 # 架构概览与关键流程

 本文概述前后端与 NDR 的交互关系，并以关键业务（分类拖拽重排、文档引用、文档版本）展示请求编排。

 ## 架构与模块

 - 前端（Vite + React + AntD）：管理端 UI；通过 JWT 或 API Key 调用后端。
 - 后端（Go）：
   - `internal/api`：HTTP 路由与处理器（鉴权、参数校验、错误规范）
   - `internal/service`：领域服务（编排与回滚策略）
   - `internal/ndrclient`：对接 NDR 的轻量客户端
   - `internal/auth`：JWT 与 API Key 认证中间件
   - `internal/config` / `internal/cache`：配置与扩展点
 - NDR（外部服务）：提供 Node/Document/Relationship/Version 能力

 ```mermaid
 flowchart LR
   FE[Frontend] -->|JWT/API Key| API[Backend API]
   API --> SVC[Service Layer]
   SVC --> NDR[(NDR Service)]
   API --> AUTH[Auth (JWT+APIKey)]
   AUTH --> DB[(DB)]
 ```

 ## 分类拖拽：跨父移动 + 重排（reposition）

 推荐接口：`PATCH /api/v1/categories/{id}/reposition`

 ```mermaid
 sequenceDiagram
   participant UI as UI
   participant API as Backend API
   participant SVC as Service
   participant NDR as NDR

   UI->>API: PATCH /categories/:id/reposition {new_parent_id, ordered_ids}
   API->>SVC: 校验参数与权限（proofreader 拒绝）
   SVC->>NDR: 调整父节点（move）
   SVC->>NDR: 按 ordered_ids 重排同级（reorder）
   NDR-->>SVC: 成功
   SVC-->>API: 返回新位置
   API-->>UI: 200 OK
 ```

说明（回滚策略摘录）：
- reposition 执行顺序为“先 move 再 reorder”。如果 reorder 失败，不会自动回滚已完成的 move，页面可能表现为“父节点已更改，但顺序未更新”。建议客户端在失败时再次发起 reorder，或刷新后由用户再次拖拽确认。
- bulk copy 在“复制阶段”失败会软删除已创建节点进行回滚；若复制成功但后续“重排阶段”失败，不回滚（节点已创建但顺序可能不符合预期），可通过再次重排或删除处理。
- 其他批量操作（如 bulk move）遵循“尽量原子，失败时保持数据一致，可通过再次操作恢复”的原则，细节见后端 service 实现。

### 回滚策略详解（节选）

1) reposition（`PATCH /categories/:id/reposition`）
- 步骤：判断是否需要变更父节点 → 调用 move → 调用 reorder
- 失败：reorder 失败不回滚 move；返回错误，客户端可提示“位置已变更但顺序未更新”，并提供“重试排序”按钮
- 建议：在拖拽完成后，若返回非 2xx，触发一次刷新节点同级顺序或重试请求

2) bulk copy（`POST /categories/bulk/copy`）
- 复制失败即回滚：删除已创建的节点；错误消息包含已回滚数量
- 重排失败不回滚：返回“已创建 N 个节点但排序未生效”的提示


 ## 文档引用关系：添加/删除/反向查询

 端点：
 - 添加：`POST /api/v1/documents/{id}/references`（payload: `{document_id}`）
 - 删除：`DELETE /api/v1/documents/{id}/references/{refId}`
 - 反向查询：`GET /api/v1/documents/{id}/referencing`

 ```mermaid
 sequenceDiagram
   participant UI as UI
   participant API as Backend API
   participant SVC as Service
   participant NDR as NDR

   UI->>API: POST /documents/:id/references {document_id}
   API->>SVC: proofreader 拒绝写操作
   SVC->>NDR: 更新 Document.metadata.references
   NDR-->>SVC: 返回文档
   SVC-->>API: 文档新状态
   API-->>UI: 200 OK
 
   UI->>API: GET /documents/:id/referencing
   API->>SVC: 查询引用该文档的文档集合
   SVC->>NDR: 检索/聚合
   API-->>UI: 200 OK {referencing_documents}
 ```

 ## 文档版本：历史/对比/回滚

 端点：
 - 历史：`GET /api/v1/documents/{id}/versions`
 - 获取特定版本：`GET /api/v1/documents/{id}/versions/{version_number}`
 - 对比：`GET /api/v1/documents/{id}/versions/{from}/diff?to={to}`
 - 回滚：`POST /api/v1/documents/{id}/versions/{version_number}/restore`

 ```mermaid
 sequenceDiagram
   participant UI as UI
   participant API as Backend API
   participant SVC as Service
   participant NDR as NDR

   UI->>API: GET /documents/:id/versions
   API->>SVC: 查询版本列表
   SVC->>NDR: 透传版本接口
   NDR-->>SVC: 列表
   API-->>UI: 200 OK

   UI->>API: POST /documents/:id/versions/:v/restore
   API->>SVC: 权限校验（proofreader 拒绝）
   SVC->>NDR: 版本回滚
   API-->>UI: 200 OK（返回回滚后的文档）
 ```

 ## 运行方式与调试建议

 - 本地开发：`make dev-backend`、`make dev-frontend`；后端支持 `--watch` 热重载。
 - Docker（验证部署）：见 `docs/DOCKER_DEPLOYMENT.md`；生产部署见 `deploy/production/README.md`。
 - NDR 调试：设置 `YDMS_DEBUG_TRAFFIC=1` 输出对 NDR 的请求/响应。
