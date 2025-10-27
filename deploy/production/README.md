# YDMS 生产环境部署指南

## 概述

本文档介绍如何使用 Docker Compose 在生产环境中部署 YDMS（题库管理系统）。

## 系统要求

- Ubuntu 20.04+ / CentOS 8+ / 其他支持的 Linux 发行版
- Docker 20.10+ 和 Docker Compose 2.0+
- 至少 2GB RAM，建议 4GB+
- 至少 10GB 可用磁盘空间

## 快速开始

### 1. 准备配置文件

```bash
# 进入部署目录
cd /path/to/ydms/deploy/production

# 复制环境变量模板
cp .env.example .env

# 编辑配置文件，填写真实的密钥和密码
nano .env
```

### 2. 运行一键部署脚本

**方式一：使用本地配置文件（推荐）**

```bash
# 准备本地 .env 文件
cp deploy/production/.env.example deploy/production/.env.1.31
nano deploy/production/.env.1.31  # 编辑并填写真实配置

# 执行部署，自动上传配置
./scripts/deploy_prod.sh --env-file deploy/production/.env.1.31
```

**方式二：手动在服务器配置**

```bash
# 部署应用（不指定配置文件）
./scripts/deploy_prod.sh

# 登录服务器手动配置
ssh dy_prod@192.168.1.31
cd ~/ydms9001
nano .env  # 编辑配置
docker compose restart  # 重启服务
```

**方式三：手动部署**

```bash
# 构建镜像
docker build -t ydms:prod .

# 启动服务
docker compose up -d

# 查看服务状态
docker compose ps
```

### 3. 部署脚本选项

```bash
# 显示帮助信息
./scripts/deploy_prod.sh --help

# 使用环境变量覆盖默认配置
REMOTE_HOST=192.168.1.32 \
REMOTE_DIR=~/ydms9002 \
./scripts/deploy_prod.sh --env-file ./my-config.env
```

### 4. 访问应用

- 应用地址：http://your-server-ip:9001
- API 文档：http://your-server-ip:9001/api/docs

## 配置说明

### 环境变量配置

#### 必填配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `POSTGRES_PASSWORD` | 数据库密码 | `your-secure-password` |
| `YDMS_NDR_BASE_URL` | NDR 服务地址 | `http://192.168.1.4:9001` |
| `YDMS_NDR_API_KEY` | NDR API 密钥 | `your-ndr-api-key` |
| `YDMS_ADMIN_KEY` | NDR 管理员密钥 | `your-admin-key` |
| `YDMS_JWT_SECRET` | JWT 签名密钥 | `your-jwt-secret` |

#### 可选配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `HTTP_PORT` | 9001 | 外部访问端口 |
| `HTTPS_PORT` | 9002 | HTTPS 访问端口 |
| `YDMS_DEBUG_TRAFFIC` | 0 | 调试模式 |
| `YDMS_JWT_EXPIRY` | 24h | JWT 过期时间 |

### 数据库配置

系统使用 PostgreSQL 作为主数据库，配置说明：

- **数据持久化**：数据库文件存储在 `./data/postgres`
- **备份策略**：建议定期备份 `./data/postgres` 目录
- **连接信息**：应用通过容器网络连接数据库
- **端口配置**：PostgreSQL 默认不暴露到宿主机，仅在 Docker 内部网络访问
- **外部访问**（可选）：如需从宿主机访问数据库进行调试，请修改 `docker-compose.yml`：
  ```yaml
  postgres:
    ports:
      - "5433:5432"  # 使用 5433 避免与宿主机 PostgreSQL 冲突
  ```

### 网络配置

- **内部网络**：`172.20.0.0/16`（Docker 网络）
- **服务通信**：所有服务在内部网络中通信
- **外部访问**：通过 Nginx 反向代理暴露端口

## 服务管理

### 查看服务状态

```bash
docker compose ps
```

### 查看日志

```bash
# 查看所有服务日志
docker compose logs

# 查看特定服务日志
docker compose logs ydms-app
docker compose logs postgres
docker compose logs nginx

# 实时跟踪日志
docker compose logs -f ydms-app
```

### 重启服务

```bash
# 重启所有服务
docker compose restart

# 重启特定服务
docker compose restart ydms-app
```

