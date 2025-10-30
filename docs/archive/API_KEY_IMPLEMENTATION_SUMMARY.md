# API Key 认证系统实现总结（已归档）

> 提示：使用与操作层面的最新指南请见 `../guides/api-keys.md`。本文聚焦实现与架构细节，供技术回溯使用。

**实现日期**: 2025-10-30
**需求来源**: 支持外部程序通过 API 获得课程管理员级别的管理能力，用于批量操作

## 一、功能概述

实现了完整的 API Key 认证系统，允许外部程序使用长期有效的密钥访问 YDMS API，实现批量管理课程、文档等资源。

### 核心特性

1. **长期有效的密钥**
   - 支持永不过期或设置过期时间
   - 格式：`ydms_<environment>_<random-base64>`
   - SHA256 哈希存储，完整密钥仅创建时返回一次

2. **权限继承机制**
   - API Key 关联到用户账号
   - 自动继承用户的角色（super_admin/course_admin/proofreader）
   - 自动继承用户的课程权限（course_permissions）

3. **灵活的认证方式**
   - 支持 `X-API-Key: <api-key>` 头
   - 支持 `Authorization: Bearer <api-key>` 头
   - 与现有 JWT 认证无缝共存

4. **完整的生命周期管理**
   - 创建、查询、更新、撤销（软删除）
   - 永久删除（仅超级管理员）
   - 使用统计（最后使用时间）
   - 统计信息（活跃/过期/撤销数量）

## 二、新增文件

### 后端代码

| 文件路径 | 说明 | 行数 |
|---------|------|-----|
| `internal/auth/apikey.go` | API Key 生成、验证、认证中间件 | ~213 |
| `internal/auth/apikey_test.go` | API Key 认证逻辑单元测试 | ~100 |
| `internal/service/apikey.go` | API Key 业务逻辑层（CRUD） | ~200 |
| `internal/api/apikey_handler.go` | API Key HTTP 处理器 | ~200 |
| `test_apikey.sh` | 完整功能测试脚本 | ~150 |

### 文档

| 文件路径 | 说明 |
|---------|------|
| `docs/API_KEY_GUIDE.md` | API Key 使用指南（含 Python 示例） |
| `docs/API_KEY_IMPLEMENTATION_SUMMARY.md` | 本文档 |

## 三、修改的文件

### 1. 数据库模型 (`internal/database/models.go`)

新增 `APIKey` 结构体：

```go
type APIKey struct {
    ID          uint
    Name        string         // 描述性名称
    KeyHash     string         // SHA256 哈希（uniqueIndex）
    KeyPrefix   string         // 前缀（便于识别）
    UserID      uint           // 关联用户
    User        User
    Scopes      string         // 权限范围（JSON）
    ExpiresAt   *time.Time     // 过期时间
    LastUsedAt  *time.Time     // 最后使用时间
    CreatedByID uint           // 创建者
    CreatedBy   *User
    DeletedAt   gorm.DeletedAt // 软删除
}
```

### 2. 数据库初始化 (`internal/database/db.go`)

**关键修复**：解决了 User ↔ APIKey 循环引用导致的外键约束问题

```go
// 禁用自动外键创建
&gorm.Config{
    DisableForeignKeyConstraintWhenMigrating: true,
}

// 迁移后手动创建外键约束
db.Exec("ALTER TABLE api_keys ADD CONSTRAINT fk_api_keys_user ...")
db.Exec("ALTER TABLE api_keys ADD CONSTRAINT fk_api_keys_created_by ...")
```

### 3. 路由配置 (`internal/api/router.go`)

实现灵活认证中间件：

```go
func authMiddlewareWrapper(jwtSecret string, db *gorm.DB) func(http.Handler) http.Handler {
    if db != nil {
        return auth.FlexibleAuthMiddleware(db, jwtSecret)
    }
    return auth.AuthMiddleware(jwtSecret)
}
```

业务 API 端点全部支持 JWT + API Key 双模式认证。

### 4. 服务器入口 (`cmd/server/main.go`)

