package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type FileStorageRepository struct {
	db *sqlx.DB
}

func NewFileStorageRepository(db *sqlx.DB) *FileStorageRepository {
	return &FileStorageRepository{db: db}
}

func (r *FileStorageRepository) Create(ctx context.Context, tx *sqlx.Tx, fs *models.FileStorage) error {
	_, err := tx.ExecContext(ctx,
		`INSERT INTO file_storages (id, name, project_id, flavor_id, status)
		 VALUES ($1, $2, $3, $4, $5)`,
		fs.ID, fs.Name, fs.ProjectID, fs.FlavorID, fs.Status,
	)
	return err
}

func (r *FileStorageRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.FileStorage, error) {
	var fs models.FileStorage
	err := r.db.GetContext(ctx, &fs,
		`SELECT id, name, project_id, flavor_id, status, docker_container_id, node_id,
		        volume_name, nfs_endpoint, size_gb, created_at, updated_at
		 FROM file_storages WHERE id = $1`, id,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &fs, err
}

func (r *FileStorageRepository) List(ctx context.Context, projectID uuid.UUID) ([]models.FileStorage, error) {
	var storages []models.FileStorage
	var err error

	const cols = `id, name, project_id, flavor_id, status, docker_container_id, node_id,
	              volume_name, nfs_endpoint, size_gb, created_at, updated_at`

	if projectID == uuid.Nil {
		err = r.db.SelectContext(ctx, &storages,
			`SELECT `+cols+` FROM file_storages WHERE status != 'deleted' ORDER BY created_at DESC`,
		)
	} else {
		err = r.db.SelectContext(ctx, &storages,
			`SELECT `+cols+` FROM file_storages WHERE project_id = $1 AND status != 'deleted' ORDER BY created_at DESC`,
			projectID,
		)
	}
	return storages, err
}

func (r *FileStorageRepository) UpdateAfterCreate(ctx context.Context, tx *sqlx.Tx, id uuid.UUID,
	containerID string, nodeID uuid.UUID, volumeName, nfsEndpoint string, sizeGB int) error {
	_, err := tx.ExecContext(ctx, `
		UPDATE file_storages SET
			status              = 'running',
			docker_container_id = $2,
			node_id             = $3,
			volume_name         = $4,
			nfs_endpoint        = $5,
			size_gb             = $6,
			updated_at          = NOW()
		WHERE id = $1`,
		id, containerID, nodeID, volumeName, nfsEndpoint, sizeGB,
	)
	return err
}

func (r *FileStorageRepository) GetPendingForUpdate(ctx context.Context, tx *sqlx.Tx) ([]models.FileStorage, error) {
	var storages []models.FileStorage
	err := tx.SelectContext(ctx, &storages,
		`SELECT id, name, project_id, flavor_id, status, docker_container_id, node_id,
		        volume_name, nfs_endpoint, size_gb, created_at, updated_at
		 FROM file_storages WHERE status IN ('pending', 'pending-start', 'pending-stop')
		 FOR UPDATE SKIP LOCKED LIMIT 5`,
	)
	return storages, err
}

func (r *FileStorageRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE file_storages SET status = $1, updated_at = NOW() WHERE id = $2`,
		status, id,
	)
	return err
}

func (r *FileStorageRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE file_storages SET status = 'deleted', updated_at = NOW() WHERE id = $1`,
		id,
	)
	return err
}