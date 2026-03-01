package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type ObjectStorageRepository struct {
	db *sqlx.DB
}

func NewObjectStorageRepository(db *sqlx.DB) *ObjectStorageRepository {
	return &ObjectStorageRepository{db: db}
}

func (r *ObjectStorageRepository) Create(ctx context.Context, tx *sqlx.Tx, os *models.ObjectStorage) error {
	_, err := tx.ExecContext(ctx,
		`INSERT INTO object_storages
		 (id, name, project_id, flavor_id, status, bucket_name, storage_limit_gb)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		os.ID, os.Name, os.ProjectID, os.FlavorID, os.Status, os.BucketName, os.StorageLimitGB,
	)
	return err
}

func (r *ObjectStorageRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.ObjectStorage, error) {
	var os models.ObjectStorage
	err := r.db.GetContext(ctx, &os,
		`SELECT id, name, project_id, flavor_id, status, docker_container_id, node_id,
		        s3_endpoint, console_endpoint, access_key, secret_key, bucket_name,
		        storage_limit_gb, created_at, updated_at
		 FROM object_storages WHERE id = $1`, id,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &os, err
}

func (r *ObjectStorageRepository) List(ctx context.Context, projectID uuid.UUID) ([]models.ObjectStorage, error) {
	var storages []models.ObjectStorage
	var err error

	const cols = `id, name, project_id, flavor_id, status, docker_container_id, node_id,
	              s3_endpoint, console_endpoint, access_key, secret_key, bucket_name,
	              storage_limit_gb, created_at, updated_at`

	if projectID == uuid.Nil {
		err = r.db.SelectContext(ctx, &storages,
			`SELECT `+cols+` FROM object_storages WHERE status != 'deleted' ORDER BY created_at DESC`,
		)
	} else {
		err = r.db.SelectContext(ctx, &storages,
			`SELECT `+cols+` FROM object_storages WHERE project_id = $1 AND status != 'deleted' ORDER BY created_at DESC`,
			projectID,
		)
	}
	return storages, err
}

func (r *ObjectStorageRepository) UpdateAfterCreate(ctx context.Context, tx *sqlx.Tx, id uuid.UUID,
	containerID string, nodeID uuid.UUID, s3Endpoint, consoleEndpoint, accessKey, secretKey string) error {
	_, err := tx.ExecContext(ctx, `
		UPDATE object_storages SET
			status           = 'running',
			docker_container_id = $2,
			node_id          = $3,
			s3_endpoint      = $4,
			console_endpoint = $5,
			access_key       = $6,
			secret_key       = $7,
			updated_at       = NOW()
		WHERE id = $1`,
		id, containerID, nodeID, s3Endpoint, consoleEndpoint, accessKey, secretKey,
	)
	return err
}

func (r *ObjectStorageRepository) GetPendingForUpdate(ctx context.Context, tx *sqlx.Tx) ([]models.ObjectStorage, error) {
	var storages []models.ObjectStorage
	err := tx.SelectContext(ctx, &storages,
		`SELECT id, name, project_id, flavor_id, status, docker_container_id, node_id,
		        s3_endpoint, console_endpoint, access_key, secret_key, bucket_name,
		        storage_limit_gb, created_at, updated_at
		 FROM object_storages WHERE status = 'pending'
		 FOR UPDATE SKIP LOCKED LIMIT 5`,
	)
	return storages, err
}

func (r *ObjectStorageRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE object_storages SET status = $1, updated_at = NOW() WHERE id = $2`,
		status, id,
	)
	return err
}

func (r *ObjectStorageRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE object_storages SET status = 'deleted', updated_at = NOW() WHERE id = $1`,
		id,
	)
	return err
}