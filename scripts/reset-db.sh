#!/bin/bash

# YDMS 数据库重置脚本
# 用法: ./scripts/reset-db.sh

set -e

echo "=== YDMS 数据库重置工具 ==="
echo ""

# 读取 .env 文件中的数据库配置
if [ -f "backend/.env" ]; then
    source backend/.env
else
    echo "错误: 找不到 backend/.env 文件"
    exit 1
fi

# 显示数据库信息
echo "数据库信息:"
echo "  主机: $YDMS_DB_HOST:$YDMS_DB_PORT"
echo "  数据库: $YDMS_DB_NAME"
echo "  用户: $YDMS_DB_USER"
echo ""

# 确认操作
echo "⚠️  警告：此操作将删除数据库中的所有数据！"
read -p "是否继续? (输入 'yes' 确认): " confirm

if [ "$confirm" != "yes" ]; then
    echo "操作已取消"
    exit 0
fi

echo ""
echo "开始重置数据库..."

# 使用 psql 连接并删除/重建数据库
PGPASSWORD=$YDMS_DB_PASSWORD psql -h $YDMS_DB_HOST -p $YDMS_DB_PORT -U $YDMS_DB_USER -d postgres << EOF
-- 断开所有现有连接
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '$YDMS_DB_NAME'
  AND pid <> pg_backend_pid();

-- 删除并重建数据库
DROP DATABASE IF EXISTS $YDMS_DB_NAME;
CREATE DATABASE $YDMS_DB_NAME;

\c $YDMS_DB_NAME

-- 数据库已重置，表将在应用启动时自动创建
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ 数据库重置成功！"
    echo ""
    echo "下一步："
    echo "1. 启动后端服务 (数据库表将自动创建)"
    echo "2. 使用 Go 重置工具创建默认管理员:"
    echo "   cd backend && go run ./cmd/reset-db"
    echo ""
else
    echo "❌ 数据库重置失败"
    exit 1
fi
