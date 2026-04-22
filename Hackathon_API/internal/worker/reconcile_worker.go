// internal/worker/reconcile_worker.go
package worker

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/art-petrovich13/hackathon_MTS/internal/compute/driver"
	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
)

// ReconcileWorker — воркер-наблюдатель.
// Запускается раз в минуту и выполняет две задачи:
//
//   A. Синхронизация статусов: берёт все running VM, проверяет реальное
//      состояние контейнера в Docker. Если контейнер упал — ставит stopped
//      и возвращает ресурсы узлу.
//
//   B. Таймаут зависших VM: если VM застряла в pending/creating дольше
//      pendingTimeout — переводит в error.
type ReconcileWorker struct {
	db             *sqlx.DB
	drv            driver.ComputeDriver
	vmRepo         *repository.VMRepository
	nodeRepo       *repository.NodeRepository
	interval       time.Duration
	pendingTimeout time.Duration // сколько VM может висеть в pending/creating
}

func NewReconcileWorker(
	db *sqlx.DB,
	drv driver.ComputeDriver,
	vmRepo *repository.VMRepository,
	nodeRepo *repository.NodeRepository,
	interval time.Duration,
) *ReconcileWorker {
	if interval == 0 {
		interval = 1 * time.Minute
	}
	return &ReconcileWorker{
		db:             db,
		drv:            drv,
		vmRepo:         vmRepo,
		nodeRepo:       nodeRepo,
		interval:       interval,
		pendingTimeout: 5 * time.Minute,
	}
}

// Start запускает цикл. Вызывай в горутине: go reconcileWorker.Start(ctx)
func (w *ReconcileWorker) Start(ctx context.Context) {
	slog.Info("reconcile worker started", "interval", w.interval, "pending_timeout", w.pendingTimeout)

	// Запускаем сразу при старте, не ждём первого тика.
	w.run(ctx)

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("reconcile worker stopped")
			return
		case <-ticker.C:
			w.run(ctx)
		}
	}
}

// run выполняет обе задачи за один цикл.
func (w *ReconcileWorker) run(ctx context.Context) {
	w.syncRunningVMs(ctx)    // Задача А
	w.timeoutStuckVMs(ctx)   // Задача Б
}

// ──────────────────────────────────────────────────────────────────────────
// Задача А: синхронизация статусов running VM с реальным состоянием Docker.
// ──────────────────────────────────────────────────────────────────────────
func (w *ReconcileWorker) syncRunningVMs(ctx context.Context) {
	// Берём все VM которые по нашему мнению запущены и имеют контейнер.
	var vms []models.VirtualMachine
	err := w.db.SelectContext(ctx, &vms,
		`SELECT * FROM vms
		 WHERE status = 'running'
		   AND docker_container_id IS NOT NULL`,
	)
	if err != nil {
		slog.Error("reconcile: failed to fetch running vms", "error", err)
		return
	}

	if len(vms) == 0 {
		return
	}

	slog.Info("reconcile: checking running vms", "count", len(vms))

	for _, vm := range vms {
		w.checkVM(ctx, vm)
	}
}

// checkVM проверяет одну VM: если контейнер упал — синхронизирует БД.
func (w *ReconcileWorker) checkVM(ctx context.Context, vm models.VirtualMachine) {
	log := slog.With("vm_id", vm.ID, "container_id", *vm.DockerContainerID)

	// Спрашиваем Docker о реальном состоянии контейнера.
	instance, err := w.drv.GetVM(ctx, *vm.DockerContainerID)

	containerGone := false   // контейнер вообще не существует
	containerStopped := false // контейнер существует но остановлен

	if err != nil {
		// Ошибка "No such container" — контейнер удалён вручную или упал без следа.
		if isNotFoundError(err) {
			log.Warn("reconcile: container not found in docker, marking vm as stopped")
			containerGone = true
		} else {
			// Другая ошибка (сеть, docker daemon) — пропускаем, попробуем в следующий раз.
			log.Error("reconcile: failed to inspect container, skipping", "error", err)
			return
		}
	} else if instance.Status == "stopped" {
		log.Warn("reconcile: container is exited, marking vm as stopped")
		containerStopped = true
	}

	// Если контейнер живой и running — всё в порядке, ничего не делаем.
	if !containerGone && !containerStopped {
		return
	}

	// Контейнер упал — нужно обновить БД: статус stopped + вернуть ресурсы.
	w.markVMStopped(ctx, vm)
}

