package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// openRouterReq — тело запроса в OpenRouter (OpenAI-совместимый формат).
type openRouterReq struct {
	Model     string              `json:"model"`
	Messages  []map[string]string `json:"messages"`
	MaxTokens int                 `json:"max_tokens"`
}

// Orchestrator — главный агент-координатор.
type Orchestrator struct {
	vmAgent      *VmAgent
	dbAgent      *DbAgent
	storageAgent *StorageAgent
	apiKey       string // OPENROUTER_API_KEY
}

func NewOrchestrator(vm *VmAgent, db *DbAgent, s *StorageAgent, apiKey string) *Orchestrator {
	return &Orchestrator{vmAgent: vm, dbAgent: db, storageAgent: s, apiKey: apiKey}
}

// systemPrompt — точный и надёжный промт для Mistral.
const systemPrompt = `You are an AI infrastructure agent for a cloud IaaS platform. The user describes their project and you must determine which infrastructure resources they need.

Analyze the request and respond ONLY with a valid JSON object. No markdown, no explanations, no code blocks.

JSON format (all fields required):
{"needs_vm":bool,"needs_db":bool,"needs_storage":bool,"needs_redis":bool,"engine":"postgres|mysql|redis","users":number,"app":"string","storage_gb":number,"summary":"string"}

Field rules:
- needs_vm: true if they need an application server, backend, web app, API, any framework (Django, Node, FastAPI, etc)
- needs_db: true if they need a relational database (PostgreSQL, MySQL) or primary data store
- needs_storage: true if they need file/object storage (S3, files, media, uploads, backups)
- needs_redis: true if they explicitly mention caching, Redis, sessions, queues, pub/sub
- engine: "postgres" for most web apps, "mysql" if explicitly requested, "redis" only if no relational DB needed
- users: extract number from text, default 100 if not mentioned
- app: short name of the technology/framework (django, node, fastapi, wordpress, etc) or "app"
- storage_gb: storage size in GB, default 10 if not mentioned
- summary: 1 short sentence in Russian describing what will be deployed

Examples:
Input: "Django сайт с PostgreSQL для 500 пользователей"
Output: {"needs_vm":true,"needs_db":true,"needs_storage":false,"needs_redis":false,"engine":"postgres","users":500,"app":"django","storage_gb":0,"summary":"Django-приложение с PostgreSQL для 500 пользователей"}

Input: "Redis кеш для API"
Output: {"needs_vm":false,"needs_db":true,"needs_storage":false,"needs_redis":false,"engine":"redis","users":0,"app":"api","storage_gb":0,"summary":"Redis кеш для API-сервиса"}

Input: "интернет-магазин с загрузкой фото товаров"
Output: {"needs_vm":true,"needs_db":true,"needs_storage":true,"needs_redis":true,"engine":"postgres","users":200,"app":"e-commerce","storage_gb":50,"summary":"Интернет-магазин с базой данных, кешем и хранилищем для фото"}`

// Parsed — структура намерений пользователя.
type Parsed struct {
	NeedsVM      bool   `json:"needs_vm"`
	NeedsDB      bool   `json:"needs_db"`
	NeedsStorage bool   `json:"needs_storage"`
	NeedsRedis   bool   `json:"needs_redis"`
	Engine       string `json:"engine"`
	Users        int    `json:"users"`
	App          string `json:"app"`
	StorageGB    int    `json:"storage_gb"`
	Summary      string `json:"summary"`
}

// Chat — основной метод оркестратора для свободного запроса.
func (o *Orchestrator) Chat(ctx context.Context, msg string, w io.Writer) error {
	o.emit(w, SSEEvent{Type: "thinking", Content: "Анализирую запрос: " + msg})

	// ── Парсим намерения через Mistral или fallback ──────────────────────
	parsed, err := o.parseIntent(ctx, msg)
	if err != nil {
		o.emit(w, SSEEvent{Type: "thinking", Content: "⚠️ Онлайн-AI недоступен, использую встроенный анализатор..."})
		parsed = o.fallbackParse(msg)
	}

	return o.buildAndEmitPlan(ctx, parsed, w)
}

// buildAndEmitPlan — собирает план из Parsed и стримит результат.
func (o *Orchestrator) buildAndEmitPlan(ctx context.Context, parsed *Parsed, w io.Writer) error {
	var proposals []ServiceProposal
	var totalCost float64

	if parsed.NeedsVM {
		o.emit(w, SSEEvent{Type: "thinking", Content: "VmAgent: подбираю конфигурацию сервера..."})
		prop, err := o.vmAgent.Propose(ctx, parsed.Users, parsed.App)
		if err == nil {
			proposals = append(proposals, *prop)
			totalCost += prop.CostPerHour
		}
	}

	if parsed.NeedsDB {
		engine := parsed.Engine
		if engine == "" {
			engine = "postgres"
		}
		o.emit(w, SSEEvent{Type: "thinking", Content: "DbAgent: выбираю " + engine + " конфигурацию..."})
		prop, err := o.dbAgent.Propose(ctx, engine)
		if err == nil {
			proposals = append(proposals, *prop)
			totalCost += prop.CostPerHour
		}
	}

	if parsed.NeedsRedis {
		o.emit(w, SSEEvent{Type: "thinking", Content: "DbAgent: добавляю Redis-кеш..."})
		prop, err := o.dbAgent.Propose(ctx, "redis")
		if err == nil {
			prop.Name = "redis-cache"
			proposals = append(proposals, *prop)
			totalCost += prop.CostPerHour
		}
	}

	if parsed.NeedsStorage {
		o.emit(w, SSEEvent{Type: "thinking", Content: "StorageAgent: подбираю объектное хранилище..."})
		prop, err := o.storageAgent.Propose(ctx, parsed.StorageGB)
		if err == nil {
			proposals = append(proposals, *prop)
			totalCost += prop.CostPerHour
		}
	}

	if len(proposals) == 0 {
		o.emit(w, SSEEvent{Type: "error", Content: "Не удалось определить нужные ресурсы. Попробуйте: \"Django + PostgreSQL для 500 пользователей\""})
		o.emit(w, SSEEvent{Type: "done", Content: nil})
		return nil
	}

	summary := parsed.Summary
	if summary == "" {
		if parsed.App != "" && parsed.App != "app" {
			summary = fmt.Sprintf("Инфраструктура для %s (%d сервисов)", parsed.App, len(proposals))
		} else {
			summary = fmt.Sprintf("Готовая инфраструктура из %d сервисов", len(proposals))
		}
	}

	plan := AgentPlan{
		Summary:          summary,
		Services:         proposals,
		TotalCostPerHour: totalCost,
	}

	o.emit(w, SSEEvent{Type: "plan", Content: plan})
	o.emit(w, SSEEvent{Type: "done", Content: nil})
	return nil
}

