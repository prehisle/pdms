# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 语言要求
- 总是使用简体中文，场景包括与用户交互、生成的文档、代码注释
- 代码提交及推送需用户每次明确要求才进行

## 架构概览

YDMS（题库管理系统）是一个全栈应用，采用 Go 后端和 React 前端：

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
```

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
- 测试基础设施已存在（package.json 中的 Vitest、React Testing Library）
- 尚未集成；在添加大量测试套件之前，先在 PR 中提议工具更改

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

## 生成的文件
生成的输出应保持未跟踪状态：
- `backend/tmp/`、`backend/.gocache/`、`backend/server.log`
- `frontend/dist/`、`frontend/node_modules/`
