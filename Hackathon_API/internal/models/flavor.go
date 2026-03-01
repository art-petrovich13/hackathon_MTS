package models

import "github.com/google/uuid"

// Flavor - доступные конфигурации ресурсов для VM и других сервисов
type Flavor struct {
	ID          uuid.UUID `db:"id"           json:"id"`
	Name        string    `db:"name"         json:"name"`
	CPU         int       `db:"cpu"          json:"cpu"`
	RAMMB       int       `db:"ram_mb"       json:"ram_mb"`
	DiskGB      int       `db:"disk_gb"      json:"disk_gb"`
	ServiceType string    `db:"service_type" json:"service_type"`          // НОВОЕ: compute|db_postgres|db_mysql|...
	DockerImage *string   `db:"docker_image" json:"docker_image,omitempty"` // НОВОЕ: образ для сервиса
	DefaultPort *int      `db:"default_port" json:"default_port,omitempty"` // НОВОЕ: порт сервиса по умолчанию
}