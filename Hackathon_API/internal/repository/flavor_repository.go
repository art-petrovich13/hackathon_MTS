package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type FlavorRepository struct {
	db *sqlx.DB
}

func NewFlavorRepository(db *sqlx.DB) *FlavorRepository {
	return &FlavorRepository{db: db}
}

// List возвращает все доступные flavor'ы.
func (r *FlavorRepository) List(ctx context.Context) ([]models.Flavor, error) {
	var flavors []models.Flavor
	query := `SELECT id, name, cpu, ram_mb, disk_gb, service_type, docker_image, default_port
	          FROM flavors ORDER BY service_type, cpu, ram_mb`
	err := r.db.SelectContext(ctx, &flavors, query)
	return flavors, err
}

// ListByServiceType возвращает flavor'ы для конкретного типа сервиса.
// Если serviceType пустой — возвращает все flavor'ы (аналог List).
func (r *FlavorRepository) ListByServiceType(ctx context.Context, serviceType string) ([]models.Flavor, error) {
	var flavors []models.Flavor
	var err error
	if serviceType == "" {
		err = r.db.SelectContext(ctx, &flavors,
			`SELECT id, name, cpu, ram_mb, disk_gb, service_type, docker_image, default_port
			 FROM flavors ORDER BY service_type, cpu, ram_mb`,
		)
	} else {
		err = r.db.SelectContext(ctx, &flavors,
			`SELECT id, name, cpu, ram_mb, disk_gb, service_type, docker_image, default_port
			 FROM flavors WHERE service_type = $1 ORDER BY cpu, ram_mb`,
			serviceType,
		)
	}
	return flavors, err
}

// GetByID возвращает flavor по ID.
func (r *FlavorRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Flavor, error) {
	var flavor models.Flavor
	query := `SELECT id, name, cpu, ram_mb, disk_gb, service_type, docker_image, default_port
	          FROM flavors WHERE id = $1`
	err := r.db.GetContext(ctx, &flavor, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &flavor, err
}