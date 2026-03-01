package repository

import (
	"context"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/jmoiron/sqlx"
)

type ServiceCatalogRepository struct {
	db *sqlx.DB
}

func NewServiceCatalogRepository(db *sqlx.DB) *ServiceCatalogRepository {
	return &ServiceCatalogRepository{db: db}
}

// List возвращает все доступные сервисы каталога.
func (r *ServiceCatalogRepository) List(ctx context.Context) ([]models.ServiceCatalog, error) {
	var catalog []models.ServiceCatalog
	err := r.db.SelectContext(ctx, &catalog,
		`SELECT id, name, type, description, icon, is_available, created_at
		 FROM service_catalog WHERE is_available = true ORDER BY name`,
	)
	return catalog, err
}