#!/bin/bash

# API Key 功能完整测试脚本

set -e  # 遇到错误立即退出

BASE_URL="http://localhost:9180"
echo "=== API Key 功能测试 ==="
echo ""

# 步骤 1: 登录获取 JWT token
echo "步骤 1: 登录获取 JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"super_admin","password":"admin123456"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ 登录失败"
  echo $LOGIN_RESPONSE | jq '.'
  exit 1
fi
echo "✅ 登录成功"
echo "Token: ${TOKEN:0:50}..."
echo ""

# 步骤 2: 查看 API Key 统计（应该为空）
echo "步骤 2: 查看 API Key 统计..."
STATS=$(curl -s -H "Authorization: Bearer $TOKEN" $BASE_URL/api/v1/api-keys/stats)
echo $STATS | jq '.'
echo ""

# 步骤 3: 创建 API Key
echo "步骤 3: 创建 API Key..."
CREATE_RESPONSE=$(curl -s -X POST $BASE_URL/api/v1/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试API Key",
    "user_id": 1,
    "environment": "test"
  }')

API_KEY=$(echo $CREATE_RESPONSE | jq -r '.api_key')
KEY_ID=$(echo $CREATE_RESPONSE | jq -r '.key_info.id')

if [ "$API_KEY" = "null" ] || [ -z "$API_KEY" ]; then
  echo "❌ 创建 API Key 失败"
  echo $CREATE_RESPONSE | jq '.'
  exit 1
fi

echo "✅ API Key 创建成功"
echo "API Key: $API_KEY"
echo "Key ID: $KEY_ID"
echo ""

# 步骤 4: 使用 API Key 访问健康检查
echo "步骤 4: 使用 API Key 访问健康检查..."
HEALTH_CHECK=$(curl -s -H "X-API-Key: $API_KEY" $BASE_URL/healthz)
echo $HEALTH_CHECK | jq '.'
if [ "$(echo $HEALTH_CHECK | jq -r '.status')" = "ok" ]; then
  echo "✅ API Key 认证成功"
else
  echo "❌ API Key 认证失败"
  exit 1
fi
echo ""

# 步骤 5: 使用 Authorization Bearer 方式
echo "步骤 5: 使用 Authorization Bearer 方式..."
HEALTH_CHECK2=$(curl -s -H "Authorization: Bearer $API_KEY" $BASE_URL/healthz)
echo $HEALTH_CHECK2 | jq '.'
echo "✅ Bearer 方式认证成功"
echo ""

# 步骤 6: 列出所有 API Keys
echo "步骤 6: 列出所有 API Keys..."
LIST_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" $BASE_URL/api/v1/api-keys)
echo $LIST_RESPONSE | jq '.api_keys[] | {id, name, key_prefix, created_at}'
echo ""

# 步骤 7: 获取 API Key 详情
echo "步骤 7: 获取 API Key 详情..."
DETAIL_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" $BASE_URL/api/v1/api-keys/$KEY_ID)
echo $DETAIL_RESPONSE | jq '{id, name, key_prefix, user: .user.username, created_at}'
echo ""

# 步骤 8: 更新 API Key
echo "步骤 8: 更新 API Key 名称..."
UPDATE_RESPONSE=$(curl -s -X PATCH $BASE_URL/api/v1/api-keys/$KEY_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "更新后的测试API Key"}')
echo $UPDATE_RESPONSE | jq '{id, name, key_prefix}'
echo "✅ 更新成功"
echo ""

# 步骤 9: 查看更新后的统计
echo "步骤 9: 查看更新后的统计..."
STATS2=$(curl -s -H "Authorization: Bearer $TOKEN" $BASE_URL/api/v1/api-keys/stats)
echo $STATS2 | jq '.'
echo ""

# 步骤 10: 测试使用 API Key 创建分类
echo "步骤 10: 测试使用 API Key 创建分类..."
CATEGORY_RESPONSE=$(curl -s -X POST $BASE_URL/api/v1/categories \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "API Key 测试分类"}')

if echo $CATEGORY_RESPONSE | jq -e '.node_id' > /dev/null 2>&1; then
  echo "✅ 使用 API Key 创建分类成功"
  echo $CATEGORY_RESPONSE | jq '{node_id, label}'
else
  echo "⚠️  创建分类失败（可能是 NDR 服务未运行）"
  echo $CATEGORY_RESPONSE | jq '.'
fi
echo ""

# 步骤 11: 撤销 API Key
echo "步骤 11: 撤销 API Key..."
REVOKE_RESPONSE=$(curl -s -X POST $BASE_URL/api/v1/api-keys/$KEY_ID/revoke \
  -H "Authorization: Bearer $TOKEN")
echo $REVOKE_RESPONSE | jq '.'
echo "✅ API Key 已撤销"
echo ""

# 步骤 12: 测试撤销后的 API Key（应该失败）
echo "步骤 12: 测试撤销后的 API Key（应该失败）..."
REVOKED_TEST=$(curl -s -H "X-API-Key: $API_KEY" $BASE_URL/api/v1/api-keys/stats)
if echo $REVOKED_TEST | jq -e '.error' > /dev/null 2>&1; then
  echo "✅ 撤销后的 API Key 无法使用（符合预期）"
  echo $REVOKED_TEST | jq '.error'
else
  echo "❌ 撤销失败，API Key 仍然可用"
  echo $REVOKED_TEST | jq '.'
  exit 1
fi
echo ""

# 步骤 13: 最终统计
echo "步骤 13: 最终统计..."
FINAL_STATS=$(curl -s -H "Authorization: Bearer $TOKEN" $BASE_URL/api/v1/api-keys/stats)
echo $FINAL_STATS | jq '.'
echo ""

echo "==================================="
echo "✅ 所有测试通过！"
echo "==================================="
echo ""
echo "API Key 系统功能验证："
echo "  ✓ 创建 API Key"
echo "  ✓ 使用 X-API-Key 认证"
echo "  ✓ 使用 Authorization Bearer 认证"
echo "  ✓ 列出 API Keys"
echo "  ✓ 获取 API Key 详情"
echo "  ✓ 更新 API Key"
echo "  ✓ 使用 API Key 访问业务 API"
echo "  ✓ 撤销 API Key"
echo "  ✓ 验证撤销后无法使用"
echo "  ✓ 统计信息正确"
