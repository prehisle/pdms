# YDMS 后端 Dockerfile
# 用于前后端分离部署，只构建后端服务

# 阶段1: 构建后端
FROM golang:1.24-alpine AS backend-builder

# 安装必要的包
RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app

# 复制 go mod 文件
COPY backend/go.mod backend/go.sum ./

# 配置 Go 代理（解决网络问题）
ENV GOPROXY=https://goproxy.cn,direct
ENV GO111MODULE=on

# 下载依赖
RUN go mod download && go mod verify

# 复制后端源代码
COPY backend/ ./

# 构建应用
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o ydms-server ./cmd/server

# 阶段3: 运行时镜像
FROM alpine:latest

# 安装运行时依赖
RUN apk --no-cache add ca-certificates tzdata curl

# 创建非root用户
RUN addgroup -g 1001 -S ydms && \
    adduser -u 1001 -S ydms -G ydms

WORKDIR /app

# 从构建阶段复制后端二进制文件
COPY --from=backend-builder /app/ydms-server /app/ydms-server

# 创建必要的目录
RUN mkdir -p /app/logs /app/data && \
    chown -R ydms:ydms /app

# 切换到非root用户
USER ydms

# 暴露端口
EXPOSE 9180

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9180/health || exit 1

# 启动命令
CMD ["./ydms-server"]