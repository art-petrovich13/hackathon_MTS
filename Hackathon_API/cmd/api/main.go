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

	"github.com/art-petrovich13/hackathon_MTS/internal/agent"
	dbcompute "github.com/art-petrovich13/hackathon_MTS/internal/compute/db"
	dockerdriver "github.com/art-petrovich13/hackathon_MTS/internal/compute/docker"
	mobilecompute "github.com/art-petrovich13/hackathon_MTS/internal/compute/mobile"
	objectcompute "github.com/art-petrovich13/hackathon_MTS/internal/compute/object"
	"github.com/art-petrovich13/hackathon_MTS/internal/config"
	"github.com/art-petrovich13/hackathon_MTS/internal/handlers"
	authmw "github.com/art-petrovich13/hackathon_MTS/internal/middleware" // ← добавить
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
	flavorRepo := repository.NewFlavorRepository(db)
	imageRepo := repository.NewImageRepository(db)
	nodeRepo := repository.NewNodeRepository(db)
	vmRepo := repository.NewVMRepository(db)
	catalogRepo := repository.NewServiceCatalogRepository(db)
	dbRepo := repository.NewManagedDatabaseRepository(db)
	osRepo := repository.NewObjectStorageRepository(db) // было: _ = repository.NewObjectStorageRepository(db)
	fsRepo := repository.NewFileStorageRepository(db)   // было: _ = repository.NewFileStorageRepository(db)
	mobileRepo := repository.NewMobileDeviceRepository(db)
	userRepo := repository.NewUserRepository(db)
	projectRepo := repository.NewProjectRepository(db)
	limitRepo := repository.NewProjectLimitRepository(db)

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

	// MinIO Driver
	minioDriver, err := objectcompute.NewMinIODriver()
	if err != nil {
		slog.Error("failed to create minio driver", "error", err)
		os.Exit(1)
	}
	slog.Info("minio driver initialized")

	// Mobile Driver
	mobileDriver, err := mobilecompute.NewMobileDriver()
	if err != nil {
		slog.Error("failed to create mobile driver", "error", err)
		os.Exit(1)
	}
	slog.Info("mobile driver initialized")

	// File Storage Worker
	fsWorker, err := worker.NewFileStorageWorker(db, fsRepo, nodeRepo, 5*time.Second)
	if err != nil {
		slog.Error("failed to create file storage worker", "error", err)
		os.Exit(1)
	}

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

	osWorker := worker.NewObjectStorageWorker(db, minioDriver, osRepo, nodeRepo, 5*time.Second)
	go osWorker.Start(workerCtx)
	slog.Info("object storage worker launched")

	go fsWorker.Start(workerCtx)
	slog.Info("file storage worker launched")

	mobileWorker := worker.NewMobileWorker(db, mobileDriver, mobileRepo, nodeRepo, 5*time.Second)
	go mobileWorker.Start(workerCtx)
	slog.Info("mobile worker launched")

	// ── Хендлеры ────────────────────────────────────────────────────────────
	limitsChecker := services.NewLimitsChecker(
		limitRepo,
		vmRepo,
		dbRepo,
		osRepo,
		fsRepo,
		mobileRepo,
		flavorRepo,
	)

	flavorHandler := handlers.NewFlavorHandler(flavorRepo)
	imageHandler := handlers.NewImageHandler(imageRepo)
	nodeHandler := handlers.NewNodeHandler(nodeRepo)
	vmHandler := handlers.NewVMHandler(vmService, limitsChecker)
	healthHandler := handlers.NewHealthHandler(db)
	catalogHandler := handlers.NewServiceCatalogHandler(catalogRepo, flavorRepo)
	databaseHandler := handlers.NewDatabaseHandler(dbRepo, flavorRepo, db, databaseDriver, limitsChecker)
	osHandler := handlers.NewObjectStorageHandler(osRepo, flavorRepo, db, minioDriver, limitsChecker)
	fsHandler := handlers.NewFileStorageHandler(fsRepo, flavorRepo, db, limitsChecker)
	mobileHandler := handlers.NewMobileHandler(mobileRepo, flavorRepo, db, mobileDriver, limitsChecker)
	authHandler := handlers.NewAuthHandler(userRepo, projectRepo)
	userHandler := handlers.NewUserHandler(userRepo, projectRepo, limitRepo, limitsChecker)

	// ── AgentMesh ────────────────────────────────────────────────────────────────
	vmAgentA := agent.NewVmAgent(flavorRepo)
	dbAgentA := agent.NewDbAgent(flavorRepo)
	storageAgentA := agent.NewStorageAgent(flavorRepo)
	orchestrator := agent.NewOrchestrator(vmAgentA, dbAgentA, storageAgentA, cfg.OpenRouterKey)
	deployer := agent.NewDeployer(vmService, dbRepo, osRepo, flavorRepo, imageRepo, db)
	agentHandler := handlers.NewAgentHandler(orchestrator, deployer)

	// ── Роутер ──────────────────────────────────────────────────────────────
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", healthHandler.Check)

	r.Post("/api/v1/auth/login", authHandler.Login)
	r.Post("/api/v1/auth/register", authHandler.Register)

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(authmw.Authenticate)
		r.Get("/auth/me", authHandler.Me)
		r.Group(func(r chi.Router) {
			r.Use(authmw.RequireAdmin)
			r.Get("/users", userHandler.ListUsers)
			r.Post("/users", userHandler.CreateUser)
			r.Get("/users/{id}", userHandler.GetUser)
			r.Delete("/users/{id}", userHandler.DeleteUser)
			r.Get("/users/{id}/limits", userHandler.GetLimits)
			r.Put("/users/{id}/limits", userHandler.SetLimits)
		})

		r.Get("/flavors", flavorHandler.List)
		r.Get("/images", imageHandler.List)
		r.Get("/nodes", nodeHandler.List)

		r.Post("/vms", vmHandler.Create)
		r.Get("/vms", vmHandler.List)
		r.Get("/vms/{id}", vmHandler.Get)
		r.Delete("/vms/{id}", vmHandler.Delete)
		r.Post("/vms/{id}/start", vmHandler.Start)
		r.Post("/vms/{id}/stop", vmHandler.Stop)
		r.Get("/vms/{id}/console", vmHandler.GetConsole)

		r.Get("/service-catalog", catalogHandler.List)
		r.Get("/service-catalog/full", catalogHandler.ListWithFlavors)

		r.Post("/databases", databaseHandler.Create)
		r.Get("/databases", databaseHandler.List)
		r.Get("/databases/{id}", databaseHandler.Get)
		r.Delete("/databases/{id}", databaseHandler.Delete)
		r.Post("/databases/{id}/start", databaseHandler.Start)
		r.Post("/databases/{id}/stop", databaseHandler.Stop)

		r.Post("/object-storages", osHandler.Create)
		r.Get("/object-storages", osHandler.List)
		r.Get("/object-storages/{id}", osHandler.Get)
		r.Delete("/object-storages/{id}", osHandler.Delete)
		r.Post("/object-storages/{id}/start", osHandler.Start)
		r.Post("/object-storages/{id}/stop", osHandler.Stop)

		r.Post("/file-storages", fsHandler.Create)
		r.Get("/file-storages", fsHandler.List)
		r.Get("/file-storages/{id}", fsHandler.Get)
		r.Delete("/file-storages/{id}", fsHandler.Delete)
		r.Post("/file-storages/{id}/start", fsHandler.Start)
		r.Post("/file-storages/{id}/stop", fsHandler.Stop)

		r.Post("/mobile-devices", mobileHandler.Create)
		r.Get("/mobile-devices", mobileHandler.List)
		r.Get("/mobile-devices/{id}", mobileHandler.Get)
		r.Delete("/mobile-devices/{id}", mobileHandler.Delete)
		r.Post("/mobile-devices/{id}/start", mobileHandler.Start)
		r.Post("/mobile-devices/{id}/stop", mobileHandler.Stop)
		r.Get("/mobile-devices/{id}/connect", mobileHandler.GetConnectInfo)

		// ── AgentMesh SSE эндпоинты ──────────────────────────────────────────────
		r.Post("/agent/chat", agentHandler.Chat)
		r.Post("/agent/execute", agentHandler.Execute)
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
