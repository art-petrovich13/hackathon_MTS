package models

import (
	"time"
	"github.com/google/uuid"
)

// User - пользователь системы
type User struct {
	ID           uuid.UUID `db:"id"          json:"id"`
	Email        string    `db:"email"       json:"email"`
	PasswordHash string    `db:"password_hash" json:"password_hash"` // json:"-"
	CreatedAt    time.Time `db:"created_at"  json:"created_at"`
}