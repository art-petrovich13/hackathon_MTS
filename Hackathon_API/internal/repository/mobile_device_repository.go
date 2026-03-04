package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type MobileDeviceRepository struct {
	db *sqlx.DB
}

func NewMobileDeviceRepository(db *sqlx.DB) *MobileDeviceRepository {
	return &MobileDeviceRepository{db: db}
}

func (r *MobileDeviceRepository) Create(ctx context.Context, tx *sqlx.Tx, d *models.MobileDevice) error {
	_, err := tx.ExecContext(ctx,
		`INSERT INTO mobile_devices
		 (id, name, project_id, flavor_id, device_type, os_version, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		d.ID, d.Name, d.ProjectID, d.FlavorID, d.DeviceType, d.OSVersion, d.Status,
	)
	return err
}

func (r *MobileDeviceRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.MobileDevice, error) {
	var d models.MobileDevice
	err := r.db.GetContext(ctx, &d,
		`SELECT id, name, project_id, flavor_id, device_type, os_version, status,
		        docker_container_id, node_id, adb_host, adb_port, vnc_port, novnc_port,
		        created_at, updated_at
		 FROM mobile_devices WHERE id = $1`, id,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &d, err
}

func (r *MobileDeviceRepository) List(ctx context.Context, projectID uuid.UUID) ([]models.MobileDevice, error) {
	var devices []models.MobileDevice
	var err error

	const cols = `id, name, project_id, flavor_id, device_type, os_version, status,
	              docker_container_id, node_id, adb_host, adb_port, vnc_port, novnc_port,
	              created_at, updated_at`

	if projectID == uuid.Nil {
		err = r.db.SelectContext(ctx, &devices,
			`SELECT `+cols+` FROM mobile_devices WHERE status != 'deleted' ORDER BY created_at DESC`,
		)
	} else {
		err = r.db.SelectContext(ctx, &devices,
			`SELECT `+cols+` FROM mobile_devices WHERE project_id = $1 AND status != 'deleted' ORDER BY created_at DESC`,
			projectID,
		)
	}
	return devices, err
}

func (r *MobileDeviceRepository) UpdateAfterCreate(ctx context.Context, tx *sqlx.Tx, id uuid.UUID,
	containerID string, nodeID uuid.UUID, adbHost string, adbPort, vncPort, novncPort int) error {
	_, err := tx.ExecContext(ctx, `
		UPDATE mobile_devices SET
			status              = 'running',
			docker_container_id = $2,
			node_id             = $3,
			adb_host            = $4,
			adb_port            = $5,
			vnc_port            = $6,
			novnc_port          = $7,
			updated_at          = NOW()
		WHERE id = $1`,
		id, containerID, nodeID, adbHost, adbPort, vncPort, novncPort,
	)
	return err
}

func (r *MobileDeviceRepository) GetPendingForUpdate(ctx context.Context, tx *sqlx.Tx) ([]models.MobileDevice, error) {
	var devices []models.MobileDevice
	err := tx.SelectContext(ctx, &devices,
		`SELECT id, name, project_id, flavor_id, device_type, os_version, status,
		        docker_container_id, node_id, adb_host, adb_port, vnc_port, novnc_port,
		        created_at, updated_at
		 FROM mobile_devices WHERE status IN ('pending', 'pending-start', 'pending-stop')
		 FOR UPDATE SKIP LOCKED LIMIT 3`,
	)
	return devices, err
}

func (r *MobileDeviceRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE mobile_devices SET status = $1, updated_at = NOW() WHERE id = $2`,
		status, id,
	)
	return err
}

func (r *MobileDeviceRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE mobile_devices SET status = 'deleted', updated_at = NOW() WHERE id = $1`,
		id,
	)
	return err
}