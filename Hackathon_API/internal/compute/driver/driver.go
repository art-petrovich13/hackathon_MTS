// internal/compute/driver/driver.go
package driver

import "context"

// VMInstance представляет информацию о виртуальной машине (контейнере)
// после выполнения операции создания или получения статуса.
type VMInstance struct {
	ID        string
	Name      string
	Status    string
	IPAddress string
	NoVNCPort int // реально выделенный host-порт для noVNC (0 если не выделялся)
}

// CreateVMOpts содержит все параметры, необходимые для создания новой VM.
type CreateVMOpts struct {
	Name      string
	CPU       int
	RAMMB     int
	ImageName string
	NoVNCPort int // 0 = не биндить noVNC порт; > 0 = биндить этот host-порт на контейнерный 80
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
