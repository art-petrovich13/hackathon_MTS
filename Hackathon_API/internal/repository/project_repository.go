package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type ProjectRepository struct {
	db *sqlx.DB
}

func NewProjectRepository(db *sqlx.DB) *ProjectRepository {
	return &ProjectRepository{db: db}
}

func (r *ProjectRepository) Create(ctx context.Context, tx *sqlx.Tx, project *models.Project) error {
	query := `INSERT INTO projects (id, name, user_id, created_at) VALUES ($1, $2, $3, $4)`
	var err error
	if tx != nil {
		_, err = tx.ExecContext(ctx, query, project.ID, project.Name, project.UserID, project.CreatedAt)
	} else {
		_, err = r.db.ExecContext(ctx, query, project.ID, project.Name, project.UserID, project.CreatedAt)
	}
	return err
}

func (r *ProjectRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Project, error) {
	var proj models.Project
	query := `SELECT id, name, user_id, created_at FROM projects WHERE id = $1`
	err := r.db.GetContext(ctx, &proj, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &proj, err
}

// ListByUser возвращает все проекты пользователя.
func (r *ProjectRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]models.Project, error) {
	var projects []models.Project
	query := `SELECT id, name, user_id, created_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &projects, query, userID)
	return projects, err
}
