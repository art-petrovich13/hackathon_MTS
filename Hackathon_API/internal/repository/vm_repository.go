package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type VMRepository struct {
	db *sqlx.DB
}

func NewVMRepository(db *sqlx.DB) *VMRepository {
	return &VMRepository{db: db}
}

// Create добавляет запись VM в БД. Обычно выполняется в транзакции.
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

// GetByID возвращает VM по ID.
func (r *VMRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.VirtualMachine, error) {
	var vm models.VirtualMachine
	query := `SELECT * FROM vms WHERE id = $1`
	err := r.db.GetContext(ctx, &vm, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &vm, err
}

// List возвращает все VM для указанного проекта. Если projectID == uuid.Nil, возвращает все VM (для админа).
func (r *VMRepository) List(ctx context.Context, projectID uuid.UUID) ([]models.VirtualMachine, error) {
	var vms []models.VirtualMachine
	var query string
	var args []interface{}
	if projectID == uuid.Nil {
		query = `SELECT * FROM vms ORDER BY created_at DESC`
	} else {
		query = `SELECT * FROM vms WHERE project_id = $1 ORDER BY created_at DESC`
		args = append(args, projectID)
	}
	err := r.db.SelectContext(ctx, &vms, query, args...)
	return vms, err
}

// UpdateStatus обновляет статус VM.
func (r *VMRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	query := `UPDATE vms SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

// UpdateVMDetails обновляет поля после успешного создания контейнера (container_id, ip, node, статус).
func (r *VMRepository) UpdateVMDetails(ctx context.Context, tx *sqlx.Tx,
	id uuid.UUID, containerID, ipAddress string, nodeID uuid.UUID) error {
	query := `UPDATE vms
	          SET docker_container_id = $1, ip_address = $2, node_id = $3, status = 'running', updated_at = NOW()
	          WHERE id = $4`
	var err error
	if tx != nil {
		_, err = tx.ExecContext(ctx, query, containerID, ipAddress, nodeID, id)
	} else {
		_, err = r.db.ExecContext(ctx, query, containerID, ipAddress, nodeID, id)
	}
	return err
}

// Delete удаляет VM (мягкое удаление не реализуем, просто DELETE).
func (r *VMRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM vms WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// GetPendingVMs возвращает все VM с указанными статусами (pending, pending-start, pending-stop) для обработки воркером.
// Использует SELECT FOR UPDATE SKIP LOCKED для безопасной работы нескольких воркеров.
func (r *VMRepository) GetPendingVMs(ctx context.Context, tx *sqlx.Tx, statuses []string, limit int) ([]models.VirtualMachine, error) {
	var vms []models.VirtualMachine
	query, args, err := sqlx.In(`SELECT * FROM vms WHERE status IN (?) FOR UPDATE SKIP LOCKED LIMIT ?`, statuses, limit)
	if err != nil {
		return nil, err
	}
	query = r.db.Rebind(query)
	if tx != nil {
		err = tx.SelectContext(ctx, &vms, query, args...)
	} else {
		err = r.db.SelectContext(ctx, &vms, query, args...)
	}
	return vms, err
}
