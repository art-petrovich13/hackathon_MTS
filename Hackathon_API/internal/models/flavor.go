package models

import "github.com/google/uuid"

// Flavor - дсоутпные конфигурации ресурсов для VM
type Flavor struct {
	ID     uuid.UUID `db:"id"      json:"id"`
	Name   string    `db:"name"    json:"name"`
	CPU    int       `db:"cpu"     json:"cpu"`
	RAMMB  int       `db:"ram_mb"  json:"ram_mb"`
	DiskGB int       `db:"disk_gb" json:"disk_gb"`
}