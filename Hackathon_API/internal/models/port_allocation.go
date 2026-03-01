package models

import "github.com/google/uuid"

type PortAllocation struct {
	ID          uuid.UUID `db:"id"           json:"id"`
	NodeID      uuid.UUID `db:"node_id"      json:"node_id"`
	Port        int       `db:"port"         json:"port"`
	ServiceType string    `db:"service_type" json:"service_type"`
	ServiceID   uuid.UUID `db:"service_id"   json:"service_id"`
}