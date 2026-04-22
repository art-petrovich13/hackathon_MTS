package models

import (
	"time"
	"github.com/google/uuid"
)

// VmMetric - метрики VM за определённый момент времени
type VmMetric struct {
	ID            uuid.UUID `db:"id"             json:"id"`
	VMID          uuid.UUID `db:"vm_id"          json:"vm_id"`
	Timestamp     time.Time `db:"timestamp"      json:"timestamp"`
	CPUAvg        *float64  `db:"cpu_avg"        json:"cpu_avg,omitempty"`   // доля CPU (0-1)
	RAMAvg        *int      `db:"ram_avg"        json:"ram_avg,omitempty"`   // используемая RAM в MB
	NetworkRxBytes *uint64  `db:"network_rx_bytes" json:"network_rx_bytes,omitempty"`
	NetworkTxBytes *uint64  `db:"network_tx_bytes" json:"network_tx_bytes,omitempty"`
}