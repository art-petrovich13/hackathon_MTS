package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	mobilecompute "github.com/art-petrovich13/hackathon_MTS/internal/compute/mobile"
	"github.com/art-petrovich13/hackathon_MTS/internal/middleware"
	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
	"github.com/art-petrovich13/hackathon_MTS/internal/utils"
)

type MobileHandler struct {
	mobileRepo *repository.MobileDeviceRepository
	flavorRepo *repository.FlavorRepository
	db         *sqlx.DB
	driver     *mobilecompute.MobileDriver
}

func NewMobileHandler(
	mobileRepo *repository.MobileDeviceRepository,
	flavorRepo *repository.FlavorRepository,
	db *sqlx.DB,
	driver *mobilecompute.MobileDriver,
) *MobileHandler {
	return &MobileHandler{mobileRepo: mobileRepo, flavorRepo: flavorRepo, db: db, driver: driver}
}

func (h *MobileHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateMobileDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())
	if claims != nil && claims.Role != "admin" {
		req.ProjectID = claims.ProjectID
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

	osVersion := req.OSVersion
	if osVersion == "" {
		osVersion = "android-11"
	}

	record := &models.MobileDevice{
		ID:         uuid.New(),
		Name:       req.Name,
		ProjectID:  req.ProjectID,
		FlavorID:   req.FlavorID,
		DeviceType: "android",
		OSVersion:  osVersion,
		Status:     "pending",
	}

	tx, err := h.db.BeginTxx(r.Context(), nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to start transaction")
		return
	}
	defer tx.Rollback() //nolint:errcheck

	if err := h.mobileRepo.Create(r.Context(), tx, record); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create mobile device")
		return
	}
	if err := tx.Commit(); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to commit")
		return
	}

	respondJSON(w, http.StatusCreated, record)
}

func (h *MobileHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var projectID uuid.UUID
	if claims != nil && claims.Role != "admin" {
		projectID = claims.ProjectID
	}
	devices, err := h.mobileRepo.List(r.Context(), projectID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch mobile devices")
		return
	}
	respondJSON(w, http.StatusOK, devices)
}

func (h *MobileHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	dev, err := h.mobileRepo.GetByID(r.Context(), id)
	if err != nil || dev == nil {
		respondError(w, http.StatusNotFound, "Mobile device not found")
		return
	}
	respondJSON(w, http.StatusOK, dev)
}

func (h *MobileHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	record, err := h.mobileRepo.GetByID(r.Context(), id)
	if err != nil || record == nil {
		respondError(w, http.StatusNotFound, "Mobile device not found")
		return
	}

	if record.DockerContainerID != nil && *record.DockerContainerID != "" {
		if err := h.driver.Delete(r.Context(), *record.DockerContainerID); err != nil {
			slog.Warn("mobile delete: container remove failed", "id", id, "error", err)
		}
	}

	if err := h.mobileRepo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete")
		return
	}

	if record.NodeID != nil {
		tx, _ := h.db.BeginTxx(r.Context(), nil)
		_ = utils.FreeServicePorts(tx, id)
		if flavor, err := h.flavorRepo.GetByID(r.Context(), record.FlavorID); err == nil {
			_, _ = tx.ExecContext(r.Context(),
				`UPDATE compute_nodes SET free_cpu = free_cpu + $1, free_ram_mb = free_ram_mb + $2 WHERE id = $3`,
				flavor.CPU, flavor.RAMMB, *record.NodeID,
			)
		}
		_ = tx.Commit()
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *MobileHandler) Start(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	record, err := h.mobileRepo.GetByID(r.Context(), id)
	if err != nil || record == nil {
		respondError(w, http.StatusNotFound, "Mobile device not found")
		return
	}
	if record.Status != "stopped" && record.Status != "error" {
		respondError(w, http.StatusConflict, "Can only start from 'stopped', current: "+record.Status)
		return
	}
	if err := h.mobileRepo.UpdateStatus(r.Context(), id, "pending-start"); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to queue start")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "start queued"})
}

func (h *MobileHandler) Stop(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	record, err := h.mobileRepo.GetByID(r.Context(), id)
	if err != nil || record == nil {
		respondError(w, http.StatusNotFound, "Mobile device not found")
		return
	}
	if record.Status != "running" {
		respondError(w, http.StatusConflict, "Mobile device is not running, current: "+record.Status)
		return
	}
	if err := h.mobileRepo.UpdateStatus(r.Context(), id, "pending-stop"); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to queue stop")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "stop queued"})
}
