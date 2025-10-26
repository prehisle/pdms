package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/yjxt/ydms/backend/internal/config"
	"github.com/yjxt/ydms/backend/internal/database"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// 加载环境变量
	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}

	// 加载配置
	cfg := config.Load()

	// 构建数据库配置
	dbConfig := database.Config{
		Host:     cfg.DB.Host,
		Port:     cfg.DB.Port,
		User:     cfg.DB.User,
		Password: cfg.DB.Password,
		DBName:   cfg.DB.DBName,
		SSLMode:  cfg.DB.SSLMode,
	}

	// 连接数据库
	db, err := database.Connect(dbConfig)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// 检查是否已有超级管理员
	var count int64
	if err := db.Model(&database.User{}).Where("role = ?", "super_admin").Count(&count).Error; err != nil {
		log.Fatalf("Failed to check super_admin: %v", err)
	}

	username := "testadmin"
	password := "testpass123"

	if count == 0 {
		log.Println("No super_admin found, creating one...")
	} else {
		log.Printf("Found %d super_admin(s), creating additional test user...\n", count)
	}

	// 创建超级管理员
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	user := &database.User{
		Username:     username,
		PasswordHash: string(hashedPassword),
		Role:         "super_admin",
		DisplayName:  "Test Admin",
	}

	// 检查用户是否已存在
	var existing database.User
	if err := db.Where("username = ?", username).First(&existing).Error; err == nil {
		log.Printf("User %s already exists (ID: %d)\n", username, existing.ID)
		fmt.Printf("\nCredentials:\n  Username: %s\n  Password: %s\n", username, password)
		os.Exit(0)
	}

	if err := db.Create(user).Error; err != nil {
		log.Fatalf("Failed to create user: %v", err)
	}

	log.Printf("Successfully created super_admin user (ID: %d)\n", user.ID)
	fmt.Printf("\nCredentials:\n  Username: %s\n  Password: %s\n", username, password)
}
