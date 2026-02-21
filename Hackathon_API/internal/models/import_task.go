package models

import (
	"time"
	"github.com/google/uuid"
)

// ImportTask - процесс загрузки образа по URL
type ImportTask struct {
	ID           uuid.UUID  `db:"id"            json:"id"`
	URL          string     `db:"url"           json:"url"`
	ImageName    string     `db:"image_name"    json:"image_name"`
	OSType       *string    `db:"os_type"       json:"os_type,omitempty"`
	Version      *string    `db:"version"       json:"version,omitempty"`
	Status       string     `db:"status"        json:"status"` // pending, downloading, importing, done, error
	ImageID      *uuid.UUID `db:"image_id"      json:"image_id,omitempty"`
	ErrorMessage *string    `db:"error_message" json:"error_message,omitempty"`
	CreatedAt    time.Time  `db:"created_at"    json:"created_at"`
}