- 初始化 API Key 服务
- 创建 API Key 处理器
- 将数据库连接传递给路由配置

## 四、架构设计

### 1. 认证流程

```
HTTP 请求
  ↓
FlexibleAuthMiddleware
  ↓
检测 Header 中的认证信息
  ├─ X-API-Key 或 Authorization: Bearer ydms_*
  │   ↓
  │  ValidateAPIKey(db, apiKey)
  │   ├─ SHA256 哈希匹配
  │   ├─ 检查 DeletedAt（撤销状态）
  │   ├─ 检查 ExpiresAt（过期时间）
  │   └─ 加载关联 User（角色、权限）
  │   ↓
  │  返回 User 对象
  │
  └─ Authorization: Bearer <jwt-token>
      ↓
     ValidateToken(jwtSecret)
      ↓
     返回 User 对象
  ↓
Context 注入 UserContextKey
  ↓
业务逻辑层使用统一的用户对象
```

### 2. 数据库设计

**关系模型**：

```
users (1) ─────┐
               ├──< (N) api_keys
users (1) ─────┘
(created_by)

users (1) ───< (N) course_permissions
```

**索引策略**：
- `key_hash`: UNIQUE INDEX（快速验证）
- `key_prefix`: INDEX（便于查询和展示）
- `user_id`: INDEX（按用户过滤）
- `deleted_at`: INDEX（软删除查询）

### 3. 安全设计

| 措施 | 实现 |
|------|------|
| **密钥保护** | SHA256 哈希存储，数据库不存明文 |
| **一次性展示** | 完整密钥仅创建时返回，后续只显示前缀 |
| **即时撤销** | 软删除后立即失效（验证时检查 DeletedAt） |
| **过期检查** | 每次验证检查 ExpiresAt 时间戳 |
| **用户关联** | 继承用户权限，用户删除时密钥失效 |
| **审计日志** | 记录最后使用时间（last_used_at） |

## 五、API 端点

### 管理端点（需要 JWT 认证）

| 方法 | 路径 | 权限要求 | 说明 |
|------|------|---------|------|
| POST | `/api/v1/api-keys` | super_admin | 创建 API Key |
| GET | `/api/v1/api-keys` | 认证用户 | 列出 API Keys |
| GET | `/api/v1/api-keys/:id` | 认证用户 | 获取详情 |
| PATCH | `/api/v1/api-keys/:id` | 认证用户 | 更新信息 |
| POST | `/api/v1/api-keys/:id/revoke` | 认证用户 | 撤销（软删除） |
| DELETE | `/api/v1/api-keys/:id` | super_admin | 永久删除 |
| GET | `/api/v1/api-keys/stats` | 认证用户 | 统计信息 |

### 业务端点（支持 API Key 认证）

所有现有业务 API 均支持 API Key 认证：
- `/api/v1/categories/*`
- `/api/v1/documents/*`
- `/api/v1/nodes/*`
- `/api/v1/users/*`（根据角色权限）

## 六、测试验证

### 自动化测试

执行 `./test_apikey.sh`，验证以下场景：

1. ✅ 使用 JWT 登录获取 token
2. ✅ 创建 API Key（返回完整密钥）
3. ✅ 使用 `X-API-Key` 头认证
4. ✅ 使用 `Authorization: Bearer` 头认证
5. ✅ 列出 API Keys（仅显示前缀）
6. ✅ 获取 API Key 详情
7. ✅ 更新 API Key 名称
8. ✅ 查看统计信息
9. ✅ 使用 API Key 访问业务 API（创建分类）
10. ✅ 撤销 API Key
11. ✅ 验证撤销后无法使用
12. ✅ 最终统计数据正确

**测试结果**: 所有测试通过 ✅

### 单元测试

```bash
cd backend
go test ./internal/auth -run TestAPIKey -v
```

## 七、使用示例

### 1. 创建 API Key

