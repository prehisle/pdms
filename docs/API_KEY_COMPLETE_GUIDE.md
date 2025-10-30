# API Key 认证系统 - 完整指南

本文档是 YDMS API Key 认证系统的完整使用指南，涵盖后端 API、前端 UI 和批量管理场景。

## 📋 目录

1. [功能概述](#功能概述)
2. [快速开始](#快速开始)
3. [前端 UI 使用](#前端-ui-使用)
4. [命令行使用](#命令行使用)
5. [Python 批量管理](#python-批量管理)
6. [安全最佳实践](#安全最佳实践)
7. [常见问题](#常见问题)

## 功能概述

API Key 认证系统允许外部程序通过长期有效的密钥访问 YDMS API，实现批量管理课程、文档等资源。

### 核心特性

- ✅ **长期有效**：支持永不过期或自定义过期时间
- ✅ **权限继承**：API Key 关联用户账号，自动继承角色和权限
- ✅ **双模式认证**：支持 `X-API-Key` 和 `Authorization: Bearer` 两种方式
- ✅ **安全存储**：SHA256 哈希存储，完整密钥仅创建时返回一次
- ✅ **完整管理**：创建、查询、更新、撤销、删除全生命周期
- ✅ **Web 界面**：超级管理员可通过前端 UI 图形化管理
- ✅ **统计监控**：实时统计活跃、过期、已撤销数量

### API Key 格式

```
ydms_<environment>_<random-base64-string>

示例：
ydms_prod_3WHJgIO9lYXWECPkQbQXd9FkNRpsAYSPyPriPyhlsPw
```

## 快速开始

### 方式一：使用前端 UI（推荐）

**适用场景**：手动创建少量 API Key

1. 以超级管理员身份登录 YDMS
2. 点击右上角用户头像 → 选择 "API Key 管理"
3. 点击 "创建 API Key" 按钮
4. 填写表单并创建
5. **立即复制**显示的完整 API Key（仅此一次机会）

详见：[API Key 前端使用指南](./API_KEY_FRONTEND_GUIDE.md)

### 方式二：使用命令行

**适用场景**：脚本自动化、CI/CD 集成

```bash
# 1. 登录获取 JWT token
TOKEN=$(curl -s -X POST http://localhost:9180/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"super_admin","password":"admin123456"}' \
  | jq -r '.token')

# 2. 创建 API Key
API_KEY=$(curl -s -X POST http://localhost:9180/api/v1/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "批量导入工具",
    "user_id": 2,
    "environment": "prod"
  }' | jq -r '.api_key')

echo "API Key: $API_KEY"
# 保存此密钥！
```

详见：[API Key 使用指南（命令行）](./API_KEY_GUIDE.md)

## 前端 UI 使用

### 访问入口

**权限要求**：仅超级管理员（super_admin）

**打开方式**：
1. 登录系统
2. 点击右上角用户头像
3. 选择 "API Key 管理"

### 主要界面

#### 1. 统计卡片

显示 API Key 的统计信息：
- **总计**：所有 API Keys 数量
- **活跃**：可正常使用的数量
- **已过期**：超过过期时间的数量
- **已撤销**：被软删除的数量

#### 2. API Key 列表

| 列名 | 说明 |
|------|------|
| 名称 | 描述性名称 |
| 密钥前缀 | `ydms_prod_abc123...` |
| 状态 | 活跃（绿）/ 已过期（红）/ 已撤销（灰） |
| 关联用户 | 用户名和角色 |
| 过期时间 | 相对时间显示 |
| 最后使用 | 相对时间显示 |
| 创建时间 | 相对时间显示 |
| 操作 | 编辑、撤销、删除 |

#### 3. 创建 API Key

**重要提示**：完整密钥仅创建时显示一次！

**表单字段**：
- **名称**（必填）：描述性名称，如 "批量导入工具"
- **关联用户**（必填）：选择用户，API Key 继承其权限
- **环境**（必填）：dev / test / prod
- **过期时间**（可选）：留空表示永不过期

**操作流程**：
1. 填写表单
2. 点击 "创建"
3. 弹窗显示完整 API Key
4. **立即复制并保存**
5. 关闭窗口后无法再次查看

#### 4. 管理操作

- **编辑**：修改 API Key 名称
- **撤销**：软删除，立即失效，保留记录
- **删除**：永久删除（仅超级管理员）
- **刷新**：重新加载最新数据

详见：[API Key 前端使用指南](./API_KEY_FRONTEND_GUIDE.md)

## 命令行使用

### 管理操作

#### 列出所有 API Keys

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:9180/api/v1/api-keys
```

#### 获取统计信息

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:9180/api/v1/api-keys/stats
```

#### 更新 API Key 名称

```bash
curl -X PATCH http://localhost:9180/api/v1/api-keys/3 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "新的名称"}'
```

#### 撤销 API Key

```bash
curl -X POST http://localhost:9180/api/v1/api-keys/3/revoke \
  -H "Authorization: Bearer $TOKEN"
```

#### 永久删除 API Key

```bash
curl -X DELETE http://localhost:9180/api/v1/api-keys/3 \
  -H "Authorization: Bearer $TOKEN"
```

### 使用 API Key 访问业务 API

#### 方式 1：X-API-Key 头

```bash
curl -H "X-API-Key: $API_KEY" \
  http://localhost:9180/api/v1/categories
```

#### 方式 2：Authorization Bearer

```bash
curl -H "Authorization: Bearer $API_KEY" \
  http://localhost:9180/api/v1/categories
```

两种方式功能完全相同，选择其一即可。

## Python 批量管理

### 安装依赖

```bash
pip install requests
```

### 完整示例：批量创建课程结构

```python
import requests
import json

# 配置
BASE_URL = "http://localhost:9180"
API_KEY = "ydms_prod_your_api_key_here"

# 请求头
headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

class YDMSClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }

    def create_category(self, name, parent_id=None):
        """创建分类目录"""
        url = f"{self.base_url}/api/v1/categories"
        data = {"label": name}
        if parent_id:
            data["parent_id"] = parent_id

        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        return response.json()

    def create_document(self, title, doc_type, content, node_id, metadata=None):
        """创建文档"""
        url = f"{self.base_url}/api/v1/documents"
        data = {
            "title": title,
            "type": doc_type,
            "content": content,
            "node_id": node_id
        }
        if metadata:
            data["metadata"] = metadata

        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        return response.json()

# 初始化客户端
client = YDMSClient(BASE_URL, API_KEY)

# 批量创建课程结构
try:
    # 1. 创建根目录
    course = client.create_category("2024春季学期 - 高等数学")
    course_id = course["node_id"]
    print(f"✓ 创建课程: {course['label']} (ID: {course_id})")

    # 2. 创建章节
    chapters = [
        "第一章 函数与极限",
        "第二章 导数与微分",
        "第三章 积分"
    ]

    chapter_ids = []
    for chapter_name in chapters:
        chapter = client.create_category(chapter_name, parent_id=course_id)
        chapter_ids.append(chapter["node_id"])
        print(f"  ✓ 创建章节: {chapter['label']} (ID: {chapter['node_id']})")

    # 3. 为第一章创建文档
    documents = [
        {
            "title": "函数的定义",
            "type": "markdown_v1",
            "content": {
                "format": "markdown",
                "data": "# 函数的定义\n\n函数是数学中的基本概念..."
            }
        },
        {
            "title": "极限的性质",
            "type": "markdown_v1",
            "content": {
                "format": "markdown",
                "data": "# 极限的性质\n\n极限具有以下性质..."
            }
        }
    ]

    for doc_data in documents:
        doc = client.create_document(
            title=doc_data["title"],
            doc_type=doc_data["type"],
            content=doc_data["content"],
            node_id=chapter_ids[0]
        )
        print(f"    ✓ 创建文档: {doc['title']} (ID: {doc['id']})")

    print("\n✅ 批量创建完成！")

except requests.exceptions.HTTPError as e:
    print(f"❌ 请求失败: {e.response.status_code}")
    print(f"   错误详情: {e.response.text}")
except Exception as e:
    print(f"❌ 发生错误: {str(e)}")
```

### 错误处理

```python
import requests

def safe_api_call(func):
    """API 调用装饰器，统一错误处理"""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                print("❌ 认证失败：API Key 无效或已过期")
            elif e.response.status_code == 403:
                print("❌ 权限不足：当前 API Key 没有此操作权限")
            elif e.response.status_code == 404:
                print("❌ 资源不存在")
            else:
                print(f"❌ 请求失败: {e.response.status_code}")
                print(f"   详情: {e.response.text}")
            return None
        except Exception as e:
            print(f"❌ 发生错误: {str(e)}")
            return None
    return wrapper

@safe_api_call
def create_category_safe(client, name, parent_id=None):
    return client.create_category(name, parent_id)
```

详见：[API Key 使用指南（Python）](./API_KEY_GUIDE.md#python-批量管理示例)

## 安全最佳实践

### 1. 密钥管理

✅ **推荐做法**：
- 创建后立即复制并保存到安全的地方（密码管理器）
- 使用环境变量存储，不要硬编码在代码中
- 不同环境使用不同的 API Key（dev/test/prod）
- 定期轮换 API Key

❌ **避免做法**：
- 将 API Key 提交到 Git 仓库
- 在日志中输出完整 API Key
- 通过 URL 参数传递 API Key
- 在客户端 JavaScript 中暴露 API Key

### 2. 权限控制

✅ **推荐做法**：
- 遵循最小权限原则
- 为不同用途创建不同的 API Key
- 为 API Key 关联最低权限的用户账号
- 为长期使用的 API Key 设置过期时间

❌ **避免做法**：
- 为临时测试创建超级管理员级别的 API Key
- 共享 API Key 给多个程序使用
- 创建永不过期的高权限 API Key

### 3. 监控和审计

✅ **推荐做法**：
- 定期查看 API Key 列表和统计信息
- 检查 "最后使用" 时间，发现异常立即撤销
- 撤销不再使用的 API Key
- 记录 API Key 的创建和使用情况

### 4. 应急响应

**如果 API Key 泄露**：
1. 立即在前端 UI 或通过 API 撤销该 API Key
2. 检查 "最后使用" 时间，判断是否被滥用
3. 创建新的 API Key 替换
4. 审查相关日志，排查安全隐患
5. 通知相关人员

## 常见问题

### Q1: API Key 丢失了怎么办？

**A**: 无法找回。API Key 以哈希形式存储，系统无法还原完整密钥。只能：
1. 撤销丢失的 API Key
2. 创建新的 API Key
3. 更新程序配置使用新密钥

### Q2: 如何为 API Key 设置特定权限？

**A**: API Key 继承关联用户的权限。步骤：
1. 创建一个具有目标权限的用户账号
2. 授予该用户相应的课程权限
3. 创建 API Key 时关联到该用户

### Q3: API Key 和 JWT Token 有什么区别？

**A**:
| 特性 | API Key | JWT Token |
|------|---------|-----------|
| 有效期 | 长期（可自定义） | 短期（通常几小时） |
| 用途 | 外部程序、批量操作 | 用户登录、前端交互 |
| 获取方式 | 管理员创建 | 用户登录获得 |
| 存储方式 | 环境变量、配置文件 | 浏览器内存 |

### Q4: 可以为一个用户创建多个 API Key 吗？

**A**: 可以。建议为不同用途创建不同的 API Key，方便管理和撤销。

### Q5: 撤销的 API Key 可以恢复吗？

**A**: 不可以。撤销后无法恢复使用，只能创建新的 API Key。

### Q6: 如何批量撤销 API Key？

**A**:
- 前端：目前不支持批量操作，需逐个撤销
- 命令行：可以编写脚本批量调用撤销 API

### Q7: API Key 会计入请求频率限制吗？

**A**: 当前版本未实现频率限制。未来版本可能添加。

### Q8: 如何查看 API Key 的使用日志？

**A**: 当前版本仅记录 "最后使用时间"。详细审计日志需要查看后端服务日志。

### Q9: 前端创建 API Key 失败怎么办？

**A**: 检查：
1. 是否以超级管理员身份登录
2. 后端服务是否正常运行
3. 浏览器控制台是否有错误信息
4. 网络连接是否正常

### Q10: 如何在生产环境部署 API Key 系统？

**A**:
1. 确保 `YDMS_JWT_SECRET` 配置强密码
2. 数据库已自动迁移（包含 api_keys 表）
3. 修改默认管理员密码
4. 测试 API Key 创建和使用
5. 配置好备份策略

## 相关文档

### 使用指南
- **[API Key 前端使用指南](./API_KEY_FRONTEND_GUIDE.md)** - Web 界面详细说明
- **[API Key 使用指南（命令行）](./API_KEY_GUIDE.md)** - 命令行和 Python 使用

### 技术文档
- **[API Key 实现总结](./API_KEY_IMPLEMENTATION_SUMMARY.md)** - 架构设计和技术细节
- **[CLAUDE.md](../CLAUDE.md)** - 项目完整文档

### API 参考
- 后端 API 端点：`/api/v1/api-keys/*`
- OpenAPI 文档：`docs/backend/openapi.json`

## 更新日志

### v1.0.0 (2025-10-30)

**后端**：
- ✅ 完整的 API Key CRUD 端点
- ✅ SHA256 哈希存储
- ✅ JWT + API Key 双模式认证
- ✅ 软删除和过期检查
- ✅ 统计信息 API
- ✅ 自动化测试脚本

**前端**：
- ✅ API Key 管理抽屉界面
- ✅ 统计卡片展示
- ✅ 创建 API Key 弹窗（强调仅显示一次）
- ✅ 列表表格（状态、时间、操作）
- ✅ 编辑、撤销、删除操作
- ✅ 权限控制（仅超级管理员）

**文档**：
- ✅ 前端使用指南
- ✅ 命令行使用指南
- ✅ 实现总结文档
- ✅ 完整使用指南（本文档）

## 反馈和支持

如遇到问题或有改进建议：
- 提交 Issue：https://github.com/your-org/ydms/issues
- 联系开发团队

---

**文档版本**：v1.0.0
**最后更新**：2025-10-30
**维护者**：YDMS 开发团队
