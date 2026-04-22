package agent

import (
	"context"
	"io"
)

// PresetRequest — тело POST /api/v1/agent/preset
type PresetRequest struct {
	PresetID string `json:"preset_id"`
}

// presetConfig — фиксированный набор ресурсов для готового решения.
// Не требует AI — выполняется через существующие суб-агенты напрямую.
type presetConfig struct {
	App          string
	Users        int
	NeedsVM      bool
	NeedsDB      bool
	Engine       string // postgres | mysql | redis
	NeedsStorage bool
	StorageGB    int
	NeedsRedis   bool // второй DB: redis кеш
	Summary      string
}

// presets — все доступные готовые решения по отраслям.
var presets = map[string]presetConfig{
	"retail": {
		App: "e-commerce", Users: 1000,
		NeedsVM: true, NeedsDB: true, Engine: "postgres",
		NeedsStorage: true, StorageGB: 50, NeedsRedis: true,
		Summary: "Интернет-магазин: VM + PostgreSQL + Redis-кеш + S3 для медиа",
	},
	"medicine": {
		App: "telemedicine", Users: 200,
		NeedsVM: true, NeedsDB: true, Engine: "postgres",
		NeedsStorage: true, StorageGB: 100,
		Summary: "Телемедицина: защищённая VM + PostgreSQL + S3 для записей приёмов",
	},
	"education": {
		App: "lms", Users: 500,
		NeedsVM: true, NeedsDB: true, Engine: "postgres",
		NeedsStorage: true, StorageGB: 30,
		Summary: "LMS для школы: VM с Moodle + PostgreSQL + S3 для учебных материалов",
	},
	"manufacturing": {
		App: "iot-platform", Users: 50,
		NeedsVM: true, NeedsDB: true, Engine: "postgres",
		NeedsStorage: true, StorageGB: 20,
		Summary: "Цифровой двойник: VM + PostgreSQL для временных рядов + S3 для дашбордов",
	},
	"startup": {
		App: "startup-mvp", Users: 300,
		NeedsVM: true, NeedsDB: true, Engine: "postgres",
		NeedsStorage: false,
		Summary: "MVP стартапа: VM + PostgreSQL — быстрый старт без лишнего",
	},
	"media": {
		App: "media-platform", Users: 800,
		NeedsVM: true, NeedsDB: true, Engine: "postgres",
		NeedsStorage: true, StorageGB: 200,
		Summary: "Медиаплатформа: VM + PostgreSQL + большое S3 для контента",
	},
	"gameserver": {
		App: "game-server", Users: 100,
		NeedsVM: true, NeedsDB: false, NeedsRedis: true,
		NeedsStorage: false,
		Summary: "Игровой сервер: высокопроизводительная VM + Redis для состояния игры",
	},
	"analytics": {
		App: "data-analytics", Users: 20,
		NeedsVM: true, NeedsDB: true, Engine: "postgres",
		NeedsStorage: true, StorageGB: 500,
		Summary: "Аналитическая платформа: VM + PostgreSQL + большое S3 для данных",
	},
	"devops": {
		App: "ci-cd", Users: 15,
		NeedsVM: true, NeedsDB: true, Engine: "postgres",
		NeedsStorage: true, StorageGB: 40,
		Summary: "CI/CD окружение: VM + PostgreSQL для артефактов + S3 для образов",
	},
	"chat": {
		App: "corporate-chat", Users: 150,
		NeedsVM: true, NeedsDB: true, Engine: "postgres",
		NeedsStorage: true, StorageGB: 20, NeedsRedis: true,
		Summary: "Корпоративный мессенджер: VM + PostgreSQL + Redis + S3 для файлов",
	},
}

// HandlePreset — выполняет готовый план без вызова AI.
// Надёжно работает всегда, использует те же суб-агенты что и Chat.
func (o *Orchestrator) HandlePreset(ctx context.Context, presetID string, w io.Writer) error {
	cfg, ok := presets[presetID]
	if !ok {
		o.emit(w, SSEEvent{Type: "error", Content: "Неизвестный preset: " + presetID})
		o.emit(w, SSEEvent{Type: "done", Content: nil})
		return nil
	}

	o.emit(w, SSEEvent{Type: "thinking", Content: "Загружаю конфигурацию: " + cfg.Summary})

	var proposals []ServiceProposal
	var totalCost float64

	if cfg.NeedsVM {
		o.emit(w, SSEEvent{Type: "thinking", Content: "VmAgent: подбираю оптимальный сервер..."})
		prop, err := o.vmAgent.Propose(ctx, cfg.Users, cfg.App)
		if err == nil {
			proposals = append(proposals, *prop)
			totalCost += prop.CostPerHour
		}
	}

	if cfg.NeedsDB {
		engine := cfg.Engine
		if engine == "" {
			engine = "postgres"
		}
		o.emit(w, SSEEvent{Type: "thinking", Content: "DbAgent: выбираю " + engine + "..."})
		prop, err := o.dbAgent.Propose(ctx, engine)
		if err == nil {
			proposals = append(proposals, *prop)
			totalCost += prop.CostPerHour
		}
	}

	// Redis как второй DB (кеш)
	if cfg.NeedsRedis {
		o.emit(w, SSEEvent{Type: "thinking", Content: "DbAgent: добавляю Redis-кеш..."})
		prop, err := o.dbAgent.Propose(ctx, "redis")
		if err == nil {
			prop.Name = "redis-cache"
			proposals = append(proposals, *prop)
			totalCost += prop.CostPerHour
		}
	}

	if cfg.NeedsStorage {
		o.emit(w, SSEEvent{Type: "thinking", Content: "StorageAgent: настраиваю объектное хранилище..."})
		prop, err := o.storageAgent.Propose(ctx, cfg.StorageGB)
		if err == nil {
			proposals = append(proposals, *prop)
			totalCost += prop.CostPerHour
		}
	}

	if len(proposals) == 0 {
		o.emit(w, SSEEvent{Type: "error", Content: "Нет доступных ресурсов. Проверьте наличие флейворов в системе."})
		o.emit(w, SSEEvent{Type: "done", Content: nil})
		return nil
	}

	plan := AgentPlan{
		Summary:          cfg.Summary,
		Services:         proposals,
		TotalCostPerHour: totalCost,
	}

	o.emit(w, SSEEvent{Type: "plan", Content: plan})
	o.emit(w, SSEEvent{Type: "done", Content: nil})
	return nil
}
