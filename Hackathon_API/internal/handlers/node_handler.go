package handlers

import (
	"net/http"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
)

type NodeHandler struct {
	repo *repository.NodeRepository
}

func NewNodeHandler(repo *repository.NodeRepository) *NodeHandler {
	return &NodeHandler{repo: repo}
}

func (h *NodeHandler) List(w http.ResponseWriter, r *http.Request) {
	nodes, err := h.repo.List(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch nodes")
		return
	}
	respondJSON(w, http.StatusOK, nodes)
}