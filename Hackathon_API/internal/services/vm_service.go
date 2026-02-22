// internal/services/vm_service.go
package services

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/art-petrovich13/hackathon_MTS/internal/compute/driver" // путь к твоему модулю
	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
)

type VMService struct {
	db         *sqlx.DB
	vmRepo     *repository.VMRepository
	flavorRepo *repository.FlavorRepository
	imageRepo  *repository.ImageRepository
	nodeRepo   *repository.NodeRepository
	computeDrv driver.ComputeDriver // добавляем драйвер
}

// NewVMService теперь принимает драйвер
func NewVMService(
	db *sqlx.DB,
	vmRepo *repository.VMRepository,
	flavorRepo *repository.FlavorRepository,
	imageRepo *repository.ImageRepository,
	nodeRepo *repository.NodeRepository,
	drv driver.ComputeDriver,
) *VMService {
	return &VMService{
		db:         db,
		vmRepo:     vmRepo,
		flavorRepo: flavorRepo,
		imageRepo:  imageRepo,
		nodeRepo:   nodeRepo,
		computeDrv: drv,
	}
}

// CreateVM создаёт VM синхронно: запись в БД + вызов драйвера + резервирование ресурсов.
func (s *VMService) CreateVM(ctx context.Context, req *models.CreateVMRequest) (*models.VirtualMachine, error) {
	// 1. Получаем flavor и image
	flavor, err := s.flavorRepo.GetByID(ctx, req.FlavorID)
	if err != nil {
		return nil, errors.New("flavor not found")
	}
	image, err := s.imageRepo.GetByID(ctx, req.ImageID)
	if err != nil {
		return nil, errors.New("image not found")
	}

	// 2. Создаём объект VM со статусом "pending"
	now := time.Now()
	vm := &models.VirtualMachine{
		ID:        uuid.New(),
		Name:      req.Name,
		ProjectID: req.ProjectID,
		FlavorID:  req.FlavorID,
		ImageID:   req.ImageID,
		Status:    "pending",
		CreatedAt: now,
		UpdatedAt: now,
	}

	// 3. Транзакция T1: сохраняем запись в БД
	tx1, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	if err := s.vmRepo.Create(ctx, tx1, vm); err != nil {
		tx1.Rollback()
		return nil, err
	}
	if err := tx1.Commit(); err != nil {
		return nil, err
	}

	// 4. Ищем подходящий узел (без транзакции, т.к. после коммита)
	node, err := s.nodeRepo.FindSuitableNode(ctx, nil, flavor.CPU, flavor.RAMMB)
	if err != nil {
		// Не удалось найти узел → помечаем VM как ошибочную
		_ = s.vmRepo.UpdateStatus(ctx, vm.ID, "error")
		return nil, errors.New("no suitable node found")
	}
	if node == nil {
		_ = s.vmRepo.UpdateStatus(ctx, vm.ID, "error")
		return nil, errors.New("no suitable node available")
	}

	// 5. Вызываем драйвер для создания контейнера
	instance, err := s.computeDrv.CreateVM(ctx, &driver.CreateVMOpts{
		Name:      vm.Name,
		CPU:       flavor.CPU,
		RAMMB:     flavor.RAMMB,
		ImageName: image.DockerImage,
	})
	if err != nil {
		// Ошибка драйвера → статус error
		_ = s.vmRepo.UpdateStatus(ctx, vm.ID, "error")
		return nil, err
	}

	// 6. Транзакция T2: резервируем ресурсы и обновляем VM
	tx2, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		// Если транзакция не началась, контейнер уже создан – нужно почистить?
		// Упрощённо: помечаем error и пробуем удалить контейнер
		_ = s.vmRepo.UpdateStatus(ctx, vm.ID, "error")
		_ = s.computeDrv.DeleteVM(ctx, instance.ID)
		return nil, err
	}
	defer tx2.Rollback()

	// Резервируем ресурсы узла (уменьшаем свободные)
	if err := s.nodeRepo.UpdateResources(ctx, tx2, node.ID, -flavor.CPU, -flavor.RAMMB); err != nil {
		// Не удалось зарезервировать – удаляем контейнер и помечаем error
		_ = s.computeDrv.DeleteVM(ctx, instance.ID)
		_ = s.vmRepo.UpdateStatus(ctx, vm.ID, "error")
		return nil, err
	}

	// Обновляем запись VM: container_id, ip, node_id, статус running
	vm.DockerContainerID = &instance.ID
	vm.IPAddress = &instance.IPAddress
	vm.NodeID = &node.ID
	vm.Status = "running"
	vm.UpdatedAt = time.Now()

	if err := s.vmRepo.Update(ctx, tx2, vm); err != nil {
		// Если не смогли обновить запись, нужно откатить резервирование и удалить контейнер
		_ = s.nodeRepo.UpdateResources(ctx, tx2, node.ID, flavor.CPU, flavor.RAMMB) // возвращаем ресурсы
		_ = s.computeDrv.DeleteVM(ctx, instance.ID)
		return nil, err
	}

	if err := tx2.Commit(); err != nil {
		// Ошибка коммита – контейнер уже создан, ресурсы зарезервированы в памяти, но не в БД – рассинхрон
		// В реальном проекте нужны компенсирующие действия, упростим – удаляем контейнер и возвращаем ресурсы
		_ = s.computeDrv.DeleteVM(ctx, instance.ID)
		_ = s.nodeRepo.UpdateResources(ctx, nil, node.ID, flavor.CPU, flavor.RAMMB) // вне транзакции
		_ = s.vmRepo.UpdateStatus(ctx, vm.ID, "error")
		return nil, errors.New("failed to commit transaction")
	}

	return vm, nil
}

