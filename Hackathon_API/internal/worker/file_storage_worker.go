package worker

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"log/slog"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
	"github.com/art-petrovich13/hackathon_MTS/internal/utils"
)

type FileStorageWorker struct {
	db       *sqlx.DB
	cli      *client.Client
	fsRepo   *repository.FileStorageRepository
	nodeRepo *repository.NodeRepository
	interval time.Duration
}

func NewFileStorageWorker(
	db *sqlx.DB,
	fsRepo *repository.FileStorageRepository,
	nodeRepo *repository.NodeRepository,
	interval time.Duration,
) (*FileStorageWorker, error) {
	cli, err := client.NewClientWithOpts(
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, fmt.Errorf("docker client: %w", err)
	}
	if interval == 0 {
		interval = 5 * time.Second
	}
	return &FileStorageWorker{db: db, cli: cli, fsRepo: fsRepo, nodeRepo: nodeRepo, interval: interval}, nil
}

func (w *FileStorageWorker) Start(ctx context.Context) {
	slog.Info("file storage worker started", "interval", w.interval)
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			slog.Info("file storage worker stopped")
			return
		case <-ticker.C:
			w.processBatch(ctx)
		}
	}
}

func (w *FileStorageWorker) processBatch(ctx context.Context) {
	tx, err := w.db.BeginTxx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		slog.Error("fs worker: begin tx failed", "error", err)
		return
	}
	defer tx.Rollback() //nolint:errcheck

	storages, err := w.fsRepo.GetPendingForUpdate(ctx, tx)
	if err != nil {
		slog.Error("fs worker: fetch pending failed", "error", err)
		return
	}
	if len(storages) == 0 {
		return
	}

	slog.Info("fs worker: processing batch", "count", len(storages))

	for _, fs := range storages {
		switch fs.Status {
		case "pending-start":
			w.processStart(ctx, tx, fs)
			continue
		case "pending-stop":
			w.processStop(ctx, tx, fs)
			continue
		}
		node, err := w.findFSNode(ctx, tx)
		if err != nil || node == nil {
			slog.Warn("fs worker: no active node", "fs_id", fs.ID)
			continue
		}

		var flavor models.Flavor
		if err := tx.GetContext(ctx, &flavor,
			`SELECT id, name, cpu, ram_mb, disk_gb FROM flavors WHERE id = $1`, fs.FlavorID,
		); err != nil {
			slog.Error("fs worker: flavor not found", "fs_id", fs.ID, "error", err)
			w.setFSError(ctx, tx, fs.ID)
			continue
		}

		if node.FreeCPU < flavor.CPU || node.FreeRAMMB < flavor.RAMMB {
			slog.Warn("fs worker: not enough resources", "fs_id", fs.ID)
			continue
		}

		if _, err := tx.ExecContext(ctx,
			`UPDATE compute_nodes SET free_cpu = free_cpu - $1, free_ram_mb = free_ram_mb - $2 WHERE id = $3`,
			flavor.CPU, flavor.RAMMB, node.ID,
		); err != nil {
			slog.Error("fs worker: reserve resources failed", "fs_id", fs.ID, "error", err)
			w.setFSError(ctx, tx, fs.ID)
			continue
		}

		port, err := utils.AllocatePort(tx, node.ID, "file_storage", fs.ID)
		if err != nil {
			slog.Error("fs worker: allocate port failed", "fs_id", fs.ID, "error", err)
			w.setFSError(ctx, tx, fs.ID)
			continue
		}

		if _, err := tx.ExecContext(ctx,
			`UPDATE file_storages SET status = 'creating', node_id = $1, updated_at = NOW() WHERE id = $2`,
			node.ID, fs.ID,
		); err != nil {
			slog.Error("fs worker: set creating failed", "fs_id", fs.ID, "error", err)
			w.setFSError(ctx, tx, fs.ID)
			continue
		}

		go w.createFileStorage(fs, *node, port, flavor.CPU, flavor.RAMMB, flavor.DiskGB)
	}

	if err := tx.Commit(); err != nil {
		slog.Error("fs worker: commit failed", "error", err)
	}
}

