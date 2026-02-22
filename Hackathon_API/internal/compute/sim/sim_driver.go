// internal/compute/sim/sim_driver.go
package sim

import (
	"context"
	"fmt"
	"log/slog"
	"math/rand"
	"time"

	"github.com/art-petrovich13/hackathon_MTS/internal/compute/driver"
)

// init гарантирует, что генератор случайных чисел будет инициализирован.
func init() {
	rand.Seed(time.Now().UnixNano())
}

// SimDriver реализует интерфейс ComputeDriver, но не взаимодействует с реальным Docker.
type SimDriver struct {
	logger *slog.Logger
}

// NewSimDriver создаёт новый симуляционный драйвер с логгером по умолчанию.
func NewSimDriver() *SimDriver {
	return &SimDriver{
		logger: slog.Default().With("component", "sim_driver"),
	}
}

// randString генерирует случайную строку заданной длины из символов a-z0-9.
func randString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

// CreateVM имитирует создание контейнера.
func (d *SimDriver) CreateVM(ctx context.Context, opts *driver.CreateVMOpts) (*driver.VMInstance, error) {
	// Проверяем, не отменён ли контекст
	select {
	case <-ctx.Done():
		d.logger.Warn("CreateVM cancelled", "error", ctx.Err())
		return nil, ctx.Err()
	default:
	}

	d.logger.Info("simulating CreateVM",
		"name", opts.Name,
		"image", opts.ImageName,
		"cpu", opts.CPU,
		"ram_mb", opts.RAMMB,
	)

	// Имитация длительной операции (например, скачивание образа)
	time.Sleep(500 * time.Millisecond)

	// Генерируем случайные данные
	instance := &driver.VMInstance{
		ID:        "sim-" + randString(8),
		Name:      opts.Name,
		Status:    "running", // по умолчанию считаем, что контейнер сразу запущен
		IPAddress: fmt.Sprintf("192.168.%d.%d", rand.Intn(254)+1, rand.Intn(254)+1),
	}

	d.logger.Info("VM created", "id", instance.ID, "ip", instance.IPAddress)
	return instance, nil
}

// DeleteVM имитирует удаление контейнера.
func (d *SimDriver) DeleteVM(ctx context.Context, vmID string) error {
	select {
	case <-ctx.Done():
		d.logger.Warn("DeleteVM cancelled", "vm_id", vmID, "error", ctx.Err())
		return ctx.Err()
	default:
	}

	d.logger.Info("simulating DeleteVM", "vm_id", vmID)
	time.Sleep(300 * time.Millisecond)
	return nil
}

// StartVM имитирует запуск контейнера.
func (d *SimDriver) StartVM(ctx context.Context, vmID string) error {
	select {
	case <-ctx.Done():
		d.logger.Warn("StartVM cancelled", "vm_id", vmID, "error", ctx.Err())
		return ctx.Err()
	default:
	}

	d.logger.Info("simulating StartVM", "vm_id", vmID)
	time.Sleep(200 * time.Millisecond)
	return nil
}

// StopVM имитирует остановку контейнера.
func (d *SimDriver) StopVM(ctx context.Context, vmID string) error {
	select {
	case <-ctx.Done():
		d.logger.Warn("StopVM cancelled", "vm_id", vmID, "error", ctx.Err())
		return ctx.Err()
	default:
	}

	d.logger.Info("simulating StopVM", "vm_id", vmID)
	time.Sleep(200 * time.Millisecond)
	return nil
}

// GetVM имитирует получение информации о контейнере.
func (d *SimDriver) GetVM(ctx context.Context, vmID string) (*driver.VMInstance, error) {
	select {
	case <-ctx.Done():
		d.logger.Warn("GetVM cancelled", "vm_id", vmID, "error", ctx.Err())
		return nil, ctx.Err()
	default:
	}

	d.logger.Info("simulating GetVM", "vm_id", vmID)

	// Для симуляции просто возвращаем фиктивные данные, предполагая, что VM существует.
	// В реальном драйвере здесь был бы запрос к Docker.
	return &driver.VMInstance{
		ID:        vmID,
		Name:      "simulated-vm",
		Status:    "running",
		IPAddress: "192.168.1.100",
	}, nil
}

// --- Заглушки для будущих методов ---

func (d *SimDriver) CreateSnapshot(ctx context.Context, containerID string, snapshotName string) (string, error) {
	d.logger.Info("CreateSnapshot called (stub)", "container_id", containerID, "snapshot_name", snapshotName)
	// TODO: реализовать позже
	return "", nil
}

func (d *SimDriver) RestoreSnapshot(ctx context.Context, imageName string, newContainerName string, cpu int, ramMB int) (string, string, error) {
	d.logger.Info("RestoreSnapshot called (stub)", "image_name", imageName, "new_container", newContainerName)
	// TODO: реализовать позже
	return "", "", nil
}

func (d *SimDriver) ImportImage(ctx context.Context, imageName string, url string) error {
	d.logger.Info("ImportImage called (stub)", "image_name", imageName, "url", url)
	// TODO: реализовать позже
	return nil
}

func (d *SimDriver) GetStats(ctx context.Context, containerID string) (*driver.ContainerStats, error) {
	d.logger.Info("GetStats called (stub)", "container_id", containerID)

	return &driver.ContainerStats{
		CPUPercent:    0.05,
		MemoryUsageMB: 128,
		NetworkRx:     1024,
		NetworkTx:     512,
	}, nil
}
