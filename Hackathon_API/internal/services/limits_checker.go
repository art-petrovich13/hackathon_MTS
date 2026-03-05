package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
	"github.com/google/uuid"
)

type LimitsChecker struct {
	limitRepo  *repository.ProjectLimitRepository
	vmRepo     *repository.VMRepository
	dbRepo     *repository.ManagedDatabaseRepository
	stgRepo    *repository.ObjectStorageRepository
	fileRepo   *repository.FileStorageRepository
	mobRepo    *repository.MobileDeviceRepository
	flavorRepo *repository.FlavorRepository
}

func NewLimitsChecker(
	limitRepo *repository.ProjectLimitRepository,
	vmRepo *repository.VMRepository,
	dbRepo *repository.ManagedDatabaseRepository,
	stgRepo *repository.ObjectStorageRepository,
	fileRepo *repository.FileStorageRepository,
	mobRepo *repository.MobileDeviceRepository,
	flavorRepo *repository.FlavorRepository,
) *LimitsChecker {
	return &LimitsChecker{limitRepo, vmRepo, dbRepo, stgRepo, fileRepo, mobRepo, flavorRepo}
}

type UsageStats struct {
	VMCount      int
	TotalCPU     int
	TotalRAMMB   int
	DBCount      int
	StorageCount int // object_storage + file_storage
	MobileCount  int
}

// GetCurrentUsage считает АКТИВНЫЕ сервисы (не deleted, не error)
func (c *LimitsChecker) GetCurrentUsage(ctx context.Context, projectID uuid.UUID) (*UsageStats, error) {
	stats := &UsageStats{}

	vms, err := c.vmRepo.List(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("usage vms: %w", err)
	}
	for _, vm := range vms {
		if vm.Status == "deleted" || vm.Status == "error" {
			continue
		}
		stats.VMCount++
		flavor, _ := c.flavorRepo.GetByID(ctx, vm.FlavorID)
		if flavor != nil {
			stats.TotalCPU += flavor.CPU
			stats.TotalRAMMB += flavor.RAMMB
		}
	}

	dbs, _ := c.dbRepo.List(ctx, projectID)
	for _, db := range dbs {
		if db.Status != "deleted" {
			stats.DBCount++
		}
	}

	stgs, _ := c.stgRepo.List(ctx, projectID)
	for _, s := range stgs {
		if s.Status != "deleted" {
			stats.StorageCount++
		}
	}

	files, _ := c.fileRepo.List(ctx, projectID)
	for _, f := range files {
		if f.Status != "deleted" {
			stats.StorageCount++
		}
	}

	mobs, _ := c.mobRepo.List(ctx, projectID)
	for _, m := range mobs {
		if m.Status != "deleted" {
			stats.MobileCount++
		}
	}

	return stats, nil
}

func (c *LimitsChecker) CheckCanCreateVM(ctx context.Context, projectID, flavorID uuid.UUID) error {
	limits, err := c.limitRepo.GetByProjectID(ctx, projectID)
	if err != nil {
		return err
	}
	if limits == nil {
		return nil
	}

	usage, err := c.GetCurrentUsage(ctx, projectID)
	if err != nil {
		return err
	}

	flavor, err := c.flavorRepo.GetByID(ctx, flavorID)
	if err != nil || flavor == nil {
		return errors.New("flavor not found")
	}

	if limits.MaxVMs > 0 && usage.VMCount >= limits.MaxVMs {
		return fmt.Errorf("VM limit exceeded: %d/%d", usage.VMCount, limits.MaxVMs)
	}
	if limits.MaxCPU > 0 && usage.TotalCPU+flavor.CPU > limits.MaxCPU {
		return fmt.Errorf("CPU limit exceeded: need %d more, but only %d available",
			flavor.CPU, limits.MaxCPU-usage.TotalCPU)
	}
	if limits.MaxRAMMB > 0 && usage.TotalRAMMB+flavor.RAMMB > limits.MaxRAMMB {
		return fmt.Errorf("RAM limit exceeded: need %dMB more, but only %dMB available",
			flavor.RAMMB, limits.MaxRAMMB-usage.TotalRAMMB)
	}
	return nil
}

func (c *LimitsChecker) CheckCanCreateDB(ctx context.Context, projectID uuid.UUID) error {
	limits, _ := c.limitRepo.GetByProjectID(ctx, projectID)
	if limits == nil {
		return nil
	}
	usage, _ := c.GetCurrentUsage(ctx, projectID)
	if limits.MaxDBs > 0 && usage.DBCount >= limits.MaxDBs {
		return fmt.Errorf("database limit exceeded: %d/%d", usage.DBCount, limits.MaxDBs)
	}
	return nil
}

func (c *LimitsChecker) CheckCanCreateStorage(ctx context.Context, projectID uuid.UUID) error {
	limits, _ := c.limitRepo.GetByProjectID(ctx, projectID)
	if limits == nil {
		return nil
	}
	usage, _ := c.GetCurrentUsage(ctx, projectID)
	if limits.MaxStorages > 0 && usage.StorageCount >= limits.MaxStorages {
		return fmt.Errorf("storage limit exceeded: %d/%d", usage.StorageCount, limits.MaxStorages)
	}
	return nil
}

func (c *LimitsChecker) CheckCanCreateMobile(ctx context.Context, projectID uuid.UUID) error {
	limits, _ := c.limitRepo.GetByProjectID(ctx, projectID)
	if limits == nil {
		return nil
	}
	usage, _ := c.GetCurrentUsage(ctx, projectID)
	if limits.MaxMobile > 0 && usage.MobileCount >= limits.MaxMobile {
		return fmt.Errorf("mobile device limit exceeded: %d/%d", usage.MobileCount, limits.MaxMobile)
	}
	return nil
}
