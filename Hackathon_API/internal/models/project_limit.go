package models

import (
	"time"

	"github.com/google/uuid"
)

type ProjectLimit struct {
	ID          uuid.UUID `db:"id"           json:"id"`
	ProjectID   uuid.UUID `db:"project_id"   json:"project_id"`
	MaxVMs      int       `db:"max_vms"      json:"max_vms"`
	MaxCPU      int       `db:"max_cpu"      json:"max_cpu"`
	MaxRAMMB    int       `db:"max_ram_mb"   json:"max_ram_mb"`
	MaxDiskGB   int       `db:"max_disk_gb"  json:"max_disk_gb"`
	MaxDBs      int       `db:"max_dbs"      json:"max_dbs"`
	MaxStorages int       `db:"max_storages" json:"max_storages"`
	MaxMobile   int       `db:"max_mobile"   json:"max_mobile"`
	CreatedAt   time.Time `db:"created_at"   json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"   json:"updated_at"`
}
