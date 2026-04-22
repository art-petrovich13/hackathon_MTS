package models

import (
	"github.com/google/uuid"
)

// Image - образ ОС
type Image struct {
	ID          uuid.UUID `db:"id"           json:"id"`
	Name        string    `db:"name"         json:"name"`
	DockerImage string    `db:"docker_image" json:"docker_image"` // *ubuntu:20.04
	OSType      string    `db:"os_type"      json:"os_type"`      
	Version     *string   `db:"version"      json:"version,omitempty"`
	Imported    bool      `db:"imported"     json:"imported"`      // true, если образ загружен пользователем
	SourceURL   *string   `db:"source_url"   json:"source_url,omitempty"`
	Status      string    `db:"status"       json:"status"`        // active, importing, error
}