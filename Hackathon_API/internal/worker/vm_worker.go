// internal/worker/vm_worker.go
package worker

import (
	"context"
	"database/sql"
	"log/slog"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/art-petrovich13/hackathon_MTS/internal/compute/driver"
	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
	"github.com/art-petrovich13/hackathon_MTS/internal/utils"
)

type VMWorker struct {
	db       *sqlx.DB
	drv      driver.ComputeDriver
	vmRepo   *repository.VMRepository
	nodeRepo *repository.NodeRepository
	interval time.Duration
}

func NewVMWorker(
	db *sqlx.DB,
	drv driver.ComputeDriver,
	vmRepo *repository.VMRepository,
	nodeRepo *repository.NodeRepository,
	interval time.Duration,
) *VMWorker {
	if interval == 0 {
		interval = 5 * time.Second
	}
	return &VMWorker{
		db:       db,
		drv:      drv,
		vmRepo:   vmRepo,
		nodeRepo: nodeRepo,
		interval: interval,
	}
}

func (w *VMWorker) Start(ctx context.Context) {
	slog.Info("vm worker started", "interval", w.interval)
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("vm worker stopped")
			return
		case <-ticker.C:
			w.processBatch(ctx)
		}
	}
}

func (w *VMWorker) processBatch(ctx context.Context) {
	tx, err := w.db.BeginTxx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		slog.Error("worker: begin tx failed", "error", err)
		return
	}
	defer tx.Rollback() //nolint:errcheck

	vms, err := w.vmRepo.GetPendingForUpdate(ctx, tx, 10)
	if err != nil {
		slog.Error("worker: fetch pending vms failed", "error", err)
		return
	}

	if len(vms) == 0 {
		return
	}

	slog.Info("worker: processing batch", "count", len(vms))

	for _, vm := range vms {
		switch vm.Status {
		case "pending":
			w.processCreate(ctx, tx, vm)
		case "pending-start":
			w.processStart(ctx, tx, vm)
		case "pending-stop":
			w.processStop(ctx, tx, vm)
		default:
			slog.Warn("worker: unknown status, skipping", "vm_id", vm.ID, "status", vm.Status)
		}
	}

	if err := tx.Commit(); err != nil {
		slog.Error("worker: commit failed", "error", err)
	}
}

