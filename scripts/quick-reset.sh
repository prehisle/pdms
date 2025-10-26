#!/bin/bash

# YDMS 快速数据重置脚本
# 仅清空表数据，不删除表结构

set -e

echo "=== YDMS 快速数据重置 ==="
echo ""

# 读取 .env 文件
if [ -f "backend/.env" ]; then
    source backend/.env
else
    echo "错误: 找不到 backend/.env 文件"
    exit 1
fi

echo "数据库: $YDMS_DB_NAME"
echo ""
echo "⚠️  将清空所有表数据（保留表结构）"
read -p "是否继续? (输入 'yes' 确认): " confirm

if [ "$confirm" != "yes" ]; then
    echo "操作已取消"
    exit 0
fi

echo ""
echo "清空数据表..."

# 清空所有表
PGPASSWORD=$YDMS_DB_PASSWORD psql -h $YDMS_DB_HOST -p $YDMS_DB_PORT -U $YDMS_DB_USER -d $YDMS_DB_NAME << EOF
TRUNCATE TABLE users RESTART IDENTITY CASCADE;
TRUNCATE TABLE course_permissions RESTART IDENTITY CASCADE;
EOF

if [ $? -eq 0 ]; then
    echo "✓ 数据已清空"

    echo ""
    echo "创建默认管理员..."

    # 直接用 SQL 创建管理员（密码是 admin123456 的 bcrypt hash）
    PGPASSWORD=$YDMS_DB_PASSWORD psql -h $YDMS_DB_HOST -p $YDMS_DB_PORT -U $YDMS_DB_USER -d $YDMS_DB_NAME << 'SQLEOF'
INSERT INTO users (username, password_hash, role, display_name, created_at, updated_at)
VALUES (
    'super_admin',
    '$2a$10$XqNhQCKow2zUMl5YkMGPUOt5mzpGgXPoc/DwKe6jm1R6ESm/HzfaK',
    'super_admin',
    '超级管理员',
    NOW(),
    NOW()
);
SQLEOF

    echo "✓ 默认管理员创建成功"
    echo ""
    echo "============================================================"
    echo "数据重置完成！"
    echo "============================================================"
    echo ""
    echo "默认管理员账号:"
    echo "  用户名: super_admin"
    echo "  密码:   admin123456"
    echo "============================================================"
else
    echo "❌ 数据清空失败"
    exit 1
fi
