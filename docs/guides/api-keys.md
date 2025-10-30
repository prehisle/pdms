 # API Keys 指南（权威版）

 本文整合并取代分散的多篇 API Key 文档，覆盖概念、创建与管理、后端/前端使用、安全与排错。历史文档作为附录保留：`docs/API_KEY_GUIDE.md`、`docs/API_KEY_FRONTEND_GUIDE.md`、`docs/API_KEY_COMPLETE_GUIDE.md`、`docs/API_KEY_IMPLEMENTATION_SUMMARY.md`。

 ## 核心概念
 - 目的：为脚本与第三方集成提供长期凭证，绕过前端登录流程。
 - 继承：API Key 关联到某个用户，自动继承其角色与课程权限。
 - 认证：两种等价方式（选其一）
   - `X-API-Key: <api-key>`
   - `Authorization: Bearer <api-key>`
 - 格式：`ydms_<environment>_<random-base64>`（仅创建时返回完整密钥，数据库仅存哈希与前缀）。

 ## 角色与权限
 - 创建/撤销/删除 API Key：仅 `super_admin`
 - 使用 API Key 访问业务接口：继承关联用户的权限（如 `course_admin` 仅可管理授权课程）。

 ## 创建与管理
 - 前端 UI（推荐人工操作）：
   - 登录 → 头像菜单 → API Key 管理 → 创建 → 复制完整密钥（仅显示一次）
   - 统计卡片、列表、编辑名称、撤销（软删）、永久删除
 - 后端 API（推荐自动化/CI）：
   - 登录获取 JWT：`POST /api/v1/auth/login`
   - 创建：`POST /api/v1/api-keys`（仅超管），请求体含 `name`、`user_id`、`environment`、`expires_at?`
   - 列表/详情/更新/撤销/删除/统计：参考 OpenAPI 与示例命令

 示例（创建）：
 ```bash
 TOKEN=$(curl -s -X POST http://localhost:9180/api/v1/auth/login \
   -H "Content-Type: application/json" \
   -d '{"username":"super_admin","password":"admin123456"}' | jq -r .token)

 curl -X POST http://localhost:9180/api/v1/api-keys \
   -H "Authorization: Bearer $TOKEN" \
   -H "Content-Type: application/json" \
   -d '{"name":"批量导入工具","user_id":2,"environment":"prod"}'
 ```

 ## 在业务 API 中使用
 ```bash
 API_KEY=ydms_prod_xxx
 # 方式一
 curl -H "X-API-Key: $API_KEY" http://localhost:9180/api/v1/categories/tree
 # 方式二
 curl -H "Authorization: Bearer $API_KEY" http://localhost:9180/api/v1/categories/tree
 ```

 更多 cURL 示例（分类/文档/引用/版本）：见 `docs/api/usage.md`。

 ## 安全与运维
 - 保存：完整密钥仅显示一次；存入安全的密钥库或环境变量，切勿提交到 Git。
 - 轮换：为长期使用的密钥设置过期时间；到期前创建新密钥、更新程序配置、撤销旧密钥。
 - 最小权限：为不同用途创建不同密钥；尽量使用 `course_admin` + 最小课程授权，而非超管。
 - 监控：关注“最后使用时间”；异常使用立即撤销，必要时排查日志并通知相关方。

 ## 故障排除
 - 401/Unauthorized：密钥格式错误、已撤销、已过期、关联用户已删除。
 - 403/Forbidden：关联用户角色或课程权限不足。
 - 404：端点/资源不存在，或路径/参数拼写错误。

 ## 相关参考
 - API 使用指南：`../api/usage.md`
 - OpenAPI：`../backend/openapi.json`
 - 历史文档：`../API_KEY_GUIDE.md`、`../API_KEY_FRONTEND_GUIDE.md`、`../API_KEY_COMPLETE_GUIDE.md`、`../API_KEY_IMPLEMENTATION_SUMMARY.md`

