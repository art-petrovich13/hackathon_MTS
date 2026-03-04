package worker

import (
    "context"
    "database/sql"
    "fmt"
    "log/slog"
    "time"

    "github.com/jmoiron/sqlx"

    mobilecompute "github.com/art-petrovich13/hackathon_MTS/internal/compute/mobile"
    "github.com/art-petrovich13/hackathon_MTS/internal/models"
    "github.com/art-petrovich13/hackathon_MTS/internal/repository"
    "github.com/art-petrovich13/hackathon_MTS/internal/utils"
    "github.com/google/uuid"
)

type MobileWorker struct {
    db         *sqlx.DB
    driver     *mobilecompute.MobileDriver
    mobileRepo *repository.MobileDeviceRepository
    nodeRepo   *repository.NodeRepository
    interval   time.Duration
}

func NewMobileWorker(
    db *sqlx.DB,
    driver *mobilecompute.MobileDriver,
    mobileRepo *repository.MobileDeviceRepository,
    nodeRepo *repository.NodeRepository,
    interval time.Duration,
) *MobileWorker {
    if interval == 0 {
        interval = 5 * time.Second
    }
    return &MobileWorker{db: db, driver: driver, mobileRepo: mobileRepo, nodeRepo: nodeRepo, interval: interval}
}

func (w *MobileWorker) Start(ctx context.Context) {
    slog.Info("mobile worker started", "interval", w.interval)
    ticker := time.NewTicker(w.interval)
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():
            slog.Info("mobile worker stopped")
            return
        case <-ticker.C:
            w.processBatch(ctx)
        }
    }
}

func (w *MobileWorker) processBatch(ctx context.Context) {
    tx, err := w.db.BeginTxx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
    if err != nil {
        slog.Error("mobile worker: begin tx failed", "error", err)
        return
    }
    defer tx.Rollback() //nolint:errcheck

    devices, err := w.mobileRepo.GetPendingForUpdate(ctx, tx)
    if err != nil || len(devices) == 0 {
        return
    }

    slog.Info("mobile worker: processing batch", "count", len(devices))

    for _, dev := range devices {
        switch dev.Status {
        case "pending-start":
            w.processStart(ctx, tx, dev)
            continue
        case "pending-stop":
            w.processStop(ctx, tx, dev)
            continue
        }

        // pending → создаём эмулятор
        node, err := w.findNode(ctx, tx)
        if err != nil || node == nil {
            slog.Warn("mobile worker: no active node", "dev_id", dev.ID)
            continue
        }

        var flavor models.Flavor
        if err := tx.GetContext(ctx, &flavor,
            `SELECT id, name, cpu, ram_mb, disk_gb FROM flavors WHERE id = $1`, dev.FlavorID,
        ); err != nil {
            slog.Error("mobile worker: flavor not found", "error", err)
            w.setError(ctx, tx, dev.ID)
            continue
        }

        if node.FreeCPU < flavor.CPU || node.FreeRAMMB < flavor.RAMMB {
            slog.Warn("mobile worker: not enough resources", "dev_id", dev.ID)
            continue
        }

        // Резервируем ресурсы
        if _, err := tx.ExecContext(ctx,
            `UPDATE compute_nodes SET free_cpu = free_cpu - $1, free_ram_mb = free_ram_mb - $2 WHERE id = $3`,
            flavor.CPU, flavor.RAMMB, node.ID,
        ); err != nil {
            slog.Error("mobile worker: reserve resources failed", "error", err)
            w.setError(ctx, tx, dev.ID)
            continue
        }

        // Выделяем 3 порта (ADB + VNC + noVNC)
        adbPort, err := utils.AllocatePort(tx, node.ID, "mobile_adb", dev.ID)
        if err != nil {
            slog.Error("mobile worker: allocate adb port failed", "error", err)
            w.setError(ctx, tx, dev.ID)
            continue
        }
        vncPort, err := utils.AllocatePort(tx, node.ID, "mobile_vnc", dev.ID)
        if err != nil {
            slog.Error("mobile worker: allocate vnc port failed", "error", err)
            w.setError(ctx, tx, dev.ID)
            continue
        }
        novncPort, err := utils.AllocatePort(tx, node.ID, "mobile_novnc", dev.ID)
        if err != nil {
            slog.Error("mobile worker: allocate novnc port failed", "error", err)
            w.setError(ctx, tx, dev.ID)
            continue
        }

        if _, err := tx.ExecContext(ctx,
            `UPDATE mobile_devices SET status = 'creating', node_id = $1, updated_at = NOW() WHERE id = $2`,
            node.ID, dev.ID,
        ); err != nil {
            slog.Error("mobile worker: set creating failed", "error", err)
            w.setError(ctx, tx, dev.ID)
            continue
        }

        go w.createDevice(dev, *node, adbPort, vncPort, novncPort, flavor.CPU, flavor.RAMMB)
    }

    if err := tx.Commit(); err != nil {
        slog.Error("mobile worker: commit failed", "error", err)
    }
}

