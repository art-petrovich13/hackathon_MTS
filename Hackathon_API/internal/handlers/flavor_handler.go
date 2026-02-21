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
	flavors, err := h.repo.List(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch flavors")
		return
	}
	respondJSON(w, http.StatusOK, flavors)
}