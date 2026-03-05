// internal/services/vm_service.go
package services

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/art-petrovich13/hackathon_MTS/internal/compute/driver"
	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
)

type VMService struct {
	db         *sqlx.DB
	vmRepo     *repository.VMRepository
	flavorRepo *repository.FlavorRepository
	imageRepo  *repository.ImageRepository
	nodeRepo   *repository.NodeRepository
	computeDrv driver.ComputeDriver
}

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

// ──────────────────────────────────────────────────────────────────────────────
// CreateVM — сохраняет запись в БД со статусом "pending" и сразу возвращает её.
// Воркер подхватит задачу, создаст контейнер и сменит статус на "running".
// ──────────────────────────────────────────────────────────────────────────────
func (s *VMService) CreateVM(ctx context.Context, req *models.CreateVMRequest) (*models.VirtualMachine, error) {
	// Проверяем, что flavor и image существуют — чтобы не создавать "мусорную" VM,
	// которую воркер всё равно не сможет обработать.
	if _, err := s.flavorRepo.GetByID(ctx, req.FlavorID); err != nil {
		return nil, errors.New("flavor not found")
	}
	if _, err := s.imageRepo.GetByID(ctx, req.ImageID); err != nil {
		return nil, errors.New("image not found")
	}

	now := time.Now()
	vm := &models.VirtualMachine{
		ID:        uuid.New(),
		Name:      req.Name,
		ProjectID: req.ProjectID,
		FlavorID:  req.FlavorID,
		ImageID:   req.ImageID,
		Status:    "pending", // воркер увидит этот статус и запустит контейнер
		CreatedAt: now,
		UpdatedAt: now,
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback() //nolint:errcheck

	if err := s.vmRepo.Create(ctx, tx, vm); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	slog.Info("vm queued for creation", "vm_id", vm.ID, "name", vm.Name)
	return vm, nil
}

// ──────────────────────────────────────────────────────────────────────────────
// StartVM — ставит статус "pending-start".
// Воркер подхватит и запустит контейнер через Docker API.
// ──────────────────────────────────────────────────────────────────────────────
func (s *VMService) StartVM(ctx context.Context, id uuid.UUID) error {
	vm, err := s.vmRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if vm == nil {
		return errors.New("vm not found")
	}

	// Запускать можно только остановленную VM.
	// Статус "error" тоже разрешаем — даём шанс на повтор.
	if vm.Status != "stopped" && vm.Status != "error" {
		return errors.New("vm can only be started from 'stopped' or 'error' status, current: " + vm.Status)
	}
	if vm.DockerContainerID == nil {
		return errors.New("vm has no associated container (was it ever created?)")
	}

	slog.Info("vm queued for start", "vm_id", id)
	return s.vmRepo.UpdateStatus(ctx, id, "pending-start")
}

// ──────────────────────────────────────────────────────────────────────────────
// StopVM — ставит статус "pending-stop".
// Воркер подхватит, остановит контейнер и освободит ресурсы узла.
// ──────────────────────────────────────────────────────────────────────────────
func (s *VMService) StopVM(ctx context.Context, id uuid.UUID) error {
	vm, err := s.vmRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if vm == nil {
		return errors.New("vm not found")
	}

	if vm.Status != "running" {
		return errors.New("vm is not running, current status: " + vm.Status)
	}
	if vm.DockerContainerID == nil {
		return errors.New("vm has no associated container")
	}

	slog.Info("vm queued for stop", "vm_id", id)
	return s.vmRepo.UpdateStatus(ctx, id, "pending-stop")
}

// ──────────────────────────────────────────────────────────────────────────────
// DeleteVM — синхронное удаление: сразу удаляет контейнер и запись в БД.
// Оставляем синхронным — пользователь должен получить подтверждение сразу,
// а операция удаления не требует долгого ожидания.
// ──────────────────────────────────────────────────────────────────────────────
func (s *VMService) DeleteVM(ctx context.Context, id uuid.UUID) error {
	vm, err := s.vmRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if vm == nil {
		return nil // уже удалена — идемпотентно
	}

	// Нельзя удалять VM, которую в данный момент обрабатывает воркер.
	switch vm.Status {
	case "pending", "pending-start", "pending-stop", "creating":
		return errors.New("vm is being processed, wait for it to reach a stable status")
	}

	// Удаляем контейнер через драйвер (Force: true — убьёт даже запущенный).
	if vm.DockerContainerID != nil {
		if err := s.computeDrv.DeleteVM(ctx, *vm.DockerContainerID); err != nil {
			// Логируем, но не прерываем — запись в БД всё равно удалим.
			// Контейнер мог уже не существовать (например, удалён вручную).
			slog.Warn("failed to delete docker container, proceeding with db cleanup",
				"vm_id", id,
				"container_id", *vm.DockerContainerID,
				"error", err,
			)
		}
	}

	// Освобождаем ресурсы узла, если VM занимала их (статус running или stopped).
	if vm.NodeID != nil && vm.Status != "pending" && vm.Status != "creating" {
		flavor, err := s.flavorRepo.GetByID(ctx, vm.FlavorID)
		if err == nil {
			if err := s.nodeRepo.UpdateResources(ctx, nil, *vm.NodeID, flavor.CPU, flavor.RAMMB); err != nil {
				slog.Warn("failed to restore node resources on delete",
					"vm_id", id,
					"node_id", *vm.NodeID,
					"error", err,
				)
			}
		}
	}

	slog.Info("vm deleted", "vm_id", id)
	return s.vmRepo.Delete(ctx, id)
}

// ──────────────────────────────────────────────────────────────────────────────
// ListVMs — список VM проекта.
// ──────────────────────────────────────────────────────────────────────────────
func (s *VMService) ListVMs(ctx context.Context, projectID uuid.UUID) ([]models.VirtualMachine, error) {
	return s.vmRepo.List(ctx, projectID)
}

// ──────────────────────────────────────────────────────────────────────────────
// GetVM — получить одну VM по ID.
// ──────────────────────────────────────────────────────────────────────────────
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
