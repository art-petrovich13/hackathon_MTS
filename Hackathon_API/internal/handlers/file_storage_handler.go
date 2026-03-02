package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
	"github.com/art-petrovich13/hackathon_MTS/internal/utils"
)

type FileStorageHandler struct {
	fsRepo     *repository.FileStorageRepository
	flavorRepo *repository.FlavorRepository
	db         *sqlx.DB
}

func NewFileStorageHandler(
	fsRepo *repository.FileStorageRepository,
	flavorRepo *repository.FlavorRepository,
	db *sqlx.DB,
) *FileStorageHandler {
	return &FileStorageHandler{fsRepo: fsRepo, flavorRepo: flavorRepo, db: db}
}

// Create — POST /api/v1/file-storages
func (h *FileStorageHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateFileStorageRequest
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

	record := &models.FileStorage{
		ID:        uuid.New(),
		Name:      req.Name,
		ProjectID: req.ProjectID,
		FlavorID:  req.FlavorID,
		Status:    "pending",
	}

	tx, err := h.db.BeginTxx(r.Context(), nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to start transaction")
		return
	}
	defer tx.Rollback() //nolint:errcheck

	if err := h.fsRepo.Create(r.Context(), tx, record); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create file storage")
		return
	}

	if err := tx.Commit(); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to commit")
		return
	}

	respondJSON(w, http.StatusCreated, record)
}

// List — GET /api/v1/file-storages
func (h *FileStorageHandler) List(w http.ResponseWriter, r *http.Request) {
	storages, err := h.fsRepo.List(r.Context(), uuid.Nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch file storages")
		return
	}
	respondJSON(w, http.StatusOK, storages)
}

// Get — GET /api/v1/file-storages/{id}
func (h *FileStorageHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	fs, err := h.fsRepo.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch")
		return
	}
	if fs == nil {
		respondError(w, http.StatusNotFound, "File storage not found")
		return
	}
	respondJSON(w, http.StatusOK, fs)
}

// Delete — DELETE /api/v1/file-storages/{id}
func (h *FileStorageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	record, err := h.fsRepo.GetByID(r.Context(), id)
	if err != nil || record == nil {
		respondError(w, http.StatusNotFound, "File storage not found")
		return
	}

	if err := h.fsRepo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete")
		return
	}

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
		slog.Info("file storage deleted", "id", id)
	}

	w.WriteHeader(http.StatusNoContent)
}