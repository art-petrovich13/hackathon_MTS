package worker

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	dbcompute "github.com/art-petrovich13/hackathon_MTS/internal/compute/db"
	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
	"github.com/art-petrovich13/hackathon_MTS/internal/utils"
)

// DBWorker — обрабатывает pending managed_databases:
// выделяет порт → создаёт Docker-контейнер → сохраняет credentials.
type DBWorker struct {
	db       *sqlx.DB
	driver   *dbcompute.DatabaseDriver
	dbRepo   *repository.ManagedDatabaseRepository
	nodeRepo *repository.NodeRepository
	interval time.Duration
}

func NewDBWorker(
	db *sqlx.DB,
	driver *dbcompute.DatabaseDriver,
	dbRepo *repository.ManagedDatabaseRepository,
	nodeRepo *repository.NodeRepository,
	interval time.Duration,
) *DBWorker {
	if interval == 0 {
		interval = 5 * time.Second
	}
	return &DBWorker{
		db:       db,
		driver:   driver,
		dbRepo:   dbRepo,
		nodeRepo: nodeRepo,
		interval: interval,
	}
}

// Start запускает цикл воркера. Вызывай в горутине: go dbWorker.Start(ctx)
func (w *DBWorker) Start(ctx context.Context) {
	slog.Info("db worker started", "interval", w.interval)
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("db worker stopped")
			return
		case <-ticker.C:
			w.processBatch(ctx)
		}
	}
}

func (w *DBWorker) processBatch(ctx context.Context) {
	// Открываем транзакцию — FOR UPDATE SKIP LOCKED не позволит двум воркерам
	// взять одну и ту же запись
	tx, err := w.db.BeginTxx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		slog.Error("db worker: begin tx failed", "error", err)
		return
	}
	defer tx.Rollback() //nolint:errcheck

	dbs, err := w.dbRepo.GetPendingForUpdate(ctx, tx)
	if err != nil {
		slog.Error("db worker: fetch pending dbs failed", "error", err)
		return
	}

	if len(dbs) == 0 {
		return
	}

	slog.Info("db worker: processing batch", "count", len(dbs))

	for _, db := range dbs {
		switch db.Status {
		case "pending-start":
			w.processStart(ctx, tx, db)
			continue
		case "pending-stop":
			w.processStop(ctx, tx, db)
			continue
		}
		// Ищем любую активную ноду для выделения порта
		node, err := w.findNode(ctx, tx)
		if err != nil || node == nil {
			slog.Warn("db worker: no active node, will retry", "db_id", db.ID)
			continue
		}

		// Загружаем flavor чтобы знать сколько CPU/RAM нужно
		var flavor models.Flavor
		if err := tx.GetContext(ctx, &flavor,
			`SELECT id, name, cpu, ram_mb, disk_gb FROM flavors WHERE id = $1`,
			db.FlavorID,
		); err != nil {
			slog.Error("db worker: flavor not found", "db_id", db.ID, "error", err)
			w.setError(ctx, tx, db.ID)
			continue
		}

		// Проверяем что ресурсов хватает
		if node.FreeCPU < flavor.CPU || node.FreeRAMMB < flavor.RAMMB {
			slog.Warn("db worker: not enough resources, will retry",
				"db_id", db.ID,
				"need_cpu", flavor.CPU, "free_cpu", node.FreeCPU,
				"need_ram_mb", flavor.RAMMB, "free_ram_mb", node.FreeRAMMB,
			)
			continue
		}

		// Резервируем ресурсы ноды
		if _, err := tx.ExecContext(ctx,
			`UPDATE compute_nodes SET free_cpu = free_cpu - $1, free_ram_mb = free_ram_mb - $2 WHERE id = $3`,
			flavor.CPU, flavor.RAMMB, node.ID,
		); err != nil {
			slog.Error("db worker: reserve node resources failed", "db_id", db.ID, "error", err)
			w.setError(ctx, tx, db.ID)
			continue
		}

		// Выделяем порт (атомарно в рамках транзакции)
		hostPort, err := utils.AllocatePort(tx, node.ID, "database", db.ID)
		if err != nil {
			slog.Error("db worker: allocate port failed", "db_id", db.ID, "error", err)
			w.setError(ctx, tx, db.ID)
			continue
		}

		// Меняем статус на 'creating' — воркер не возьмёт снова
		if _, err := tx.ExecContext(ctx,
			`UPDATE managed_databases SET status = 'creating', node_id = $1, updated_at = NOW() WHERE id = $2`,
			node.ID, db.ID,
		); err != nil {
			slog.Error("db worker: set creating status failed", "db_id", db.ID, "error", err)
			w.setError(ctx, tx, db.ID)
			continue
		}

		// Запускаем Docker-операцию в горутине (после коммита транзакции)
		go w.createDatabase(db, *node, hostPort, flavor.CPU, flavor.RAMMB)
	}

	if err := tx.Commit(); err != nil {
		slog.Error("db worker: commit failed", "error", err)
	}
}

