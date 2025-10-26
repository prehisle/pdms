# 数据库重置指南

## 🚀 快速开始（推荐）

最简单的重置方法：

```bash
make quick-reset
```

这会：
- ✅ 清空所有表数据
- ✅ 保留表结构
- ✅ 创建默认管理员
- ⚡ 非常快速（约 2 秒）

---

## 📌 三种重置方法

### 1. 快速重置（日常使用）

```bash
make quick-reset
```

**适用场景**：
- 日常测试后清理数据
- 运行 E2E 测试前准备环境
- 快速恢复到初始状态

**优点**：
- 速度快
- 保留表结构
- 不影响其他数据库连接

---

### 2. 完整重置（遇到问题时）

```bash
make reset-init
```

**适用场景**：
- 数据库结构出问题
- 表结构需要重建
- 彻底清理环境

**说明**：
- 删除并重建整个数据库
- 重新运行所有迁移
- 创建默认管理员

---

### 3. 使用 Go 工具

```bash
cd backend
go run ./cmd/reset-db
```

输入 `yes` 确认后：
- 删除所有表
- 重新创建表
- 创建默认管理员

---

## 👤 默认管理员账号

所有重置方法都会创建相同的默认账号：

```
用户名: super_admin
密码:   admin123456
```

⚠️ **首次登录后请立即修改密码！**

---

## 🧪 完整测试流程

```bash
# 1. 重置数据库
make quick-reset

# 2. 启动后端（新终端）
make dev-backend

# 3. 启动前端（新终端）
make dev-frontend

# 4. 运行 E2E 测试
make test-e2e
```

---

## 📚 所有可用命令

查看所有命令：

```bash
make help
```

输出示例：

```
YDMS 项目命令

clean                清理临时文件
dev-backend          启动后端开发服务器
dev-frontend         启动前端开发服务器
install              安装所有依赖
install-backend      安装后端依赖
install-frontend     安装前端依赖
quick-reset          快速重置（仅清空数据，推荐）
reset-db             重置数据库（删除所有数据）
reset-init           完整重置并初始化（重建数据库）
test-backend         运行后端测试
test-e2e             运行 E2E 测试
test-e2e-ui          运行 E2E 测试（UI 模式）
```

---

## 🔧 故障排除

### 问题：命令找不到

```bash
# 确保在项目根目录
cd /home/yjxt/codes/ydms
make quick-reset
```

### 问题：数据库连接失败

检查配置文件 `backend/.env`：

```bash
YDMS_DB_HOST=192.168.1.4
YDMS_DB_PORT=5432
YDMS_DB_USER=admin
YDMS_DB_PASSWORD=admin
YDMS_DB_NAME=ydms
```

测试连接：

```bash
PGPASSWORD=admin psql -h 192.168.1.4 -p 5432 -U admin -d ydms -c "SELECT version();"
```

### 问题：权限错误

```bash
# 给脚本添加执行权限
chmod +x scripts/*.sh
```

---

## 📝 进阶用法

### 手动清空特定表

```bash
source backend/.env
PGPASSWORD=$YDMS_DB_PASSWORD psql -h $YDMS_DB_HOST -p $YDMS_DB_PORT -U $YDMS_DB_USER -d $YDMS_DB_NAME << EOF
TRUNCATE TABLE users RESTART IDENTITY CASCADE;
EOF
```

### 备份数据库

```bash
source backend/.env
PGPASSWORD=$YDMS_DB_PASSWORD pg_dump -h $YDMS_DB_HOST -p $YDMS_DB_PORT -U $YDMS_DB_USER $YDMS_DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 恢复数据库

```bash
source backend/.env
PGPASSWORD=$YDMS_DB_PASSWORD psql -h $YDMS_DB_HOST -p $YDMS_DB_PORT -U $YDMS_DB_USER $YDMS_DB_NAME < backup_20251026_120000.sql
```

---

## ⚠️ 重要提示

1. **生产环境**：绝对不要在生产环境使用这些重置命令！
2. **数据丢失**：所有重置操作都会删除数据，无法恢复
3. **服务状态**：重置前最好停止后端服务
4. **备份习惯**：重要数据请先备份

---

## 📂 相关文件

- [scripts/quick-reset.sh](scripts/quick-reset.sh) - 快速重置脚本
- [scripts/reset-and-init.sh](scripts/reset-and-init.sh) - 完整重置脚本
- [backend/cmd/reset-db/main.go](backend/cmd/reset-db/main.go) - Go 重置工具
- [scripts/README.md](scripts/README.md) - 详细文档
- [Makefile](Makefile) - 项目命令定义

---

## 💡 推荐工作流

日常开发：

```bash
# 早上开始
make quick-reset      # 清理昨天的测试数据
make dev-backend      # 启动后端
make dev-frontend     # 启动前端

# 开发中...

# 测试前
make quick-reset      # 重置到干净状态
make test-e2e         # 运行测试

# 下班前
# 无需清理，明天再重置
```

---

如有问题，请查看 [scripts/README.md](scripts/README.md) 了解更多详情。
