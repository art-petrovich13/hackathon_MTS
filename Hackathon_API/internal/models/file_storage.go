package models

import (
	"time"

	"github.com/google/uuid"
)

type FileStorage struct {
	ID                uuid.UUID  `db:"id"                   json:"id"`
	Name              string     `db:"name"                 json:"name"`
	ProjectID         uuid.UUID  `db:"project_id"           json:"project_id"`
	FlavorID          uuid.UUID  `db:"flavor_id"            json:"flavor_id"`
	Status            string     `db:"status"               json:"status"`
	DockerContainerID *string    `db:"docker_container_id"  json:"docker_container_id,omitempty"`
	NodeID            *uuid.UUID `db:"node_id"              json:"node_id,omitempty"`
	VolumeName        *string    `db:"volume_name"          json:"volume_name,omitempty"`
	NFSEndpoint       *string    `db:"nfs_endpoint"         json:"nfs_endpoint,omitempty"`
	SizeGB            *int       `db:"size_gb"              json:"size_gb,omitempty"`
	CreatedAt         time.Time  `db:"created_at"           json:"created_at"`
	UpdatedAt         time.Time  `db:"updated_at"           json:"updated_at"`
}

type CreateFileStorageRequest struct {
	Name      string    `json:"name"`
	ProjectID uuid.UUID `json:"project_id"`
	FlavorID  uuid.UUID `json:"flavor_id"`
}