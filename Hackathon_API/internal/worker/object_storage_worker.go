package worker

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	objectcompute "github.com/art-petrovich13/hackathon_MTS/internal/compute/object"
	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
	"github.com/art-petrovich13/hackathon_MTS/internal/utils"
)

type ObjectStorageWorker struct {
	db       *sqlx.DB
	driver   *objectcompute.MinIODriver
	osRepo   *repository.ObjectStorageRepository
	nodeRepo *repository.NodeRepository
	interval time.Duration
}

func NewObjectStorageWorker(
	db *sqlx.DB,
	driver *objectcompute.MinIODriver,
	osRepo *repository.ObjectStorageRepository,
	nodeRepo *repository.NodeRepository,
	interval time.Duration,
) *ObjectStorageWorker {
	if interval == 0 {
		interval = 5 * time.Second
	}
	return &ObjectStorageWorker{db: db, driver: driver, osRepo: osRepo, nodeRepo: nodeRepo, interval: interval}
}

func (w *ObjectStorageWorker) Start(ctx context.Context) {
	slog.Info("object storage worker started", "interval", w.interval)
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			slog.Info("object storage worker stopped")
			return
		case <-ticker.C:
			w.processBatch(ctx)
		}
	}
}

func (w *ObjectStorageWorker) processBatch(ctx context.Context) {
	tx, err := w.db.BeginTxx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		slog.Error("os worker: begin tx failed", "error", err)
		return
	}
	defer tx.Rollback() //nolint:errcheck

	storages, err := w.osRepo.GetPendingForUpdate(ctx, tx)
	if err != nil {
		slog.Error("os worker: fetch pending failed", "error", err)
		return
	}
	if len(storages) == 0 {
		return
	}

	slog.Info("os worker: processing batch", "count", len(storages))

	for _, os := range storages {
		switch os.Status {
		case "pending-start":
			w.processStart(ctx, tx, os)
			continue
		case "pending-stop":
			w.processStop(ctx, tx, os)
			continue
		}
		node, err := w.findOSNode(ctx, tx)
		if err != nil || node == nil {
			slog.Warn("os worker: no active node", "os_id", os.ID)
			continue
		}

		var flavor models.Flavor
		if err := tx.GetContext(ctx, &flavor,
			`SELECT id, name, cpu, ram_mb, disk_gb FROM flavors WHERE id = $1`, os.FlavorID,
		); err != nil {
			slog.Error("os worker: flavor not found", "os_id", os.ID, "error", err)
			w.setOSError(ctx, tx, os.ID)
			continue
		}

		if node.FreeCPU < flavor.CPU || node.FreeRAMMB < flavor.RAMMB {
			slog.Warn("os worker: not enough resources", "os_id", os.ID)
			continue
		}

		if _, err := tx.ExecContext(ctx,
			`UPDATE compute_nodes SET free_cpu = free_cpu - $1, free_ram_mb = free_ram_mb - $2 WHERE id = $3`,
			flavor.CPU, flavor.RAMMB, node.ID,
		); err != nil {
			slog.Error("os worker: reserve resources failed", "os_id", os.ID, "error", err)
			w.setOSError(ctx, tx, os.ID)
			continue
		}

		// Выделяем 2 порта: S3 и Console
		s3Port, err := utils.AllocatePort(tx, node.ID, "object_storage_s3", os.ID)
		if err != nil {
			slog.Error("os worker: allocate s3 port failed", "os_id", os.ID, "error", err)
			w.setOSError(ctx, tx, os.ID)
			continue
		}
		consolePort, err := utils.AllocatePort(tx, node.ID, "object_storage_console", os.ID)
		if err != nil {
			slog.Error("os worker: allocate console port failed", "os_id", os.ID, "error", err)
			w.setOSError(ctx, tx, os.ID)
			continue
		}

		if _, err := tx.ExecContext(ctx,
			`UPDATE object_storages SET status = 'creating', node_id = $1, updated_at = NOW() WHERE id = $2`,
			node.ID, os.ID,
		); err != nil {
			slog.Error("os worker: set creating failed", "os_id", os.ID, "error", err)
			w.setOSError(ctx, tx, os.ID)
			continue
		}

		go w.createStorage(os, *node, s3Port, consolePort, flavor.CPU, flavor.RAMMB)
	}

	if err := tx.Commit(); err != nil {
		slog.Error("os worker: commit failed", "error", err)
	}
}

