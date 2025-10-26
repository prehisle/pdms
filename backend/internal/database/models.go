package database

import (
	"time"

	"gorm.io/gorm"
)

// User 用户模型
type User struct {
	ID           uint           `gorm:"primarykey" json:"id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	Username     string         `gorm:"uniqueIndex;not null" json:"username"`
	PasswordHash string         `gorm:"not null" json:"-"` // 不在 JSON 中返回密码
	Role         string         `gorm:"not null;index" json:"role"` // super_admin, course_admin, proofreader
	DisplayName  string         `json:"display_name"`
	CreatedByID  *uint          `gorm:"index" json:"created_by_id,omitempty"` // 创建者 ID
	CreatedBy    *User          `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
}

// CoursePermission 课程权限模型（多对多关联）
type CoursePermission struct {
	ID         uint      `gorm:"primarykey" json:"id"`
	CreatedAt  time.Time `json:"created_at"`
	UserID     uint      `gorm:"not null;index" json:"user_id"`
	RootNodeID int64     `gorm:"not null;index" json:"root_node_id"` // NDR 中的根节点 ID
	User       User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// TableName 指定表名
func (User) TableName() string {
	return "users"
}

// TableName 指定表名
func (CoursePermission) TableName() string {
	return "course_permissions"
}
