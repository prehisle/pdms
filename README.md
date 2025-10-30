 # YDMS（资料管理系统）

 一套面向“节点/文档/关系（NDR）”的资料管理与后台管理界面，后端基于 Go，前端基于 Vite + React + Ant Design。用于按目录组织多类型文档，支持文档类型扩展与版本管理。

 ## 快速开始

 - 环境要求：`Go 1.22+`、`Node.js 18+`、可选 `Docker 20.10+`
 - 一键查看可用命令：`make help`

 常用命令：

 - 启动后端（热重载）：`make dev-backend`
 - 启动前端（Vite）：`make dev-frontend`
 - 生成文档类型代码（前后端同步）：`make generate-doc-types`
 - 运行后端测试：`make test-backend`
 - 运行前端 E2E 测试：`make test-e2e`
 - 快速重置数据库：`make quick-reset`（详见 `DATABASE_RESET.md`）

 ## 目录结构

 - `backend/` Go 服务端
   - `cmd/server` 入口；`internal/api` 路由；`internal/service` 领域服务
   - `internal/ndrclient` NDR 客户端；`internal/config` 配置；`internal/cache` 缓存抽象
 - `frontend/` 管理端（Vite + React + AntD）
   - `src/` 业务模块与组件
 - `docs/` 设计文档、部署与 OpenAPI 规范
 - `doc-types/` 文档类型配置与模板，支持代码生成
 - `deploy/production/` 生产部署说明与示例配置

 更多说明见下方“文档索引”。

## 文档索引（推荐从这里开始）

 - 开发入门
   - 后端入门：`backend/README.md`
   - 前端入门：`frontend/README.md`
   - 文档类型与生成：`doc-types/README.md`
- API 与规范
  - OpenAPI 规范：`docs/backend/openapi.json`
  - API 使用指南（cURL 示例）：`docs/api/usage.md`
  - 在线预览（Redoc）：`docs/api/index.html`
 - 部署与运维
   - Docker 部署：`docs/DOCKER_DEPLOYMENT.md`
   - 生产部署：`deploy/production/README.md`
   - 运维与维护：`docs/MAINTENANCE_GUIDE.md`
   - 数据库重置：`DATABASE_RESET.md`
- 规划与进展
  - 方案与设计：`docs/backend/项目规划与方案.md`
  - 当前进度与待办：`docs/backend/当前进度与待办.md`
- 主题指南（将逐步整合）
  - API Keys 指南（权威）：`docs/guides/api-keys.md`
  - 历史与实现文档：`docs/API_KEY_GUIDE.md`、`docs/API_KEY_FRONTEND_GUIDE.md`、`docs/API_KEY_COMPLETE_GUIDE.md`、`docs/API_KEY_IMPLEMENTATION_SUMMARY.md`
 - 架构与权限
   - 架构概览与关键流程：`docs/architecture/overview.md`
   - 权限矩阵与请求头：`docs/architecture/permissions.md`
   - 文档引用功能：`frontend/文档引用功能使用说明.md`

 更多分类索引见：`docs/README.md`。

 ## 安全与配置

 - 所有敏感配置均通过 `.env` 管理；请勿提交实际密钥（`YDMS_NDR_API_KEY`、`YDMS_ADMIN_KEY` 等）。
 - 支持以 `YDMS_` 前缀的环境变量覆盖默认配置，保持与文档一致。
 - 临时构建文件（如 `backend/tmp/`、`.gocache/`、`server.log`）保持未跟踪状态（见 `.gitignore`）。

## 故障排除

 - 数据库一键重置与常见问题：`DATABASE_RESET.md`
- 查看后端 NDR 请求调试：设置 `YDMS_DEBUG_TRAFFIC=1`（详见 `backend/README.md`）

## 文档工具

- 检查 Markdown 内部链接：`make docs-check`
- 运行 markdownlint（若已安装）：`make docs-lint`
- 打开 OpenAPI 预览页面：`make docs-openapi`

 ## 贡献与规范

 - 代码风格、提交流程与沟通约定见 `AGENTS.md`
 - 提交信息请使用 `feat:`、`fix:` 等前缀，并在 PR 中补充变更说明、测试记录与必要截图/示例