func (w *ObjectStorageWorker) createStorage(
	os models.ObjectStorage, node models.ComputeNode,
	s3Port, consolePort, cpu, ramMB int,
) {
	ctx := context.Background()
	log := slog.With("os_id", os.ID)
	log.Info("os worker: creating minio container")

	accessKey := utils.GenerateAccessKey()
	secretKey := utils.GenerateSecretKey()

	instance, err := w.driver.Create(ctx, &objectcompute.CreateMinIOOpts{
		Name:        fmt.Sprintf("%s-%s", os.Name, os.ID.String()[:8]),
		AccessKey:   accessKey,
		SecretKey:   secretKey,
		S3Port:      s3Port,
		ConsolePort: consolePort,
	})
	if err != nil {
		log.Error("os worker: minio create failed", "error", err)
		w.compensateOS(ctx, os.ID, node.ID, s3Port, consolePort, cpu, ramMB)
		return
	}

	updateTx, err := w.db.BeginTxx(ctx, nil)
	if err != nil {
		log.Error("os worker: begin update tx failed", "error", err)
		_ = w.driver.Delete(ctx, instance.ContainerID)
		w.compensateOS(ctx, os.ID, node.ID, s3Port, consolePort, cpu, ramMB)
		return
	}
	defer updateTx.Rollback() //nolint:errcheck

	if err := w.osRepo.UpdateAfterCreate(ctx, updateTx, os.ID,
		instance.ContainerID, node.ID,
		instance.S3Endpoint, instance.ConsoleEndpoint,
		accessKey, secretKey,
	); err != nil {
		log.Error("os worker: update after create failed", "error", err)
		_ = w.driver.Delete(ctx, instance.ContainerID)
		w.compensateOS(ctx, os.ID, node.ID, s3Port, consolePort, cpu, ramMB)
		return
	}

	if err := updateTx.Commit(); err != nil {
		log.Error("os worker: commit failed", "error", err)
		_ = w.driver.Delete(ctx, instance.ContainerID)
		w.compensateOS(ctx, os.ID, node.ID, s3Port, consolePort, cpu, ramMB)
		return
	}

	log.Info("os worker: object storage created",
		"container_id", instance.ContainerID,
		"s3", instance.S3Endpoint,
		"console", instance.ConsoleEndpoint,
	)
}

func (w *ObjectStorageWorker) compensateOS(ctx context.Context, osID, nodeID uuid.UUID, s3Port, consolePort, cpu, ramMB int) {
	tx, _ := w.db.BeginTxx(ctx, nil)
	if tx == nil {
		return
	}
	defer tx.Rollback() //nolint:errcheck

	if s3Port > 0 {
		_ = utils.FreePort(tx, nodeID, s3Port)
	}
	if consolePort > 0 {
		_ = utils.FreePort(tx, nodeID, consolePort)
	}
	if cpu > 0 || ramMB > 0 {
		_, _ = tx.ExecContext(ctx,
			`UPDATE compute_nodes SET free_cpu = free_cpu + $1, free_ram_mb = free_ram_mb + $2 WHERE id = $3`,
			cpu, ramMB, nodeID,
		)
	}
	_, _ = tx.ExecContext(ctx,
		`UPDATE object_storages SET status = 'error', updated_at = NOW() WHERE id = $1`, osID,
	)
	_ = tx.Commit()
}

func (w *ObjectStorageWorker) setOSError(ctx context.Context, tx *sqlx.Tx, id uuid.UUID) {
	_, _ = tx.ExecContext(ctx,
		`UPDATE object_storages SET status = 'error', updated_at = NOW() WHERE id = $1`, id,
	)
}

