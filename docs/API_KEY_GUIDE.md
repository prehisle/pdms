# API Key 认证系统使用指南

本文档介绍如何使用 YDMS 的 API Key 认证系统，以便外部程序能够批量管理课程。

## 概述

API Key 系统提供了一种安全的方式让外部程序访问 YDMS API，具有以下特点：

- **长期有效**：API Key 可以设置长期有效或永不过期
- **权限继承**：API Key 关联到用户账号，自动继承该用户的所有权限
- **易于管理**：可以随时创建、查看、撤销 API Key
- **安全存储**：API Key 以哈希形式存储，确保安全

## API Key 格式

```
ydms_<environment>_<random-string>
```

示例：
```
ydms_prod_abc123defghijk456lmnopqrstuv789wxyz
```

## 认证方式

API Key 支持两种认证方式：

### 方式 1：使用 Authorization Header（推荐）

```bash
curl -H "Authorization: Bearer ydms_prod_xxx..." \
  http://localhost:9180/api/v1/categories
```

### 方式 2：使用 X-API-Key Header

```bash
curl -H "X-API-Key: ydms_prod_xxx..." \
  http://localhost:9180/api/v1/categories
```

## 管理 API Key

### 1. 创建 API Key

**端点**: `POST /api/v1/api-keys`

**权限**: 仅超级管理员可以创建 API Key

**请求体**:
```json
{
  "name": "外部批量管理程序",
  "user_id": 2,
  "environment": "prod",
  "expires_at": "2025-12-31T23:59:59Z",
  "scopes": ["read", "write"]
}
```

**参数说明**:
- `name` (必填): API Key 的描述名称
- `user_id` (必填): 关联的用户 ID（必须是 super_admin 或 course_admin）
- `environment` (可选): 环境标识（prod/dev/test），默认为 prod
- `expires_at` (可选): 过期时间，不填则永不过期
- `scopes` (可选): 权限范围，暂未实现细粒度权限控制

**响应**:
```json
{
  "api_key": "ydms_prod_abc123...",
  "key_prefix": "ydms_prod_abc1...",
  "key_info": {
    "id": 1,
    "name": "外部批量管理程序",
    "key_prefix": "ydms_prod_abc1...",
    "user_id": 2,
    "user": {
      "id": 2,
      "username": "course_admin1",
      "role": "course_admin",
      "display_name": "课程管理员"
    },
    "expires_at": "2025-12-31T23:59:59Z",
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

**重要提示**: `api_key` 完整密钥仅在创建时返回一次，请妥善保存！

**示例**:
```bash
# 使用超级管理员 JWT token 创建 API Key
TOKEN="eyJhbGciOiJIUzI1NiIs..."

curl -X POST http://localhost:9180/api/v1/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "批量导入工具",
    "user_id": 2,
    "environment": "prod"
  }'
```

### 2. 列出 API Keys

**端点**: `GET /api/v1/api-keys`

**查询参数**:
- `user_id`: 按用户 ID 过滤（仅超级管理员可用）
- `include_deleted`: 是否包含已撤销的 API Key（true/false）

**示例**:
```bash
# 列出所有 API Keys
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:9180/api/v1/api-keys

# 列出特定用户的 API Keys
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9180/api/v1/api-keys?user_id=2"

# 包含已撤销的 API Keys
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:9180/api/v1/api-keys?include_deleted=true"
```

### 3. 获取 API Key 详情

**端点**: `GET /api/v1/api-keys/{id}`

**示例**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:9180/api/v1/api-keys/1
```

### 4. 更新 API Key

**端点**: `PATCH /api/v1/api-keys/{id}`

**可更新字段**:
- `name`: 名称
- `expires_at`: 过期时间
- `scopes`: 权限范围

**示例**:
```bash
curl -X PATCH http://localhost:9180/api/v1/api-keys/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "更新后的名称",
    "expires_at": "2026-12-31T23:59:59Z"
  }'
```

### 5. 撤销 API Key（软删除）

**端点**: `POST /api/v1/api-keys/{id}/revoke`

**示例**:
```bash
curl -X POST http://localhost:9180/api/v1/api-keys/1/revoke \
  -H "Authorization: Bearer $TOKEN"
```

### 6. 永久删除 API Key

**端点**: `DELETE /api/v1/api-keys/{id}`

**权限**: 仅超级管理员可以永久删除

**示例**:
```bash
curl -X DELETE http://localhost:9180/api/v1/api-keys/1 \
  -H "Authorization: Bearer $TOKEN"
```

### 7. 获取 API Key 统计

**端点**: `GET /api/v1/api-keys/stats`

**查询参数**:
- `user_id`: 按用户 ID 过滤（仅超级管理员可用）

**响应**:
```json
{
  "total": 10,
  "active": 8,
  "expired": 1,
  "revoked": 1
}
```

**示例**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:9180/api/v1/api-keys/stats
```

## 使用 API Key 进行批量操作

### 示例 1: 批量创建分类节点

```bash
API_KEY="ydms_prod_abc123..."

# 创建根节点
curl -X POST http://localhost:9180/api/v1/categories \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "新课程",
    "parent_id": null
  }'

# 创建子节点
curl -X POST http://localhost:9180/api/v1/categories \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "第一章",
    "parent_id": 123
  }'
```

### 示例 2: 批量创建文档

```bash
API_KEY="ydms_prod_abc123..."