### 更新应用

```bash
# 重新构建并部署
docker compose build --no-cache
docker compose up -d --force-recreate
```

### 停止服务

```bash
# 停止所有服务
docker compose down

# 停止并删除数据卷（⚠️ 会删除数据）
docker compose down -v
```

## 数据管理

### 数据库备份

```bash
# 创建备份
docker compose exec postgres pg_dump -U ydms_user ydms > backup.sql

# 恢复备份
docker compose exec -T postgres psql -U ydms_user ydms < backup.sql
```

### 数据迁移

```bash
# 迁移到新服务器
# 1. 停止服务
docker compose down

# 2. 打包数据目录
tar -czf ydms-data.tar.gz data/

# 3. 在新服务器解压
tar -xzf ydms-data.tar.gz

# 4. 启动服务
docker compose up -d
```

## 监控和维护

### 健康检查

所有服务都配置了健康检查：

```bash
# 查看健康状态
docker compose ps
```

### 性能监控

```bash
# 查看资源使用情况
docker stats

# 查看磁盘使用
df -h
du -sh data/
```

### 日志轮转

日志文件存储在 `./data/logs`，建议配置日志轮转：

```bash
# 添加 logrotate 配置
sudo nano /etc/logrotate.d/ydms
```

内容示例：

```
/path/to/ydms/data/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}
```

## 安全配置

### 防火墙设置

```bash
# Ubuntu/Debian
sudo ufw allow 9001
sudo ufw allow 9002
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=9001/tcp
sudo firewall-cmd --permanent --add-port=9002/tcp
sudo firewall-cmd --reload
```

### SSL/HTTPS 配置

如需启用 HTTPS，请：

1. 获取 SSL 证书（Let's Encrypt 或其他 CA）
2. 修改 `nginx.conf` 启用 HTTPS 配置
3. 更新 `.env` 中的端口配置
4. 重启 Nginx 服务

### 密码安全

- 使用强密码策略
- 定期更换数据库密码
- 确保 JWT 密钥足够复杂
- 不要在版本控制中提交敏感信息

## 故障排除

### 常见问题

#### 1. 服务无法启动

```bash
# 检查日志
docker compose logs

# 检查端口占用
netstat -tlnp | grep :80
netstat -tlnp | grep :9180

# 检查磁盘空间
df -h
```

#### 2. 数据库连接失败

```bash
# 检查数据库状态
docker compose exec postgres pg_isready -U ydms_user

# 检查网络连接
docker compose exec ydms-app ping postgres
```

#### 3. 前端无法访问

```bash
# 检查 Nginx 配置
docker compose exec nginx nginx -t

# 重新加载配置
docker compose exec nginx nginx -s reload
```

#### 4. 端口冲突错误

错误信息：`Bind for 0.0.0.0:XXXX failed: port is already allocated`

```bash
# 检查端口占用
sudo lsof -i :9001  # 检查 HTTP 端口
sudo lsof -i :5432  # 检查 PostgreSQL 端口

# 解决方案1：停止占用端口的服务
sudo systemctl stop postgresql  # 如果是系统 PostgreSQL

# 解决方案2：修改 .env 文件，使用其他端口
HTTP_PORT=9003
# PostgreSQL 默认不暴露，无需修改

# 重新部署
docker compose down
docker compose up -d
```

### 获取支持

如遇到问题，请：

1. 检查日志文件获取错误信息
2. 确认所有配置项正确填写
3. 验证系统资源充足
4. 查看项目文档或提交 Issue

## 多实例部署

如需在同一服务器部署多个实例：

1. 修改 `.env` 中的 `COMPOSE_PROJECT_NAME`
2. 调整端口配置避免冲突
3. 使用不同的数据目录
4. 重复部署步骤

示例：

```bash
# 实例1
COMPOSE_PROJECT_NAME=ydms-dev
HTTP_PORT=9002
YDMS_HTTP_PORT=9180

# 实例2
COMPOSE_PROJECT_NAME=ydms-prod
HTTP_PORT=9003
YDMS_HTTP_PORT=9181
```

## 更新记录

- v1.0.0: 初始版本，支持基本部署功能
- v1.1.0: 添加健康检查和资源限制
- v1.2.0: 优化安全配置和日志管理