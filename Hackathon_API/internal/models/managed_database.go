package models

import (
	"time"

	"github.com/google/uuid"
)

type ManagedDatabase struct {
	ID                uuid.UUID  `db:"id"                   json:"id"`
	Name              string     `db:"name"                 json:"name"`
	ProjectID         uuid.UUID  `db:"project_id"           json:"project_id"`
	FlavorID          uuid.UUID  `db:"flavor_id"            json:"flavor_id"`
	Engine            string     `db:"engine"               json:"engine"`         // postgres|mysql|redis
	EngineVersion     string     `db:"engine_version"       json:"engine_version"`
	Status            string     `db:"status"               json:"status"`
	DockerContainerID *string    `db:"docker_container_id"  json:"docker_container_id,omitempty"`
	NodeID            *uuid.UUID `db:"node_id"              json:"node_id,omitempty"`
	Host              *string    `db:"host"                 json:"host,omitempty"`
	Port              *int       `db:"port"                 json:"port,omitempty"`
	DBName            *string    `db:"db_name"              json:"db_name,omitempty"`
	DBUser            *string    `db:"db_user"              json:"db_user,omitempty"`
	DBPassword        *string    `db:"db_password"          json:"db_password,omitempty"`
	CreatedAt         time.Time  `db:"created_at"           json:"created_at"`
	UpdatedAt         time.Time  `db:"updated_at"           json:"updated_at"`
}

// CreateDatabaseRequest — тело запроса для POST /api/v1/databases
type CreateDatabaseRequest struct {
	Name      string    `json:"name"`
	ProjectID uuid.UUID `json:"project_id"`
	FlavorID  uuid.UUID `json:"flavor_id"`
	Engine    string    `json:"engine"`    // postgres|mysql|redis
	DBName    string    `json:"db_name"`
}