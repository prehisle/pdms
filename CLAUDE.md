# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 语言要求
- 总是使用简体中文，场景包括与用户交互、生成的文档、代码注释
- 代码提交及推送需用户每次明确要求才进行

## 架构概览

YDMS（资料管理系统）是一个全栈应用，采用 Go 后端和 React 前端：

- **后端**：Go 1.22+ 服务，充当上游 NDR（节点-文档-关系）服务的代理/门面
  - 入口：`backend/cmd/server/main.go`
  - HTTP 路由：`backend/internal/api/router.go` 和 `handler.go`
  - 领域服务：`backend/internal/service/`（category.go、documents.go、document_types.go）
  - NDR 客户端：`backend/internal/ndrclient/client.go` - 封装所有上游 NDR API 调用
  - 工具库：`backend/internal/config/`、`backend/internal/cache/`（cache.Provider 目前为空实现）

- **前端**：Vite + React + Ant Design + TanStack Query
  - 入口：`frontend/src/main.tsx`
  - 按领域组织的功能：`frontend/src/features/categories/`、`frontend/src/features/documents/`
  - API 客户端：`frontend/src/api/`（http.ts、categories.ts、documents.ts）
  - 输出：`frontend/dist/`（gitignore 排除）

- **文档**：`docs/` 包含设计笔记和 `docs/backend/openapi.json`（NDR OpenAPI 规范）

## 开发命令

### 快速开始（使用 Makefile）
```bash
# 查看所有可用命令
make help

# 快速重置数据库（推荐）- 清空数据但保留表结构
make quick-reset

# 完整重置并初始化（重建数据库）
make reset-init

# 启动后端开发服务器
make dev-backend

# 启动前端开发服务器
make dev-frontend

# 运行后端测试
make test-backend

# 运行 E2E 测试
make test-e2e

# 运行 E2E 测试（UI 模式）
make test-e2e-ui

# 安装所有依赖
make install

# 清理临时文件
make clean
```

### 后端
```bash
cd backend

# 启动服务器（加载 .env 或 YDMS_* 环境变量）
go run ./cmd/server

# 启动并在 .go/.env/go.mod/go.sum 变更时自动重新加载
# 二进制文件编译到 backend/tmp/server-dev
go run ./cmd/server --watch

# 运行所有测试并显示覆盖率
go test ./... -cover

# 运行特定测试
go test ./internal/service -run TestCreateDocument

# 运行 NDR 集成测试（需要运行中的 NDR 服务）
go test ./internal/ndrclient -run TestRealNDRIntegration \
  -ndr.url=http://localhost:9001 \
  -ndr.apikey=your-key \
  -ndr.user=test-user

# 格式化代码
gofmt -w .
go vet ./...

# 整理依赖
go mod tidy
```

### 前端
```bash
cd frontend

# 安装依赖（在修改 lockfile 后）
npm install

# 在 http://localhost:5173 启动开发服务器
npm run dev

# 启用拖拽调试（在浏览器控制台输出 [drag-debug] 日志）
VITE_DEBUG_DRAG=1 npm run dev

# 构建生产版本
npm run build

# 预览生产版本构建
npm run preview

# E2E 测试
npm run test:e2e              # 无头模式运行测试
npm run test:e2e:ui           # UI 模式运行测试
npm run test:e2e:headed       # 有头模式运行测试
npm run test:e2e:debug        # 调试模式运行测试
```

### 数据库管理
```bash
# 快速重置（日常使用，推荐）
make quick-reset

# 完整重置（遇到问题时）
make reset-init

# 使用 Go 工具重置
cd backend && go run ./cmd/reset-db

# 手动连接数据库（需配置 .env）
PGPASSWORD=admin psql -h 192.168.1.4 -p 5432 -U admin -d ydms
```

**默认管理员账号**（重置后自动创建）：
- 用户名：`super_admin`
- 密码：`admin123456`

详细的数据库重置指南请参阅 [DATABASE_RESET.md](DATABASE_RESET.md)。

## 关键领域概念

### 文档类型系统
应用最近从灵活的资料系统迁移到强类型文档系统。在 `backend/internal/service/document_types.go` 中定义了五种文档类型：

1. **overview** - HTML 格式，通用概览内容
2. **dictation** - YAML 格式，听写练习
3. **comprehensive_choice** - YAML 格式，多空选择题
4. **case_analysis** - YAML 格式，案例分析题（原为 "security_analysis"）
5. **essay** - YAML 格式，论文题

每个文档包含：
- `type`：上述常量之一
- `content`：结构为 `{"format": "html"|"yaml", "data": "<内容字符串>"}`
- `metadata`：灵活的 JSON 对象（如 `{"difficulty": 1-5, "tags": [...]}`），由 `ValidateDocumentMetadata()` 验证

