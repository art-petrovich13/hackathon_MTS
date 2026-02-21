package main

import (
	"fmt"
	"log"

	"github.com/art-petrovich13/hackathon_MTS/internal/config"
)

func main() {
	fmt.Println("=== ТЕСТ КОНФИГУРАЦИИ ===")

	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("❌ ОШИБКА загрузки конфигурации: %v", err)
	}

	fmt.Println("✅ Конфигурация успешно загружена!")
	fmt.Printf("Порт сервера: %s\n", cfg.Server.Port)
}
