package models

import (
	"time"
	"github.com/google/uuid"
)

type VirtualMachine struct {
	ID               uuid.UUID  `db:"id"                  json:"id"`
	Name             string     `db:"name"                json:"name"`
	ProjectID        uuid.UUID  `db:"project_id"          json:"project_id"`
	FlavorID         uuid.UUID  `db:"flavor_id"           json:"flavor_id"`
	ImageID          uuid.UUID  `db:"image_id"            json:"image_id"`
	Status           string     `db:"status"              json:"status"` // pending, creating, running, stopping, stopped, error
	DockerContainerID *string   `db:"docker_container_id" json:"docker_container_id,omitempty"`
	IPAddress        *string    `db:"ip_address"          json:"ip_address,omitempty"`
	NodeID           *uuid.UUID `db:"node_id"             json:"node_id,omitempty"`
	CreatedAt        time.Time  `db:"created_at"          json:"created_at"`
	UpdatedAt        time.Time  `db:"updated_at"          json:"updated_at"`
}

// CreateVMRequest – структура для запроса создания VM для API
type CreateVMRequest struct {
	Name      string    `json:"name"`
	ProjectID uuid.UUID `json:"project_id"`
	FlavorID  uuid.UUID `json:"flavor_id"`
	ImageID   uuid.UUID `json:"image_id"`
}