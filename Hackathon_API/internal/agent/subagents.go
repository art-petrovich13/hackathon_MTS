package agent

import (
	"context"
	"fmt"

	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
)

// ── VmAgent ───────────────────────────────────────────────────────────────────

type VmAgent struct {
	flavorRepo *repository.FlavorRepository
}

func NewVmAgent(fr *repository.FlavorRepository) *VmAgent {
	return &VmAgent{flavorRepo: fr}
}

// Propose выбирает оптимальный compute-flavor по числу пользователей.
func (a *VmAgent) Propose(ctx context.Context, users int, appName string) (*ServiceProposal, error) {
	flavors, err := a.flavorRepo.ListByServiceType(ctx, "compute")
	if err != nil || len(flavors) == 0 {
		return nil, fmt.Errorf("нет доступных compute-флейворов")
	}

	chosen := flavors[0]
	for _, f := range flavors {
		if users > 500 && f.CPU >= 4 {
			chosen = f
			break
		}
		if users > 100 && f.CPU >= 2 && chosen.CPU < 2 {
			chosen = f
		}
	}

	reason := fmt.Sprintf("Для %d пользователей: %d ядер обеспечат нужный throughput", users, chosen.CPU)
	if users == 0 {
		reason = "Стандартная конфигурация для приложения " + appName
	}

	return &ServiceProposal{
		ServiceType: "vm",
		Name:        appName + "-server",
		FlavorID:    chosen.ID.String(),
		FlavorName:  fmt.Sprintf("%d CPU, %dMB RAM, %dGB Disk", chosen.CPU, chosen.RAMMB, chosen.DiskGB),
		Config:      map[string]interface{}{},
		Reason:      reason,
		CostPerHour: float64(chosen.CPU)*0.02 + float64(chosen.RAMMB/1024)*0.01,
	}, nil
}

// ── DbAgent ───────────────────────────────────────────────────────────────────

type DbAgent struct {
	flavorRepo *repository.FlavorRepository
}

func NewDbAgent(fr *repository.FlavorRepository) *DbAgent {
	return &DbAgent{flavorRepo: fr}
}

// Propose выбирает db-flavor под нужный engine.
func (a *DbAgent) Propose(ctx context.Context, engine string) (*ServiceProposal, error) {
	if engine == "" {
		engine = "postgres"
	}

	flavors, _ := a.flavorRepo.ListByServiceType(ctx, "db_"+engine)
	if len(flavors) == 0 {
		// fallback на любой db-флейвор
		flavors, _ = a.flavorRepo.ListByServiceType(ctx, "db_postgres")
	}
	if len(flavors) == 0 {
		return nil, fmt.Errorf("нет доступных db-флейворов")
	}

	chosen := flavors[0]
	versionMap := map[string]string{"postgres": "15", "mysql": "8", "redis": "7"}
	ver := versionMap[engine]
	if ver == "" {
		ver = "latest"
	}
	dbName := engine + "_db"

	return &ServiceProposal{
		ServiceType: "database",
		Name:        engine + "-db",
		FlavorID:    chosen.ID.String(),
		FlavorName:  fmt.Sprintf("%d CPU, %dMB RAM", chosen.CPU, chosen.RAMMB),
		Config: map[string]interface{}{
			"engine":  engine,
			"version": ver,
			"db_name": dbName,
		},
		Reason:      fmt.Sprintf("%s %s — проверенный выбор для продакшн-приложений", engine, ver),
		CostPerHour: float64(chosen.CPU) * 0.015,
	}, nil
}

// ── StorageAgent ──────────────────────────────────────────────────────────────

type StorageAgent struct {
	flavorRepo *repository.FlavorRepository
}

func NewStorageAgent(fr *repository.FlavorRepository) *StorageAgent {
	return &StorageAgent{flavorRepo: fr}
}

// Propose выбирает object_storage-flavor.
func (a *StorageAgent) Propose(ctx context.Context, storageGB int) (*ServiceProposal, error) {
	flavors, _ := a.flavorRepo.ListByServiceType(ctx, "object_storage")
	if len(flavors) == 0 {
		return nil, fmt.Errorf("нет доступных storage-флейворов")
	}

	if storageGB <= 0 {
		storageGB = 10
	}
	chosen := flavors[0]

	return &ServiceProposal{
		ServiceType: "object_storage",
		Name:        "s3-storage",
		FlavorID:    chosen.ID.String(),
		FlavorName:  fmt.Sprintf("%dGB объектного хранилища (MinIO)", storageGB),
		Config:      map[string]interface{}{"bucket_name": "default-bucket"},
		Reason:      "MinIO совместим с AWS S3 API, идеален для статики и медиафайлов",
		CostPerHour: 0.005,
	}, nil
}
