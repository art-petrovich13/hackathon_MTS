package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/art-petrovich13/hackathon_MTS/internal/agent"
	authmw "github.com/art-petrovich13/hackathon_MTS/internal/middleware"
	"github.com/google/uuid"
)

// AgentHandler — три SSE-эндпоинта:
//
//	POST /api/v1/agent/preset  — готовое решение по preset_id (без AI, 100% надёжно)
//	POST /api/v1/agent/chat    — свободный запрос → AI → план
//	POST /api/v1/agent/execute — исполнение плана → деплой
type AgentHandler struct {
	orchestrator *agent.Orchestrator
	deployer     *agent.Deployer
}

func NewAgentHandler(o *agent.Orchestrator, d *agent.Deployer) *AgentHandler {
	return &AgentHandler{orchestrator: o, deployer: d}
}

// sseHeaders — выставляет заголовки SSE и сбрасывает write-deadline.
func sseHeaders(w http.ResponseWriter) {
	rc := http.NewResponseController(w)
	rc.SetWriteDeadline(time.Time{}) //nolint:errcheck
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("X-Accel-Buffering", "no")
}

// Preset — POST /api/v1/agent/preset
// Принимает {"preset_id":"retail"}, стримит план без вызова AI.
func (h *AgentHandler) Preset(w http.ResponseWriter, r *http.Request) {
	sseHeaders(w)
	var req agent.PresetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PresetID == "" {
		http.Error(w, `{"error":"preset_id required"}`, http.StatusBadRequest)
		return
	}
	h.orchestrator.HandlePreset(r.Context(), req.PresetID, w) //nolint:errcheck
}

// Chat — POST /api/v1/agent/chat
// Принимает {"message":"..."}, стримит SSE: thinking | plan | done
func (h *AgentHandler) Chat(w http.ResponseWriter, r *http.Request) {
	sseHeaders(w)
	var req agent.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Message == "" {
		http.Error(w, `{"error":"message required"}`, http.StatusBadRequest)
		return
	}
	h.orchestrator.Chat(r.Context(), req.Message, w) //nolint:errcheck
}

// Execute — POST /api/v1/agent/execute
// Принимает {"plan":{...}}, стримит прогресс деплоя.
func (h *AgentHandler) Execute(w http.ResponseWriter, r *http.Request) {
	sseHeaders(w)
	var req agent.ExecuteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
		return
	}
	projectID := uuid.Nil
	if claims := authmw.ClaimsFromContext(r.Context()); claims != nil {
		projectID = claims.ProjectID
	}
	h.deployer.Execute(r.Context(), req, projectID, w) //nolint:errcheck
}
