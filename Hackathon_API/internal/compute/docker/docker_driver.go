package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"

	"github.com/art-petrovich13/hackathon_MTS/internal/compute/driver"
)

// DockerDriver — реализация ComputeDriver поверх Docker API.
type DockerDriver struct {
	cli *client.Client
}

// NewDockerDriver создаёт клиента Docker из переменных окружения.
// Если DOCKER_HOST не задан — используется локальный сокет /var/run/docker.sock.
func NewDockerDriver() (*DockerDriver, error) {
	cli, err := client.NewClientWithOpts(
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, fmt.Errorf("docker client init: %w", err)
	}
	return &DockerDriver{cli: cli}, nil
}

// ──────────────────────────────────────────────
// CreateVM — создаёт и запускает контейнер-«VM».
// ──────────────────────────────────────────────
func (d *DockerDriver) CreateVM(ctx context.Context, opts *driver.CreateVMOpts) (*driver.VMInstance, error) {
	// 1. Проверяем наличие образа локально.
	_, _, err := d.cli.ImageInspectWithRaw(ctx, opts.ImageName)
	if err != nil {
		// Образа нет — скачиваем. Отдельный таймаут на pull.
		pullCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
		defer cancel()

		reader, pullErr := d.cli.ImagePull(pullCtx, opts.ImageName, image.PullOptions{})
		if pullErr != nil {
			return nil, fmt.Errorf("image pull %q: %w", opts.ImageName, pullErr)
		}
		// Ждём завершения скачивания (читаем весь поток).
		io.Copy(io.Discard, reader)
		reader.Close()
	}

	// 2. Формируем конфигурацию контейнера.
	// 2. Формируем конфигурацию контейнера.
	containerName := "vm-" + randString(10)

	// Определяем Cmd: для VNC-образов (novnc_port > 0) не переопределяем CMD —
	// образ dorowu/ubuntu-desktop-lxde-vnc имеет собственный entrypoint.
	// Для обычных образов (alpine, ubuntu) нужен sleep infinity, иначе контейнер сразу выйдет.
	var cmd []string
	if opts.NoVNCPort == 0 {
		cmd = []string{"sleep", "infinity"}
	}

	cfg := &container.Config{
		Image:    opts.ImageName,
		Hostname: opts.Name,
		Cmd:      cmd, // nil для VNC-образов — Docker использует CMD из Dockerfile
		Labels: map[string]string{
			"iaas.vm.name": opts.Name,
			"iaas.managed": "true",
		},
	}

	// Формируем port bindings — только если нужен noVNC
	var portBindings nat.PortMap
	var exposedPorts nat.PortSet

	if opts.NoVNCPort > 0 {
		portBindings = nat.PortMap{
			// Образ dorowu/ubuntu-desktop-lxde-vnc экспортирует noVNC на порту 80
			"80/tcp": []nat.PortBinding{
				{HostIP: "0.0.0.0", HostPort: fmt.Sprintf("%d", opts.NoVNCPort)},
			},
		}
		exposedPorts = nat.PortSet{
			"80/tcp": struct{}{},
		}
		cfg.ExposedPorts = exposedPorts
	}

	hostCfg := &container.HostConfig{
		Resources: container.Resources{
			NanoCPUs: int64(opts.CPU) * 1_000_000_000,
			Memory:   int64(opts.RAMMB) * 1024 * 1024,
		},
		PortBindings:  portBindings, // nil если noVNC не нужен
		RestartPolicy: container.RestartPolicy{Name: "unless-stopped"},
	}

	// 3. Создаём контейнер.
	resp, err := d.cli.ContainerCreate(ctx, cfg, hostCfg, &network.NetworkingConfig{}, nil, containerName)
	if err != nil {
		return nil, fmt.Errorf("container create: %w", err)
	}

	// 4. Запускаем контейнер.
	if err := d.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		// Если запуск упал — убираем созданный контейнер.
		_ = d.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		return nil, fmt.Errorf("container start: %w", err)
	}

	// 5. Получаем IP-адрес из сетевых настроек.
	ip, err := d.getContainerIP(ctx, resp.ID)
	if err != nil {
		return nil, fmt.Errorf("get container ip: %w", err)
	}

	return &driver.VMInstance{
		ID:        resp.ID,
		Name:      containerName,
		Status:    "running",
		IPAddress: ip,
		NoVNCPort: opts.NoVNCPort, // возвращаем обратно чтобы воркер сохранил в БД
	}, nil
}

// ──────────────────────────────────────────────
// DeleteVM — принудительно удаляет контейнер.
// ──────────────────────────────────────────────
func (d *DockerDriver) DeleteVM(ctx context.Context, vmID string) error {
	err := d.cli.ContainerRemove(ctx, vmID, container.RemoveOptions{
		Force:         true, // убиваем даже запущенный
		RemoveVolumes: true,
	})
	if err != nil {
		return fmt.Errorf("container remove %q: %w", vmID, err)
	}
	return nil
}

