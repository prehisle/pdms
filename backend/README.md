# YDMS Backend Skeleton

This module hosts the Go backend for the YDMS materials management system.

## Getting started

1. Ensure Go 1.22+ is installed.
2. Configure the connection to the NDR service by setting environment variables or editing `.env`:

```
YDMS_NDR_BASE_URL=http://localhost:9001
YDMS_NDR_API_KEY=your-ndr-key
YDMS_HTTP_PORT=9180
YDMS_DEFAULT_USER_ID=system
YDMS_ADMIN_KEY=your-ndr-admin-key
YDMS_DEBUG_TRAFFIC=1
```

3. From this directory, run:

```bash
go run ./cmd/server
```

4. The server listens on `:9180` by default (override with `YDMS_HTTP_PORT`).
5. Test the hello endpoint:

```bash
curl http://localhost:9180/api/v1/ping
```

### Auto reload during development

Use the built-in watcher to rebuild and restart the server when `.go`, `.env`, `go.mod`, or `go.sum` change:

```bash
go run ./cmd/server --watch
```

The watcher reuses the same configuration as `go run` and produces the compiled binary at `tmp/server-dev`. Press `Ctrl+C` to stop both the watcher and the underlying server.

If you prefer [air](https://github.com/air-verse/air) or another tool, the existing `.air.toml` still works.

## Testing

Run the backend unit tests:

```bash
go test ./...
```

To exercise the real NDR integration (requires a reachable NDR service and valid credentials):

```bash
go test ./internal/ndrclient \
  -run TestRealNDRIntegration \
  -ndr.url=http://localhost:9001 \
  -ndr.apikey=your-ndr-key \
  -ndr.user=test-user
```

## Category API quick reference

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/v1/categories` | `POST` | 创建新目录节点（可选 `parent_id`） |
| `/api/v1/categories/tree` | `GET` | 拉取整棵目录树（内部自动分页聚合） |
| `/api/v1/categories/{id}` | `PATCH` | 更新目录属性（目前支持改名） |
| `/api/v1/categories/{id}/move` | `PATCH` | 仅调整父节点，不会改变同级顺序 |
| `/api/v1/categories/reorder` | `POST` | 按新顺序重排指定父节点下的所有子节点 |
| `/api/v1/categories/{id}/reposition` | `PATCH` | 一次请求完成“改父节点 + 重排”。`ordered_ids` 必须包含被移动的节点 |

对于拖拽场景推荐直接使用 `PATCH /api/v1/categories/{id}/reposition`，请求示例：

```json
{
  "new_parent_id": 42,
  "ordered_ids": [7, 5, 13]
}
```

当只需要同级重排时，可继续调用 `POST /api/v1/categories/reorder`，但要保证 `ordered_ids` 中的所有节点已经挂在该父节点下，否则 NDR 会返回 `404 Node not found`。

### 调试请求日志

将环境变量 `YDMS_DEBUG_TRAFFIC=1` 传给后端进程后，服务会在日志中输出向 NDR 发起的 HTTP 请求与返回的响应体，便于排查 move/reorder 等调用链路问题。在生产环境请谨慎开启，以免日志包含敏感信息。

## Project structure

- `cmd/server`: application entrypoint
- `internal/api`: HTTP handlers and routing
- `internal/service`: domain services
- `internal/ndrclient`: placeholder for the NDR integration
- `internal/cache`: cache abstraction with no-op implementation
- `internal/config`: configuration loading utilities

Caching is disabled by default but the `cache.Provider` interface allows plugging
in Redis or other providers without touching the service layer.
