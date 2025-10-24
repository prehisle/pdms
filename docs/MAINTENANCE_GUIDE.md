# YDMS 项目维护指南

## 1. 项目概览

YDMS 由 Go 后端与 React 前端组成，面向题库管理及文档维护场景。后端负责对接外部 NDR 服务，提供目录、文档等 API；前端提供基于 Ant Design 与 Monaco Editor 的管理界面。项目采用模块化结构，强调表驱动的业务逻辑、严格的 TypeScript 类型以及可扩展的缓存与配置机制。

核心目标：
- 保持稳定的目录与文档管理能力，确保与 NDR 的同步可靠。
- 支撑前端的拖拽、批量操作、文档编辑等进阶功能。
- 提供清晰的开发、测试、部署流程，方便团队持续维护与迭代。

## 2. 目录结构速览

- `backend/`：Go 1.22 服务
  - `cmd/server`：服务入口与开发时的自动重载逻辑。
  - `internal/api`：HTTP 路由与 Handler，负责认证信息透传与中间件。
  - `internal/service`：题库与文档的领域逻辑，包含批量操作、回滚策略等。
  - `internal/ndrclient`：对接上游 NDR 的 HTTP 客户端封装。
  - `internal/cache`：缓存抽象，目前提供空实现，可替换为 Redis 等。
  - `internal/config`：环境变量读取与默认值管理。
- `frontend/`：Vite + React 管理端
  - `src/api`：HTTP 工具与业务 API 封装，使用 `fetch` 及 Query 构造器。
  - `src/features`：按领域划分的功能模块（如 categories、documents）。
  - `src/features/.../components`：界面组件；`hooks`：React Query 与状态逻辑。
  - `src/main.tsx`、`AppRoutes.tsx`：应用入口与路由。
  - `vite.config.ts`、`vite.config.test.ts`：开发与测试构建配置。
- `docs/`：设计说明、OpenAPI 规格、阶段性报告与本维护指南。

## 3. 环境与基础配置

### 3.1 后端
- 依赖 Go 1.22+，推荐使用 `gvm` 或官方 tarball 安装。
- 核心环境变量（可在 `.env` 中维护）：
  - `YDMS_NDR_BASE_URL`：NDR 服务地址。
  - `YDMS_NDR_API_KEY`、`YDMS_ADMIN_KEY`：访问凭证，勿提交至仓库。
  - `YDMS_DEFAULT_USER_ID`：缺省的用户标识，会作为 `x-user-id`。
  - `YDMS_HTTP_PORT`：HTTP 监听端口，默认 `9180`。
  - `YDMS_DEBUG_TRAFFIC=1` 可输出 NDR 请求/响应日志，仅限调试。
- 启动命令：`cd backend && go run ./cmd/server`。
- 开发热重载：`go run ./cmd/server --watch`，生成二进制位于 `backend/tmp/server-dev`。

### 3.2 前端
- 依赖 Node.js 18+ 与 npm（或 pnpm/yarn）；锁定文件为 `package-lock.json`。
- 环境变量通过 Vite 读取：
  - `VITE_API_BASE_URL`：API 网关地址；默认为浏览器当前域名。
  - `VITE_DEBUG_DRAG=1`：开启拖拽调试日志。
- 初始化：
  - `cd frontend && npm install`
  - 开发服：`npm run dev`，访问 `http://localhost:5173`。

## 4. 日常开发流程

1. **拉取最新代码**：`git pull`，确认未提交临时文件（尤其是 `backend/tmp/`、`server.log` 等）。
2. **切换/创建分支**：采用约定的分支命名（如 `feature/...`、`fix/...`）。
3. **后端开发**：
   - 使用 `cmd/server` 启动服务，与前端或 Postman 联调。
   - 通过 `internal/service` 编写业务逻辑，尽量保持表驱动与纯函数。
   - 若需缓存，扩展 `cache.Provider` 接口并在 `main.go` 中注入实现。
4. **前端开发**：
   - 在 `src/features` 下按领域扩展组件与 hooks。
   - 所有 API 请求通过 `src/api` 封装，确保错误处理与查询参数构造一致。
   - 严格保持 TypeScript 类型完整，必要时补充 `types.ts`。
5. **文档维护**：
   - 重大变更更新 `docs/` 中相关说明与 OpenAPI。
   - 若工作流变化，需要同步更新 `AGENTS.md` 或本指南。
6. **文档操作约定**：
   - 列表页中的“移入回收站”仅触发软删除，真实数据保存在 `/api/v1/documents` 回收站内，可随时恢复或彻底删除。
   - 回收站入口位于文档面板右上方，所有操作会自动刷新当前节点的文档列表与回收站视图。
   - 历史版本抽屉提供版本浏览与一键回退，回退成功后会刷新历史列表与节点文档数据，确保前后端状态一致。

## 5. 依赖与版本管理

### 5.1 Go 模块
- `backend/go.mod` 记录依赖，当前核心依赖包括：
  - `fsnotify`：热重载文件监控。
  - `uuid`：请求 ID 生成。
  - `godotenv`：环境变量加载。
- 新增依赖前确认是否必须，并通过 `go mod tidy` 清理冗余条目。

### 5.2 Node.js 依赖
- `package.json` 中的关键依赖：
  - `@tanstack/react-query`：数据获取与缓存。
  - `antd`：UI 组件库。
  - `@monaco-editor/react`、`dompurify`、`js-yaml`：文档编辑器相关。