// ──────────────────────────────────────────────
// StartVM — запускает остановленный контейнер.
// ──────────────────────────────────────────────
func (d *DockerDriver) StartVM(ctx context.Context, vmID string) error {
	err := d.cli.ContainerStart(ctx, vmID, container.StartOptions{})
	if err != nil {
		return fmt.Errorf("container start %q: %w", vmID, err)
	}
	return nil
}

// ──────────────────────────────────────────────
// StopVM — мягко останавливает контейнер (SIGTERM → SIGKILL).
// ──────────────────────────────────────────────
func (d *DockerDriver) StopVM(ctx context.Context, vmID string) error {
	// В SDK v25+ ContainerStop принимает StopOptions, а не *time.Duration.
	timeoutSec := 30
	err := d.cli.ContainerStop(ctx, vmID, container.StopOptions{
		Timeout: &timeoutSec,
	})
	if err != nil {
		return fmt.Errorf("container stop %q: %w", vmID, err)
	}
	return nil
}

// ──────────────────────────────────────────────
// GetVM — возвращает текущее состояние контейнера.
// ──────────────────────────────────────────────
func (d *DockerDriver) GetVM(ctx context.Context, vmID string) (*driver.VMInstance, error) {
	inspect, err := d.cli.ContainerInspect(ctx, vmID)
	if err != nil {
		return nil, fmt.Errorf("container inspect %q: %w", vmID, err)
	}

	status := "stopped"
	if inspect.State != nil && inspect.State.Running {
		status = "running"
	}

	ip := extractIP(inspect.NetworkSettings)

	return &driver.VMInstance{
		ID:        vmID,
		Name:      inspect.Name,
		Status:    status,
		IPAddress: ip,
	}, nil
}

// ──────────────────────────────────────────────
// CreateSnapshot — коммитит контейнер в образ Docker.
// Возвращает ID созданного образа (sha256:...).
// ──────────────────────────────────────────────
func (d *DockerDriver) CreateSnapshot(ctx context.Context, containerID string, snapshotName string) (string, error) {
	commitResp, err := d.cli.ContainerCommit(ctx, containerID, container.CommitOptions{
		Reference: snapshotName,
		Comment:   "iaas snapshot",
		Author:    "iaas-platform",
		Pause:     true, // приостанавливаем контейнер для консистентности
	})
	if err != nil {
		return "", fmt.Errorf("container commit %q -> %q: %w", containerID, snapshotName, err)
	}
	return commitResp.ID, nil
}

// ──────────────────────────────────────────────
// RestoreSnapshot — создаёт новый контейнер из образа снапшота.
// Возвращает containerID и IP нового контейнера.
// ──────────────────────────────────────────────
func (d *DockerDriver) RestoreSnapshot(ctx context.Context, imageName string, newContainerName string, cpu int, ramMB int) (string, string, error) {
	cfg := &container.Config{
		Image: imageName,
		Cmd:   []string{"sleep", "infinity"},
		Labels: map[string]string{
			"iaas.managed":   "true",
			"iaas.restored":  "true",
			"iaas.from_snap": imageName,
		},
	}

	hostCfg := &container.HostConfig{
		Resources: container.Resources{
			NanoCPUs: int64(cpu) * 1_000_000_000,
			Memory:   int64(ramMB) * 1024 * 1024,
		},
		RestartPolicy: container.RestartPolicy{Name: "unless-stopped"},
	}

	resp, err := d.cli.ContainerCreate(ctx, cfg, hostCfg, &network.NetworkingConfig{}, nil, newContainerName)
	if err != nil {
		return "", "", fmt.Errorf("restore create container from %q: %w", imageName, err)
	}

	if err := d.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		_ = d.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		return "", "", fmt.Errorf("restore start container: %w", err)
	}

	ip, err := d.getContainerIP(ctx, resp.ID)
	if err != nil {
		return "", "", fmt.Errorf("restore get ip: %w", err)
	}

	return resp.ID, ip, nil
}

