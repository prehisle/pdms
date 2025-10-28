# PDMS Docker Compose 部署方案

## 目标
- 通过 `docker-compose up -d` 一键启动完整 PDMS 环境。
- 统一管理 PostgreSQL、后端 Go 服务、前端静态站点。
- 支持本地开发调试与生产近似环境。

## 服务规划
服务名称 | 说明
---------|------
`db` | PostgreSQL 15+，持久化数据卷，可加载初始化 SQL。
`backend` | Go 服务，读取数据库与 JWT 等环境变量，运行自动迁移并生成默认超级管理员（可通过环境变量覆盖账号密码）。
`frontend` | Vite 构建出的静态文件，使用 Nginx 或轻量 server 提供服务；也可提供开发模式。

可选服务：
- `seed`：一次性执行 `go run ./cmd/reset-db` 或 SQL 脚本，重置数据库并写入默认管理员。

## 目录结构建议
```
project-root/
├─ docker/
│  ├─ backend/Dockerfile
│  ├─ frontend/Dockerfile
│  ├─ frontend/nginx.conf (如使用 Nginx)
│  └─ initdb/00-init.sql (可选)
├─ docker-compose.yml
└─ .env (公共环境变量)
```

## docker-compose.yml 示例
````yaml
docker-compose.yml
version: "3.9"

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: ${PDMS_DB_NAME:-pdms}
      POSTGRES_USER: ${PDMS_DB_USER:-pdms}
      POSTGRES_PASSWORD: ${PDMS_DB_PASSWORD:-pdms123}
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./docker/initdb:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"

  backend:
    build:
      context: .
      dockerfile: docker/backend/Dockerfile
    depends_on:
      - db
    environment:
      YDMS_DB_HOST: db
      YDMS_DB_PORT: 5432
      YDMS_DB_USER: ${PDMS_DB_USER:-pdms}
      YDMS_DB_PASSWORD: ${PDMS_DB_PASSWORD:-pdms123}
      YDMS_DB_NAME: ${PDMS_DB_NAME:-pdms}
      JWT_SECRET: ${JWT_SECRET:-change-me}
      YDMS_DEBUG_TRAFFIC: ${YDMS_DEBUG_TRAFFIC:-0}
      AUTO_INIT_SUPER_ADMIN: ${AUTO_INIT_SUPER_ADMIN:-false}
    ports:
      - "9180:9180"

  frontend:
    build:
      context: .
      dockerfile: docker/frontend/Dockerfile
    depends_on:
      - backend
    environment:
      VITE_API_BASE_URL: ${VITE_API_BASE_URL:-http://localhost:9180}
    ports:
      - "5173:80"

volumes:
  db-data:
````

## Dockerfile 模板

### backend
```dockerfile
# docker/backend/Dockerfile
FROM golang:1.22 AS builder
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

FROM gcr.io/distroless/base-debian11
WORKDIR /app
COPY --from=builder /app/server ./server
EXPOSE 9180
ENTRYPOINT ["./server"]
```

容器启动后，后端会在数据库缺少超级管理员时自动创建默认账号。生产环境应通过环境变量 `YDMS_DEFAULT_ADMIN_USERNAME`、`YDMS_DEFAULT_ADMIN_PASSWORD` 提供强密码，或在启动完成后立即修改密码。

### frontend (Nginx)
```dockerfile
# docker/frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`docker/frontend/nginx.conf` 示例：
```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;

  location /api/ {
    proxy_pass http://pdms-backend:9180/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## 环境变量管理
- `docker-compose` 默认读取顶层 `.env`。建议包含：
  - `PDMS_DB_NAME`, `PDMS_DB_USER`, `PDMS_DB_PASSWORD`
  - `JWT_SECRET`、`YDMS_NDR_API_KEY`、`YDMS_ADMIN_KEY`
  - `VITE_API_BASE_URL`
- 后端 `.env` 可用于存储默认值，但要注意安全；生产环境应通过 compose 或 secrets 注入。

## 数据库初始化策略
1. **容器自带脚本**：在 `docker/initdb` 中放置 SQL 或使用 `go run ./cmd/reset-db`，确保在首次部署前写入结构和默认账号。
2. **环境变量覆盖**：通过 `YDMS_DEFAULT_ADMIN_USERNAME`、`YDMS_DEFAULT_ADMIN_PASSWORD`、`YDMS_DEFAULT_ADMIN_DISPLAY_NAME` 配置自定义管理员信息。
3. **外部脚本**：在部署流水线中执行 `make reset-db` 或等价脚本，再 `docker-compose up`。

## 一键部署流程
1. 准备 `.env`：
   ```
   PDMS_DB_NAME=pdms
   PDMS_DB_USER=pdms
   PDMS_DB_PASSWORD=pdms123
   JWT_SECRET=change-me
   VITE_API_BASE_URL=http://localhost:9180
   AUTO_INIT_SUPER_ADMIN=true
   ```
2. 构建镜像：`docker-compose build`
3. 启动：`docker-compose up -d`
4. 访问前端：`http://localhost:5173`

## 开发模式变体
- **热更新后端**：将 backend 服务改写为 `go run ./cmd/server --watch`，挂载源码到容器。示例：
  ```yaml
  backend-dev:
    build:
      context: .
      dockerfile: docker/backend-dev/Dockerfile
    volumes:
      - ./backend:/app
    command: go run ./cmd/server --watch
  ```
- **热更新前端**：在 compose 中暴露端口 5173，挂载 `frontend/` 并调用 `npm run dev`。

## 持久化与备份
- 数据库卷 `db-data` 存放在宿主机，需定期备份。
- 如需迁移数据库，可在 compose 中添加备份服务或利用 `pg_dump`。

## CI/CD 集成建议
- 在 CI 中使用 `docker-compose -f docker-compose.yml up -d db backend` 启动依赖，再执行测试。
- 部署阶段构建镜像后推送至私有仓库，生产环境只需 `docker-compose pull && docker-compose up -d`。

## 安全考虑
- 生产环境应使用强密码与随机化的 `JWT_SECRET`，并考虑启用 TLS。
- 管理默认账号后务必修改密码；或在初始化脚本中生成随机密码，通过外部渠道传达。

## 后续优化
- 添加监控/日志服务（如 Loki + Promtail）到 compose。
- 引入反向代理（Traefik / Nginx）统一处理 SSL 与多服务路由。
- 将健康检查 (`/api/v1/healthz`) 与 readiness probe 写入 compose 的 `healthcheck`，增强容器编排能力。
