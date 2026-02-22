// cmd/api/main.go
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

	// ── ИЗМЕНЕНИЕ: заменяем sim на docker ──────────────────────────────────
	dockerdriver "github.com/art-petrovich13/hackathon_MTS/internal/compute/docker"
	// ───────────────────────────────────────────────────────────────────────
	"github.com/art-petrovich13/hackathon_MTS/internal/config"
	"github.com/art-petrovich13/hackathon_MTS/internal/handlers"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
	"github.com/art-petrovich13/hackathon_MTS/internal/services"
	"github.com/art-petrovich13/hackathon_MTS/internal/worker"
)

func main() {
	// ── Конфигурация ────────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("cannot load config:", err)
	}

	// ── БД ──────────────────────────────────────────────────────────────────
	db, err := repository.NewDB(cfg)
	if err != nil {
		log.Fatal("cannot connect to db:", err)
	}
	defer db.Close()
	slog.Info("database connected")

	// ── Репозитории ─────────────────────────────────────────────────────────
	flavorRepo := repository.NewFlavorRepository(db)
	imageRepo := repository.NewImageRepository(db)
	nodeRepo := repository.NewNodeRepository(db)
	vmRepo := repository.NewVMRepository(db)

	// ── ИЗМЕНЕНИЕ: Docker-драйвер вместо симуляционного ────────────────────
	//
	// NewDockerDriver читает переменную DOCKER_HOST из окружения.
	// Если DOCKER_HOST не задан — подключается к локальному сокету
	// /var/run/docker.sock (стандартное поведение Docker SDK).
	//
	// При запуске через docker-compose не забудь пробросить сокет:
	//   volumes:
	//     - /var/run/docker.sock:/var/run/docker.sock
	//
	computeDriver, err := dockerdriver.NewDockerDriver()
	if err != nil {
		slog.Error("failed to create docker driver", "error", err)
		os.Exit(1)
	}
	slog.Info("using DOCKER compute driver")
	// ───────────────────────────────────────────────────────────────────────

	// ── Сервисы ─────────────────────────────────────────────────────────────
	vmService := services.NewVMService(db, vmRepo, flavorRepo, imageRepo, nodeRepo, computeDriver)

	// ── Воркер ──────────────────────────────────────────────────────────────────
	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()

	vmWorker := worker.NewVMWorker(db, computeDriver, vmRepo, nodeRepo, 5*time.Second)
	go vmWorker.Start(workerCtx)
	slog.Info("vm worker launched")

	// ── Хендлеры ────────────────────────────────────────────────────────────
	flavorHandler := handlers.NewFlavorHandler(flavorRepo)
	imageHandler := handlers.NewImageHandler(imageRepo)
	nodeHandler := handlers.NewNodeHandler(nodeRepo)
	vmHandler := handlers.NewVMHandler(vmService)

	// ── Роутер ──────────────────────────────────────────────────────────────
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/flavors", flavorHandler.List)
		r.Get("/images", imageHandler.List)
		r.Get("/nodes", nodeHandler.List)

		r.Post("/vms", vmHandler.Create)
		r.Get("/vms", vmHandler.List)
		r.Get("/vms/{id}", vmHandler.Get)
		r.Delete("/vms/{id}", vmHandler.Delete)
		r.Post("/vms/{id}/start", vmHandler.Start)
		r.Post("/vms/{id}/stop", vmHandler.Stop)
	})

	// ── HTTP-сервер + Graceful shutdown ─────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + cfg.APIPort,
		Handler:      r,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)

	go func() {
		slog.Info("server started", "port", cfg.APIPort)
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