// ──────────────────────────────────────────────
// ImportImage — скачивает tar-архив по URL и загружает его в Docker.
// Файл должен быть совместим с `docker load` (сохранённый через `docker save`).
// ──────────────────────────────────────────────
func (d *DockerDriver) ImportImage(ctx context.Context, imageName string, url string) error {
	// Скачиваем файл по URL с таймаутом.
	httpClient := &http.Client{Timeout: 10 * time.Minute}
	resp, err := httpClient.Get(url)
	if err != nil {
		return fmt.Errorf("download image from %q: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download image: unexpected status %d from %q", resp.StatusCode, url)
	}

	// В SDK v25+ ImageLoad не принимает bool-аргумент quiet.
	loadResp, err := d.cli.ImageLoad(ctx, resp.Body)
	if err != nil {
		return fmt.Errorf("image load: %w", err)
	}
	defer loadResp.Body.Close()

	// Читаем ответ до конца, чтобы загрузка завершилась корректно.
	io.Copy(io.Discard, loadResp.Body)

	return nil
}

// ──────────────────────────────────────────────
// GetStats — возвращает метрики контейнера (CPU, RAM, сеть).
// Делает один снимок (не стрим).
// ──────────────────────────────────────────────

// statsJSON — локальная структура для парсинга ответа Docker Stats API.
// types.StatsJSON в SDK v25+ переехал в другой пакет; используем свой,
// чтобы не зависеть от конкретной версии SDK.
type statsJSON struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage  uint64   `json:"total_usage"`
			PercpuUsage []uint64 `json:"percpu_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64            `json:"usage"`
		Stats map[string]uint64 `json:"stats"`
	} `json:"memory_stats"`
	Networks map[string]struct {
		RxBytes uint64 `json:"rx_bytes"`
		TxBytes uint64 `json:"tx_bytes"`
	} `json:"networks"`
}

func (d *DockerDriver) GetStats(ctx context.Context, containerID string) (*driver.ContainerStats, error) {
	statsResp, err := d.cli.ContainerStats(ctx, containerID, false)
	if err != nil {
		return nil, fmt.Errorf("container stats %q: %w", containerID, err)
	}
	defer statsResp.Body.Close()

	var v statsJSON
	if err := json.NewDecoder(statsResp.Body).Decode(&v); err != nil {
		return nil, fmt.Errorf("decode stats: %w", err)
	}

	// Вычисляем процент CPU через дельту между двумя снимками.
	cpuPercent := 0.0
	cpuDelta := float64(v.CPUStats.CPUUsage.TotalUsage) - float64(v.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(v.CPUStats.SystemUsage) - float64(v.PreCPUStats.SystemUsage)
	numCPU := float64(len(v.CPUStats.CPUUsage.PercpuUsage))
	if numCPU == 0 {
		numCPU = 1
	}
	if systemDelta > 0 && cpuDelta > 0 {
		cpuPercent = (cpuDelta / systemDelta) * numCPU
	}

	// RAM: реальное потребление без кеша страниц (актуально для Linux).
	memUsageBytes := v.MemoryStats.Usage
	if cache, ok := v.MemoryStats.Stats["cache"]; ok && memUsageBytes > cache {
		memUsageBytes -= cache
	}
	memUsageMB := int64(memUsageBytes) / 1024 / 1024

	// Сетевой трафик — ищем eth0, иначе первый попавшийся интерфейс.
	var rxBytes, txBytes uint64
	if net, ok := v.Networks["eth0"]; ok {
		rxBytes = net.RxBytes
		txBytes = net.TxBytes
	} else {
		for _, net := range v.Networks {
			rxBytes = net.RxBytes
			txBytes = net.TxBytes
			break
		}
	}

	return &driver.ContainerStats{
		CPUPercent:    cpuPercent,
		MemoryUsageMB: memUsageMB,
		NetworkRx:     rxBytes,
		NetworkTx:     txBytes,
	}, nil
}

// ──────────────────────────────────────────────
// Вспомогательные функции
// ──────────────────────────────────────────────

// getContainerIP инспектирует контейнер и возвращает его IP.
func (d *DockerDriver) getContainerIP(ctx context.Context, containerID string) (string, error) {
	const maxAttempts = 5
	for i := range maxAttempts {
		inspect, err := d.cli.ContainerInspect(ctx, containerID)
		if err != nil {
			return "", err
		}
		if ip := extractIP(inspect.NetworkSettings); ip != "" {
			return ip, nil
		}
		if i < maxAttempts-1 {
			time.Sleep(300 * time.Millisecond)
		}
	}
	return "", fmt.Errorf("container %q did not get an IP after %d attempts", containerID, maxAttempts)
}

// extractIP вытаскивает IP из NetworkSettings.
// Сначала проверяет IPAddress верхнего уровня (стандартный bridge),
// затем перебирает пользовательские сети.
func extractIP(settings *types.NetworkSettings) string {
	if settings == nil {
		return ""
	}
	if settings.IPAddress != "" {
		return settings.IPAddress
	}
	for _, net := range settings.Networks {
		if net.IPAddress != "" {
			return net.IPAddress
		}
	}
	return ""
}

// randString генерирует случайную строку из строчных букв и цифр длиной n.
func randString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}