文档验证在服务层通过 `ValidateDocumentContent()` 和 `ValidateDocumentMetadata()` 进行。

### 分类树与 NDR 集成
- 分类是存储在 NDR 服务中的层级节点
- `service/category.go` 中的后端方法聚合分页的 NDR 响应（GetTree、ListDeleted）
- 拖拽排序使用 `/api/v1/categories/{id}/reposition` 端点，该端点在一个原子操作中组合移动和重排
- `reposition` 端点需要 `new_parent_id` 和 `ordered_ids`（必须包含被移动的节点）

### 关系
- 文档通过关系绑定到分类节点（node_id ↔ document_id）
- 软删除：文档/节点用 `deleted_at` 标记；使用 `/nodes/{id}/restore` 或 `/documents/{id}/restore` 恢复
- 清除：`/nodes/{id}/purge` 或 `/documents/{id}/purge` 永久删除

### 用户认证和权限系统

#### 角色定义
YDMS 实现了基于角色的访问控制（RBAC），定义了三种用户角色：

1. **super_admin（超级管理员）**
   - 完全访问权限
   - 可以创建/编辑/删除所有用户（包括其他 super_admin）
   - 可以管理所有分类和文档
   - 可以为 course_admin 分配课程权限

2. **course_admin（课程管理员）**
   - 可以创建/编辑/删除校对员用户
   - 可以管理分配给自己的课程（根节点）及其子节点
   - 可以创建/编辑/删除分类和文档
   - 不能管理其他管理员

3. **proofreader（校对员）**
   - **只读**查看分类树
   - **可以编辑**文档内容
   - **可以查看和恢复**文档历史版本
   - **不能**创建/删除文档
   - **不能**创建/编辑/删除分类
   - **不能**访问用户管理
   - **可以**修改自己的密码

#### 数据库模型

**users 表**:
```sql
id            SERIAL PRIMARY KEY
username      VARCHAR(100) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
role          VARCHAR(50) NOT NULL  -- super_admin, course_admin, proofreader
display_name  VARCHAR(100)
created_by_id INT REFERENCES users(id)
created_at    TIMESTAMP
updated_at    TIMESTAMP
deleted_at    TIMESTAMP  -- 软删除
```

**course_permissions 表**:
```sql
id           SERIAL PRIMARY KEY
user_id      INT REFERENCES users(id)
root_node_id INT NOT NULL  -- NDR 中的根节点 ID
created_at   TIMESTAMP
```

#### 认证流程

1. **默认管理员**: 数据库迁移会自动创建 `super_admin / admin123456`，可通过 `YDMS_DEFAULT_ADMIN_*` 环境变量覆盖，部署后务必强制修改密码。

2. **登录**: 用户使用用户名和密码登录
   - `POST /api/v1/auth/login`
   - 返回 JWT token 和用户信息

3. **认证**: 使用 JWT token 进行 API 请求
   - Header: `Authorization: Bearer <token>`
   - Middleware 验证 token 并提取用户信息

4. **其他操作**:
   - 获取当前用户: `GET /api/v1/auth/me`
   - 修改密码: `POST /api/v1/auth/change-password`
   - 登出: `POST /api/v1/auth/logout` (前端删除 token)

#### 用户管理 API

- `GET /api/v1/users` - 获取用户列表
- `POST /api/v1/users` - 创建用户
- `GET /api/v1/users/:id` - 获取用户详情
- `DELETE /api/v1/users/:id` - 删除用户
- `GET /api/v1/users/:id/courses` - 获取用户的课程权限
- `POST /api/v1/users/:id/courses` - 授予课程权限
- `DELETE /api/v1/users/:id/courses/:rootNodeId` - 撤销课程权限

#### 前端权限控制

**分类树 (CategoryTreePanel)**:
- `canManageCategories` prop 控制是否显示管理功能
- 工具栏中的"新建根目录"按钮根据权限显示/隐藏
- 右键菜单根据角色动态生成：
  - proofreader 只能看到"复制所选"（只读操作）
  - 管理员可以看到所有操作（新建、编辑、删除、剪切、粘贴）

**用户管理 (UserManagementPage)**:
- 仅 super_admin 和 course_admin 可见
- super_admin 可以创建所有角色用户
- course_admin 只能创建 proofreader
- 不能删除自己
- course_admin 不能删除其他管理员

**路由保护**:
- 所有业务路由需要认证 (JWT middleware)
- 前端使用 `PrivateRoute` 组件保护路由
- `AuthContext` 提供全局用户状态

#### 测试账号

**默认管理员**（数据库重置后自动创建）：
```
用户名: super_admin
密码:   admin123456
```

**开发/测试环境的其他账号**：
```
超级管理员:
  Username: testadmin
  Password: newpass456

课程管理员:
  Username: course_admin1
  Password: testpass123

校对员:
  创建后使用设置的密码
```

