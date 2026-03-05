package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
	"github.com/art-petrovich13/hackathon_MTS/internal/services"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Deployer исполняет AgentPlan — создаёт ресурсы через существующие сервисы и репозитории.
// Все ресурсы создаются со статусом "pending" — воркеры подхватят их автоматически.
type Deployer struct {
	vmService  *services.VMService
	dbRepo     *repository.ManagedDatabaseRepository
	osRepo     *repository.ObjectStorageRepository
	flavorRepo *repository.FlavorRepository
	imageRepo  *repository.ImageRepository
	db         *sqlx.DB
}

func NewDeployer(
	vmSvc *services.VMService,
	dbRepo *repository.ManagedDatabaseRepository,
	osRepo *repository.ObjectStorageRepository,
	fr *repository.FlavorRepository,
	ir *repository.ImageRepository,
	db *sqlx.DB,
) *Deployer {
	return &Deployer{
		vmService:  vmSvc,
		dbRepo:     dbRepo,
		osRepo:     osRepo,
		flavorRepo: fr,
		imageRepo:  ir,
		db:         db,
	}
}

// Execute проходит по плану и создаёт ресурсы, стримя прогресс через SSE.
func (d *Deployer) Execute(ctx context.Context, req ExecuteRequest, projectID uuid.UUID, w io.Writer) error {
	total := len(req.Plan.Services)
	completed := 0

	emitStep := func(step DeployStep) {
		data, _ := json.Marshal(SSEEvent{Type: "deploy_step", Content: step})
		fmt.Fprintf(w, "data: %s\n\n", data)
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
	}

	for _, svc := range req.Plan.Services {
		flavorID, err := uuid.Parse(svc.FlavorID)
		if err != nil {
			emitStep(DeployStep{
				Step:    svc.ServiceType,
				Status:  "error",
				Message: fmt.Sprintf("Неверный FlavorID для %s: %s", svc.Name, svc.FlavorID),
			})
			continue
		}

		switch svc.ServiceType {

		// ── VM ────────────────────────────────────────────────────────────
		case "vm":
			emitStep(DeployStep{
				Step:    "creating_vm",
				Status:  "in_progress",
				Message: fmt.Sprintf("Создаю виртуальный сервер «%s»...", svc.Name),
			})

			imgs, err := d.imageRepo.List(ctx)
			if err != nil || len(imgs) == 0 {
				emitStep(DeployStep{Step: "creating_vm", Status: "error", Message: "Нет доступных образов для VM"})
				continue
			}

			vm, err := d.vmService.CreateVM(ctx, &models.CreateVMRequest{
				Name:      svc.Name,
				ProjectID: projectID,
				FlavorID:  flavorID,
				ImageID:   imgs[0].ID,
			})
			if err != nil {
				emitStep(DeployStep{Step: "creating_vm", Status: "error", Message: err.Error()})
				continue
			}
			completed++
			emitStep(DeployStep{
				Step:    "creating_vm",
				Status:  "success",
				Message: fmt.Sprintf("Сервер «%s» создан (%d/%d), запускается...", svc.Name, completed, total),
				Result:  vm,
			})
			time.Sleep(400 * time.Millisecond)

		// ── Database ──────────────────────────────────────────────────────
		case "database":
			engine, _ := svc.Config["engine"].(string)
			if engine == "" {
				engine = "postgres"
			}
			emitStep(DeployStep{
				Step:    "creating_db",
				Status:  "in_progress",
				Message: fmt.Sprintf("Разворачиваю базу данных «%s» (%s)...", svc.Name, engine),
			})

			// Определяем версию движка
			engineVersion, _ := svc.Config["version"].(string)
			if engineVersion == "" {
				// Пробуем взять из docker_image флейвора
				if flavor, err := d.flavorRepo.GetByID(ctx, flavorID); err == nil && flavor != nil && flavor.DockerImage != nil {
					parts := strings.SplitN(*flavor.DockerImage, ":", 2)
					if len(parts) == 2 {
						engineVersion = parts[1]
					}
				}
				if engineVersion == "" {
					engineVersion = map[string]string{"postgres": "15", "mysql": "8", "redis": "7"}[engine]
				}
			}

			dbName, _ := svc.Config["db_name"].(string)
			if dbName == "" {
				dbName = engine + "_db"
			}

			record := &models.ManagedDatabase{
				ID:            uuid.New(),
				Name:          svc.Name,
				ProjectID:     projectID,
				FlavorID:      flavorID,
				Engine:        engine,
				EngineVersion: engineVersion,
				Status:        "pending",
				DBName:        &dbName,
			}

			tx, err := d.db.BeginTxx(ctx, nil)
			if err != nil {
				emitStep(DeployStep{Step: "creating_db", Status: "error", Message: "Ошибка транзакции: " + err.Error()})
				continue
			}
			if err := d.dbRepo.Create(ctx, tx, record); err != nil {
				tx.Rollback() //nolint:errcheck
				emitStep(DeployStep{Step: "creating_db", Status: "error", Message: err.Error()})
				continue
			}
			tx.Commit() //nolint:errcheck
			completed++
			emitStep(DeployStep{
				Step:    "creating_db",
				Status:  "success",
				Message: fmt.Sprintf("База данных «%s» создана (%d/%d), настраивается...", svc.Name, completed, total),
				Result:  record,
			})
			time.Sleep(400 * time.Millisecond)

		// ── Object Storage ────────────────────────────────────────────────
		case "object_storage":
			emitStep(DeployStep{
				Step:    "creating_storage",
				Status:  "in_progress",
				Message: fmt.Sprintf("Создаю объектное хранилище «%s»...", svc.Name),
			})

			bucket, _ := svc.Config["bucket_name"].(string)
			if bucket == "" {
				bucket = "default-bucket"
			}
			storageLimit := 50

			record := &models.ObjectStorage{
				ID:             uuid.New(),
				Name:           svc.Name,
				ProjectID:      projectID,
				FlavorID:       flavorID,
				Status:         "pending",
				BucketName:     &bucket,
				StorageLimitGB: &storageLimit,
			}

			tx, err := d.db.BeginTxx(ctx, nil)
			if err != nil {
				emitStep(DeployStep{Step: "creating_storage", Status: "error", Message: "Ошибка транзакции: " + err.Error()})
				continue
			}
			if err := d.osRepo.Create(ctx, tx, record); err != nil {
				tx.Rollback() //nolint:errcheck
				emitStep(DeployStep{Step: "creating_storage", Status: "error", Message: err.Error()})
				continue
			}
			tx.Commit() //nolint:errcheck
			completed++
			emitStep(DeployStep{
				Step:    "creating_storage",
				Status:  "success",
				Message: fmt.Sprintf("Хранилище «%s» создано (%d/%d), инициализируется...", svc.Name, completed, total),
				Result:  record,
			})
			time.Sleep(400 * time.Millisecond)
		}
	}

	// Финальное событие
	data, _ := json.Marshal(SSEEvent{
		Type:    "done",
		Content: fmt.Sprintf("✅ Готово! Создано %d/%d сервисов. Статусы обновятся автоматически.", completed, total),
	})
	fmt.Fprintf(w, "data: %s\n\n", data)
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
	return nil
}
