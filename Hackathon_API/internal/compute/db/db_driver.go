package db

import (
	"context"
	"fmt"
	"io"
	"time"
	"strings"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
)

// DatabaseInstance — результат создания контейнера с БД
type DatabaseInstance struct {
	ContainerID string
	Host        string // IP контейнера в сети Docker
	Port        int    // порт на хосте (из port_allocations)
}

// DatabaseDriver создаёт/удаляет контейнеры с управляемыми СУБД
type DatabaseDriver struct {
	cli *client.Client
}

func NewDatabaseDriver() (*DatabaseDriver, error) {
	cli, err := client.NewClientWithOpts(
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, fmt.Errorf("docker client init: %w", err)
	}
	return &DatabaseDriver{cli: cli}, nil
}

// CreateDatabaseOpts — параметры для создания контейнера с БД
type CreateDatabaseOpts struct {
	Engine    string // "postgres" | "mysql" | "redis"
	Version   string // "15" | "8" | "7"
	Name      string // имя контейнера и базы данных
	DBName    string // название БД внутри
	DBUser    string // имя пользователя
	DBPass    string // пароль
	HostPort  int    // порт на хосте (уже выделен через AllocatePort)
}

// CreateDatabase — создаёт и запускает контейнер с СУБД.
// Возвращает ContainerID, IP и реальный порт.
func (d *DatabaseDriver) CreateDatabase(ctx context.Context, opts *CreateDatabaseOpts) (*DatabaseInstance, error) {
	dockerImage, containerPort, env := d.buildConfig(opts)

	// 1. Скачиваем образ если нужно
	if err := d.ensureImage(ctx, dockerImage); err != nil {
		return nil, fmt.Errorf("ensure image %q: %w", dockerImage, err)
	}

	// 2. Маппинг порта: containerPort → HostPort
	portSpec := fmt.Sprintf("%d/tcp", containerPort)
	hostBinding := nat.PortMap{
		nat.Port(portSpec): []nat.PortBinding{
			{HostIP: "0.0.0.0", HostPort: fmt.Sprintf("%d", opts.HostPort)},
		},
	}
	exposedPorts := nat.PortSet{nat.Port(portSpec): struct{}{}}

	containerName := fmt.Sprintf("db-%s", opts.Name)

	cfg := &container.Config{
		Image:        dockerImage,
		Env:          env,
		ExposedPorts: exposedPorts,
		Labels: map[string]string{
			"iaas.managed":  "true",
			"iaas.db.name":  opts.Name,
			"iaas.db.engine": opts.Engine,
		},
	}

	hostCfg := &container.HostConfig{
		PortBindings:  hostBinding,
		RestartPolicy: container.RestartPolicy{Name: "unless-stopped"},
	}

	// 3. Создаём контейнер
	resp, err := d.cli.ContainerCreate(ctx, cfg, hostCfg, &network.NetworkingConfig{}, nil, containerName)
	if err != nil {
		return nil, fmt.Errorf("container create: %w", err)
	}

	// 4. Запускаем
	if err := d.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		_ = d.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		return nil, fmt.Errorf("container start: %w", err)
	}

	// 5. Ждём пока БД поднимется
	if err := d.waitReady(ctx, resp.ID, opts.Engine); err != nil {
		_ = d.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		return nil, fmt.Errorf("db not ready: %w", err)
	}

	// 6. Получаем IP контейнера
	inspect, err := d.cli.ContainerInspect(ctx, resp.ID)
	if err != nil {
		return nil, fmt.Errorf("inspect: %w", err)
	}
	ip := inspect.NetworkSettings.IPAddress
	if ip == "" {
		for _, n := range inspect.NetworkSettings.Networks {
			ip = n.IPAddress
			break
		}
	}

	return &DatabaseInstance{
		ContainerID: resp.ID,
		Host:        ip,
		Port:        opts.HostPort,
	}, nil
}

// DeleteDatabase — останавливает и удаляет контейнер с БД.
func (d *DatabaseDriver) DeleteDatabase(ctx context.Context, containerID string) error {
	err := d.cli.ContainerRemove(ctx, containerID, container.RemoveOptions{
		Force:         true,
		RemoveVolumes: true,
	})
	if err != nil {
		return fmt.Errorf("remove container %q: %w", containerID, err)
	}
	return nil
}

