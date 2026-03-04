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

// systemPrompt — инструкция для Mistral. Критично для качества парсинга.
const systemPrompt = `Ты — AI-агент IaaS платформы. Пользователь описывает задачу развёртывания на русском или английском языке.
Твоя задача: проанализировать запрос и вернуть ТОЛЬКО JSON без markdown-блоков и пояснений.

Формат ответа (строго JSON):
{"needs_vm":bool,"needs_db":bool,"needs_storage":bool,"engine":"postgres|mysql|redis","users":number,"app":"string","storage_gb":number}

Правила:
- needs_vm=true если нужен сервер/приложение/Django/Node/FastAPI/бэкенд
- needs_db=true если нужна база данных/БД/database/PostgreSQL/MySQL/Redis
- needs_storage=true если нужно хранилище/S3/MinIO/файлы/медиа/статика
- engine: "postgres" по умолчанию для реляционных, "redis" для кеша
- users: число из запроса, 0 если не указано
- app: название технологии или "app" если не указано
- storage_gb: объём в ГБ из запроса, 10 если не указано

Примеры:
"Django + PostgreSQL для 1000 пользователей" -> {"needs_vm":true,"needs_db":true,"needs_storage":false,"engine":"postgres","users":1000,"app":"django","storage_gb":0}
"только Redis кеш" -> {"needs_vm":false,"needs_db":true,"needs_storage":false,"engine":"redis","users":0,"app":"redis","storage_gb":0}
"S3 хранилище для картинок сайта" -> {"needs_vm":false,"needs_db":false,"needs_storage":true,"engine":"","users":0,"app":"app","storage_gb":50}`

// Chat — основной метод оркестратора.
// Пишет SSE-события напрямую в http.ResponseWriter.
func (o *Orchestrator) Chat(ctx context.Context, msg string, w io.Writer) error {
	o.emit(w, SSEEvent{Type: "thinking", Content: "Анализирую задачу: " + msg})

	// ── Шаг 1: парсим намерения через Mistral (или fallback) ──────────────
	parsed, err := o.parseIntent(ctx, msg)
	if err != nil {
		o.emit(w, SSEEvent{Type: "thinking", Content: "⚠️ AI недоступен, использую локальный парсер..."})
		parsed = o.fallbackParse(msg)
	}

	// ── Шаг 2: координируем суб-агентов ──────────────────────────────────
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
		o.emit(w, SSEEvent{Type: "thinking", Content: "DbAgent: выбираю движок и конфигурацию базы данных..."})
		prop, err := o.dbAgent.Propose(ctx, parsed.Engine)
		if err == nil {
			proposals = append(proposals, *prop)
			totalCost += prop.CostPerHour
		}
	}

	if parsed.NeedsStorage {
		o.emit(w, SSEEvent{Type: "thinking", Content: "StorageAgent: рассчитываю объём хранилища..."})
		prop, err := o.storageAgent.Propose(ctx, parsed.StorageGB)
		if err == nil {
			proposals = append(proposals, *prop)
			totalCost += prop.CostPerHour
		}
	}

	if len(proposals) == 0 {
		o.emit(w, SSEEvent{Type: "error", Content: "Не удалось определить нужные ресурсы. Попробуй: \"Django + PostgreSQL для 500 пользователей\""})
		o.emit(w, SSEEvent{Type: "done", Content: nil})
		return nil
	}

	// ── Шаг 3: собираем план ─────────────────────────────────────────────
	appName := parsed.App
	if appName == "" || appName == "app" {
		appName = "вашего"
	}
	plan := AgentPlan{
		Summary:          fmt.Sprintf("Для %s приложения рекомендую %d сервис(а)", appName, len(proposals)),
		Services:         proposals,
		TotalCostPerHour: totalCost,
	}

	o.emit(w, SSEEvent{Type: "plan", Content: plan})
	o.emit(w, SSEEvent{Type: "done", Content: nil})
	return nil
}

// parseIntent — вызывает Mistral через OpenRouter для структурированного парсинга.
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
		MaxTokens: 256,
	})

	req, err := http.NewRequestWithContext(ctx, "POST",
		"https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+o.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://iaas-mts-hackathon.local")
	req.Header.Set("X-Title", "MTS IaaS AgentMesh")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
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
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}
	if len(raw.Choices) == 0 {
		return nil, fmt.Errorf("empty response from openrouter")
	}

	// Убираем возможные markdown-обёртки ```json ... ```
	content := strings.TrimSpace(raw.Choices[0].Message.Content)
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var parsed Parsed
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return nil, fmt.Errorf("json parse error: %w, raw: %s", err, content)
	}
	return &parsed, nil
}

// fallbackParse — regexp-парсер на случай недоступности OpenRouter.
// Достаточно надёжен для демо-сценариев.
func (o *Orchestrator) fallbackParse(msg string) *Parsed {
	m := strings.ToLower(msg)
	p := &Parsed{App: "app"}

	// VM
	vmKeywords := []string{"vm", "сервер", "server", "django", "node", "fastapi", "flask", "nginx", "приложен", "бэкенд", "backend", "wordpress", "laravel"}
	for _, kw := range vmKeywords {
		if strings.Contains(m, kw) {
			p.NeedsVM = true
			p.App = kw
			break
		}
	}

	// DB
	dbKeywords := []string{"postgres", "postgresql", "mysql", "redis", "бд", "database", "баз", "db"}
	for _, kw := range dbKeywords {
		if strings.Contains(m, kw) {
			p.NeedsDB = true
			break
		}
	}

	// Storage
	storKeywords := []string{"s3", "minio", "storage", "файл", "хранил", "медиа", "media", "static", "статик", "картин"}
	for _, kw := range storKeywords {
		if strings.Contains(m, kw) {
			p.NeedsStorage = true
			break
		}
	}

	// Engine
	if strings.Contains(m, "redis") {
		p.Engine = "redis"
	} else if strings.Contains(m, "mysql") {
		p.Engine = "mysql"
	} else {
		p.Engine = "postgres"
	}

	// Users
	// Простой поиск числа рядом со словами "пользователей", "users", "юзер"
	for _, suffix := range []string{" пользов", " users", " юзер"} {
		idx := strings.Index(m, suffix)
		if idx > 0 {
			// ищем число до suffix
			var num int
			fmt.Sscanf(strings.TrimSpace(m[max(0, idx-10):idx]), "%d", &num)
			if num > 0 {
				p.Users = num
				break
			}
		}
	}

	return p
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// emit — пишет одно SSE-событие в writer и сразу флашит.
func (o *Orchestrator) emit(w io.Writer, event SSEEvent) {
	data, _ := json.Marshal(event)
	fmt.Fprintf(w, "data: %s\n\n", data)
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
}
