package models

import (
	"time"
	"github.com/google/uuid"
)

// Snapshot - сохранённое состояние VM
type Snapshot struct {
	ID              uuid.UUID  `db:"id"                 json:"id"`
	VMID            uuid.UUID  `db:"vm_id"              json:"vm_id"`
	Name            string     `db:"name"               json:"name"`
	DockerImageName *string    `db:"docker_image_name"  json:"docker_image_name,omitempty"`
	SizeMB          *int       `db:"size_mb"            json:"size_mb,omitempty"`
	Status          string     `db:"status"             json:"status"` // creating, available, error
	CreatedAt       time.Time  `db:"created_at"         json:"created_at"`
}