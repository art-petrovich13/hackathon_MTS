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

	dbcompute    "github.com/art-petrovich13/hackathon_MTS/internal/compute/db"
	dockerdriver "github.com/art-petrovich13/hackathon_MTS/internal/compute/docker"
	"github.com/art-petrovich13/hackathon_MTS/internal/config"
	"github.com/art-petrovich13/hackathon_MTS/internal/handlers"
	"github.com/art-petrovich13/hackathon_MTS/internal/repository"
	"github.com/art-petrovich13/hackathon_MTS/internal/services"
	"github.com/art-petrovich13/hackathon_MTS/internal/worker"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("cannot load config:", err)
	}

	db, err := repository.NewDB(cfg)
	if err != nil {
		log.Fatal("cannot connect to db:", err)
	}
	defer db.Close()
	slog.Info("database connected")

	// ── Репозитории ─────────────────────────────────────────────────────────
	flavorRepo  := repository.NewFlavorRepository(db)
	imageRepo   := repository.NewImageRepository(db)
	nodeRepo    := repository.NewNodeRepository(db)
	vmRepo      := repository.NewVMRepository(db)
	catalogRepo := repository.NewServiceCatalogRepository(db)
	dbRepo      := repository.NewManagedDatabaseRepository(db)
	_            = repository.NewObjectStorageRepository(db)
	_            = repository.NewFileStorageRepository(db)
	_            = repository.NewMobileDeviceRepository(db)

	// ── Compute Driver (для VM) ──────────────────────────────────────────────
	computeDriver, err := dockerdriver.NewDockerDriver()
	if err != nil {
		slog.Error("failed to create docker driver", "error", err)
		os.Exit(1)
	}
	slog.Info("using DOCKER compute driver")

	// ── Database Driver (для managed databases) ──────────────────────────────
	databaseDriver, err := dbcompute.NewDatabaseDriver()
	if err != nil {
		slog.Error("failed to create database driver", "error", err)
		os.Exit(1)
	}
	slog.Info("database driver initialized")

	// ── Сервисы ─────────────────────────────────────────────────────────────
	vmService := services.NewVMService(db, vmRepo, flavorRepo, imageRepo, nodeRepo, computeDriver)

	// ── Воркеры ─────────────────────────────────────────────────────────────
	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()

	vmWorker := worker.NewVMWorker(db, computeDriver, vmRepo, nodeRepo, 5*time.Second)
	go vmWorker.Start(workerCtx)
	slog.Info("vm worker launched")

	reconcileWorker := worker.NewReconcileWorker(db, computeDriver, vmRepo, nodeRepo, 1*time.Minute)
	go reconcileWorker.Start(workerCtx)
	slog.Info("reconcile worker launched")

	dbWorker := worker.NewDBWorker(db, databaseDriver, dbRepo, nodeRepo, 5*time.Second)
	go dbWorker.Start(workerCtx)
	slog.Info("db worker launched")

	// ── Хендлеры ────────────────────────────────────────────────────────────
	flavorHandler   := handlers.NewFlavorHandler(flavorRepo)
	imageHandler    := handlers.NewImageHandler(imageRepo)
	nodeHandler     := handlers.NewNodeHandler(nodeRepo)
	vmHandler       := handlers.NewVMHandler(vmService)
	healthHandler   := handlers.NewHealthHandler(db)
	catalogHandler  := handlers.NewServiceCatalogHandler(catalogRepo, flavorRepo)
	databaseHandler := handlers.NewDatabaseHandler(dbRepo, flavorRepo, db, databaseDriver)
	
	// ── Роутер ──────────────────────────────────────────────────────────────
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", healthHandler.Check)

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

		r.Get("/service-catalog", catalogHandler.List)
		r.Get("/service-catalog/full", catalogHandler.ListWithFlavors)

		r.Post("/databases", databaseHandler.Create)
		r.Get("/databases", databaseHandler.List)
		r.Get("/databases/{id}", databaseHandler.Get)
		r.Delete("/databases/{id}", databaseHandler.Delete)
	})

	// ── HTTP сервер + Graceful Shutdown ─────────────────────────────────────
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
	slog.Info("shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
	}
	slog.Info("server stopped")
}