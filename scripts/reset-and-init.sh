#!/bin/bash

# YDMS 数据库完整重置和初始化脚本
# 用法: ./scripts/reset-and-init.sh

set -e

echo "=== YDMS 数据库完整重置和初始化 ==="
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
echo "⚠️  警告：此操作将删除数据库中的所有数据并重新初始化！"
read -p "是否继续? (输入 'yes' 确认): " confirm

if [ "$confirm" != "yes" ]; then
    echo "操作已取消"
    exit 0
fi

echo ""
echo "步骤 1/3: 重置数据库..."

# 使用 psql 连接并删除/重建数据库
PGPASSWORD=$YDMS_DB_PASSWORD psql -h $YDMS_DB_HOST -p $YDMS_DB_PORT -U $YDMS_DB_USER -d postgres << EOF > /dev/null 2>&1
-- 断开所有现有连接
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '$YDMS_DB_NAME'
  AND pid <> pg_backend_pid();

-- 删除并重建数据库
DROP DATABASE IF EXISTS $YDMS_DB_NAME;
CREATE DATABASE $YDMS_DB_NAME;
EOF

if [ $? -eq 0 ]; then
    echo "✓ 数据库重置成功"
else
    echo "❌ 数据库重置失败"
    exit 1
fi

echo ""
echo "步骤 2/3: 运行数据库迁移..."

# 运行 Go 重置工具来创建表和默认管理员
cd backend
echo "yes" | go run ./cmd/reset-db

echo ""
echo "============================================================"
echo "数据库重置完成！"
echo "============================================================"
echo ""
echo "默认管理员账号:"
echo "  用户名: super_admin"
echo "  密码:   admin123456"
echo ""
echo "⚠️  请在首次登录后立即修改密码！"
echo ""
echo "后端服务地址: http://localhost:9180"
echo "前端服务地址: http://localhost:5174"
echo "============================================================"