// StartVM запускает существующую остановленную VM.
func (s *VMService) StartVM(ctx context.Context, id uuid.UUID) error {
	// Получаем VM
	vm, err := s.vmRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if vm == nil {
		return errors.New("vm not found")
	}
	if vm.Status != "stopped" && vm.Status != "error" {
		return errors.New("vm cannot be started from current status")
	}
	if vm.DockerContainerID == nil || vm.NodeID == nil {
		return errors.New("vm has no associated container or node")
	}

	// Получаем flavor для ресурсов
	flavor, err := s.flavorRepo.GetByID(ctx, vm.FlavorID)
	if err != nil {
		return err
	}

	// Проверяем, достаточно ли ресурсов на узле (они должны быть свободны после остановки)
	// Для этого найдём узел и проверим (можно использовать FindSuitableNode)
	node, err := s.nodeRepo.GetByID(ctx, *vm.NodeID)
	if err != nil {
		return err
	}
	if node == nil {
		return errors.New("node not found")
	}

	// Если ресурсы на узле уже заняты другими VM, теоретически их может не хватить.
	// Но поскольку мы резервируем ресурсы при старте, нужно убедиться, что свободно достаточно.
	// Для простоты предполагаем, что после остановки ресурсы освободились, и мы их снова зарезервируем.
	// Можно пропустить проверку и сразу резервировать.

	// Вызываем драйвер для запуска контейнера
	if err := s.computeDrv.StartVM(ctx, *vm.DockerContainerID); err != nil {
		_ = s.vmRepo.UpdateStatus(ctx, id, "error")
		return err
	}

	// Транзакция: резервируем ресурсы и меняем статус
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		// Контейнер запущен, но не смогли обновить БД – нужно остановить?
		_ = s.computeDrv.StopVM(ctx, *vm.DockerContainerID)
		_ = s.vmRepo.UpdateStatus(ctx, id, "error")
		return err
	}
	defer tx.Rollback()

	// Резервируем ресурсы (уменьшаем free)
	if err := s.nodeRepo.UpdateResources(ctx, tx, node.ID, -flavor.CPU, -flavor.RAMMB); err != nil {
		_ = s.computeDrv.StopVM(ctx, *vm.DockerContainerID)
		_ = s.vmRepo.UpdateStatus(ctx, id, "error")
		return err
	}

	// Обновляем статус VM
	if err := s.vmRepo.UpdateStatus(ctx, id, "running"); err != nil {
		// Возвращаем ресурсы
		_ = s.nodeRepo.UpdateResources(ctx, tx, node.ID, flavor.CPU, flavor.RAMMB)
		_ = s.computeDrv.StopVM(ctx, *vm.DockerContainerID)
		return err
	}

	return tx.Commit()
}