func (w *MobileWorker) createDevice(
    dev models.MobileDevice, node models.ComputeNode,
    adbPort, vncPort, novncPort, cpu, ramMB int,
) {
    ctx := context.Background()
    log := slog.With("dev_id", dev.ID, "os", dev.OSVersion)
    log.Info("mobile worker: creating android emulator")

    instance, err := w.driver.Create(ctx, &mobilecompute.CreateMobileOpts{
        Name:      fmt.Sprintf("%s-%s", dev.Name, dev.ID.String()[:8]),
        OSVersion: dev.OSVersion,
        ADBPort:   adbPort,
        VNCPort:   vncPort,
        NoVNCPort: novncPort,
    })
    if err != nil {
        log.Error("mobile worker: docker create failed", "error", err)
        w.compensate(ctx, dev.ID, node.ID, adbPort, vncPort, novncPort, cpu, ramMB)
        return
    }

    updateTx, err := w.db.BeginTxx(ctx, nil)
    if err != nil {
        log.Error("mobile worker: begin update tx failed", "error", err)
        _ = w.driver.Delete(ctx, instance.ContainerID)
        w.compensate(ctx, dev.ID, node.ID, adbPort, vncPort, novncPort, cpu, ramMB)
        return
    }
    defer updateTx.Rollback() //nolint:errcheck

    if err := w.mobileRepo.UpdateAfterCreate(ctx, updateTx, dev.ID,
        instance.ContainerID, node.ID,
        instance.ADBHost, adbPort, vncPort, novncPort,
    ); err != nil {
        log.Error("mobile worker: update after create failed", "error", err)
        _ = w.driver.Delete(ctx, instance.ContainerID)
        w.compensate(ctx, dev.ID, node.ID, adbPort, vncPort, novncPort, cpu, ramMB)
        return
    }

    if err := updateTx.Commit(); err != nil {
        log.Error("mobile worker: commit failed", "error", err)
        _ = w.driver.Delete(ctx, instance.ContainerID)
        w.compensate(ctx, dev.ID, node.ID, adbPort, vncPort, novncPort, cpu, ramMB)
        return
    }

    log.Info("mobile worker: android emulator created",
        "container", instance.ContainerID,
        "adb_port", adbPort,
        "novnc_url", instance.NoVNCURL,
    )
}

func (w *MobileWorker) processStart(ctx context.Context, tx *sqlx.Tx, dev models.MobileDevice) {
    if dev.DockerContainerID == nil {
        w.setError(ctx, tx, dev.ID)
        return
    }
    if dev.NodeID != nil {
        var flavor models.Flavor
        if err := tx.GetContext(ctx, &flavor, `SELECT id, name, cpu, ram_mb, disk_gb FROM flavors WHERE id = $1`, dev.FlavorID); err == nil {
            _, _ = tx.ExecContext(ctx,
                `UPDATE compute_nodes SET free_cpu = free_cpu - $1, free_ram_mb = free_ram_mb - $2 WHERE id = $3`,
                flavor.CPU, flavor.RAMMB, *dev.NodeID,
            )
        }
    }
    if err := w.driver.StartContainer(ctx, *dev.DockerContainerID); err != nil {
        slog.Error("mobile worker: start failed", "error", err)
        w.setError(ctx, tx, dev.ID)
        return
    }
    _, _ = tx.ExecContext(ctx, `UPDATE mobile_devices SET status = 'running', updated_at = NOW() WHERE id = $1`, dev.ID)
}

func (w *MobileWorker) processStop(ctx context.Context, tx *sqlx.Tx, dev models.MobileDevice) {
    if dev.DockerContainerID == nil {
        w.setError(ctx, tx, dev.ID)
        return
    }
    if err := w.driver.StopContainer(ctx, *dev.DockerContainerID); err != nil {
        slog.Error("mobile worker: stop failed", "error", err)
        w.setError(ctx, tx, dev.ID)
        return
    }
    if dev.NodeID != nil {
        var flavor models.Flavor
        if err := tx.GetContext(ctx, &flavor, `SELECT id, name, cpu, ram_mb, disk_gb FROM flavors WHERE id = $1`, dev.FlavorID); err == nil {
            _, _ = tx.ExecContext(ctx,
                `UPDATE compute_nodes SET free_cpu = free_cpu + $1, free_ram_mb = free_ram_mb + $2 WHERE id = $3`,
                flavor.CPU, flavor.RAMMB, *dev.NodeID,
            )
        }
    }
    _, _ = tx.ExecContext(ctx, `UPDATE mobile_devices SET status = 'stopped', updated_at = NOW() WHERE id = $1`, dev.ID)
}

func (w *MobileWorker) compensate(ctx context.Context, devID, nodeID uuid.UUID, adbPort, vncPort, novncPort, cpu, ramMB int) {
    tx, err := w.db.BeginTxx(ctx, nil)
    if err != nil {
        return
    }
    defer tx.Rollback() //nolint:errcheck

    _ = utils.FreePort(tx, nodeID, adbPort)
    _ = utils.FreePort(tx, nodeID, vncPort)
    _ = utils.FreePort(tx, nodeID, novncPort)

    _, _ = tx.ExecContext(ctx,
        `UPDATE compute_nodes SET free_cpu = free_cpu + $1, free_ram_mb = free_ram_mb + $2 WHERE id = $3`,
        cpu, ramMB, nodeID,
    )
    _, _ = tx.ExecContext(ctx,
        `UPDATE mobile_devices SET status = 'error', updated_at = NOW() WHERE id = $1`, devID,
    )
    _ = tx.Commit()
}

func (w *MobileWorker) setError(ctx context.Context, tx *sqlx.Tx, id uuid.UUID) {
    _, _ = tx.ExecContext(ctx,
        `UPDATE mobile_devices SET status = 'error', updated_at = NOW() WHERE id = $1`, id,
    )
}

func (w *MobileWorker) findNode(ctx context.Context, tx *sqlx.Tx) (*models.ComputeNode, error) {
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