// ─── Внутренние методы ──────────────────────────────────────────────────────

// buildConfig возвращает docker image, внутренний порт и переменные окружения
// в зависимости от движка БД.
func (d *DatabaseDriver) buildConfig(opts *CreateDatabaseOpts) (dockerImage string, containerPort int, env []string) {
	switch opts.Engine {
	case "postgres":
		dockerImage = fmt.Sprintf("postgres:%s", opts.Version)
		containerPort = 5432
		env = []string{
			fmt.Sprintf("POSTGRES_DB=%s", opts.DBName),
			fmt.Sprintf("POSTGRES_USER=%s", opts.DBUser),
			fmt.Sprintf("POSTGRES_PASSWORD=%s", opts.DBPass),
		}

	case "mysql":
		dockerImage = fmt.Sprintf("mysql:%s", opts.Version)
		containerPort = 3306
		env = []string{
			fmt.Sprintf("MYSQL_DATABASE=%s", opts.DBName),
			fmt.Sprintf("MYSQL_USER=%s", opts.DBUser),
			fmt.Sprintf("MYSQL_PASSWORD=%s", opts.DBPass),
			fmt.Sprintf("MYSQL_ROOT_PASSWORD=%s", opts.DBPass), // root нужен MySQL
		}

	case "redis":
		dockerImage = fmt.Sprintf("redis:%s", opts.Version)
		containerPort = 6379
		// Redis без аутентификации по умолчанию, пароль через --requirepass
		if opts.DBPass != "" {
			env = []string{fmt.Sprintf("REDIS_PASSWORD=%s", opts.DBPass)}
		}

	default:
		// Fallback — postgres
		dockerImage = "postgres:15"
		containerPort = 5432
		env = []string{
			fmt.Sprintf("POSTGRES_DB=%s", opts.DBName),
			fmt.Sprintf("POSTGRES_USER=%s", opts.DBUser),
			fmt.Sprintf("POSTGRES_PASSWORD=%s", opts.DBPass),
		}
	}
	return
}

// ensureImage скачивает образ если его нет локально.
func (d *DatabaseDriver) ensureImage(ctx context.Context, dockerImage string) error {
	_, _, err := d.cli.ImageInspectWithRaw(ctx, dockerImage)
	if err == nil {
		return nil // образ уже есть
	}

	pullCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	reader, err := d.cli.ImagePull(pullCtx, dockerImage, image.PullOptions{})
	if err != nil {
		return fmt.Errorf("image pull %q: %w", dockerImage, err)
	}
	defer reader.Close()
	io.Copy(io.Discard, reader) // ждём завершения скачивания
	return nil
}

// waitReady ждёт пока БД будет готова принимать соединения.
// Использует docker logs — простой и надёжный способ для хакатона.
func (d *DatabaseDriver) waitReady(ctx context.Context, containerID string, engine string) error {
	// Паттерны в логах которые означают "БД готова"
	readyPatterns := map[string]string{
		"postgres": "database system is ready to accept connections",
		"mysql":    "ready for connections",
		"redis":    "Ready to accept connections",
	}
	pattern, ok := readyPatterns[engine]
	if !ok {
		// Неизвестный движок — просто ждём 5 секунд
		time.Sleep(5 * time.Second)
		return nil
	}

	// Ждём до 90 секунд
	deadline := time.Now().Add(90 * time.Second)
	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		logReader, err := d.cli.ContainerLogs(ctx, containerID, container.LogsOptions{
			ShowStdout: true,
			ShowStderr: true,
		})
		if err == nil {
			logBytes, _ := io.ReadAll(logReader)
			logReader.Close()
			logStr := string(logBytes)
			if strings.Contains(logStr, pattern) {
    			return nil
			}
		}

		time.Sleep(2 * time.Second)
	}

	return fmt.Errorf("database not ready after 90 seconds (engine: %s)", engine)
}

// containsPattern простая проверка содержимого строки.
func containsPattern(s, pattern string) bool {
	return len(s) > 0 && len(pattern) > 0 &&
		// Используем strings.Contains без импорта через простую реализацию
		func() bool {
			for i := 0; i <= len(s)-len(pattern); i++ {
				if s[i:i+len(pattern)] == pattern {
					return true
				}
			}
			return false
		}()
}