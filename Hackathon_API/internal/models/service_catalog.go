package models

import (
	"time"

	"github.com/google/uuid"
)

type ServiceCatalog struct {
	ID          uuid.UUID `db:"id"           json:"id"`
	Name        string    `db:"name"         json:"name"`
	Type        string    `db:"type"         json:"type"`
	Description *string   `db:"description"  json:"description,omitempty"`
	Icon        *string   `db:"icon"         json:"icon,omitempty"`
	IsAvailable bool      `db:"is_available" json:"is_available"`
	CreatedAt   time.Time `db:"created_at"   json:"created_at"`
}