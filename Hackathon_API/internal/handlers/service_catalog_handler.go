package handlers

import (
	"net/http"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
)

type ServiceCatalogHandler struct {
	catalogRepo *repository.ServiceCatalogRepository
	flavorRepo  *repository.FlavorRepository
}

func NewServiceCatalogHandler(
	catalogRepo *repository.ServiceCatalogRepository,
	flavorRepo *repository.FlavorRepository,
) *ServiceCatalogHandler {
	return &ServiceCatalogHandler{
		catalogRepo: catalogRepo,
		flavorRepo:  flavorRepo,
	}
}

// List обрабатывает GET /api/v1/service-catalog
// Возвращает список доступных сервисов платформы.
func (h *ServiceCatalogHandler) List(w http.ResponseWriter, r *http.Request) {
	catalog, err := h.catalogRepo.List(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch service catalog")
		return
	}
	respondJSON(w, http.StatusOK, catalog)
}

// ListWithFlavors обрабатывает GET /api/v1/service-catalog/full
// Возвращает каталог с вложенными flavor'ами для каждого сервиса.
func (h *ServiceCatalogHandler) ListWithFlavors(w http.ResponseWriter, r *http.Request) {
	catalog, err := h.catalogRepo.List(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch service catalog")
		return
	}

	type ServiceWithFlavors struct {
		models.ServiceCatalog
		Flavors []models.Flavor `json:"flavors"`
	}

	result := make([]ServiceWithFlavors, 0, len(catalog))
	for _, svc := range catalog {
		flavors, err := h.flavorRepo.ListByServiceType(r.Context(), svc.Type)
		if err != nil {
			flavors = []models.Flavor{}
		}
		result = append(result, ServiceWithFlavors{
			ServiceCatalog: svc,
			Flavors:        flavors,
		})
	}

	respondJSON(w, http.StatusOK, result)
}