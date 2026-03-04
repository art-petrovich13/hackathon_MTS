package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/art-petrovich13/hackathon_MTS/internal/agent"
	authmw "github.com/art-petrovich13/hackathon_MTS/internal/middleware"
	"github.com/google/uuid"
)

// AgentHandler обрабатывает два SSE-эндпоинта:
//   POST /api/v1/agent/chat    — стримит мысли + план
//   POST /api/v1/agent/execute — стримит прогресс деплоя
type AgentHandler struct {
	orchestrator *agent.Orchestrator
	deployer     *agent.Deployer
}

func NewAgentHandler(o *agent.Orchestrator, d *agent.Deployer) *AgentHandler {
	return &AgentHandler{orchestrator: o, deployer: d}
}

// Chat — POST /api/v1/agent/chat
// Принимает {"message":"..."}, стримит SSE: thinking... | plan | done
func (h *AgentHandler) Chat(w http.ResponseWriter, r *http.Request) {
	// Отключаем write-deadline для SSE (иначе Go обрежет соединение через 10с)
	rc := http.NewResponseController(w)
	rc.SetWriteDeadline(time.Time{}) //nolint:errcheck

	// ОБЯЗАТЕЛЬНО: SSE-заголовки ДО любого Write
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("X-Accel-Buffering", "no") // отключаем буфер nginx если он есть

	var req agent.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Message == "" {
		http.Error(w, `{"error":"message required"}`, http.StatusBadRequest)
		return
	}

	h.orchestrator.Chat(r.Context(), req.Message, w) //nolint:errcheck
}

// Execute — POST /api/v1/agent/execute
// Принимает {"plan":{...}}, стримит SSE: deploy_step... | done
func (h *AgentHandler) Execute(w http.ResponseWriter, r *http.Request) {
	rc := http.NewResponseController(w)
	rc.SetWriteDeadline(time.Time{}) //nolint:errcheck

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("X-Accel-Buffering", "no")

	var req agent.ExecuteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
		return
	}

	// Берём projectID из JWT-токена (как во всех других хендлерах)
	projectID := uuid.Nil
	if claims := authmw.ClaimsFromContext(r.Context()); claims != nil {
		projectID = claims.ProjectID
	}

	h.deployer.Execute(r.Context(), req, projectID, w) //nolint:errcheck
}
