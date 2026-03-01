package models

import (
	"time"

	"github.com/google/uuid"
)

type MobileDevice struct {
	ID                uuid.UUID  `db:"id"                   json:"id"`
	Name              string     `db:"name"                 json:"name"`
	ProjectID         uuid.UUID  `db:"project_id"           json:"project_id"`
	FlavorID          uuid.UUID  `db:"flavor_id"            json:"flavor_id"`
	DeviceType        string     `db:"device_type"          json:"device_type"` // android
	OSVersion         string     `db:"os_version"           json:"os_version"`
	Status            string     `db:"status"               json:"status"`
	DockerContainerID *string    `db:"docker_container_id"  json:"docker_container_id,omitempty"`
	NodeID            *uuid.UUID `db:"node_id"              json:"node_id,omitempty"`
	ADBHost           *string    `db:"adb_host"             json:"adb_host,omitempty"`
	ADBPort           *int       `db:"adb_port"             json:"adb_port,omitempty"`
	VNCPort           *int       `db:"vnc_port"             json:"vnc_port,omitempty"`
	NoVNCPort         *int       `db:"novnc_port"           json:"novnc_port,omitempty"`
	CreatedAt         time.Time  `db:"created_at"           json:"created_at"`
	UpdatedAt         time.Time  `db:"updated_at"           json:"updated_at"`
}

type CreateMobileDeviceRequest struct {
	Name      string    `json:"name"`
	ProjectID uuid.UUID `json:"project_id"`
	FlavorID  uuid.UUID `json:"flavor_id"`
	OSVersion string    `json:"os_version"` // android-11, android-12
}