func (w *ObjectStorageWorker) findOSNode(ctx context.Context, tx *sqlx.Tx) (*models.ComputeNode, error) {
	var node models.ComputeNode
	err := tx.GetContext(ctx, &node,
		`SELECT id, name, endpoint, total_cpu, total_ram_mb, free_cpu, free_ram_mb, status
		 FROM compute_nodes WHERE status = 'active' LIMIT 1 FOR UPDATE`,
	)
	if err != nil {
		return nil, err
	}
	return &node, nil
}

func (w *ObjectStorageWorker) processStart(ctx context.Context, tx *sqlx.Tx, os models.ObjectStorage) {
	log := slog.With("os_id", os.ID, "op", "start")
	log.Info("os worker: starting object storage")

	if os.DockerContainerID == nil || *os.DockerContainerID == "" {
		log.Error("os worker: container_id is nil, cannot start")
		w.setOSError(ctx, tx, os.ID)
		return
	}

	if os.NodeID != nil {
		var flavor models.Flavor
		if err := tx.GetContext(ctx, &flavor,
			`SELECT id, name, cpu, ram_mb, disk_gb FROM flavors WHERE id = $1`, os.FlavorID,
		); err != nil {
			log.Error("os worker: flavor not found for start", "error", err)
			w.setOSError(ctx, tx, os.ID)
			return
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE compute_nodes SET free_cpu = free_cpu - $1, free_ram_mb = free_ram_mb - $2 WHERE id = $3`,
			flavor.CPU, flavor.RAMMB, *os.NodeID,
		); err != nil {
			log.Error("os worker: reserve resources failed", "error", err)
			w.setOSError(ctx, tx, os.ID)
			return
		}
	}

	if err := w.driver.StartContainer(ctx, *os.DockerContainerID); err != nil {
		log.Error("os worker: docker start failed", "error", err)
		w.setOSError(ctx, tx, os.ID)
		return
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE object_storages SET status = 'running', updated_at = NOW() WHERE id = $1`, os.ID,
	); err != nil {
		log.Error("os worker: update status failed after start", "error", err)
		w.setOSError(ctx, tx, os.ID)
		return
	}

	log.Info("os worker: object storage started successfully")
}

func (w *ObjectStorageWorker) processStop(ctx context.Context, tx *sqlx.Tx, os models.ObjectStorage) {
	log := slog.With("os_id", os.ID, "op", "stop")
	log.Info("os worker: stopping object storage")

	if os.DockerContainerID == nil || *os.DockerContainerID == "" {
		log.Error("os worker: container_id is nil, cannot stop")
		w.setOSError(ctx, tx, os.ID)
		return
	}

	if err := w.driver.StopContainer(ctx, *os.DockerContainerID); err != nil {
		log.Error("os worker: docker stop failed", "error", err)
		w.setOSError(ctx, tx, os.ID)
		return
	}

	if os.NodeID != nil {
		var flavor models.Flavor
		if err := tx.GetContext(ctx, &flavor,
			`SELECT id, name, cpu, ram_mb, disk_gb FROM flavors WHERE id = $1`, os.FlavorID,
		); err != nil {
			// Контейнер уже остановлен -- логируем, но не прерываем
			log.Error("os worker: flavor not found for stop, resources not restored", "error", err)
		} else {
			if _, err := tx.ExecContext(ctx,
				`UPDATE compute_nodes SET free_cpu = free_cpu + $1, free_ram_mb = free_ram_mb + $2 WHERE id = $3`,
				flavor.CPU, flavor.RAMMB, *os.NodeID,
			); err != nil {
				log.Error("os worker: restore resources failed", "error", err)
			}
		}
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE object_storages SET status = 'stopped', updated_at = NOW() WHERE id = $1`, os.ID,
	); err != nil {
		log.Error("os worker: update status failed after stop", "error", err)
		w.setOSError(ctx, tx, os.ID)
		return
	}

	log.Info("os worker: object storage stopped successfully")
}