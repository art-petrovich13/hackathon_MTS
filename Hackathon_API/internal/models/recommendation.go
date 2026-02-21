package models

import (
	"time"
	"github.com/google/uuid"
)

// Recommendation - предложение по оптимизации ресурсов VM
type Recommendation struct {
	ID                uuid.UUID  `db:"id"                   json:"id"`
	VMID              uuid.UUID  `db:"vm_id"                json:"vm_id"`
	Type              string     `db:"type"                 json:"type"` // stop, resize_up, resize_down, delete
	CurrentFlavorID   *uuid.UUID `db:"current_flavor_id"    json:"current_flavor_id,omitempty"`
	SuggestedFlavorID *uuid.UUID `db:"suggested_flavor_id"  json:"suggested_flavor_id,omitempty"`
	Reason            *string    `db:"reason"               json:"reason,omitempty"`
	Status            string     `db:"status"               json:"status"` // pending, applied, dismissed
	CreatedAt         time.Time  `db:"created_at"           json:"created_at"`
}