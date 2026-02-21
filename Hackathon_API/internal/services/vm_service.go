package services

import (
	"context"
	"database/sql"
	"errors"
	"time"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
)

type VMService struct {
	db          *sqlx.DB
	vmRepo      *repository.VMRepository
	flavorRepo  *repository.FlavorRepository
	imageRepo   *repository.ImageRepository
	nodeRepo    *repository.NodeRepository
	// computeDrv  driver.ComputeDriver // пока не используем
}

func NewVMService(
	db *sqlx.DB,
	vmRepo *repository.VMRepository,
	flavorRepo *repository.FlavorRepository,
	imageRepo *repository.ImageRepository,
	nodeRepo *repository.NodeRepository,
	// drv driver.ComputeDriver,
) *VMService {
	return &VMService{
		db:         db,
		vmRepo:     vmRepo,
		flavorRepo: flavorRepo,
		imageRepo:  imageRepo,
		nodeRepo:   nodeRepo,
		// computeDrv: drv,
	}
}

// CreateVM создаёт запись VM в БД со статусом "pending".
func (s *VMService) CreateVM(ctx context.Context, req *models.CreateVMRequest) (*models.VirtualMachine, error) {
	// Проверяем существование flavor и image (опционально)
	if _, err := s.flavorRepo.GetByID(ctx, req.FlavorID); err != nil {
		return nil, errors.New("flavor not found")
	}
	if _, err := s.imageRepo.GetByID(ctx, req.ImageID); err != nil {
		return nil, errors.New("image not found")
	}

	vm := &models.VirtualMachine{
		ID:        uuid.New(),
		Name:      req.Name,
		ProjectID: req.ProjectID,
		FlavorID:  req.FlavorID,
		ImageID:   req.ImageID,
		Status:    "pending",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Начинаем транзакцию
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if err := s.vmRepo.Create(ctx, tx, vm); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return vm, nil
}

// ListVMs возвращает список VM. Если projectID == uuid.Nil, возвращает все VM.
func (s *VMService) ListVMs(ctx context.Context, projectID uuid.UUID) ([]models.VirtualMachine, error) {
	return s.vmRepo.List(ctx, projectID)
}

// GetVM возвращает VM по ID.
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

// DeleteVM удаляет запись VM (реальный контейнер пока не трогаем).
func (s *VMService) DeleteVM(ctx context.Context, id uuid.UUID) error {
	// TODO: перед удалением нужно остановить и удалить контейнер, но пока просто удаляем запись
	return s.vmRepo.Delete(ctx, id)
}

// StartVM меняет статус на "pending-start" (запуск будет обработан воркером).
func (s *VMService) StartVM(ctx context.Context, id uuid.UUID) error {
	// Проверим, что VM существует
	vm, err := s.vmRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if vm == nil {
		return errors.New("vm not found")
	}
	// Можно проверить текущий статус (например, только stopped можно запустить)
	if vm.Status != "stopped" && vm.Status != "error" {
		return errors.New("vm cannot be started from current status")
	}
	return s.vmRepo.UpdateStatus(ctx, id, "pending-start")
}

// StopVM меняет статус на "pending-stop" (остановка будет обработана воркером).
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
	return s.vmRepo.UpdateStatus(ctx, id, "pending-stop")
}