func (w *VMWorker) processCreate(ctx context.Context, tx *sqlx.Tx, vm models.VirtualMachine) {
	log := slog.With("vm_id", vm.ID, "vm_name", vm.Name, "op", "create")
	log.Info("worker: creating vm")

	var flavor models.Flavor
	if err := tx.GetContext(ctx, &flavor, `SELECT * FROM flavors WHERE id = $1`, vm.FlavorID); err != nil {
		log.Error("worker: flavor not found", "error", err)
		w.setError(ctx, tx, vm.ID)
		return
	}

	var img models.Image
	if err := tx.GetContext(ctx, &img, `SELECT * FROM images WHERE id = $1`, vm.ImageID); err != nil {
		log.Error("worker: image not found", "error", err)
		w.setError(ctx, tx, vm.ID)
		return
	}

	var node models.ComputeNode
	err := tx.GetContext(ctx, &node,
		`SELECT * FROM compute_nodes
		 WHERE free_cpu >= $1 AND free_ram_mb >= $2 AND status = 'active'
		 ORDER BY free_cpu DESC
		 LIMIT 1
		 FOR UPDATE`,
		flavor.CPU, flavor.RAMMB,
	)
	if err != nil {
		log.Warn("worker: no suitable node, will retry next tick")
		return
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE compute_nodes
		 SET free_cpu = free_cpu - $1, free_ram_mb = free_ram_mb - $2
		 WHERE id = $3`,
		flavor.CPU, flavor.RAMMB, node.ID,
	); err != nil {
		log.Error("worker: reserve node resources failed", "error", err)
		w.setError(ctx, tx, vm.ID)
		return
	}

	// Аллоцируем porт для noVNC.
	// Порт выделяется всегда — безопасно: если образ не VNC, порт просто не будет занят.
	novncPort, novncErr := utils.AllocatePort(tx, node.ID, "vm_novnc", vm.ID)
	if novncErr != nil {
		log.Warn("worker: failed to allocate novnc port, vm will run without VNC", "error", novncErr)
		novncPort = 0
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE vms SET status = 'creating', node_id = $1, updated_at = NOW() WHERE id = $2`,
		node.ID, vm.ID,
	); err != nil {
		log.Error("worker: set vm creating status failed", "error", err)
		w.setError(ctx, tx, vm.ID)
		return
	}

	go func(vmID, nodeID interface{}, flavorCPU, flavorRAMMB int, imageName, vmName string, novncPort int) {
		dockerCtx := context.Background()

		instance, err := w.drv.CreateVM(dockerCtx, &driver.CreateVMOpts{
			Name:      vmName,
			CPU:       flavorCPU,
			RAMMB:     flavorRAMMB,
			ImageName: imageName,
			NoVNCPort: novncPort,
		})
		if err != nil {
			log.Error("worker: docker create failed", "error", err)
			w.compensateFailedCreate(dockerCtx, vmID, nodeID, flavorCPU, flavorRAMMB)
			return
		}

		updateCtx := context.Background()
		updateTx, err := w.db.BeginTxx(updateCtx, nil)
		if err != nil {
			log.Error("worker: begin update tx failed", "error", err)
			_ = w.drv.DeleteVM(dockerCtx, instance.ID)
			w.compensateFailedCreate(dockerCtx, vmID, nodeID, flavorCPU, flavorRAMMB)
			return
		}
		defer updateTx.Rollback() //nolint:errcheck

		if _, err := updateTx.ExecContext(updateCtx,
			`UPDATE vms SET
				status              = 'running',
				docker_container_id = $1,
				ip_address          = $2,
				novnc_port          = $3,
				updated_at          = NOW()
			 WHERE id = $4`,
			instance.ID, instance.IPAddress, instance.NoVNCPort, vmID,
		); err != nil {
			log.Error("worker: update vm after docker create failed", "error", err)
			_ = w.drv.DeleteVM(dockerCtx, instance.ID)
			w.compensateFailedCreate(dockerCtx, vmID, nodeID, flavorCPU, flavorRAMMB)
			return
		}

		if err := updateTx.Commit(); err != nil {
			log.Error("worker: commit update tx failed", "error", err)
			_ = w.drv.DeleteVM(dockerCtx, instance.ID)
			w.compensateFailedCreate(dockerCtx, vmID, nodeID, flavorCPU, flavorRAMMB)
			return
		}

		log.Info("worker: vm created successfully",
			"container_id", instance.ID,
			"ip", instance.IPAddress,
		)
	}(vm.ID, node.ID, flavor.CPU, flavor.RAMMB, img.DockerImage, vm.Name, novncPort)
}

