// internal/compute/driver/driver.go
package driver

import "context"

// VMInstance представляет информацию о виртуальной машине (контейнере)
// после выполнения операции создания или получения статуса.
type VMInstance struct {
	// ID контейнера, присвоенный Docker (реальный или симулированный)
	ID string
	// Имя контейнера (обычно соответствует имени VM)
	Name string
	// Статус: running, stopped, error, pending и т.д.
	Status string
	// IP-адрес контейнера в сети Docker
	IPAddress string
}

// CreateVMOpts содержит все параметры, необходимые для создания новой VM.
type CreateVMOpts struct {
	Name      string // Желаемое имя VM
	CPU       int    // Количество ядер CPU (целое число)
	RAMMB     int    // Объём RAM в мегабайтах
	ImageName string // Имя Docker-образа (например, "ubuntu:22.04")
}

// ContainerStats содержит метрики использования ресурсов контейнера.
type ContainerStats struct {
	CPUPercent    float64 // Доля использования CPU (0.0 - 1.0)
	MemoryUsageMB int64   // Используемая RAM в МБ
	NetworkRx     uint64  // Получено байт с момента запуска контейнера
	NetworkTx     uint64  // Отправлено байт с момента запуска
}

// ComputeDriver — основной интерфейс для всех операций с виртуальными машинами.
// Все методы должны быть контекстно-зависимыми для поддержки отмены и таймаутов.
type ComputeDriver interface {
	// --- Базовые операции с VM ---
	CreateVM(ctx context.Context, opts *CreateVMOpts) (*VMInstance, error)
	DeleteVM(ctx context.Context, vmID string) error
	StartVM(ctx context.Context, vmID string) error
	StopVM(ctx context.Context, vmID string) error
	GetVM(ctx context.Context, vmID string) (*VMInstance, error)

	// --- Операции для снапшотов (DR) ---
	// CreateSnapshot создаёт образ (снапшот) из работающего контейнера.
	CreateSnapshot(ctx context.Context, containerID string, snapshotName string) (string, error)
	// RestoreSnapshot создаёт и запускает новый контейнер из ранее созданного снапшота.
	RestoreSnapshot(ctx context.Context, imageName string, newContainerName string, cpu int, ramMB int) (string, string, error)

	// --- Операции для импорта образов (миграция) ---
	// ImportImage загружает образ из внешнего URL и делает его доступным в Docker.
	ImportImage(ctx context.Context, imageName string, url string) error

	// --- Операции для сбора метрик (FinOps) ---
	// GetStats возвращает текущую статистику использования ресурсов контейнера.
	GetStats(ctx context.Context, containerID string) (*ContainerStats, error)
}