// createDatabase — вызывается в горутине после коммита основной транзакции.
// Создаёт Docker-контейнер и обновляет запись в БД.
func (w *DBWorker) createDatabase(db models.ManagedDatabase, node models.ComputeNode, hostPort int, cpu, ramMB int) {
	ctx := context.Background()
	log := slog.With("db_id", db.ID, "engine", db.Engine)
	log.Info("db worker: creating database container")

	// Генерируем credentials
	dbName := "mydb"
	if db.DBName != nil && *db.DBName != "" {
		dbName = *db.DBName
	}
	dbUser := utils.GenerateUsername("user")
	dbPass := utils.GeneratePassword(24)

	// Определяем версию движка из EngineVersion
	version := db.EngineVersion
	if version == "" || version == "latest" {
		version = defaultVersion(db.Engine)
	}

	// Создаём контейнер
	instance, err := w.driver.CreateDatabase(ctx, &dbcompute.CreateDatabaseOpts{
		Engine:   db.Engine,
		Version:  version,
		Name:     fmt.Sprintf("%s-%s", db.Name, db.ID.String()[:8]),
		DBName:   dbName,
		DBUser:   dbUser,
		DBPass:   dbPass,
		HostPort: hostPort,
	})
	if err != nil {
		log.Error("db worker: docker create failed", "error", err)
		w.compensate(ctx, db.ID, node.ID, hostPort, cpu, ramMB)
		return
	}

	// Обновляем запись: статус running + credentials
	updateTx, err := w.db.BeginTxx(ctx, nil)
	if err != nil {
		log.Error("db worker: begin update tx failed", "error", err)
		_ = w.driver.DeleteDatabase(ctx, instance.ContainerID)
		w.compensate(ctx, db.ID, node.ID, hostPort, cpu, ramMB)
		return
	}
	defer updateTx.Rollback() //nolint:errcheck

	if err := w.dbRepo.UpdateAfterCreate(ctx, updateTx, db.ID,
		instance.ContainerID, node.ID,
		instance.Host, hostPort,
		dbUser, dbPass,
	); err != nil {
		log.Error("db worker: update after create failed", "error", err)
		_ = w.driver.DeleteDatabase(ctx, instance.ContainerID)
		w.compensate(ctx, db.ID, node.ID, hostPort, cpu, ramMB)
		return
	}

	if err := updateTx.Commit(); err != nil {
		log.Error("db worker: commit update tx failed", "error", err)
		_ = w.driver.DeleteDatabase(ctx, instance.ContainerID)
		w.compensate(ctx, db.ID, node.ID, hostPort, cpu, ramMB)
		return
	}

	log.Info("db worker: database created successfully",
		"container_id", instance.ContainerID,
		"host", instance.Host,
		"port", hostPort,
	)
}

// compensate — компенсирующая транзакция при ошибке:
// ставит статус error и освобождает порт.
func (w *DBWorker) compensate(ctx context.Context, dbID uuid.UUID, nodeID uuid.UUID, hostPort int, cpu, ramMB int) {
	tx, err := w.db.BeginTxx(ctx, nil)
	if err != nil {
		slog.Error("db worker: compensation tx failed", "error", err)
		return
	}
	defer tx.Rollback() //nolint:errcheck

	// Освобождаем порт
	if hostPort > 0 {
		if err := utils.FreePort(tx, nodeID, hostPort); err != nil {
			slog.Error("db worker: free port failed", "error", err, "port", hostPort)
		}
	}

	// Возвращаем ресурсы ноде
	if _, err := tx.ExecContext(ctx,
		`UPDATE compute_nodes SET free_cpu = free_cpu + $1, free_ram_mb = free_ram_mb + $2 WHERE id = $3`,
		cpu, ramMB, nodeID,
	); err != nil {
		slog.Error("db worker: restore node resources failed", "error", err)
	}

	// Ставим статус error
	if _, err := tx.ExecContext(ctx,
		`UPDATE managed_databases SET status = 'error', updated_at = NOW() WHERE id = $1`,
		dbID,
	); err != nil {
		slog.Error("db worker: set error status failed", "error", err)
	}

	if err := tx.Commit(); err != nil {
		slog.Error("db worker: compensation commit failed", "error", err)
	}
}