**安全提示**:
- 首次登录后请立即修改密码
- 生产环境必须修改所有默认密码

## 环境配置

后端从 `backend/` 或环境变量读取 `.env`：
```
YDMS_NDR_BASE_URL=http://localhost:9001
YDMS_NDR_API_KEY=your-ndr-key
YDMS_HTTP_PORT=9180
YDMS_DEFAULT_USER_ID=system
YDMS_ADMIN_KEY=your-ndr-admin-key
YDMS_DEBUG_TRAFFIC=1  # 记录向 NDR 的 HTTP 请求和响应
```

前端读取 `frontend/.env`：
```
VITE_API_BASE_URL=http://localhost:9180  # API 基础 URL（可选，默认使用 Vite 代理）
VITE_DEBUG_DRAG=1  # 启用拖拽调试日志
VITE_DEBUG_MENU=1  # 启用菜单调试模式
```

**绝不提交秘钥**，如 `YDMS_NDR_API_KEY` 或 `YDMS_ADMIN_KEY`。

## 测试策略

### 后端测试
- 单元测试与代码共地：`*_test.go`
- 优先使用表驱动测试
- 夹具在 `backend/internal/service/testdata/`
- NDR 集成测试需要运行中的服务（见上面的命令）
- 所有测试已更新为使用新的文档类型系统（overview, dictation, comprehensive_choice, case_analysis, essay）

### 前端测试
- **Playwright E2E 测试**: `frontend/e2e/` 目录包含端到端测试
  - 认证流程测试: `auth.spec.ts`
  - 用户管理测试: `user-management.spec.ts`
  - 权限控制测试: `permissions.spec.ts`
  - 测试辅助工具: `fixtures/auth.ts`
  - 测试结果: `TEST_RESULTS.md`
- 运行测试: `npm run test:e2e`
- UI 模式调试: `npm run test:e2e:ui`
- 测试基础设施已存在（package.json 中的 Vitest、React Testing Library）用于单元测试

## 代码风格

### Go
- 使用 `gofmt`/`goimports` 格式化
- 包名小写，导出函数 PascalCase
- 共享错误遵循 `ErrXYZ` 约定
- 服务和处理器使用表驱动测试
- 小接口，镜像现有的缓存/配置抽象

### TypeScript/React
- 严格 TypeScript：显式返回类型
- 组件在 PascalCase 文件中，hooks 为 `useCamelCase`
- 每个组件共置资源
- 共享查询键在 `src/hooks/` 下（如适用）
- 描述性的 prop 名称

## 提交约定
遵循常规提交：
- `feat:` - 新功能
- `fix:` - 修复 bug
- `docs:` - 文档变更
- `refactor:` - 代码重构
- `test:` - 测试增加/变更

使用简洁的命令式摘要。分组相关变更。跨越后端和前端时提及领域。

## Pull Request 指南
PR 应包括：
- 行为变更摘要
- 运行的测试命令
- 链接的问题（如适用）
- 面向用户的变更需要 UI 截图或 curl 示例
- 工作流或 API 变更时更新 `docs/`、`AGENTS.md` 或此文件

## 常见调试

### 后端
- 启用 `YDMS_DEBUG_TRAFFIC=1` 记录所有 NDR HTTP 请求和响应
- 检查 `backend/server.log`（gitignore 排除）
- watch 模式写入 `backend/tmp/` - 重置时清理

### 前端
- 使用 `VITE_DEBUG_DRAG=1` 进行拖拽诊断，浏览器控制台显示 `[drag-debug]` 日志
- 使用 `VITE_DEBUG_MENU=1` 启用菜单调试模式
- 使用 `VITE_API_BASE_URL` 自定义 API 端点（开发时默认通过 Vite 代理到 localhost:9180）
- React Query DevTools 在开发时可用

### Docker Compose 问题

**错误：`KeyError: 'ContainerConfig'`**
- **原因**：使用旧版 `docker-compose` V1 与镜像元数据不兼容
- **解决**：
  ```bash
  # 使用 Docker Compose V2（空格而非连字符）
  docker compose down
  docker compose up -d

  # 如果命令不存在，安装 Docker Compose V2
  sudo apt-get install docker-compose-plugin

  # 完全重建（如果仍失败）
  docker compose down
  docker rm -f ydms-postgres ydms-app ydms-frontend
  docker pull postgres:16-alpine
  docker compose up -d --force-recreate
  ```

**端口冲突错误：`port is already allocated`**
- **检查端口占用**：
  ```bash
  sudo lsof -i :9001   # 前端 HTTP 端口
  sudo lsof -i :9180   # 后端 API 端口
  sudo lsof -i :5432   # PostgreSQL（如果暴露）
  ```
- **解决方案**：
  - 方案1：停止占用端口的服务（如 `sudo systemctl stop postgresql`）
  - 方案2：修改 `.env` 文件使用其他端口，然后 `docker compose restart`

