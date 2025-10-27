package database

import (
	"fmt"
	"log"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Config 数据库配置
type Config struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// Connect 连接到数据库并返回 GORM DB 实例
func Connect(cfg Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Database connected successfully")
	return db, nil
}

// AutoMigrate 自动迁移数据库表
func AutoMigrate(db *gorm.DB) error {
	log.Println("Running database migrations...")

	err := db.AutoMigrate(
		&User{},
		&CoursePermission{},
	)

	if err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	log.Println("Database migrations completed successfully")

	// 创建默认管理员账号（如果不存在）
	if err := ensureDefaultAdmin(db); err != nil {
		log.Printf("Warning: failed to create default admin: %v", err)
		// 不返回错误，允许应用继续启动
	}

	return nil
}

// ensureDefaultAdmin 确保默认管理员账号存在
func ensureDefaultAdmin(db *gorm.DB) error {
	var count int64
	if err := db.Model(&User{}).Where("role = ?", "super_admin").Count(&count).Error; err != nil {
		return fmt.Errorf("check admin user: %w", err)
	}

	// 如果已经有超级管理员，跳过
	if count > 0 {
		log.Println("Super admin user already exists, skipping default admin creation")
		return nil
	}

	// 创建默认管理员
	// 生成密码 hash (密码: admin123)
	passwordBytes, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	defaultAdmin := User{
		Username:     "admin",
		PasswordHash: string(passwordBytes),
		Role:         "super_admin",
		DisplayName:  "系统管理员",
	}

	if err := db.Create(&defaultAdmin).Error; err != nil {
		return fmt.Errorf("create default admin: %w", err)
	}

	log.Println("✓ Default admin created successfully")
	log.Println("  Username: admin")
	log.Println("  Password: admin123")
	log.Println("  ⚠️  WARNING: Please change the default password immediately!")

	return nil
}