// markVMStopped открывает транзакцию, ставит VM статус stopped
// и возвращает ресурсы узлу.
func (w *ReconcileWorker) markVMStopped(ctx context.Context, vm models.VirtualMachine) {
	log := slog.With("vm_id", vm.ID)

	tx, err := w.db.BeginTxx(ctx, nil)
	if err != nil {
		log.Error("reconcile: begin tx failed", "error", err)
		return
	}
	defer tx.Rollback() //nolint:errcheck

	// Ставим статус stopped.
	if _, err := tx.ExecContext(ctx,
		`UPDATE vms SET status = 'stopped', updated_at = NOW() WHERE id = $1`,
		vm.ID,
	); err != nil {
		log.Error("reconcile: update vm status failed", "error", err)
		return
	}

	// Возвращаем ресурсы узлу (если VM была привязана к узлу).
	if vm.NodeID != nil {
		var flavor models.Flavor
		if err := tx.GetContext(ctx, &flavor,
			`SELECT * FROM flavors WHERE id = $1`, vm.FlavorID,
		); err != nil {
			log.Error("reconcile: flavor not found, resources not restored", "error", err)
			// Продолжаем — статус всё равно обновим, ресурсы потеряем (лучше чем ничего).
		} else {
			if _, err := tx.ExecContext(ctx,
				`UPDATE compute_nodes
				 SET free_cpu    = free_cpu    + $1,
				     free_ram_mb = free_ram_mb + $2
				 WHERE id = $3`,
				flavor.CPU, flavor.RAMMB, *vm.NodeID,
			); err != nil {
				log.Error("reconcile: restore node resources failed", "error", err)
				return
			}
			log.Info("reconcile: node resources restored",
				"node_id", *vm.NodeID,
				"cpu", flavor.CPU,
				"ram_mb", flavor.RAMMB,
			)
		}
	}

	if err := tx.Commit(); err != nil {
		log.Error("reconcile: commit failed", "error", err)
		return
	}

	log.Info("reconcile: vm marked as stopped (container was down)")
}

// ──────────────────────────────────────────────────────────────────────────
// Задача Б: таймаут для VM которые зависли в pending или creating.
// ──────────────────────────────────────────────────────────────────────────
func (w *ReconcileWorker) timeoutStuckVMs(ctx context.Context) {
	cutoff := time.Now().Add(-w.pendingTimeout)

	// Один UPDATE переводит все зависшие VM в error за один запрос.
	result, err := w.db.ExecContext(ctx,
		`UPDATE vms
		 SET status     = 'error',
		     updated_at = NOW()
		 WHERE status IN ('pending', 'creating')
		   AND updated_at < $1`,
		cutoff,
	)
	if err != nil {
		slog.Error("reconcile: timeout stuck vms failed", "error", err)
		return
	}

	rows, _ := result.RowsAffected()
	if rows > 0 {
		slog.Warn("reconcile: timed out stuck vms",
			"count", rows,
			"timeout", w.pendingTimeout,
		)
	}
}

// ──────────────────────────────────────────────────────────────────────────
// Вспомогательные функции
// ──────────────────────────────────────────────────────────────────────────

// isNotFoundError проверяет, является ли ошибка Docker "контейнер не найден".
// Docker SDK возвращает её как текстовую ошибку содержащую "No such container".
func isNotFoundError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "no such container") ||
		strings.Contains(msg, "not found")
}