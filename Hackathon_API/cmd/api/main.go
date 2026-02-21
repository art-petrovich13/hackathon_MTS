package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/art-petrovich13/hackathon_MTS/internal/config"
	"github.com/art-petrovich13/hackathon_MTS/internal/handlers"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
	"github.com/art-petrovich13/hackathon_MTS/internal/services"
)

func main() {
	// Загрузка конфигурации
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("cannot load config:", err)
	}

	// Подключение к БД
	db, err := repository.NewDB(cfg)
	if err != nil {
		log.Fatal("cannot connect to db:", err)
	}
	defer db.Close()
	slog.Info("database connected")

	// Инициализация репозиториев
	flavorRepo := repository.NewFlavorRepository(db)
	imageRepo := repository.NewImageRepository(db)
	nodeRepo := repository.NewNodeRepository(db)
	vmRepo := repository.NewVMRepository(db)
	// userRepo, projectRepo пока не нужны, но можно создать

	// Инициализация сервисов
	vmService := services.NewVMService(db, vmRepo, flavorRepo, imageRepo, nodeRepo)

	// Инициализация обработчиков
	flavorHandler := handlers.NewFlavorHandler(flavorRepo)
	imageHandler := handlers.NewImageHandler(imageRepo)
	nodeHandler := handlers.NewNodeHandler(nodeRepo)
	vmHandler := handlers.NewVMHandler(vmService)

	// Настройка роутера
	r := chi.NewRouter()

	// Middleware (глобальные)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger) // или свой логгер на основе slog
	r.Use(middleware.Recoverer)
	// Можно добавить CORS позже
	// r.Use(cors.Handler(cors.Options{...}))

	// Группа API v1
	r.Route("/api/v1", func(r chi.Router) {
		// Публичные эндпоинты (без аутентификации)
		r.Get("/flavors", flavorHandler.List)
		r.Get("/images", imageHandler.List)
		r.Get("/nodes", nodeHandler.List)

		// VM endpoints
		r.Post("/vms", vmHandler.Create)
		r.Get("/vms", vmHandler.List)
		r.Get("/vms/{id}", vmHandler.Get)
		r.Delete("/vms/{id}", vmHandler.Delete)
		r.Post("/vms/{id}/start", vmHandler.Start)
		r.Post("/vms/{id}/stop", vmHandler.Stop)
	})

	// Запуск сервера
	port := cfg.APIPort
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)

	go func() {
		slog.Info("server started", "port", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "error", err)
		}
	}()

	<-quit
	slog.Info("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
	}
	slog.Info("server stopped")
}