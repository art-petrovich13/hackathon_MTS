package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/art-petrovich13/hackathon_MTS/internal/middleware"
	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/services"
)

type VMHandler struct {
	service       *services.VMService
	limitsChecker *services.LimitsChecker
}

func NewVMHandler(service *services.VMService, lc *services.LimitsChecker) *VMHandler {
	return &VMHandler{service: service, limitsChecker: lc}
}

type CreateVMRequest = models.CreateVMRequest

func (h *VMHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateVMRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "name is required")
		return
	}
	if req.FlavorID == uuid.Nil || req.ImageID == uuid.Nil {
		respondError(w, http.StatusBadRequest, "flavor_id and image_id are required")
		return
	}

	// Подставляем project_id из токена для user
	claims := middleware.ClaimsFromContext(r.Context())
	if claims != nil && claims.Role != "admin" {
		req.ProjectID = claims.ProjectID
	}
	if req.ProjectID == uuid.Nil {
		respondError(w, http.StatusBadRequest, "project_id is required")
		return
	}

	// Проверяем лимиты
	if err := h.limitsChecker.CheckCanCreateVM(r.Context(), req.ProjectID, req.FlavorID); err != nil {
		respondError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	vm, err := h.service.CreateVM(r.Context(), &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, vm)
}

func (h *VMHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var projectID uuid.UUID
	if claims != nil && claims.Role != "admin" {
		projectID = claims.ProjectID
	}
	vms, err := h.service.ListVMs(r.Context(), projectID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch VMs")
		return
	}
	respondJSON(w, http.StatusOK, vms)
}

func (h *VMHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid VM ID")
		return
	}
	vm, err := h.service.GetVM(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "VM not found")
		return
	}
	respondJSON(w, http.StatusOK, vm)
}

func (h *VMHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid VM ID")
		return
	}

	// ownership check
	vm, err := h.service.GetVM(r.Context(), id)
	if err != nil || vm == nil {
		respondError(w, http.StatusNotFound, "VM not found")
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())
	if claims != nil && claims.Role != "admin" && vm.ProjectID != claims.ProjectID {
		respondError(w, http.StatusForbidden, "Access denied")
		return
	}

	if err := h.service.DeleteVM(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *VMHandler) Start(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid VM ID")
		return
	}
	if err := h.service.StartVM(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "start initiated"})
}

func (h *VMHandler) Stop(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid VM ID")
		return
	}
	if err := h.service.StopVM(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "stop initiated"})
}

// GetConsole — GET /api/v1/vms/{id}/console
func (h *VMHandler) GetConsole(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid VM ID")
		return
	}

	vm, err := h.service.GetVM(r.Context(), id)
	if err != nil || vm == nil {
		respondError(w, http.StatusNotFound, "VM not found")
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())
	if claims != nil && claims.Role != "admin" && vm.ProjectID != claims.ProjectID {
		respondError(w, http.StatusForbidden, "Access denied")
		return
	}

	if vm.NoVNCPort == nil {
		respondError(w, http.StatusNotFound, "This VM does not have VNC enabled")
		return
	}
	if vm.Status != "running" {
		respondError(w, http.StatusConflict, "VM is not running")
		return
	}

	host := "127.0.0.1"
	if vm.IPAddress != nil {
		host = *vm.IPAddress
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"novnc_url": fmt.Sprintf("http://%s:%d/vnc.html", host, *vm.NoVNCPort),
		"host":      host,
		"port":      *vm.NoVNCPort,
	})
}
