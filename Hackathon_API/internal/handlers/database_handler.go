package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/art-petrovich13/hackathon_MTS/internal/models"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
)

type DatabaseHandler struct {
	dbRepo     *repository.ManagedDatabaseRepository
	flavorRepo *repository.FlavorRepository
	db         *sqlx.DB
}

func NewDatabaseHandler(
	dbRepo *repository.ManagedDatabaseRepository,
	flavorRepo *repository.FlavorRepository,
	db *sqlx.DB,
) *DatabaseHandler {
	return &DatabaseHandler{dbRepo: dbRepo, flavorRepo: flavorRepo, db: db}
}

// Create обрабатывает POST /api/v1/databases
func (h *DatabaseHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateDatabaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Валидация
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

	validEngines := map[string]bool{"postgres": true, "mysql": true, "redis": true}
	if !validEngines[req.Engine] {
		respondError(w, http.StatusBadRequest, "engine must be one of: postgres, mysql, redis")
		return
	}

	// Проверяем и загружаем flavor
	flavor, err := h.flavorRepo.GetByID(r.Context(), req.FlavorID)
	if err != nil || flavor == nil {
		respondError(w, http.StatusBadRequest, "flavor not found")
		return
	}

	// Определяем версию движка из docker_image ("postgres:15" → "15")
	engineVersion := "latest"
	if flavor.DockerImage != nil {
		parts := strings.SplitN(*flavor.DockerImage, ":", 2)
		if len(parts) == 2 {
			engineVersion = parts[1]
		}
	}

	// Имя БД по умолчанию = имя сервиса если не задано
	dbName := req.DBName
	if dbName == "" {
		dbName = req.Name
	}

	record := &models.ManagedDatabase{
		ID:            uuid.New(),
		Name:          req.Name,
		ProjectID:     req.ProjectID,
		FlavorID:      req.FlavorID,
		Engine:        req.Engine,
		EngineVersion: engineVersion,
		Status:        "pending",
		DBName:        &dbName,
	}

	tx, err := h.db.BeginTxx(r.Context(), nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to start transaction")
		return
	}
	defer tx.Rollback() //nolint:errcheck

	if err := h.dbRepo.Create(r.Context(), tx, record); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create database record")
		return
	}

	if err := tx.Commit(); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to commit transaction")
		return
	}

	respondJSON(w, http.StatusCreated, record)
}

// List обрабатывает GET /api/v1/databases
func (h *DatabaseHandler) List(w http.ResponseWriter, r *http.Request) {
	// TODO (День 18): получать projectID из JWT-контекста.
	// Пока передаём uuid.Nil → возвращаются все записи (admin-режим).
	dbs, err := h.dbRepo.List(r.Context(), uuid.Nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch databases")
		return
	}
	respondJSON(w, http.StatusOK, dbs)
}

// Get обрабатывает GET /api/v1/databases/{id}
func (h *DatabaseHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid database ID")
		return
	}

	db, err := h.dbRepo.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch database")
		return
	}
	if db == nil {
		respondError(w, http.StatusNotFound, "Database not found")
		return
	}

	respondJSON(w, http.StatusOK, db)
}

// Delete обрабатывает DELETE /api/v1/databases/{id}
func (h *DatabaseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid database ID")
		return
	}

	// Проверяем что запись существует
	db, err := h.dbRepo.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch database")
		return
	}
	if db == nil {
		respondError(w, http.StatusNotFound, "Database not found")
		return
	}

	// TODO (День 14-15): остановить Docker-контейнер и освободить порт
	// через DatabaseWorker или синхронный вызов DockerDriver.

	if err := h.dbRepo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete database")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}