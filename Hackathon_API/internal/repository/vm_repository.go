// internal/repository/vm_repository.go
package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
)

type VMRepository struct {
	db *sqlx.DB
}

func NewVMRepository(db *sqlx.DB) *VMRepository {
	return &VMRepository{db: db}
}

// Create добавляет новую VM в БД.
func (r *VMRepository) Create(ctx context.Context, tx *sqlx.Tx, vm *models.VirtualMachine) error {
	query := `INSERT INTO vms (
		id, name, project_id, flavor_id, image_id, status,
		docker_container_id, ip_address, node_id, created_at, updated_at
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`

	var err error
	if tx != nil {
		_, err = tx.ExecContext(ctx, query,
			vm.ID, vm.Name, vm.ProjectID, vm.FlavorID, vm.ImageID, vm.Status,
			vm.DockerContainerID, vm.IPAddress, vm.NodeID, vm.CreatedAt, vm.UpdatedAt)
	} else {
		_, err = r.db.ExecContext(ctx, query,
			vm.ID, vm.Name, vm.ProjectID, vm.FlavorID, vm.ImageID, vm.Status,
			vm.DockerContainerID, vm.IPAddress, vm.NodeID, vm.CreatedAt, vm.UpdatedAt)
	}
	return err
}

// Update обновляет существующую VM (полное обновление).
func (r *VMRepository) Update(ctx context.Context, tx *sqlx.Tx, vm *models.VirtualMachine) error {
	query := `UPDATE vms SET
		name                = $1,
		project_id          = $2,
		flavor_id           = $3,
		image_id            = $4,
		status              = $5,
		docker_container_id = $6,
		ip_address          = $7,
		node_id             = $8,
		updated_at          = $9
	WHERE id = $10`

	var err error
	if tx != nil {
		_, err = tx.ExecContext(ctx, query,
			vm.Name, vm.ProjectID, vm.FlavorID, vm.ImageID, vm.Status,
			vm.DockerContainerID, vm.IPAddress, vm.NodeID, vm.UpdatedAt, vm.ID)
	} else {
		_, err = r.db.ExecContext(ctx, query,
			vm.Name, vm.ProjectID, vm.FlavorID, vm.ImageID, vm.Status,
			vm.DockerContainerID, vm.IPAddress, vm.NodeID, vm.UpdatedAt, vm.ID)
	}
	return err
}

// UpdateStatus обновляет только статус VM.
func (r *VMRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	query := `UPDATE vms SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

// GetByID возвращает VM по ID.
// Возвращает (nil, nil), если запись не найдена.
func (r *VMRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.VirtualMachine, error) {
	var vm models.VirtualMachine
	query := `SELECT
		id, name, project_id, flavor_id, image_id, status,
		docker_container_id, ip_address, node_id, created_at, updated_at
	FROM vms WHERE id = $1`

	err := r.db.GetContext(ctx, &vm, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &vm, err
}

// List возвращает VM, опционально фильтруя по project_id.
// Передай uuid.Nil, чтобы получить все VM без фильтра.
func (r *VMRepository) List(ctx context.Context, projectID uuid.UUID) ([]models.VirtualMachine, error) {
	var vms []models.VirtualMachine

	var query string
	var args []interface{}

	if projectID == uuid.Nil {
		query = `SELECT
			id, name, project_id, flavor_id, image_id, status,
			docker_container_id, ip_address, node_id, created_at, updated_at
		FROM vms ORDER BY created_at DESC`
	} else {
		query = `SELECT
			id, name, project_id, flavor_id, image_id, status,
			docker_container_id, ip_address, node_id, created_at, updated_at
		FROM vms WHERE project_id = $1 ORDER BY created_at DESC`
		args = append(args, projectID)
	}

	err := r.db.SelectContext(ctx, &vms, query, args...)
	return vms, err
}

// Delete удаляет VM по ID.
func (r *VMRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM vms WHERE id = $1`, id)
	return err
}

// ── НОВЫЙ МЕТОД: нужен воркеру (День 8-9) ───────────────────────────────────

// GetPendingForUpdate выбирает до limit VM со статусами, требующими обработки,
// блокирует их строки (FOR UPDATE SKIP LOCKED) чтобы несколько воркеров
// не обработали одну и ту же VM одновременно.
//
// Метод должен вызываться ВНУТРИ открытой транзакции tx.
// Поддерживаемые статусы:
//   - "pending"       → нужно создать контейнер
//   - "pending-start" → нужно запустить контейнер
//   - "pending-stop"  → нужно остановить контейнер
func (r *VMRepository) GetPendingForUpdate(ctx context.Context, tx *sqlx.Tx, limit int) ([]models.VirtualMachine, error) {
	if limit <= 0 {
		limit = 10
	}

	var vms []models.VirtualMachine
	query := `SELECT
		id, name, project_id, flavor_id, image_id, status,
		docker_container_id, ip_address, node_id, created_at, updated_at
	FROM vms
	WHERE status IN ('pending', 'pending-start', 'pending-stop')
	ORDER BY created_at ASC
	LIMIT $1
	FOR UPDATE SKIP LOCKED`

	err := tx.SelectContext(ctx, &vms, query, limit)
	return vms, err
}