// StopVM останавливает работающую VM и освобождает ресурсы.
func (s *VMService) StopVM(ctx context.Context, id uuid.UUID) error {
	vm, err := s.vmRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if vm == nil {
		return errors.New("vm not found")
	}
	if vm.Status != "running" {
		return errors.New("vm is not running")
	}
	if vm.DockerContainerID == nil || vm.NodeID == nil {
		return errors.New("vm has no associated container or node")
	}

	flavor, err := s.flavorRepo.GetByID(ctx, vm.FlavorID)
	if err != nil {
		return err
	}

	// Вызываем драйвер для остановки контейнера
	if err := s.computeDrv.StopVM(ctx, *vm.DockerContainerID); err != nil {
		_ = s.vmRepo.UpdateStatus(ctx, id, "error")
		return err
	}

	// Транзакция: освобождаем ресурсы и меняем статус
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		_ = s.vmRepo.UpdateStatus(ctx, id, "error")
		return err
	}
	defer tx.Rollback()

	// Освобождаем ресурсы (увеличиваем free)
	if err := s.nodeRepo.UpdateResources(ctx, tx, *vm.NodeID, flavor.CPU, flavor.RAMMB); err != nil {
		_ = s.vmRepo.UpdateStatus(ctx, id, "error")
		return err
	}

	if err := s.vmRepo.UpdateStatus(ctx, id, "stopped"); err != nil {
		// Возвращаем ресурсы (снова уменьшаем) – сложно, упростим: оставляем как есть и логируем
		_ = s.nodeRepo.UpdateResources(ctx, tx, *vm.NodeID, -flavor.CPU, -flavor.RAMMB)
		return err
	}

	return tx.Commit()
}

// DeleteVM полностью удаляет VM: контейнер, запись в БД, освобождает ресурсы.
func (s *VMService) DeleteVM(ctx context.Context, id uuid.UUID) error {
	vm, err := s.vmRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if vm == nil {
		return nil // уже удалена
	}

	// Если есть контейнер, удаляем его через драйвер
	if vm.DockerContainerID != nil {
		if err := s.computeDrv.DeleteVM(ctx, *vm.DockerContainerID); err != nil {
			// Логируем ошибку, но пытаемся продолжить
			// Можно вернуть ошибку, но для простоты пробуем удалить запись
		}
	}

	// Освобождаем ресурсы, если VM была запущена или остановлена (ресурсы могли быть зарезервированы)
	if vm.NodeID != nil && (vm.Status == "running" || vm.Status == "stopped") {
		flavor, err := s.flavorRepo.GetByID(ctx, vm.FlavorID)
		if err == nil {
			// Возвращаем ресурсы (если VM была запущена, они были заняты; если остановлена – тоже заняты диском? по нашей модели disk не учитываем)
			// Для упрощения считаем, что при любом статусе, кроме error, ресурсы были зарезервированы.
			_ = s.nodeRepo.UpdateResources(ctx, nil, *vm.NodeID, flavor.CPU, flavor.RAMMB)
		}
	}

	// Удаляем запись из БД
	return s.vmRepo.Delete(ctx, id)
}

// ListVMs и GetVM остаются без изменений
func (s *VMService) ListVMs(ctx context.Context, projectID uuid.UUID) ([]models.VirtualMachine, error) {
	return s.vmRepo.List(ctx, projectID)
}

func (s *VMService) GetVM(ctx context.Context, id uuid.UUID) (*models.VirtualMachine, error) {
	vm, err := s.vmRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if vm == nil {
		return nil, sql.ErrNoRows
	}
	return vm, nil
}
