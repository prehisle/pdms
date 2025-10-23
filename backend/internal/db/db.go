package db

import (
	"log"
	"time"

	"github.com/yjxt/ydms/backend/internal/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Init initializes the database connection and runs auto migrations for core tables.
func Init(cfg config.DBConfig) (*gorm.DB, error) {
	if cfg.DSN == "" || cfg.DSN == "not_set" {
		log.Println("db: DSN not set, skipping database initialization")
		return nil, nil
	}

	db, err := gorm.Open(postgres.Open(cfg.DSN), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxOpenConns(20)
		sqlDB.SetMaxIdleConns(10)
		sqlDB.SetConnMaxLifetime(1 * time.Hour)
	}

	if err := AutoMigrate(db); err != nil {
		return nil, err
	}

	log.Println("db: initialization complete")
	return db, nil
}

// AutoMigrate runs migrations for core models.
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&User{},
		&UserRole{},
		&CourseAdminAssignment{},
		&ProofreaderAssignment{},
	)
}