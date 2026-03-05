package agent

// SSEEvent — одно событие, стримируемое фронтенду через Server-Sent Events.
// Type: "thinking" | "plan" | "deploy_step" | "error" | "done"
type SSEEvent struct {
	Type    string      `json:"type"`
	Content interface{} `json:"content"`
}

// ServiceProposal — предложение одного суб-агента по конкретному ресурсу.
type ServiceProposal struct {
	ServiceType string                 `json:"service_type"` // vm | database | object_storage
	Name        string                 `json:"name"`
	FlavorID    string                 `json:"flavor_id"`
	FlavorName  string                 `json:"flavor_name"` // "2 CPU, 4096MB RAM, 50GB Disk"
	Config      map[string]interface{} `json:"config"`      // engine, version, bucket_name...
	Reason      string                 `json:"reason"`
	CostPerHour float64                `json:"cost_per_hour"`
}

// AgentPlan — финальный план от оркестратора, который отправляется фронтенду.
type AgentPlan struct {
	Summary          string            `json:"summary"`
	Services         []ServiceProposal `json:"services"`
	TotalCostPerHour float64           `json:"total_cost_per_hour"`
}

// ChatRequest — тело POST /api/v1/agent/chat
type ChatRequest struct {
	Message string `json:"message"`
}

// ExecuteRequest — тело POST /api/v1/agent/execute
type ExecuteRequest struct {
	Plan AgentPlan `json:"plan"`
}

// DeployStep — один шаг деплоя, стримируется как SSEEvent{Type:"deploy_step"}.
type DeployStep struct {
	Step    string      `json:"step"`             // creating_vm | creating_db | creating_storage | done
	Status  string      `json:"status"`           // in_progress | success | error
	Message string      `json:"message"`
	Result  interface{} `json:"result,omitempty"` // VirtualMachine | ManagedDatabase | ObjectStorage
}

// Parsed — структура намерений пользователя, которую возвращает Mistral.