**服务无法启动或健康检查失败**
- **检查日志**：
  ```bash
  docker compose logs postgres   # 数据库日志
  docker compose logs ydms-app   # 后端日志
  docker compose logs frontend   # 前端日志
  ```
- **检查网络连接**：
  ```bash
  docker compose exec ydms-app ping postgres  # 测试内部网络
  ```
- **验证环境配置**：
  ```bash
  # 确保 .env 文件包含所有必需变量
  grep -E "POSTGRES_PASSWORD|YDMS_NDR_API_KEY|YDMS_JWT_SECRET" .env
  ```

## 生成的文件
生成的输出应保持未跟踪状态：
- `backend/tmp/`、`backend/.gocache/`、`backend/server.log`
- `frontend/dist/`、`frontend/node_modules/`

## 生产部署

### Docker 部署
项目支持前后端分离的 Docker 部署方式：

```bash
# 构建后端镜像
docker build -t ydms-backend:latest -f Dockerfile .

# 构建前端镜像
docker build -t ydms-frontend:latest -f Dockerfile.frontend ./frontend

# 使用 Docker Compose 部署
cd deploy/production
cp .env.example .env
nano .env  # 配置环境变量
docker compose up -d
```

### 一键部署脚本
```bash
# 使用本地配置文件部署（推荐）
./scripts/deploy_prod.sh --env-file deploy/production/.env.1.31

# 查看部署选项
./scripts/deploy_prod.sh --help
```

### 生产环境检查
```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs ydms-app

# 重启服务
docker compose restart ydms-app
```

详细的生产部署指南请参阅 [deploy/production/README.md](deploy/production/README.md)。

### 关键配置
生产环境必须配置以下环境变量：
- `POSTGRES_PASSWORD` - 数据库密码
- `YDMS_NDR_BASE_URL` - NDR 服务地址
- `YDMS_NDR_API_KEY` - NDR API 密钥
- `YDMS_ADMIN_KEY` - NDR 管理员密钥
- `YDMS_JWT_SECRET` - JWT 签名密钥

**安全提示**：
- 生产环境必须修改所有默认密码
- 使用强密码和随机生成的密钥
- 定期备份 PostgreSQL 数据库

## 常见工作流

### 日常开发流程
```bash
# 1. 启动前重置数据库到干净状态
make quick-reset

# 2. 在不同终端启动后端和前端
make dev-backend   # 终端1：后端服务
make dev-frontend  # 终端2：前端服务

# 3. 开发中...修改代码，自动重载

# 4. 运行测试验证变更
make test-backend  # 后端测试
make test-e2e      # E2E 测试

# 5. 提交前检查
cd backend && go vet ./...    # 检查代码
cd frontend && npm run build  # 验证构建
```

### 添加新文档类型
1. 在 `backend/internal/service/document_types.go` 中添加新的文档类型常量
2. 更新 `ValidateDocumentContent()` 和 `ValidateDocumentMetadata()` 函数
3. 在 `backend/internal/service/testdata/` 添加测试数据
4. 更新相关测试用例
5. 在前端添加相应的编辑器和预览组件

### 调试 NDR 集成问题
```bash
# 1. 启用调试模式
export YDMS_DEBUG_TRAFFIC=1

# 2. 启动服务并查看日志
make dev-backend

# 3. 日志会显示所有 HTTP 请求和响应
# 检查 backend/server.log 文件

# 4. 运行集成测试
cd backend
go test ./internal/ndrclient -run TestRealNDRIntegration \
  -ndr.url=http://localhost:9001 \
  -ndr.apikey=your-key \
  -ndr.user=test-user
```

### 修复 E2E 测试失败
```bash
# 1. 重置数据库到已知状态
make quick-reset

# 2. 以 UI 模式运行失败的测试
cd frontend
npx playwright test --ui

# 3. 或以有头模式运行查看浏览器行为
npx playwright test --headed

# 4. 调试特定测试
npx playwright test --debug auth.spec.ts

# 5. 查看测试结果报告
npx playwright show-report
```

### 添加新的用户权限功能
1. 更新数据库模型（`backend/internal/models/`）
2. 修改认证 middleware（`backend/internal/api/middleware.go`）
3. 更新用户服务层（`backend/internal/service/users.go`）
4. 在前端更新 `AuthContext` 和权限检查
5. 添加 E2E 测试验证权限控制（`frontend/e2e/permissions.spec.ts`）

### 处理端口冲突
```bash
# 检查端口占用
lsof -i :9180  # YDMS 后端
lsof -i :5173  # Vite 前端
lsof -i :9001  # NDR 服务

# 终止占用端口的进程
kill -9 <PID>

# 或使用 fuser
fuser -k 9180/tcp
```
