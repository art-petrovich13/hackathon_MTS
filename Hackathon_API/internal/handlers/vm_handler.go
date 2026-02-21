package handlers

import (
	"encoding/json"
	"net/http"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/services"
)

type VMHandler struct {
	service *services.VMService
}

func NewVMHandler(service *services.VMService) *VMHandler {
	return &VMHandler{service: service}
}

// CreateVMRequest – тело запроса на создание VM.
// (можно использовать models.CreateVMRequest)
type CreateVMRequest = models.CreateVMRequest

// Create обрабатывает POST /api/v1/vms
func (h *VMHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateVMRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Валидация (простейшая)
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "name is required")
		return
	}
	if req.ProjectID == uuid.Nil {
		respondError(w, http.StatusBadRequest, "project_id is required")
		return
	}
	if req.FlavorID == uuid.Nil || req.ImageID == uuid.Nil {
		respondError(w, http.StatusBadRequest, "flavor_id and image_id are required")
		return
	}

	vm, err := h.service.CreateVM(r.Context(), &req)
	if err != nil {
		// Здесь можно более детально обработать ошибки (например, если flavor не найден)
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, vm)
}

// List возвращает все VM (позже можно добавить фильтр по проекту)
func (h *VMHandler) List(w http.ResponseWriter, r *http.Request) {
	// TODO: получать project_id из контекста после аутентификации
	// Пока передаём uuid.Nil, чтобы получить все
	vms, err := h.service.ListVMs(r.Context(), uuid.Nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch VMs")
		return
	}
	respondJSON(w, http.StatusOK, vms)
}

// Get возвращает VM по ID
func (h *VMHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid VM ID")
		return
	}

	vm, err := h.service.GetVM(r.Context(), id)
	if err != nil {
		// Если VM не найдена, вернём 404
		respondError(w, http.StatusNotFound, "VM not found")
		return
	}
	respondJSON(w, http.StatusOK, vm)
}

// Delete обрабатывает DELETE /api/v1/vms/{id}
func (h *VMHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid VM ID")
		return
	}

	if err := h.service.DeleteVM(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent) // 204 No Content
}

// Start обрабатывает POST /api/v1/vms/{id}/start
func (h *VMHandler) Start(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
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

// Stop обрабатывает POST /api/v1/vms/{id}/stop
func (h *VMHandler) Stop(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
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