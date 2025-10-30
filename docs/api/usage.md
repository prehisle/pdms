 # API 使用指南

 本文提供使用 YDMS 后端 API 的常用示例与最佳实践，涵盖鉴权、分类与文档操作、引用关系与版本管理等。

 ## 准备
 - 默认地址：`http://localhost:9180`
 - 运行服务：根目录执行 `make dev-backend`
 - 查看 OpenAPI 规范：`docs/backend/openapi.json`

 ## 鉴权方式
 任选其一：
 - 使用 JWT（推荐给人机交互/前端）：
   1) 登录获取 token
   ```bash
   curl -s -X POST http://localhost:9180/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"super_admin","password":"admin123456"}'
   # 响应包含 token，如 {"token":"<JWT>"}
   ```
   2) 携带 `Authorization: Bearer <JWT>` 访问业务接口

 - 使用 API Key（推荐给脚本/集成）：
   - 方式 A：`X-API-Key: <api-key>`
   - 方式 B：`Authorization: Bearer <api-key>`
   - 创建与管理见：`docs/guides/api-keys.md`

 说明：后端会自动处理 `x-user-id`、`x-request-id` 等透传，无需手动设置。

 ## 健康检查
 ```bash
 curl http://localhost:9180/api/v1/healthz
 ```

 ## 分类（目录）相关
 
 - 获取整棵目录树
 ```bash
 curl -H "Authorization: Bearer $TOKEN" \
   "http://localhost:9180/api/v1/categories/tree?include_deleted=false"
 ```

 - 创建分类（根/子节点）
 ```bash
 curl -X POST http://localhost:9180/api/v1/categories \
   -H "Authorization: Bearer $TOKEN" \
   -H "Content-Type: application/json" \
   -d '{
     "label": "第一章",
     "parent_id": null
   }'
 ```

 - 重命名分类
 ```bash
 curl -X PATCH http://localhost:9180/api/v1/categories/123 \
   -H "Authorization: Bearer $TOKEN" \
   -H "Content-Type: application/json" \
   -d '{"label":"新的名称"}'
 ```

 - 变更父节点 + 同级重排（拖拽推荐接口）
 ```bash
 curl -X PATCH http://localhost:9180/api/v1/categories/7/reposition \
   -H "Authorization: Bearer $TOKEN" \
   -H "Content-Type: application/json" \
   -d '{
     "new_parent_id": 42,
     "ordered_ids": [7,5,13]
   }'
 ```

 - 仅同级重排
 ```bash
 curl -X POST http://localhost:9180/api/v1/categories/reorder \
   -H "Authorization: Bearer $TOKEN" \
   -H "Content-Type: application/json" \
   -d '{
     "parent_id": 42,
     "ordered_ids": [7,5,13]
   }'
 ```

 - 回收站与恢复/彻底删除
 ```bash
 # 查看回收站
 curl -H "Authorization: Bearer $TOKEN" http://localhost:9180/api/v1/categories/trash

 # 恢复（单个）
 curl -X POST -H "Authorization: Bearer $TOKEN" \
   http://localhost:9180/api/v1/categories/123/restore

 # 彻底删除（单个）
 curl -X DELETE -H "Authorization: Bearer $TOKEN" \
   http://localhost:9180/api/v1/categories/123/purge

 # 批量恢复
 curl -X POST http://localhost:9180/api/v1/categories/bulk/restore \
   -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
   -d '{"ids":[1,2,3]}'

 # 批量删除（软删）
 curl -X POST http://localhost:9180/api/v1/categories/bulk/delete \
   -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
   -d '{"ids":[1,2,3]}'
 ```

 提示：禁止删除仍包含子节点的目录；如遇 409/400，先检查子节点与绑定关系。

 ## 文档相关

 - 创建文档（多类型支持）
 ```bash
 curl -X POST http://localhost:9180/api/v1/documents \
   -H "Authorization: Bearer $TOKEN" \
   -H "Content-Type: application/json" \
   -d '{
     "title": "知识点概览",
     "type": "knowledge_overview_v1",
     "content": { "format": "html", "data": "<h1>...</h1>" },
     "metadata": { "difficulty": 3, "tags": ["重点"] }
   }'
 ```

 - 列表与过滤（支持 metadata.* 查询）
 ```bash
 # 等值（默认）
 curl -H "Authorization: Bearer $TOKEN" \
   "http://localhost:9180/api/v1/documents?metadata.stage=draft&metadata.stage=review"

 # IN
 curl -H "Authorization: Bearer $TOKEN" \
   "http://localhost:9180/api/v1/documents?metadata.stage[in]=draft,final"

 # 模糊匹配（未含 % 自动按 %值%）
 curl -H "Authorization: Bearer $TOKEN" \
   "http://localhost:9180/api/v1/documents?metadata.title[like]=设计"

 # 数值范围
 curl -H "Authorization: Bearer $TOKEN" \
   "http://localhost:9180/api/v1/documents?metadata.score[gte]=60&metadata.score[lte]=90"

 # 数组包含（包含任一值 / 同时包含）
 curl -H "Authorization: Bearer $TOKEN" \
   "http://localhost:9180/api/v1/documents?metadata.tags[any]=alpha&metadata.tags[all]=beta&metadata.tags[all]=gamma"
 ```

 - 获取/更新/删除
 ```bash
 curl -H "Authorization: Bearer $TOKEN" http://localhost:9180/api/v1/documents/888
 curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
   -d '{"title":"新标题"}' http://localhost:9180/api/v1/documents/888
 curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:9180/api/v1/documents/888
 ```

 - 节点与文档绑定
 ```bash
 # 查询节点子树文档
 curl -H "Authorization: Bearer $TOKEN" \
   "http://localhost:9180/api/v1/nodes/42/subtree-documents?page=1&size=50"

 # 绑定/解绑
 curl -X POST -H "Authorization: Bearer $TOKEN" \
   http://localhost:9180/api/v1/nodes/42/bind/888
 curl -X DELETE -H "Authorization: Bearer $TOKEN" \
   http://localhost:9180/api/v1/nodes/42/unbind/888
 ```

 - 文档引用关系
 ```bash
 # 添加引用（doc 100 引用 doc 200）
 curl -X POST http://localhost:9180/api/v1/documents/100/references \
   -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
   -d '{"document_id":200}'

 # 删除引用
 curl -X DELETE -H "Authorization: Bearer $TOKEN" \
   http://localhost:9180/api/v1/documents/100/references/200

 # 查询引用到当前文档的文档（反向）
 curl -H "Authorization: Bearer $TOKEN" \
   http://localhost:9180/api/v1/documents/200/referencing
 ```

 - 文档版本
 ```bash
 # 列表
 curl -H "Authorization: Bearer $TOKEN" \
   http://localhost:9180/api/v1/documents/100/versions

 # 获取特定版本
 curl -H "Authorization: Bearer $TOKEN" \
   http://localhost:9180/api/v1/documents/100/versions/3

 # 版本对比（from=3, to=5）
 curl -H "Authorization: Bearer $TOKEN" \
   "http://localhost:9180/api/v1/documents/100/versions/3/diff?to=5"

 # 回滚到某版本
 curl -X POST -H "Authorization: Bearer $TOKEN" \
   http://localhost:9180/api/v1/documents/100/versions/3/restore
 ```