// setError — ставит статус error прямо в рамках существующей транзакции.
func (w *DBWorker) setError(ctx context.Context, tx *sqlx.Tx, id uuid.UUID) {
	if _, err := tx.ExecContext(ctx,
		`UPDATE managed_databases SET status = 'error', updated_at = NOW() WHERE id = $1`, id,
	); err != nil {
		slog.Error("db worker: set error failed", "id", id, "error", err)
	}
}

// findNode — ищет любую активную ноду (для выделения порта).
func (w *DBWorker) findNode(ctx context.Context, tx *sqlx.Tx) (*models.ComputeNode, error) {
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

// defaultVersion возвращает версию по умолчанию для движка.
func defaultVersion(engine string) string {
	switch engine {
	case "postgres":
		return "15"
	case "mysql":
		return "8"
	case "redis":
		return "7"
	default:
		return "latest"
	}
}

// extractVersion достаёт версию из строки "postgres:15" → "15"
func extractVersion(dockerImage string) string {
	if idx := strings.LastIndex(dockerImage, ":"); idx >= 0 {
		return dockerImage[idx+1:]
	}
	return "latest"
}

func (w *DBWorker) processStart(ctx context.Context, tx *sqlx.Tx, db models.ManagedDatabase) {
	log := slog.With("db_id", db.ID, "op", "start")
	log.Info("db worker: starting database")

	if db.DockerContainerID == nil || *db.DockerContainerID == "" {
		log.Error("db worker: container_id is nil, cannot start")
		w.setError(ctx, tx, db.ID)
		return
	}

	if db.NodeID != nil {
		var flavor models.Flavor
		if err := tx.GetContext(ctx, &flavor,
			`SELECT id, name, cpu, ram_mb, disk_gb FROM flavors WHERE id = $1`, db.FlavorID,
		); err != nil {
			log.Error("db worker: flavor not found for start", "error", err)
			w.setError(ctx, tx, db.ID)
			return
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE compute_nodes SET free_cpu = free_cpu - $1, free_ram_mb = free_ram_mb - $2 WHERE id = $3`,
			flavor.CPU, flavor.RAMMB, *db.NodeID,
		); err != nil {
			log.Error("db worker: reserve resources failed", "error", err)
			w.setError(ctx, tx, db.ID)
			return
		}
	}

	if err := w.driver.StartContainer(ctx, *db.DockerContainerID); err != nil {
		log.Error("db worker: docker start failed", "error", err)
		w.setError(ctx, tx, db.ID)
		return
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE managed_databases SET status = 'running', updated_at = NOW() WHERE id = $1`, db.ID,
	); err != nil {
		log.Error("db worker: update status failed after start", "error", err)
		w.setError(ctx, tx, db.ID)
		return
	}

	log.Info("db worker: database started successfully")
}

func (w *DBWorker) processStop(ctx context.Context, tx *sqlx.Tx, db models.ManagedDatabase) {
	log := slog.With("db_id", db.ID, "op", "stop")
	log.Info("db worker: stopping database")

	if db.DockerContainerID == nil || *db.DockerContainerID == "" {
		log.Error("db worker: container_id is nil, cannot stop")
		w.setError(ctx, tx, db.ID)
		return
	}

	if err := w.driver.StopContainer(ctx, *db.DockerContainerID); err != nil {
		log.Error("db worker: docker stop failed", "error", err)
		w.setError(ctx, tx, db.ID)
		return
	}

	if db.NodeID != nil {
		var flavor models.Flavor
		if err := tx.GetContext(ctx, &flavor,
			`SELECT id, name, cpu, ram_mb, disk_gb FROM flavors WHERE id = $1`, db.FlavorID,
		); err != nil {
			// Контейнер уже остановлен -- логируем, но не прерываем
			log.Error("db worker: flavor not found for stop, resources not restored", "error", err)
		} else {
			if _, err := tx.ExecContext(ctx,
				`UPDATE compute_nodes SET free_cpu = free_cpu + $1, free_ram_mb = free_ram_mb + $2 WHERE id = $3`,
				flavor.CPU, flavor.RAMMB, *db.NodeID,
			); err != nil {
				log.Error("db worker: restore resources failed", "error", err)
			}
		}
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE managed_databases SET status = 'stopped', updated_at = NOW() WHERE id = $1`, db.ID,
	); err != nil {
		log.Error("db worker: update status failed after stop", "error", err)
		w.setError(ctx, tx, db.ID)
		return
	}

	log.Info("db worker: database stopped successfully")
}