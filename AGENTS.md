# Repository Guidelines

## 项目结构与模块组织
仓库分为 `backend/` 与 `frontend/` 两大端。Go 服务入口位于 `backend/cmd/server`，HTTP 路由集中在 `backend/internal/api`，业务逻辑放在 `backend/internal/service`，外部 NDR 客户端在 `backend/internal/ndrclient`。React 管理端代码位于 `frontend/src/`，构建产物输出到 `frontend/dist/`，设计文档与 OpenAPI 规范位于 `docs/`。临时构建文件（例如 `backend/tmp/`、`.gocache/`、`server.log`）应保持未跟踪状态。

## 构建、测试与开发命令
- `cd backend && go run ./cmd/server`：按当前 `.env` 启动 API 服务。
- `cd backend && go run ./cmd/server --watch`：监视 Go 源与环境变量变化并热重载，可在 `backend/tmp/server-dev` 找到二进制。
- `cd backend && go test ./... -cover`：执行后端单元测试并输出覆盖率。
- `cd frontend && npm install`：同步前端依赖；锁文件变更后必跑。
- `cd frontend && npm run dev`：本地启动 Vite，默认端口 5173。
- `cd frontend && npm run build` 或 `npm run preview`：验证生产构建。

## 编码风格与命名规范
Go 代码使用 `goimports`、`gofmt` 格式化，包名全小写，导出符号 PascalCase，共享错误统一 `ErrXxx`。React 组件采用 PascalCase 文件名与导出，Hook 以 `useCamelCase` 命名，TypeScript 保持显式返回类型与语义化 Prop 名称。必要时添加精炼注释解释复杂逻辑，避免琐碎注释。

## 测试指引
Go 单测文件紧邻被测代码，命名为 `*_test.go`，可复用 `backend/internal/service/testdata` 下的夹具。集成测试需外部 NDR 服务，仅在具备凭据时运行（`go test ./internal/ndrclient -run TestRealNDRIntegration -ndr.url=...`）。提交前至少跑后端单测；前端尚未建立自动化测试，若需新增工具先在 PR 中提议。

## 提交与合并请求规范
提交消息遵循 `feat: ...`、`fix: ...` 等惯例前缀，语句保持祈使语并聚焦单一变更。PR 需说明行为变更、影响范围、已执行测试命令以及相关 Issue，UI 变动附示例截图或 cURL 片段。多域修改应在描述中点明涉及的服务或前端模块。

## 安全与配置提示
敏感配置通过 `.env` 管理，禁止提交实际的 `YDMS_NDR_API_KEY`、`YDMS_ADMIN_KEY` 或外部端点。启用 Watch 模式会在 `backend/tmp/` 写入临时二进制，定期清理并确保日志文件不入库。必要时使用环境变量前缀 `YDMS_` 进行覆盖，保持与文档一致。

## 沟通约定
所有协作与反馈请统一使用中文表述，确保讨论语境一致、记录易于追溯。
