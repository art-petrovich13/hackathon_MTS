package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type UserRepository struct {
	db *sqlx.DB
}

func NewUserRepository(db *sqlx.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, tx *sqlx.Tx, user *models.User) error {
	query := `INSERT INTO users (id, email, password_hash, role, created_at)
	          VALUES ($1, $2, $3, $4, $5)`
	var err error
	if tx != nil {
		_, err = tx.ExecContext(ctx, query, user.ID, user.Email, user.PasswordHash, user.Role, user.CreatedAt)
	} else {
		_, err = r.db.ExecContext(ctx, query, user.ID, user.Email, user.PasswordHash, user.Role, user.CreatedAt)
	}
	return err
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var user models.User
	query := `SELECT id, email, password_hash, role, created_at FROM users WHERE id = $1`
	err := r.db.GetContext(ctx, &user, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &user, err
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	query := `SELECT id, email, password_hash, role, created_at FROM users WHERE email = $1`
	err := r.db.GetContext(ctx, &user, query, email)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &user, err
}

// List возвращает всех пользователей (только для admin)
func (r *UserRepository) List(ctx context.Context) ([]models.User, error) {
	var users []models.User
	err := r.db.SelectContext(ctx, &users,
		`SELECT id, email, role, created_at FROM users ORDER BY created_at DESC`)
	return users, err
}

// Delete удаляет пользователя по ID
func (r *UserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}
