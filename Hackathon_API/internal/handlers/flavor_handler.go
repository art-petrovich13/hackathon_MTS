package handlers

import (
	"net/http"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
)

type FlavorHandler struct {
	repo *repository.FlavorRepository
}

func NewFlavorHandler(repo *repository.FlavorRepository) *FlavorHandler {
	return &FlavorHandler{repo: repo}
}

// List возвращает список всех доступных конфигураций (flavors).
func (h *FlavorHandler) List(w http.ResponseWriter, r *http.Request) {
	serviceType := r.URL.Query().Get("service_type")

	flavors, err := h.repo.ListByServiceType(r.Context(), serviceType)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch flavors")
		return
	}
	respondJSON(w, http.StatusOK, flavors)
}