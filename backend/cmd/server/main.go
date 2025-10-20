package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/yjxt/ydms/backend/internal/api"
	"github.com/yjxt/ydms/backend/internal/cache"
	"github.com/yjxt/ydms/backend/internal/config"
	"github.com/yjxt/ydms/backend/internal/ndrclient"
	"github.com/yjxt/ydms/backend/internal/service"
)

func main() {
	// Load environment variables from .env if present.
	if err := godotenv.Load(".env"); err != nil {
		// Attempt to load from project root as fallback.
		_ = godotenv.Load()
	}

	cfg := config.Load()

	cacheProvider := cache.NewNoop()
	ndr := ndrclient.NewClient(ndrclient.NDRConfig{
		BaseURL: cfg.NDR.BaseURL,
		APIKey:  cfg.NDR.APIKey,
	})
	svc := service.NewService(cacheProvider, ndr)
	handler := api.NewHandler(svc)
	router := api.NewRouter(handler)

	server := &http.Server{
		Addr:              cfg.HTTPAddress(),
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("backend listening on %s", cfg.HTTPAddress())
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	waitForShutdown(server)
}

func waitForShutdown(server *http.Server) {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	<-ctx.Done()
	log.Println("shutdown signal received")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
		if err := server.Close(); err != nil {
			log.Printf("forced close failed: %v", err)
		}
	}
	log.Println("server stopped")
}
