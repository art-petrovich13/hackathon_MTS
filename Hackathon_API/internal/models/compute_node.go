package models

import "github.com/google/uuid"

// ComputeNode - вычислительный узел (физический сервер с Docker)
type ComputeNode struct {
	ID         uuid.UUID `db:"id"           json:"id"`
	Name       string    `db:"name"         json:"name"`
	Endpoint   string    `db:"endpoint"     json:"endpoint"`      // "unix:///var/run/docker.sock" или "tcp://..."
	TotalCPU   int       `db:"total_cpu"    json:"total_cpu"`     
	TotalRAMMB int       `db:"total_ram_mb" json:"total_ram_mb"`
	FreeCPU    int       `db:"free_cpu"     json:"free_cpu"`
	FreeRAMMB  int       `db:"free_ram_mb"  json:"free_ram_mb"`
	Status     string    `db:"status"       json:"status"`        // active, offline, draining
}