curl -X POST http://localhost:9180/api/v1/documents \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "知识点概览",
    "type": "knowledge_overview_v1",
    "content": {
      "format": "html",
      "data": "<h1>知识点内容</h1>"
    },
    "metadata": {
      "difficulty": 3,
      "tags": ["重点"]
    }
  }'
```

### 示例 3: Python 批量导入脚本

```python
import requests
import json

class YDMSClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }

    def create_category(self, label, parent_id=None):
        """创建分类节点"""
        data = {
            "label": label,
            "parent_id": parent_id
        }
        response = requests.post(
            f"{self.base_url}/api/v1/categories",
            headers=self.headers,
            json=data
        )
        response.raise_for_status()
        return response.json()

    def create_document(self, title, doc_type, content, metadata=None):
        """创建文档"""
        data = {
            "title": title,
            "type": doc_type,
            "content": content,
            "metadata": metadata or {}
        }
        response = requests.post(
            f"{self.base_url}/api/v1/documents",
            headers=self.headers,
            json=data
        )
        response.raise_for_status()
        return response.json()

    def link_document_to_category(self, category_id, document_id):
        """关联文档到分类"""
        data = {"document_id": document_id}
        response = requests.post(
            f"{self.base_url}/api/v1/categories/{category_id}/documents",
            headers=self.headers,
            json=data
        )
        response.raise_for_status()
        return response.json()

# 使用示例
if __name__ == "__main__":
    client = YDMSClient(
        base_url="http://localhost:9180",
        api_key="ydms_prod_abc123..."
    )

    # 批量创建课程结构
    course = client.create_category("Python 基础课程")
    chapter1 = client.create_category("第一章：入门", course["node_id"])
    chapter2 = client.create_category("第二章：进阶", course["node_id"])

    # 创建文档
    doc = client.create_document(
        title="Python 环境安装",
        doc_type="markdown_v1",
        content={
            "format": "markdown",
            "data": "# Python 环境安装\\n\\n..."
        },
        metadata={"difficulty": 1}
    )

    # 关联文档到章节
    client.link_document_to_category(chapter1["node_id"], doc["document_id"])

    print("批量导入完成！")
```

## 安全最佳实践

1. **密钥管理**
   - 将 API Key 存储在环境变量中，不要硬编码在代码里
   - 不要将 API Key 提交到版本控制系统
   - 定期轮换 API Key

2. **权限控制**
   - 为不同的用途创建不同的 API Key
   - 为 API Key 设置合理的过期时间
   - 不再使用的 API Key 应及时撤销

3. **日志监控**
   - 监控 API Key 的使用情况（`last_used_at` 字段）
   - 发现异常使用立即撤销

4. **网络安全**
   - 生产环境务必使用 HTTPS
   - 限制 API 访问的 IP 地址范围（通过防火墙或网关）

## 故障排查

### API Key 认证失败

**错误**: `401 Unauthorized - invalid API key`

**可能原因**:
1. API Key 格式错误
2. API Key 已被撤销
3. API Key 已过期
4. 关联的用户已被删除

**解决方法**:
```bash
# 检查 API Key 详情
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:9180/api/v1/api-keys/stats

# 创建新的 API Key
curl -X POST http://localhost:9180/api/v1/api-keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "新密钥", "user_id": 2}'
```

### 权限不足

**错误**: `403 Forbidden`

**可能原因**:
1. API Key 关联的用户角色不是管理员
2. 课程管理员尝试访问未授权的课程

**解决方法**:
- 检查用户角色：`GET /api/v1/users/{user_id}`
- 检查课程权限：`GET /api/v1/users/{user_id}/courses`

## 附录：完整的 API 端点列表

所有需要认证的端点都支持 API Key 认证：

### 分类管理
- `GET /api/v1/categories` - 获取分类树
- `POST /api/v1/categories` - 创建分类
- `PATCH /api/v1/categories/{id}` - 更新分类
- `DELETE /api/v1/categories/{id}` - 删除分类
- `POST /api/v1/categories/{id}/reposition` - 移动和重排分类
- `POST /api/v1/categories/bulk/restore` - 批量恢复
- `DELETE /api/v1/categories/bulk/delete` - 批量删除

### 文档管理
- `GET /api/v1/documents` - 获取文档列表
- `POST /api/v1/documents` - 创建文档
- `GET /api/v1/documents/{id}` - 获取文档详情
- `PATCH /api/v1/documents/{id}` - 更新文档
- `DELETE /api/v1/documents/{id}` - 删除文档
- `GET /api/v1/documents/{id}/history` - 获取文档历史
- `POST /api/v1/documents/{id}/restore` - 恢复到历史版本

### 节点管理
- `GET /api/v1/nodes/{id}` - 获取节点详情
- `GET /api/v1/nodes/{id}/documents` - 获取节点的文档
- `POST /api/v1/nodes/{id}/documents` - 关联文档到节点
- `DELETE /api/v1/nodes/{nodeId}/documents/{docId}` - 取消关联

## 总结

API Key 认证系统为外部程序提供了强大且灵活的批量管理能力。通过合理使用 API Key，你可以：

1. 实现自动化的课程导入工具
2. 批量更新课程内容
3. 与其他系统集成
4. 构建自定义的管理界面

如有问题，请查看系统日志或联系管理员。
