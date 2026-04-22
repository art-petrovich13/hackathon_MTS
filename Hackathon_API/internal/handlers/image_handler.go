package handlers

import (
	"net/http"

	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
)

type ImageHandler struct {
	repo *repository.ImageRepository
}

func NewImageHandler(repo *repository.ImageRepository) *ImageHandler {
	return &ImageHandler{repo: repo}
}

func (h *ImageHandler) List(w http.ResponseWriter, r *http.Request) {
	images, err := h.repo.List(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch images")
		return
	}
	respondJSON(w, http.StatusOK, images)
}