// parseIntent — вызывает Mistral через OpenRouter.
func (o *Orchestrator) parseIntent(ctx context.Context, msg string) (*Parsed, error) {
	if o.apiKey == "" {
		return nil, fmt.Errorf("OPENROUTER_API_KEY не задан")
	}

	reqBody, _ := json.Marshal(openRouterReq{
		Model: "mistralai/mistral-small-3.1-24b-instruct:free",
		Messages: []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": msg},
		},
		MaxTokens: 300,
	})

	req, err := http.NewRequestWithContext(ctx, "POST",
		"https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+o.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://iaas-mts-hackathon.local")
	req.Header.Set("X-Title", "MTS IaaS Agent Market")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openrouter unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("openrouter status %d", resp.StatusCode)
	}

	var raw struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}
	if raw.Error != nil {
		return nil, fmt.Errorf("openrouter error: %s", raw.Error.Message)
	}
	if len(raw.Choices) == 0 {
		return nil, fmt.Errorf("empty response from openrouter")
	}

	// Убираем возможные markdown-обёртки
	content := strings.TrimSpace(raw.Choices[0].Message.Content)
	for _, prefix := range []string{"```json", "```JSON", "```"} {
		content = strings.TrimPrefix(content, prefix)
	}
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	// Ищем JSON-объект если LLM добавил текст вокруг
	if start := strings.Index(content, "{"); start > 0 {
		if end := strings.LastIndex(content, "}"); end > start {
			content = content[start : end+1]
		}
	}

	var parsed Parsed
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return nil, fmt.Errorf("json parse error: %w (raw: %.100s)", err, content)
	}
	return &parsed, nil
}

// fallbackParse — надёжный локальный парсер на случай недоступности AI.
func (o *Orchestrator) fallbackParse(msg string) *Parsed {
	m := strings.ToLower(msg)
	p := &Parsed{App: "app", Users: 100, Engine: "postgres"}

	// VM keywords
	for _, kw := range []string{"vm", "сервер", "server", "django", "node", "nodejs", "fastapi",
		"flask", "nginx", "rails", "laravel", "wordpress", "spring", "express",
		"приложен", "бэкенд", "backend", "api", "сайт", "web"} {
		if strings.Contains(m, kw) {
			p.NeedsVM = true
			if kw != "vm" && kw != "сервер" && kw != "server" && kw != "приложен" && kw != "бэкенд" && kw != "backend" && kw != "сайт" && kw != "web" {
				p.App = kw
			}
			break
		}
	}

	// DB keywords
	for _, kw := range []string{"postgres", "postgresql", "mysql", "бд", "database", "баз", "db", "данн"} {
		if strings.Contains(m, kw) {
			p.NeedsDB = true
			break
		}
	}

	// Redis
	if strings.Contains(m, "redis") {
		if !p.NeedsDB {
			p.NeedsDB = true
			p.Engine = "redis"
		} else {
			p.NeedsRedis = true
		}
	}
	if strings.Contains(m, "кеш") || strings.Contains(m, "cache") || strings.Contains(m, "кэш") {
		p.NeedsRedis = true
	}

	// Engine
	if strings.Contains(m, "mysql") {
		p.Engine = "mysql"
	} else if strings.Contains(m, "redis") && !p.NeedsDB {
		p.Engine = "redis"
	}

	// Storage keywords
	for _, kw := range []string{"s3", "minio", "storage", "файл", "хранил", "медиа", "media",
		"static", "статик", "картин", "фото", "image", "upload", "загруз"} {
		if strings.Contains(m, kw) {
			p.NeedsStorage = true
			break
		}
	}

	// Extract users count
	for _, suffix := range []string{" пользов", " users", " юзер", " клиент"} {
		idx := strings.Index(m, suffix)
		if idx > 0 {
			var num int
			fmt.Sscanf(strings.TrimSpace(m[maxInt(0, idx-10):idx]), "%d", &num)
			if num > 0 {
				p.Users = num
				break
			}
		}
	}

	// Если ничего не нашли — ставим базовый набор
	if !p.NeedsVM && !p.NeedsDB && !p.NeedsStorage {
		p.NeedsVM = true
		p.NeedsDB = true
	}

	return p
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// emit — пишет одно SSE-событие и немедленно флашит.
func (o *Orchestrator) emit(w io.Writer, event SSEEvent) {
	data, _ := json.Marshal(event)
	fmt.Fprintf(w, "data: %s\n\n", data)
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
}