func (w *VMWorker) compensateFailedCreate(ctx context.Context, vmID, nodeID interface{}, cpu, ramMB int) {
	tx, err := w.db.BeginTxx(ctx, nil)
	if err != nil {
		slog.Error("worker: compensation tx failed", "error", err)
		return
	}
	defer tx.Rollback() //nolint:errcheck

	if _, err := tx.ExecContext(ctx,
		`UPDATE compute_nodes SET free_cpu = free_cpu + $1, free_ram_mb = free_ram_mb + $2 WHERE id = $3`,
		cpu, ramMB, nodeID,
	); err != nil {
		slog.Error("worker: compensation restore resources failed", "error", err)
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE vms SET status = 'error', updated_at = NOW() WHERE id = $1`,
		vmID,
	); err != nil {
		slog.Error("worker: compensation set error status failed", "error", err)
	}

	if err := tx.Commit(); err != nil {
		slog.Error("worker: compensation commit failed", "error", err)
	}
}

func (w *VMWorker) processStart(ctx context.Context, tx *sqlx.Tx, vm models.VirtualMachine) {
	log := slog.With("vm_id", vm.ID, "vm_name", vm.Name, "op", "start")
	log.Info("worker: starting vm")

	if vm.DockerContainerID == nil {
		log.Error("worker: container_id is nil, cannot start")
		w.setError(ctx, tx, vm.ID)
		return
	}

	var flavor models.Flavor
	if err := tx.GetContext(ctx, &flavor, `SELECT * FROM flavors WHERE id = $1`, vm.FlavorID); err != nil {
		log.Error("worker: flavor not found", "error", err)
		w.setError(ctx, tx, vm.ID)
		return
	}

	if vm.NodeID != nil {
		if _, err := tx.ExecContext(ctx,
			`UPDATE compute_nodes SET free_cpu = free_cpu - $1, free_ram_mb = free_ram_mb - $2 WHERE id = $3`,
			flavor.CPU, flavor.RAMMB, *vm.NodeID,
		); err != nil {
			log.Error("worker: update node resources failed", "error", err)
			w.setError(ctx, tx, vm.ID)
			return
		}
	}

	if err := w.drv.StartVM(ctx, *vm.DockerContainerID); err != nil {
		log.Error("worker: docker start failed", "error", err)
		w.setError(ctx, tx, vm.ID)
		return
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE vms SET status = 'running', updated_at = NOW() WHERE id = $1`,
		vm.ID,
	); err != nil {
		log.Error("worker: update vm status failed", "error", err)
		_ = w.drv.StopVM(ctx, *vm.DockerContainerID)
		w.setError(ctx, tx, vm.ID)
		return
	}

	log.Info("worker: vm started successfully")
}

func (w *VMWorker) processStop(ctx context.Context, tx *sqlx.Tx, vm models.VirtualMachine) {
	log := slog.With("vm_id", vm.ID, "vm_name", vm.Name, "op", "stop")
	log.Info("worker: stopping vm")

	if vm.DockerContainerID == nil {
		log.Error("worker: container_id is nil, cannot stop")
		w.setError(ctx, tx, vm.ID)
		return
	}

	var flavor models.Flavor
	if err := tx.GetContext(ctx, &flavor, `SELECT * FROM flavors WHERE id = $1`, vm.FlavorID); err != nil {
		log.Error("worker: flavor not found", "error", err)
		w.setError(ctx, tx, vm.ID)
		return
	}

	if err := w.drv.StopVM(ctx, *vm.DockerContainerID); err != nil {
		log.Error("worker: docker stop failed", "error", err)
		w.setError(ctx, tx, vm.ID)
		return
	}

	if vm.NodeID != nil {
		if _, err := tx.ExecContext(ctx,
			`UPDATE compute_nodes SET free_cpu = free_cpu + $1, free_ram_mb = free_ram_mb + $2 WHERE id = $3`,
			flavor.CPU, flavor.RAMMB, *vm.NodeID,
		); err != nil {
			log.Error("worker: restore node resources failed", "error", err)
			w.setError(ctx, tx, vm.ID)
			return
		}
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE vms SET status = 'stopped', updated_at = NOW() WHERE id = $1`,
		vm.ID,
	); err != nil {
		log.Error("worker: update vm status failed", "error", err)
		w.setError(ctx, tx, vm.ID)
		return
	}

	log.Info("worker: vm stopped successfully")
}

func (w *VMWorker) setError(ctx context.Context, tx *sqlx.Tx, vmID interface{}) {
	if _, err := tx.ExecContext(ctx,
		`UPDATE vms SET status = 'error', updated_at = NOW() WHERE id = $1`,
		vmID,
	); err != nil {
		slog.Error("worker: failed to set error status", "vm_id", vmID, "error", err)
	}
}
