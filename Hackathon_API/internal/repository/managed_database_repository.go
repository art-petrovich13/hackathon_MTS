package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type ManagedDatabaseRepository struct {
	db *sqlx.DB
}

func NewManagedDatabaseRepository(db *sqlx.DB) *ManagedDatabaseRepository {
	return &ManagedDatabaseRepository{db: db}
}

// Create вставляет новую запись в рамках транзакции.
func (r *ManagedDatabaseRepository) Create(ctx context.Context, tx *sqlx.Tx, db *models.ManagedDatabase) error {
	query := `INSERT INTO managed_databases
		(id, name, project_id, flavor_id, engine, engine_version, status, db_name)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := tx.ExecContext(ctx, query,
		db.ID, db.Name, db.ProjectID, db.FlavorID,
		db.Engine, db.EngineVersion, db.Status, db.DBName,
	)
	return err
}

// GetByID возвращает запись по ID. Возвращает (nil, nil) если не найдена.
func (r *ManagedDatabaseRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.ManagedDatabase, error) {
	var db models.ManagedDatabase
	err := r.db.GetContext(ctx, &db,
		`SELECT id, name, project_id, flavor_id, engine, engine_version, status,
		        docker_container_id, node_id, host, port, db_name, db_user, db_password,
		        created_at, updated_at
		 FROM managed_databases WHERE id = $1`, id,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &db, err
}

// List возвращает список БД. Если projectID == uuid.Nil — возвращает все (admin).
func (r *ManagedDatabaseRepository) List(ctx context.Context, projectID uuid.UUID) ([]models.ManagedDatabase, error) {
	var dbs []models.ManagedDatabase
	var err error

	const cols = `id, name, project_id, flavor_id, engine, engine_version, status,
	              docker_container_id, node_id, host, port, db_name, db_user, db_password,
	              created_at, updated_at`

	if projectID == uuid.Nil {
		err = r.db.SelectContext(ctx, &dbs,
			`SELECT `+cols+` FROM managed_databases WHERE status != 'deleted' ORDER BY created_at DESC`,
		)
	} else {
		err = r.db.SelectContext(ctx, &dbs,
			`SELECT `+cols+` FROM managed_databases WHERE project_id = $1 AND status != 'deleted' ORDER BY created_at DESC`,
			projectID,
		)
	}
	return dbs, err
}

// UpdateStatus обновляет только статус записи.
func (r *ManagedDatabaseRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE managed_databases SET status = $1, updated_at = NOW() WHERE id = $2`,
		status, id,
	)
	return err
}

// UpdateAfterCreate заполняет поля после успешного создания контейнера (вызывается воркером).
func (r *ManagedDatabaseRepository) UpdateAfterCreate(ctx context.Context, tx *sqlx.Tx, id uuid.UUID,
	containerID string, nodeID uuid.UUID, host string, port int, dbUser, dbPassword string) error {
	_, err := tx.ExecContext(ctx, `
		UPDATE managed_databases SET
			status              = 'running',
			docker_container_id = $2,
			node_id             = $3,
			host                = $4,
			port                = $5,
			db_user             = $6,
			db_password         = $7,
			updated_at          = NOW()
		WHERE id = $1`,
		id, containerID, nodeID, host, port, dbUser, dbPassword,
	)
	return err
}

// GetPendingForUpdate выбирает до 5 pending записей и блокирует их строки.
// Вызывать ВНУТРИ транзакции.
func (r *ManagedDatabaseRepository) GetPendingForUpdate(ctx context.Context, tx *sqlx.Tx) ([]models.ManagedDatabase, error) {
	var dbs []models.ManagedDatabase
	err := tx.SelectContext(ctx, &dbs,
		`SELECT id, name, project_id, flavor_id, engine, engine_version, status,
		        docker_container_id, node_id, host, port, db_name, db_user, db_password,
		        created_at, updated_at
		 FROM managed_databases WHERE status IN ('pending', 'pending-start', 'pending-stop')
		 FOR UPDATE SKIP LOCKED LIMIT 5`,
	)
	return dbs, err
}

// Delete помечает запись как удалённую (soft delete).
func (r *ManagedDatabaseRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE managed_databases SET status = 'deleted', updated_at = NOW() WHERE id = $1`,
		id,
	)
	return err
}