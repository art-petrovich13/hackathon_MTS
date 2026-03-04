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

	"log/slog"
	dbcompute "github.com/art-petrovich13/hackathon_MTS/internal/compute/db"
	"github.com/art-petrovich13/hackathon_MTS/internal/utils"
)

type DatabaseHandler struct {
	dbRepo     *repository.ManagedDatabaseRepository
	flavorRepo *repository.FlavorRepository
	db         *sqlx.DB
	dbDriver   *dbcompute.DatabaseDriver
}

func NewDatabaseHandler(
	dbRepo *repository.ManagedDatabaseRepository,
	flavorRepo *repository.FlavorRepository,
	db *sqlx.DB,
	dbDriver *dbcompute.DatabaseDriver, 
) *DatabaseHandler {
	return &DatabaseHandler{dbRepo: dbRepo, flavorRepo: flavorRepo, db: db, dbDriver: dbDriver}
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
// Заменить метод Delete:
func (h *DatabaseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid database ID")
		return
	}

	record, err := h.dbRepo.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch database")
		return
	}
	if record == nil {
		respondError(w, http.StatusNotFound, "Database not found")
		return
	}

	// Если контейнер существует — удаляем его
	if record.DockerContainerID != nil && *record.DockerContainerID != "" {
		if err := h.dbDriver.DeleteDatabase(r.Context(), *record.DockerContainerID); err != nil {
			slog.Warn("failed to delete db container, proceeding",
				"id", id, "container", *record.DockerContainerID, "error", err)
		}
	}

	// Мягкое удаление записи
	if err := h.dbRepo.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete database")
		return
	}

	// Освобождаем порт и возвращаем ресурсы ноде
	if record.Port != nil && record.NodeID != nil {
		tx, _ := h.db.BeginTxx(r.Context(), nil)
		_ = utils.FreePort(tx, *record.NodeID, *record.Port)

		// Возвращаем CPU/RAM ноде
		flavor, err := h.flavorRepo.GetByID(r.Context(), record.FlavorID)
		if err == nil && flavor != nil {
			if _, err := tx.ExecContext(r.Context(),
				`UPDATE compute_nodes SET free_cpu = free_cpu + $1, free_ram_mb = free_ram_mb + $2 WHERE id = $3`,
				flavor.CPU, flavor.RAMMB, *record.NodeID,
			); err != nil {
				slog.Warn("delete db: restore node resources failed", "error", err)
			}
		}

		_ = tx.Commit()
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *DatabaseHandler) Start(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid database ID")
		return
	}
	record, err := h.dbRepo.GetByID(r.Context(), id)
	if err != nil || record == nil {
		respondError(w, http.StatusNotFound, "Database not found")
		return
	}
	if record.Status != "stopped" && record.Status != "error" {
		respondError(w, http.StatusConflict,
			"Database can only be started from 'stopped' or 'error', current: "+record.Status)
		return
	}
	if record.DockerContainerID == nil || *record.DockerContainerID == "" {
		respondError(w, http.StatusConflict, "Database has no associated container")
		return
	}
	if err := h.dbRepo.UpdateStatus(r.Context(), id, "pending-start"); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to queue start")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "start queued"})
}

func (h *DatabaseHandler) Stop(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid database ID")
		return
	}
	record, err := h.dbRepo.GetByID(r.Context(), id)
	if err != nil || record == nil {
		respondError(w, http.StatusNotFound, "Database not found")
		return
	}
	if record.Status != "running" {
		respondError(w, http.StatusConflict,
			"Database is not running, current: "+record.Status)
		return
	}
	if record.DockerContainerID == nil || *record.DockerContainerID == "" {
		respondError(w, http.StatusConflict, "Database has no associated container")
		return
	}
	if err := h.dbRepo.UpdateStatus(r.Context(), id, "pending-stop"); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to queue stop")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "stop queued"})
}