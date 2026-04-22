package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type ImageRepository struct {
	db *sqlx.DB
}

func NewImageRepository(db *sqlx.DB) *ImageRepository {
	return &ImageRepository{db: db}
}

func (r *ImageRepository) List(ctx context.Context) ([]models.Image, error) {
	var images []models.Image
	query := `SELECT id, name, docker_image, os_type, version, imported, source_url, status
	          FROM images WHERE status = 'active' ORDER BY name`
	err := r.db.SelectContext(ctx, &images, query)
	return images, err
}

func (r *ImageRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Image, error) {
	var img models.Image
	query := `SELECT id, name, docker_image, os_type, version, imported, source_url, status
	          FROM images WHERE id = $1`
	err := r.db.GetContext(ctx, &img, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &img, err
}