func (w *FileStorageWorker) createFileStorage(
	fs models.FileStorage, node models.ComputeNode,
	port, cpu, ramMB, sizeGB int,
) {
	ctx := context.Background()
	log := slog.With("fs_id", fs.ID)
	log.Info("fs worker: creating file storage container")

	const fsImage = "nginx:alpine"
	volumeName := fmt.Sprintf("iaas-fs-%s", fs.ID.String()[:8])
	containerName := fmt.Sprintf("fs-%s", fs.ID.String()[:8])

	// Скачиваем образ
	reader, err := w.cli.ImagePull(ctx, fsImage, image.PullOptions{})
	if err == nil {
		io.Copy(io.Discard, reader)
		reader.Close()
	}

	portSpec := nat.Port("80/tcp")
	cfg := &container.Config{
		Image:        fsImage,
		ExposedPorts: nat.PortSet{portSpec: struct{}{}},
		Labels: map[string]string{
			"iaas.managed": "true",
			"iaas.service": "file_storage",
			"iaas.name":    fs.Name,
		},
	}

	hostCfg := &container.HostConfig{
		PortBindings: nat.PortMap{
			portSpec: []nat.PortBinding{
				{HostIP: "0.0.0.0", HostPort: fmt.Sprintf("%d", port)},
			},
		},
		RestartPolicy: container.RestartPolicy{Name: "unless-stopped"},
		Binds: []string{
			fmt.Sprintf("%s:/usr/share/nginx/html", volumeName),
		},
	}

	resp, err := w.cli.ContainerCreate(ctx, cfg, hostCfg, &network.NetworkingConfig{}, nil, containerName)
	if err != nil {
		log.Error("fs worker: container create failed", "error", err)
		w.compensateFS(ctx, fs.ID, node.ID, port, cpu, ramMB)
		return
	}

	if err := w.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		log.Error("fs worker: container start failed", "error", err)
		_ = w.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		w.compensateFS(ctx, fs.ID, node.ID, port, cpu, ramMB)
		return
	}

	time.Sleep(3 * time.Second)

	nfsEndpoint := fmt.Sprintf("http://127.0.0.1:%d", port)

	updateTx, err := w.db.BeginTxx(ctx, nil)
	if err != nil {
		log.Error("fs worker: begin update tx failed", "error", err)
		_ = w.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		w.compensateFS(ctx, fs.ID, node.ID, port, cpu, ramMB)
		return
	}
	defer updateTx.Rollback() //nolint:errcheck

	if err := w.fsRepo.UpdateAfterCreate(ctx, updateTx, fs.ID,
		resp.ID, node.ID, volumeName, nfsEndpoint, sizeGB,
	); err != nil {
		log.Error("fs worker: update after create failed", "error", err)
		_ = w.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		w.compensateFS(ctx, fs.ID, node.ID, port, cpu, ramMB)
		return
	}

	if err := updateTx.Commit(); err != nil {
		log.Error("fs worker: commit failed", "error", err)
		_ = w.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		w.compensateFS(ctx, fs.ID, node.ID, port, cpu, ramMB)
		return
	}

	log.Info("fs worker: file storage created",
		"container_id", resp.ID,
		"endpoint", nfsEndpoint,
		"volume", volumeName,
	)
}

func (w *FileStorageWorker) compensateFS(ctx context.Context, fsID, nodeID uuid.UUID, port, cpu, ramMB int) {
	tx, _ := w.db.BeginTxx(ctx, nil)
	if tx == nil {
		return
	}
	defer tx.Rollback() //nolint:errcheck
	if port > 0 {
		_ = utils.FreePort(tx, nodeID, port)
	}
	if cpu > 0 || ramMB > 0 {
		_, _ = tx.ExecContext(ctx,
			`UPDATE compute_nodes SET free_cpu = free_cpu + $1, free_ram_mb = free_ram_mb + $2 WHERE id = $3`,
			cpu, ramMB, nodeID,
		)
	}
	_, _ = tx.ExecContext(ctx,
		`UPDATE file_storages SET status = 'error', updated_at = NOW() WHERE id = $1`, fsID,
	)
	_ = tx.Commit()
}

