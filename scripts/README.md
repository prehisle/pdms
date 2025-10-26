# 数据库重置脚本使用指南

本目录包含用于重置 YDMS 数据库的工具脚本。

## 脚本说明

### 1. `reset-and-init.sh` - 一键完整重置（推荐）

**用途**: 删除所有数据，重建数据库表，并创建默认管理员账户

**使用方法**:
```bash
# 在项目根目录执行
./scripts/reset-and-init.sh
```

**执行步骤**:
1. 删除并重建 PostgreSQL 数据库
2. 运行数据库迁移，创建所有表
3. 创建默认超级管理员账户

**默认账号**:
- 用户名: `super_admin`
- 密码: `admin123456`

**⚠️ 重要提示**:
- 此操作会删除所有数据，包括用户、课程权限等
- 首次登录后请立即修改默认密码
- 确保后端服务已停止再执行此脚本

---

### 2. `reset-db.sh` - 仅重置数据库

**用途**: 只删除并重建数据库，不创建默认数据

**使用方法**:
```bash
./scripts/reset-db.sh
```

**后续操作**:
需要手动运行 Go 工具创建管理员:
```bash
cd backend
go run ./cmd/reset-db
```

---

## 使用 Go 命令直接重置

如果你喜欢使用 Go 命令，可以：

```bash
cd backend
go run ./cmd/reset-db
```

这个命令会:
1. 删除所有数据库表
2. 重新创建表结构
3. 创建默认超级管理员

---

## 常见场景

### 场景 1: 测试后清理数据

```bash
# 停止后端服务 (Ctrl+C)
./scripts/reset-and-init.sh
# 重新启动后端服务
```

### 场景 2: 重新开始 E2E 测试

```bash
# 1. 重置数据库
./scripts/reset-and-init.sh

# 2. 启动后端
cd backend && go run ./cmd/server --watch

# 3. 启动前端
cd frontend && npm run dev

# 4. 运行测试
cd frontend && npx playwright test
```

### 场景 3: 只清除测试数据，保留结构

使用 SQL 直接清空表:
```bash
PGPASSWORD=admin psql -h 192.168.1.4 -p 5432 -U admin -d ydms << EOF
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE course_permissions CASCADE;
EOF

# 然后创建默认管理员
cd backend && go run ./cmd/reset-db
```

---

## 数据库配置

数据库配置位于 `backend/.env`:

```env
YDMS_DB_HOST=192.168.1.4
YDMS_DB_PORT=5432
YDMS_DB_USER=admin
YDMS_DB_PASSWORD=admin
YDMS_DB_NAME=ydms
YDMS_DB_SSLMODE=disable
```

---

## 故障排除

### 问题: 脚本报错 "找不到 .env 文件"

**解决**: 确保在项目根目录执行脚本
```bash
cd /home/yjxt/codes/ydms
./scripts/reset-and-init.sh
```

### 问题: 数据库连接失败

**检查**:
1. PostgreSQL 服务是否运行
2. `backend/.env` 中的数据库配置是否正确
3. 网络连接是否正常

```bash
# 测试数据库连接
PGPASSWORD=admin psql -h 192.168.1.4 -p 5432 -U admin -d postgres -c "SELECT version();"
```

### 问题: 权限不足

**解决**: 添加执行权限
```bash
chmod +x scripts/*.sh
```

---

## 安全建议

1. **生产环境**: 绝对不要使用这些脚本！它们会删除所有数据
2. **密码安全**: 首次登录后立即修改默认密码
3. **备份**: 重置前如果需要保留数据，请先备份

```bash
# 备份数据库
PGPASSWORD=admin pg_dump -h 192.168.1.4 -p 5432 -U admin ydms > backup_$(date +%Y%m%d_%H%M%S).sql

# 恢复数据库
PGPASSWORD=admin psql -h 192.168.1.4 -p 5432 -U admin ydms < backup_20251026_120000.sql
```
