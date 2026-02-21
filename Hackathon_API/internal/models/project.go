package models

import (
	"time"
	"github.com/google/uuid"
)

// Project - проект пользователя (группа виртуальных машин)
type Project struct {
	ID        uuid.UUID `db:"id"         json:"id"`
	Name      string    `db:"name"       json:"name"`
	UserID    uuid.UUID `db:"user_id"    json:"user_id"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}