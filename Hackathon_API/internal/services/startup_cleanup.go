package services

import (
	"context"
	"log/slog"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
	"github.com/jmoiron/sqlx"
)

// CleanupOrphanContainers удаляет Docker-контейнеры которые больше не имеют
// записи в БД (или запись помечена как deleted).
// Вызывается один раз при старте сервера.
func CleanupOrphanContainers(ctx context.Context, db *sqlx.DB, dockerCli *client.Client) {
	slog.Info("startup cleanup: scanning for orphan containers")

	// Префиксы контейнеров которые создаёт наш сервис
	prefixes := []string{"vm-", "fs-", "obj-", "db-", "mob-"}

	for _, prefix := range prefixes {
		f := filters.NewArgs()
		f.Add("name", prefix)

		containers, err := dockerCli.ContainerList(ctx, container.ListOptions{
			All:     true, // включая stopped
			Filters: f,
		})
		if err != nil {
			slog.Warn("startup cleanup: failed to list containers", "prefix", prefix, "error", err)
			continue
		}

		for _, c := range containers {
			containerID := c.ID
			containerName := ""
			if len(c.Names) > 0 {
				containerName = c.Names[0]
			}

			// Проверяем есть ли активная запись в БД по container_id
			active := isContainerActive(ctx, db, containerID, prefix)
			if active {
				continue
			}

			// Не нашли активную запись — orphan, удаляем
			slog.Info("startup cleanup: removing orphan container",
				"name", containerName,
				"id", containerID[:12],
			)
			if err := dockerCli.ContainerRemove(ctx, containerID, container.RemoveOptions{
				Force: true,
			}); err != nil {
				slog.Warn("startup cleanup: failed to remove container",
					"name", containerName,
					"error", err,
				)
			}
		}
	}

	// После чистки контейнеров — пересчитываем free_cpu/free_ram на нодах
	recalcNodeResources(ctx, db)

	slog.Info("startup cleanup: done")
}

// isContainerActive проверяет есть ли в БД запись с данным container_id
// и статусом != deleted
func isContainerActive(ctx context.Context, db *sqlx.DB, containerID string, prefix string) bool {
	var table string
	switch prefix {
	case "vm-":
		table = "vms"
	case "fs-":
		table = "file_storages"
	case "obj-":
		table = "object_storages"
	case "db-":
		table = "managed_databases"
	case "mob-":
		table = "mobile_devices"
	default:
		return true // неизвестный префикс — не трогаем
	}

	var count int
	err := db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM `+table+
			` WHERE docker_container_id = $1 AND status != 'deleted'`,
		containerID,
	)
	if err != nil {
		return true // при ошибке не трогаем контейнер
	}
	return count > 0
}

// recalcNodeResources пересчитывает free_cpu и free_ram_mb на всех нодах
// на основе реально активных ресурсов в БД
func recalcNodeResources(ctx context.Context, db *sqlx.DB) {
	_, err := db.ExecContext(ctx, `
		UPDATE compute_nodes cn
		SET
			free_cpu    = cn.total_cpu    - COALESCE(used.cpu, 0),
			free_ram_mb = cn.total_ram_mb - COALESCE(used.ram, 0)
		FROM (
			SELECT node_id,
				SUM(f.cpu)    AS cpu,
				SUM(f.ram_mb) AS ram
			FROM (
				SELECT node_id, flavor_id FROM vms
				WHERE status NOT IN ('deleted','error','pending','creating') AND node_id IS NOT NULL
				UNION ALL
				SELECT node_id, flavor_id FROM file_storages
				WHERE status NOT IN ('deleted','error','pending','creating') AND node_id IS NOT NULL
				UNION ALL
				SELECT node_id, flavor_id FROM object_storages
				WHERE status NOT IN ('deleted','error','pending','creating') AND node_id IS NOT NULL
				UNION ALL
				SELECT node_id, flavor_id FROM managed_databases
				WHERE status NOT IN ('deleted','error','pending','creating') AND node_id IS NOT NULL
				UNION ALL
				SELECT node_id, flavor_id FROM mobile_devices
				WHERE status NOT IN ('deleted','error','pending','creating') AND node_id IS NOT NULL
			) all_services
			JOIN flavors f ON f.id = all_services.flavor_id
			GROUP BY node_id
		) used
		WHERE cn.id = used.node_id
	`)
	if err != nil {
		slog.Warn("startup cleanup: failed to recalc node resources", "error", err)
		return
	}
	slog.Info("startup cleanup: node resources recalculated")
}