func (w *FileStorageWorker) setFSError(ctx context.Context, tx *sqlx.Tx, id uuid.UUID) {
	_, _ = tx.ExecContext(ctx,
		`UPDATE file_storages SET status = 'error', updated_at = NOW() WHERE id = $1`, id,
	)
}

func (w *FileStorageWorker) findFSNode(ctx context.Context, tx *sqlx.Tx) (*models.ComputeNode, error) {
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

func (w *FileStorageWorker) processStart(ctx context.Context, tx *sqlx.Tx, fs models.FileStorage) {
	log := slog.With("fs_id", fs.ID, "op", "start")
	log.Info("fs worker: starting file storage")

	if fs.DockerContainerID == nil || *fs.DockerContainerID == "" {
		log.Error("fs worker: container_id is nil, cannot start")
		w.setFSError(ctx, tx, fs.ID)
		return
	}

	if fs.NodeID != nil {
		var flavor models.Flavor
		if err := tx.GetContext(ctx, &flavor,
			`SELECT id, name, cpu, ram_mb, disk_gb FROM flavors WHERE id = $1`, fs.FlavorID,
		); err != nil {
			log.Error("fs worker: flavor not found for start", "error", err)
			w.setFSError(ctx, tx, fs.ID)
			return
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE compute_nodes SET free_cpu = free_cpu - $1, free_ram_mb = free_ram_mb - $2 WHERE id = $3`,
			flavor.CPU, flavor.RAMMB, *fs.NodeID,
		); err != nil {
			log.Error("fs worker: reserve resources failed", "error", err)
			w.setFSError(ctx, tx, fs.ID)
			return
		}
	}

	if err := w.cli.ContainerStart(ctx, *fs.DockerContainerID, container.StartOptions{}); err != nil {
		log.Error("fs worker: docker start failed", "error", err)
		w.setFSError(ctx, tx, fs.ID)
		return
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE file_storages SET status = 'running', updated_at = NOW() WHERE id = $1`, fs.ID,
	); err != nil {
		log.Error("fs worker: update status failed after start", "error", err)
		w.setFSError(ctx, tx, fs.ID)
		return
	}

	log.Info("fs worker: file storage started successfully")
}

func (w *FileStorageWorker) processStop(ctx context.Context, tx *sqlx.Tx, fs models.FileStorage) {
	log := slog.With("fs_id", fs.ID, "op", "stop")
	log.Info("fs worker: stopping file storage")

	if fs.DockerContainerID == nil || *fs.DockerContainerID == "" {
		log.Error("fs worker: container_id is nil, cannot stop")
		w.setFSError(ctx, tx, fs.ID)
		return
	}

	timeoutSec := 10
	if err := w.cli.ContainerStop(ctx, *fs.DockerContainerID, container.StopOptions{Timeout: &timeoutSec}); err != nil {
		log.Error("fs worker: docker stop failed", "error", err)
		w.setFSError(ctx, tx, fs.ID)
		return
	}

	if fs.NodeID != nil {
		var flavor models.Flavor
		if err := tx.GetContext(ctx, &flavor,
			`SELECT id, name, cpu, ram_mb, disk_gb FROM flavors WHERE id = $1`, fs.FlavorID,
		); err != nil {
			// Контейнер уже остановлен -- логируем, но не прерываем
			log.Error("fs worker: flavor not found for stop, resources not restored", "error", err)
		} else {
			if _, err := tx.ExecContext(ctx,
				`UPDATE compute_nodes SET free_cpu = free_cpu + $1, free_ram_mb = free_ram_mb + $2 WHERE id = $3`,
				flavor.CPU, flavor.RAMMB, *fs.NodeID,
			); err != nil {
				log.Error("fs worker: restore resources failed", "error", err)
			}
		}
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE file_storages SET status = 'stopped', updated_at = NOW() WHERE id = $1`, fs.ID,
	); err != nil {
		log.Error("fs worker: update status failed after stop", "error", err)
		w.setFSError(ctx, tx, fs.ID)
		return
	}

	log.Info("fs worker: file storage stopped successfully")
}