- 测试依赖（Vitest 与 Testing Library）已在 `devDependencies` 中，运行单测前需确保安装完毕。
- 升级依赖时：
  1. 使用 `npm outdated` 评估影响；必要时在单独分支实验。
  2. 更新后运行 `npm run build` 与 `npm run test` 验证。
  3. 如涉及打包体积或性能变化，记录在 `docs/`。

## 6. 测试与质量保障

### 6.1 后端测试
- 基础单测：`cd backend && go test ./... -cover`。
- NDR 集成测试：`go test ./internal/ndrclient -run TestRealNDRIntegration -ndr.url=...`（需联通真实 NDR）。
- 新增业务逻辑时应覆盖成功与失败路径，利用 `internal/service/testdata` 复用夹具。

### 6.2 前端测试
- 运行命令：`cd frontend && npm run test`（Vitest）。
- 默认 `setupTests.ts` 已引入 Testing Library 配置；编写测试文件可放置在 `__tests__` 或与组件同层。
- 前端暂未全面接入持续集成，建议在提交前至少手动运行单测。

### 6.3 静态检查与格式化
- Go：提交前运行 `gofmt`/`goimports`，可通过 `go fmt ./...` 快速处理。
- TypeScript：遵循项目现有格式，必要时使用编辑器的 Prettier/Vite 插件。
- 注意遵守仓库约定：接口命名采用 PascalCase，hooks 使用 `useCamelCase` 命名。

## 7. 构建与部署

### 7.1 后端
- 正式构建可使用 `go build ./cmd/server` 生成二进制。
- 部署前需配置生产环境变量，建议通过容器或系统服务管理。
- 日志默认输出到标准输出，必要时在上层扩展日志收集。

### 7.2 前端
- 生产构建：`npm run build`，输出至 `frontend/dist/`。
- 预览构建：`npm run preview`，用于本地验证打包结果。
- 部署时仅需发布 `dist/` 静态文件，确保与后端域名或 API 网关的 CORS 配置匹配。

### 7.3 联调建议
- 使用 `.env` 中的 `YDMS_DEBUG_TRAFFIC=1` 观察后端与 NDR 的请求链路。
- 前端可通过浏览器控制台的 `[drag-debug]` 日志排查拖拽相关问题。
- 若涉及大批量操作，提前在测试环境回放关键流程，关注 `CURRENT_ISSUES.md` 中提到的回滚策略。

## 8. 常见运维与排障

- **后端无法启动**：检查端口占用、环境变量、`.env` 是否存在；必要时删除 `backend/tmp/server-dev` 重建。
- **NDR 请求失败**：确认 API Key、生效 IP 白名单、NDR 服务状态；启用调试日志查看更多细节。
- **目录树异常**：使用 `GET /api/v1/categories/tree` 校验服务返回；若排序错误，可调用 `PATCH /api/v1/categories/{id}/reposition` 重排。
- **批量操作失败**：根据日志确认是否触发回滚函数，参考 `internal/service/category.go` 中的实现以定位问题。
- **前端构建报错**：确保 Node 版本满足要求，清理 `node_modules` 后重新安装；检查 TypeScript 配置与新增类型定义。
- **文档找回/回退**：
  - 软删除的文档可通过 `GET /api/v1/documents/trash` 查看，`POST /api/v1/documents/{id}/restore` 恢复，`DELETE /api/v1/documents/{id}/purge` 彻底删除。
  - 历史版本通过 `GET /api/v1/documents/{id}/versions` 获取，`POST /api/v1/documents/{id}/versions/{version}/restore` 回退。前端抽屉中会展示更新时间、操作者、备注及源码预览，便于核对后执行回退。

## 9. 安全与合规

- 不得将真实的 `YDMS_*` 密钥写入仓库，使用 `.env` 本地管理并加入 `.gitignore`。
- 前端通过 DOMPurify 进行 HTML 净化，但仍需避免将未验证的用户输入直接渲染。
- 在生产环境禁用 `YDMS_DEBUG_TRAFFIC`，避免日志泄露敏感信息。
- 审核第三方依赖更新，关注安全公告，必要时在维护指南中记录处理措施。

## 10. 文档与沟通

- 最新的 API 规格参考 `docs/backend/openapi.json`。
- 当前缺陷与改进计划详见 `docs/CURRENT_ISSUES.md`、`docs/PROGRESS_REPORT.md`。
- 前端文档编辑器实现细节位于 `docs/frontend/EDITOR_IMPLEMENTATION.md`。
- 若流程发生变化，请同步更新上述文档及本指南，确保团队信息一致。

## 11. 提交流程

- 提交信息遵循「类型前缀 + 简明描述」（如 `fix: 调整批量删除依赖校验`）。
- 同一次提交仅包含关联改动，禁止混杂无关文件。
- 推送前确认测试通过并无多余日志或临时文件，必要时更新相关文档。
- 合并请求中需列出：变更概述、验证命令、关联缺陷或需求、前端截图或 cURL 结果（若为用户可见功能）。

## 12. 后续提升建议

- 引入自动化流水线执行 `go test`、`npm run test` 与构建流程，提升质量门槛。
- 规划缓存实现（如 Redis），复用 `cache.Provider` 接口降低刷新延迟。
- 完成前端测试依赖安装，在 CI 中启用 Vitest 覆盖率报告。
- 加强监控：为后端关键 API 增加延迟、错误率指标；前端可引入错误上报。
- 整理定期维护事项（如依赖更新、OpenAPI 对齐）并安排周期性检查。

> 本指南需随项目演进定期更新，如发现信息过期请立即修订。
