package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/art-petrovich13/hackathon_MTS/internal/auth"
	"github.com/art-petrovich13/hackathon_MTS/internal/middleware"
	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
)

type AuthHandler struct {
	userRepo    *repository.UserRepository
	projectRepo *repository.ProjectRepository
}

func NewAuthHandler(userRepo *repository.UserRepository, projectRepo *repository.ProjectRepository) *AuthHandler {
	return &AuthHandler{userRepo: userRepo, projectRepo: projectRepo}
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UserResponse struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	ProjectID uuid.UUID `json:"project_id"`
	CreatedAt time.Time `json:"created_at"`
}

type LoginResponse struct {
	Token     string       `json:"token"`
	ExpiresAt time.Time    `json:"expires_at"`
	User      UserResponse `json:"user"`
}

// Login — POST /api/v1/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		respondError(w, http.StatusBadRequest, "Email and password are required")
		return
	}

	fmt.Printf("DEBUG login attempt: email=%q password=%q\n", req.Email, req.Password)

	user, err := h.userRepo.GetByEmail(r.Context(), req.Email)

	fmt.Printf("DEBUG user found: %+v, err: %v\n", user, err)

	if err != nil || user == nil {
		respondError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	bcryptErr := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))

	fmt.Printf("DEBUG bcrypt result: %v\n", bcryptErr)

	if bcryptErr != nil {
		respondError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	project, err := h.projectRepo.GetByUserID(r.Context(), user.ID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to load project")
		return
	}
	if project == nil {
		project = &models.Project{
			ID:     uuid.New(),
			Name:   "default",
			UserID: user.ID,
		}
		if err := h.projectRepo.Create(r.Context(), nil, project); err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to create project")
			return
		}
	}

	token, err := auth.GenerateToken(user.ID, user.Email, user.Role, project.ID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	respondJSON(w, http.StatusOK, LoginResponse{
		Token:     token,
		ExpiresAt: time.Now().Add(24 * time.Hour),
		User: UserResponse{
			ID:        user.ID,
			Email:     user.Email,
			Role:      user.Role,
			ProjectID: project.ID,
			CreatedAt: user.CreatedAt,
		},
	})
}

// Register — POST /api/v1/auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Email == "" || len(req.Password) < 6 {
		respondError(w, http.StatusBadRequest, "Email required, password min 6 chars")
		return
	}

	// Проверяем что email не занят
	existing, _ := h.userRepo.GetByEmail(r.Context(), req.Email)
	if existing != nil {
		respondError(w, http.StatusConflict, "Email already registered")
		return
	}

	// Хэшируем пароль
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	user := &models.User{
		ID:           uuid.New(),
		Email:        req.Email,
		PasswordHash: string(hash),
		Role:         "user",
	}
	if err := h.userRepo.Create(r.Context(), nil, user); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	// Создаём проект сразу при регистрации
	project := &models.Project{
		ID:     uuid.New(),
		Name:   "default",
		UserID: user.ID,
	}
	if err := h.projectRepo.Create(r.Context(), nil, project); err != nil {
		respondError(w, http.StatusInternalServerError, "User created but project failed")
		return
	}

	respondJSON(w, http.StatusCreated, map[string]string{
		"message":    "User registered successfully",
		"user_id":    user.ID.String(),
		"project_id": project.ID.String(),
	})
}

// Me — GET /api/v1/auth/me (текущий пользователь из токена)
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}
	respondJSON(w, http.StatusOK, UserResponse{
		ID:        claims.UserID,
		Email:     claims.Email,
		Role:      claims.Role,
		ProjectID: claims.ProjectID,
	})
}