```bash
# 登录获取 JWT
TOKEN=$(curl -s -X POST http://localhost:9180/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"super_admin","password":"admin123456"}' \
  | jq -r '.token')

# 创建 API Key（关联到 user_id=2）
API_KEY=$(curl -s -X POST http://localhost:9180/api/v1/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "批量导入工具",
    "user_id": 2,
    "environment": "prod"
  }' | jq -r '.api_key')

echo "请保存此密钥: $API_KEY"
```

### 2. 使用 API Key 访问 API

```bash
# 方式 1: X-API-Key 头
curl -H "X-API-Key: $API_KEY" \
  http://localhost:9180/api/v1/categories

# 方式 2: Authorization Bearer
curl -H "Authorization: Bearer $API_KEY" \
  http://localhost:9180/api/v1/categories
```

### 3. Python 批量操作示例

详见 `docs/API_KEY_GUIDE.md` 中的完整代码示例。

## 八、关键技术决策

### 1. 为什么选择 SHA256 而非 Bcrypt？

| 对比项 | SHA256 | Bcrypt |
|--------|--------|--------|
| **速度** | 极快（<1ms） | 较慢（50-100ms） |
| **安全性** | 足够（API Key 32字节随机） | 更高（密码哈希标准） |
| **用例** | API Key（高熵随机） | 用户密码（低熵） |

**结论**: API Key 本身是高熵随机字符串，SHA256 速度快且安全性足够。

### 2. 为什么软删除？

- 保留审计记录
- 支持统计历史数据
- 防止误删除后无法追溯

### 3. 为什么与用户强关联？

- 复用现有 RBAC 体系
- 简化权限管理逻辑
- 支持按用户撤销所有密钥

## 九、后续改进建议

### 短期（可选）

1. **前端界面**: 在用户管理页面添加 API Key 管理 UI
2. **通知机制**: API Key 即将过期时发送提醒
3. **审计日志**: 记录 API Key 的使用详情（IP、端点等）

### 长期（可选）

1. **细粒度权限**: 支持 API Key 级别的 scopes（如只读权限）
2. **IP 白名单**: 限制 API Key 只能从特定 IP 访问
3. **速率限制**: 为 API Key 添加请求频率限制
4. **Webhook**: 异常使用时触发告警

## 十、部署检查清单

### 生产环境部署前

- [ ] 确保 `YDMS_JWT_SECRET` 已配置且足够复杂
- [ ] 数据库已执行迁移（自动通过 `db.AutoMigrate`）
- [ ] 测试脚本在生产环境运行通过
- [ ] API Key 创建权限仅授予可信管理员
- [ ] 监控 API Key 使用情况

### 已解决的问题

- [x] 数据库外键循环引用问题（通过手动创建约束）
- [x] 业务 API 未集成 API Key 认证（更新中间件）
- [x] 测试脚本使用公开端点验证撤销（改用认证端点）
- [x] 临时文件清理（`fix_migration.sql`、`server.pid`）
- [x] `.gitignore` 添加 `*.pid` 规则

## 十一、文件清单

### 需要提交的新文件

```bash
git add internal/auth/apikey.go
git add internal/auth/apikey_test.go
git add internal/service/apikey.go
git add internal/api/apikey_handler.go
git add docs/API_KEY_GUIDE.md
git add docs/API_KEY_IMPLEMENTATION_SUMMARY.md
git add test_apikey.sh
```

### 修改的文件

```bash
git add internal/database/models.go
git add internal/database/db.go
git add internal/api/router.go
git add cmd/server/main.go
git add go.mod go.sum
git add .gitignore
git add CLAUDE.md
```

### 已删除的临时文件

- `fix_migration.sql` - 数据库调试脚本（已修复代码，不再需要）
- `server.pid` - 运行时 PID 文件（已加入 .gitignore）

## 十二、总结

✅ **功能完整**: 实现了从创建到撤销的完整生命周期管理
✅ **安全可靠**: SHA256 哈希、软删除、过期检查、权限继承
✅ **易于集成**: 双模式认证、无缝兼容现有 JWT 系统
✅ **测试充分**: 自动化测试脚本验证所有关键场景
✅ **文档完善**: 使用指南 + 实现总结 + 代码注释

API Key 系统现已完全可用，可支持外部程序批量管理课程！
