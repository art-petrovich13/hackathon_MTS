package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type ProjectLimitRepository struct {
	db *sqlx.DB
}

func NewProjectLimitRepository(db *sqlx.DB) *ProjectLimitRepository {
	return &ProjectLimitRepository{db: db}
}

func (r *ProjectLimitRepository) GetByProjectID(ctx context.Context, projectID uuid.UUID) (*models.ProjectLimit, error) {
	var limit models.ProjectLimit
	err := r.db.GetContext(ctx, &limit,
		`SELECT id, project_id, max_vms, max_cpu, max_ram_mb, max_disk_gb,
		        max_dbs, max_storages, max_mobile, created_at, updated_at
		 FROM project_limits WHERE project_id = $1`, projectID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &limit, err
}

func (r *ProjectLimitRepository) Create(ctx context.Context, limit *models.ProjectLimit) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO project_limits
		 (id, project_id, max_vms, max_cpu, max_ram_mb, max_disk_gb, max_dbs, max_storages, max_mobile)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		limit.ID, limit.ProjectID, limit.MaxVMs, limit.MaxCPU, limit.MaxRAMMB,
		limit.MaxDiskGB, limit.MaxDBs, limit.MaxStorages, limit.MaxMobile,
	)
	return err
}

// Upsert — создаёт или обновляет лимиты (если запись уже есть — перезаписывает)
func (r *ProjectLimitRepository) Upsert(ctx context.Context, limit *models.ProjectLimit) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO project_limits
		 (id, project_id, max_vms, max_cpu, max_ram_mb, max_disk_gb, max_dbs, max_storages, max_mobile)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (project_id) DO UPDATE SET
		   max_vms      = EXCLUDED.max_vms,
		   max_cpu      = EXCLUDED.max_cpu,
		   max_ram_mb   = EXCLUDED.max_ram_mb,
		   max_disk_gb  = EXCLUDED.max_disk_gb,
		   max_dbs      = EXCLUDED.max_dbs,
		   max_storages = EXCLUDED.max_storages,
		   max_mobile   = EXCLUDED.max_mobile,
		   updated_at   = NOW()`,
		uuid.New(), limit.ProjectID, limit.MaxVMs, limit.MaxCPU, limit.MaxRAMMB,
		limit.MaxDiskGB, limit.MaxDBs, limit.MaxStorages, limit.MaxMobile,
	)
	return err
}
