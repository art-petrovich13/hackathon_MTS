// internal/handlers/health_handler.go
package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jmoiron/sqlx"
)

// HealthHandler отвечает за эндпоинт GET /health.
// Проверяет доступность БД и возвращает общий статус сервиса.
type HealthHandler struct {
	db *sqlx.DB
}

func NewHealthHandler(db *sqlx.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

// healthResponse — структура ответа health check.
type healthResponse struct {
	Status    string `json:"status"`              // "ok" или "degraded"
	DB        string `json:"db"`                  // "ok" или текст ошибки
	Timestamp string `json:"timestamp"`            // время проверки
	Uptime    string `json:"uptime,omitempty"`     // можно расширить позже
}

// Check обрабатывает GET /health.
// Возвращает 200 если всё хорошо, 503 если БД недоступна.
func (h *HealthHandler) Check(w http.ResponseWriter, r *http.Request) {
	resp := healthResponse{
		Status:    "ok",
		DB:        "ok",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	httpStatus := http.StatusOK

	// Пингуем БД с коротким таймаутом — health check должен отвечать быстро.
	ctx := r.Context()
	if err := h.db.PingContext(ctx); err != nil {
		resp.Status = "degraded"
		resp.DB = err.Error()
		httpStatus = http.StatusServiceUnavailable // 503
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)
	json.NewEncoder(w).Encode(resp)
}