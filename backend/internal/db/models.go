package db

import (
	"time"

	"gorm.io/gorm"
)

// User represents a local user entity for authentication/authorization mapping.
type User struct {
	ID           uint64         `gorm:"primaryKey"`
	Username     string         `gorm:"size:64;uniqueIndex"`
	PasswordHash string         `gorm:"size:256"`
	Email        string         `gorm:"size:128"`
	Status       string         `gorm:"size:32"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    gorm.DeletedAt `gorm:"index"`
}

// UserRole binds a user to a global role (e.g., super_admin).
type UserRole struct {
	ID        uint64         `gorm:"primaryKey"`
	UserID    uint64         `gorm:"uniqueIndex:idx_user_role"`
	Role      string         `gorm:"size:32;uniqueIndex:idx_user_role"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

// CourseAdminAssignment grants course_admin role within a course root node domain.
type CourseAdminAssignment struct {
	ID         uint64         `gorm:"primaryKey"`
	UserID     uint64         `gorm:"uniqueIndex:idx_course_admin"`
	RootNodeID int64          `gorm:"uniqueIndex:idx_course_admin;index"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
	DeletedAt  gorm.DeletedAt `gorm:"index"`
}

// ProofreaderAssignment grants proofreader role within a course root node domain.
type ProofreaderAssignment struct {
	ID         uint64         `gorm:"primaryKey"`
	UserID     uint64         `gorm:"uniqueIndex:idx_proofreader"`
	RootNodeID int64          `gorm:"uniqueIndex:idx_proofreader;index"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
	DeletedAt  gorm.DeletedAt `gorm:"index"`
}