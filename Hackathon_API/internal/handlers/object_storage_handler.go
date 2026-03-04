package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	objectcompute "github.com/art-petrovich13/hackathon_MTS/internal/compute/object"
	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
	"github.com/art-petrovich13/hackathon_MTS/internal/utils"
)

type ObjectStorageHandler struct {
	osRepo     *repository.ObjectStorageRepository
	flavorRepo *repository.FlavorRepository
	db         *sqlx.DB
	driver     *objectcompute.MinIODriver
}

func NewObjectStorageHandler(
	osRepo *repository.ObjectStorageRepository,
	flavorRepo *repository.FlavorRepository,
	db *sqlx.DB,
	driver *objectcompute.MinIODriver,
) *ObjectStorageHandler {
	return &ObjectStorageHandler{osRepo: osRepo, flavorRepo: flavorRepo, db: db, driver: driver}
}

// Create — POST /api/v1/object-storages
func (h *ObjectStorageHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateObjectStorageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "name is required")
		return
	}
	if req.ProjectID == uuid.Nil {
		respondError(w, http.StatusBadRequest, "project_id is required")
		return
	}
	if req.FlavorID == uuid.Nil {
		respondError(w, http.StatusBadRequest, "flavor_id is required")
		return
	}

	flavor, err := h.flavorRepo.GetByID(r.Context(), req.FlavorID)
	if err != nil || flavor == nil {
		respondError(w, http.StatusBadRequest, "flavor not found")
		return
	}

	bucketName := req.BucketName
	if bucketName == "" {
		bucketName = req.Name
	}
	storageLimit := flavor.DiskGB

	record := &models.ObjectStorage{
		ID:             uuid.New(),
		Name:           req.Name,
		ProjectID:      req.ProjectID,
		FlavorID:       req.FlavorID,
		Status:         "pending",
		BucketName:     &bucketName,
		StorageLimitGB: &storageLimit,
	}

	tx, err := h.db.BeginTxx(r.Context(), nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to start transaction")
		return
	}
	defer tx.Rollback() //nolint:errcheck

	if err := h.osRepo.Create(r.Context(), tx, record); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create object storage")
		return
	}

	if err := tx.Commit(); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to commit")
		return
	}

	respondJSON(w, http.StatusCreated, record)
}

// List — GET /api/v1/object-storages
func (h *ObjectStorageHandler) List(w http.ResponseWriter, r *http.Request) {
	storages, err := h.osRepo.List(r.Context(), uuid.Nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch object storages")
		return
	}
	respondJSON(w, http.StatusOK, storages)
}

// Get — GET /api/v1/object-storages/{id}
func (h *ObjectStorageHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	os, err := h.osRepo.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch")
		return
	}
	if os == nil {
		respondError(w, http.StatusNotFound, "Object storage not found")
		return
	}
	respondJSON(w, http.StatusOK, os)
}

// Delete — DELETE /api/v1/object-storages/{id}
func (h *ObjectStorageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	record, err := h.osRepo.GetByID(r.Context(), id)
	if err != nil || record == nil {
		respondError(w, http.StatusNotFound, "Object storage not found")
		return
	}

	// Удаляем Docker контейнер
	if record.DockerContainerID != nil && *record.DockerContainerID != "" {
		if err := h.driver.Delete(r.Context(), *record.DockerContainerID); err != nil {
			slog.Warn("os delete: container remove failed", "id", id, "error", err)
		}
	}

	if err := h.osRepo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete")
		return
	}

	// Освобождаем ресурсы
	if record.NodeID != nil {
		tx, _ := h.db.BeginTxx(r.Context(), nil)
		_ = utils.FreeServicePorts(tx, id)
		if flavor, err := h.flavorRepo.GetByID(r.Context(), record.FlavorID); err == nil && flavor != nil {
			_, _ = tx.ExecContext(r.Context(),
				`UPDATE compute_nodes SET free_cpu = free_cpu + $1, free_ram_mb = free_ram_mb + $2 WHERE id = $3`,
				flavor.CPU, flavor.RAMMB, *record.NodeID,
			)
		}
		_ = tx.Commit()
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ObjectStorageHandler) Start(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	record, err := h.osRepo.GetByID(r.Context(), id)
	if err != nil || record == nil {
		respondError(w, http.StatusNotFound, "Object storage not found")
		return
	}
	if record.Status != "stopped" && record.Status != "error" {
		respondError(w, http.StatusConflict,
			"Can only start from 'stopped' or 'error', current: "+record.Status)
		return
	}
	if record.DockerContainerID == nil || *record.DockerContainerID == "" {
		respondError(w, http.StatusConflict, "No associated container")
		return
	}
	if err := h.osRepo.UpdateStatus(r.Context(), id, "pending-start"); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to queue start")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "start queued"})
}

func (h *ObjectStorageHandler) Stop(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	record, err := h.osRepo.GetByID(r.Context(), id)
	if err != nil || record == nil {
		respondError(w, http.StatusNotFound, "Object storage not found")
		return
	}
	if record.Status != "running" {
		respondError(w, http.StatusConflict,
			"Object storage is not running, current: "+record.Status)
		return
	}
	if err := h.osRepo.UpdateStatus(r.Context(), id, "pending-stop"); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to queue stop")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "stop queued"})
}