## 故障排除
- 401/403：检查 JWT 或 API Key、用户角色与课程权限
- 404：检查路由和资源是否存在；注意子路由路径（如 references/、versions/）
- 409/422：检查请求体字段、排序/移动的业务前置条件
- 调试上游 NDR 请求：设置 `YDMS_DEBUG_TRAFFIC=1` 查看透传日志

## 权限与课程授权最小示例

以下示例演示如何：
1) 使用超级管理员创建一个课程根目录；
2) 创建一个课程管理员用户；
3) 给该用户授予该课程的权限；
4) 使用课程管理员身份访问分类树仅看到授权课程。

```bash
# 1) 超级管理员登录，获取 JWT
ADMIN_TOKEN=$(curl -s -X POST http://localhost:9180/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"super_admin","password":"admin123456"}' | jq -r .token)

# 2) 创建课程根目录（注意字段名为 name）
COURSE_JSON=$(curl -s -X POST http://localhost:9180/api/v1/categories \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"测试课程（授权示例）","parent_id": null}')
COURSE_ID=$(echo "$COURSE_JSON" | jq -r .id)

# 3) 创建课程管理员用户
USER_JSON=$(curl -s -X POST http://localhost:9180/api/v1/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"course_admin1","password":"pwd123456","role":"course_admin"}')
USER_ID=$(echo "$USER_JSON" | jq -r .user.id)

# 4) 授予该用户对课程根目录的权限
curl -s -X POST http://localhost:9180/api/v1/users/$USER_ID/courses \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"root_node_id": '$COURSE_ID'}'

# 5) 使用课程管理员登录并查看分类树
CA_TOKEN=$(curl -s -X POST http://localhost:9180/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"course_admin1","password":"pwd123456"}' | jq -r .token)

curl -s -H "Authorization: Bearer $CA_TOKEN" \
  http://localhost:9180/api/v1/categories/tree | jq

# 期望：仅看到刚才授权的根目录及其子节点
```

提示：课程管理员被限制的拖拽操作（如将子节点升到根层级、或把根节点降级为子节点）会被服务端拒绝并返回错误信息。

## 参考
- OpenAPI：`docs/backend/openapi.json`
- 项目总览：`../../README.md`
- 文档索引：`../README.md`
