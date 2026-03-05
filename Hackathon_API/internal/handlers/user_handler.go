package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/art-petrovich13/hackathon_MTS/internal/middleware"
	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
	"github.com/art-petrovich13/hackathon_MTS/internal/services"
)

type UserHandler struct {
	userRepo      *repository.UserRepository
	projectRepo   *repository.ProjectRepository
	limitRepo     *repository.ProjectLimitRepository
	limitsChecker *services.LimitsChecker
}

func NewUserHandler(
	userRepo *repository.UserRepository,
	projectRepo *repository.ProjectRepository,
	limitRepo *repository.ProjectLimitRepository,
	lc *services.LimitsChecker,
) *UserHandler {
	return &UserHandler{userRepo, projectRepo, limitRepo, lc}
}

// ListUsers — GET /api/v1/users (только admin)
func (h *UserHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.userRepo.List(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to load users")
		return
	}

	type UserWithProject struct {
		models.User
		Project *models.Project      `json:"project,omitempty"`
		Limits  *models.ProjectLimit `json:"limits,omitempty"`
	}

	result := make([]UserWithProject, 0, len(users))
	for _, u := range users {
		p, _ := h.projectRepo.GetByUserID(r.Context(), u.ID)
		var limits *models.ProjectLimit
		if p != nil {
			limits, _ = h.limitRepo.GetByProjectID(r.Context(), p.ID)
		}
		result = append(result, UserWithProject{User: u, Project: p, Limits: limits})
	}
	respondJSON(w, http.StatusOK, result)
}

// GetUser — GET /api/v1/users/{id} (только admin)
func (h *UserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}
	user, err := h.userRepo.GetByID(r.Context(), id)
	if err != nil || user == nil {
		respondError(w, http.StatusNotFound, "User not found")
		return
	}
	respondJSON(w, http.StatusOK, user)
}

// CreateUser — POST /api/v1/users (только admin)
func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Role == "" {
		req.Role = "user"
	}

	existing, _ := h.userRepo.GetByEmail(r.Context(), req.Email)
	if existing != nil {
		respondError(w, http.StatusConflict, "Email already registered")
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	user := &models.User{
		ID:           uuid.New(),
		Email:        req.Email,
		PasswordHash: string(hash),
		Role:         req.Role,
	}
	if err := h.userRepo.Create(r.Context(), nil, user); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	project := &models.Project{ID: uuid.New(), Name: "default", UserID: user.ID}
	_ = h.projectRepo.Create(r.Context(), nil, project)

	// Устанавливаем дефолтные лимиты для нового проекта
	limit := &models.ProjectLimit{
		ID: uuid.New(), ProjectID: project.ID,
		MaxVMs: 5, MaxCPU: 8, MaxRAMMB: 8192, MaxDiskGB: 100,
		MaxDBs: 3, MaxStorages: 3, MaxMobile: 2,
	}
	_ = h.limitRepo.Create(r.Context(), limit)

	respondJSON(w, http.StatusCreated, user)
}

// DeleteUser — DELETE /api/v1/users/{id} (только admin)
func (h *UserHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}
	// Нельзя удалить самого себя
	claims := middleware.ClaimsFromContext(r.Context())
	if claims != nil && claims.UserID == id {
		respondError(w, http.StatusConflict, "Cannot delete your own account")
		return
	}
	if err := h.userRepo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete user")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// SetLimits — PUT /api/v1/users/{id}/limits (только admin)
func (h *UserHandler) SetLimits(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}
	project, err := h.projectRepo.GetByUserID(r.Context(), id)
	if err != nil || project == nil {
		respondError(w, http.StatusNotFound, "Project not found for this user")
		return
	}

	var req models.ProjectLimit
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.ProjectID = project.ID

	if err := h.limitRepo.Upsert(r.Context(), &req); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update limits")
		return
	}
	respondJSON(w, http.StatusOK, req)
}

// GetLimits — GET /api/v1/users/{id}/limits (admin only)
func (h *UserHandler) GetLimits(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	project, _ := h.projectRepo.GetByUserID(r.Context(), userID)
	if project == nil {
		respondJSON(w, http.StatusOK, map[string]any{"limits": nil, "usage": nil})
		return
	}

	limits, _ := h.limitRepo.GetByProjectID(r.Context(), project.ID)
	usage, _ := h.limitsChecker.GetCurrentUsage(r.Context(), project.ID)

	respondJSON(w, http.StatusOK, map[string]any{
		"limits": limits,
		"usage":  usage,
	})
}
