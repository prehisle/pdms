#!/bin/bash

# =============================================================================
# YDMS 生产环境一键部署脚本
# =============================================================================
# 使用方法：
#   ./scripts/deploy_prod.sh [选项]
#
# 选项：
#   --env-file <path>  指定本地 .env 文件路径，自动上传到服务器
#   --help             显示帮助信息
#
# 示例：
#   # 使用默认配置（服务器需手动配置 .env）
#   ./scripts/deploy_prod.sh
#
#   # 使用本地准备好的 .env 文件
#   ./scripts/deploy_prod.sh --env-file ./deploy/production/.env.1.31
#
# 环境变量（可选）：
#   REMOTE_HOST    - 远程服务器地址 (默认: 192.168.1.31)
#   REMOTE_USER    - 远程用户名 (默认: dy_prod)
#   REMOTE_DIR     - 远程部署目录 (默认: ~/ydms9001)
#   IMAGE_NAME     - 镜像名称 (默认: ydms)
#   IMAGE_TAG      - 镜像标签 (默认: prod)

set -euo pipefail

# 参数解析
LOCAL_ENV_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --env-file)
            LOCAL_ENV_FILE="$2"
            shift 2
            ;;
        --help|-h)
            grep '^#' "$0" | grep -v '#!/bin/bash' | sed 's/^# //' | sed 's/^#//'
            exit 0
            ;;
        *)
            echo "未知选项: $1"
            echo "使用 --help 查看帮助信息"
            exit 1
            ;;
    esac
done

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数（输出到 stderr，避免污染函数返回值）
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# 配置变量
REMOTE_HOST="${REMOTE_HOST:-192.168.1.31}"
REMOTE_USER="${REMOTE_USER:-dy_prod}"
REMOTE_DIR="${REMOTE_DIR:-~/ydms9001}"
IMAGE_NAME="${IMAGE_NAME:-ydms}"
IMAGE_TAG="${IMAGE_TAG:-prod}"
DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 检查依赖
check_dependencies() {
    log_info "检查本地依赖..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装或不在 PATH 中"
        exit 1
    fi

    if ! command -v scp &> /dev/null; then
        log_error "scp 未安装或不在 PATH 中"
        exit 1
    fi

    if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "${REMOTE_USER}@${REMOTE_HOST}" echo "SSH连接测试成功" 2>/dev/null; then
        log_error "无法连接到远程服务器 ${REMOTE_USER}@${REMOTE_HOST}"
        log_error "请确保："
        log_error "  1. SSH 免密登录已配置"
        log_error "  2. 服务器地址和用户名正确"
        log_error "  3. 网络连接正常"
        exit 1
    fi

    # 检查本地 .env 文件
    if [[ -n "${LOCAL_ENV_FILE}" ]]; then
        if [[ ! -f "${LOCAL_ENV_FILE}" ]]; then
            log_error "指定的 .env 文件不存在: ${LOCAL_ENV_FILE}"
            exit 1
        fi
        log_info "将使用本地 .env 文件: ${LOCAL_ENV_FILE}"
    fi

    log_success "依赖检查通过"
}

# 构建镜像
build_image() {
    log_info "开始构建 Docker 镜像..."

    cd "${DEPLOY_DIR}"

    # 构建后端镜像
    log_info "构建后端镜像..."
    if [[ ! -f "Dockerfile" ]]; then
        log_error "后端 Dockerfile 不存在"
        exit 1
    fi

    if docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" -f Dockerfile .; then
        local backend_size
        backend_size=$(docker images "${IMAGE_NAME}:${IMAGE_TAG}" --format "{{.Size}}")
        log_success "后端镜像构建成功: ${IMAGE_NAME}:${IMAGE_TAG} (${backend_size})"
    else
        log_error "后端镜像构建失败"
        exit 1
    fi

    # 构建前端镜像
    log_info "构建前端镜像..."
    if [[ ! -f "Dockerfile.frontend" ]]; then
        log_error "前端 Dockerfile.frontend 不存在"
        exit 1
    fi

    if docker build -t "${IMAGE_NAME}-frontend:${IMAGE_TAG}" -f Dockerfile.frontend .; then
        local frontend_size
        frontend_size=$(docker images "${IMAGE_NAME}-frontend:${IMAGE_TAG}" --format "{{.Size}}")
        log_success "前端镜像构建成功: ${IMAGE_NAME}-frontend:${IMAGE_TAG} (${frontend_size})"
    else
        log_error "前端镜像构建失败"
        exit 1
    fi
}

# 导出镜像
export_image() {
    log_info "导出 Docker 镜像..."

    local backend_tar="ydms_backend_prod.tar"
    local frontend_tar="ydms_frontend_prod.tar"

    # 删除旧的导出文件
    rm -f "${backend_tar}" "${frontend_tar}"

    # 导出后端镜像
    log_info "导出后端镜像..."
    if docker save "${IMAGE_NAME}:${IMAGE_TAG}" -o "${backend_tar}"; then
        local backend_file_size
        backend_file_size=$(ls -lh "${backend_tar}" | awk '{print $5}')
        log_success "后端镜像导出成功: ${backend_tar} (${backend_file_size})"
    else
        log_error "后端镜像导出失败"
        exit 1
    fi

    # 导出前端镜像
    log_info "导出前端镜像..."
    if docker save "${IMAGE_NAME}-frontend:${IMAGE_TAG}" -o "${frontend_tar}"; then
        local frontend_file_size
        frontend_file_size=$(ls -lh "${frontend_tar}" | awk '{print $5}')
        log_success "前端镜像导出成功: ${frontend_tar} (${frontend_file_size})"
    else
        log_error "前端镜像导出失败"
        exit 1
    fi
}

# 准备部署文件
prepare_deploy_files() {
    log_info "准备部署文件..."

    local deploy_temp_dir
    deploy_temp_dir=$(mktemp -d)

    # 复制必要文件
    cp "${DEPLOY_DIR}/deploy/production/docker-compose.yml" "${deploy_temp_dir}/"
    cp "${DEPLOY_DIR}/deploy/production/nginx.conf" "${deploy_temp_dir}/"
    cp "${DEPLOY_DIR}/deploy/production/.env.example" "${deploy_temp_dir}/.env.example"

    # 复制 .env 文件（如果指定了本地文件）
    if [[ -n "${LOCAL_ENV_FILE}" ]]; then
        log_info "复制本地 .env 文件到部署包..."
        cp "${LOCAL_ENV_FILE}" "${deploy_temp_dir}/.env"
    fi

    # 复制镜像文件
    cp "${DEPLOY_DIR}/ydms_backend_prod.tar" "${deploy_temp_dir}/"
    cp "${DEPLOY_DIR}/ydms_frontend_prod.tar" "${deploy_temp_dir}/"

    # 创建部署脚本
    cat > "${deploy_temp_dir}/remote_deploy.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 配置
REMOTE_DIR="${1:-~/ydms9001}"
IMAGE_NAME="ydms"
IMAGE_TAG="prod"

log_info "开始远程部署..."

# 检查 Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker 未安装"
    exit 1
fi

# 检查 Docker Compose
if ! command -v docker &> /dev/null compose && ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose 未安装"
    exit 1
fi

# 确定使用哪个 compose 命令
COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
fi

# 创建部署目录
log_info "创建部署目录: ${REMOTE_DIR}"
mkdir -p "${REMOTE_DIR}"
cd "${REMOTE_DIR}"

# 创建数据目录和运行时目录
mkdir -p data/{postgres,logs,app} runtime

# 调试：列出当前目录的文件
log_info "当前目录: $(pwd)"
log_info "目录内容:"
ls -la

# 检查环境文件
if [[ -f ".env" ]]; then
    log_success "发现 .env 配置文件，将使用现有配置"
else
    if [[ -f ".env.example" ]]; then
        log_warning ".env 文件不存在，正在从模板创建..."
        cp .env.example .env
        log_warning "请编辑 .env 文件，填写真实的配置信息"
        log_warning "特别是数据库密码、NDR API 密钥和 JWT 密钥"
        log_warning "配置完成后，请重新运行: docker compose restart"
    else
        log_error "环境文件模板不存在"
        log_error "当前目录: $(pwd)"
        log_error "目录内容: $(ls -la)"
        exit 1
    fi
fi

# 移动镜像到 runtime 目录
if [[ -f "ydms_backend_prod.tar" ]]; then
    mv ydms_backend_prod.tar runtime/
fi
if [[ -f "ydms_frontend_prod.tar" ]]; then
    mv ydms_frontend_prod.tar runtime/
fi

# 加载后端镜像
log_info "加载后端 Docker 镜像..."
if docker load -i runtime/ydms_backend_prod.tar; then
    log_success "后端镜像加载成功"
else
    log_error "后端镜像加载失败"
    exit 1
fi

# 加载前端镜像
log_info "加载前端 Docker 镜像..."
if docker load -i runtime/ydms_frontend_prod.tar; then
    log_success "前端镜像加载成功"
else
    log_error "前端镜像加载失败"
    exit 1
fi

# 检查现有服务
log_info "检查现有服务状态..."
if ${COMPOSE_CMD} ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null; then
    log_info "发现现有服务，将进行更新部署"
fi

# 启动服务
log_info "启动服务..."
if ${COMPOSE_CMD} up -d --force-recreate --remove-orphans; then
    log_success "服务启动成功"
else
    log_error "服务启动失败"
    exit 1
fi

# 等待服务就绪
log_info "等待服务就绪..."
sleep 10

# 检查服务状态
log_info "检查服务状态..."
${COMPOSE_CMD} ps

# 健康检查
log_info "执行健康检查..."
for i in {1..6}; do
    if curl -f http://localhost:9001/health &>/dev/null; then
        log_success "健康检查通过"
        break
    else
        if [[ $i -eq 6 ]]; then
            log_warning "健康检查失败，但服务可能仍在启动中"
        else
            log_info "等待服务启动... ($i/6)"
            sleep 10
        fi
    fi
done

# 清理临时文件
log_info "清理临时文件..."
rm -f runtime/ydms_backend_prod.tar runtime/ydms_frontend_prod.tar

log_success "部署完成！"
log_info "访问地址: http://$(hostname -I | awk '{print $1}')"
log_info "管理命令: cd ${REMOTE_DIR} && ${COMPOSE_CMD} logs -f"
EOF

    chmod +x "${deploy_temp_dir}/remote_deploy.sh"

    echo "${deploy_temp_dir}"
}

# 传输文件到远程服务器
transfer_files() {
    local deploy_temp_dir="$1"

    log_info "传输文件到远程服务器..."

    # 确保远程目录存在（展开 ~ 符号）
    ssh "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ${REMOTE_DIR}"

    # 显示准备传输的文件
    log_info "准备传输的文件列表："
    ls -lah "${deploy_temp_dir}/"

    # 打包部署文件（包含隐藏文件）
    local tar_file="${DEPLOY_DIR}/deploy_package.tar.gz"
    tar -czf "${tar_file}" -C "${deploy_temp_dir}" .

    log_info "传输部署包..."
    # 传输 tar 包
    if scp "${tar_file}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/deploy_package.tar.gz"; then
        log_success "部署包传输成功"
    else
        log_error "部署包传输失败"
        rm -f "${tar_file}"
        rm -rf "${deploy_temp_dir}"
        exit 1
    fi

    # 在远程服务器解压
    log_info "解压部署包..."
    if ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && tar -xzf deploy_package.tar.gz && rm deploy_package.tar.gz"; then
        log_success "部署包解压成功"
    else
        log_error "部署包解压失败"
        rm -f "${tar_file}"
        rm -rf "${deploy_temp_dir}"
        exit 1
    fi

    # 验证远程文件
    log_info "验证远程文件..."
    ssh "${REMOTE_USER}@${REMOTE_HOST}" "ls -lah ${REMOTE_DIR}/"

    # 清理临时文件
    rm -f "${tar_file}"
    rm -rf "${deploy_temp_dir}"
}

# 远程执行部署
remote_deploy() {
    log_info "在远程服务器执行部署..."

    if ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && ./remote_deploy.sh ${REMOTE_DIR}"; then
        log_success "远程部署成功"
    else
        log_error "远程部署失败"
        exit 1
    fi
}

# 清理本地临时文件
cleanup() {
    log_info "清理本地临时文件..."

    if [[ -f "${DEPLOY_DIR}/ydms_backend_prod.tar" ]]; then
        rm -f "${DEPLOY_DIR}/ydms_backend_prod.tar"
    fi

    if [[ -f "${DEPLOY_DIR}/ydms_frontend_prod.tar" ]]; then
        rm -f "${DEPLOY_DIR}/ydms_frontend_prod.tar"
    fi

    if [[ -f "${DEPLOY_DIR}/deploy_package.tar.gz" ]]; then
        rm -f "${DEPLOY_DIR}/deploy_package.tar.gz"
    fi

    log_success "清理完成"
}

# 显示部署信息
show_deployment_info() {
    log_success "YDMS 生产环境部署完成！"
    echo
    echo "部署信息："
    echo "  服务器地址: ${REMOTE_HOST}"
    echo "  部署目录: ${REMOTE_DIR}"
    echo "  访问地址: http://${REMOTE_HOST}:9001"
    echo "  管理命令: ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_DIR} && docker compose logs -f'"
    echo

    if [[ -n "${LOCAL_ENV_FILE}" ]]; then
        echo "配置信息："
        echo "  ✓ 已使用本地 .env 文件: ${LOCAL_ENV_FILE}"
        echo "  ✓ 配置已自动上传到服务器"
        echo
        echo "后续操作："
        echo "  1. 验证服务是否正常运行"
        echo "  2. 定期备份数据目录: ${REMOTE_DIR}/data"
    else
        echo "重要提醒："
        echo "  1. 请登录服务器编辑 ${REMOTE_DIR}/.env 文件"
        echo "  2. 填写真实的数据库密码和 API 密钥"
        echo "  3. 重启服务以应用新配置: docker compose restart"
        echo "  4. 定期备份数据目录: ${REMOTE_DIR}/data"
    fi
    echo
}

# 主函数
main() {
    echo "=========================================="
    echo "YDMS 生产环境一键部署脚本"
    echo "=========================================="
    echo

    # 检查是否在正确的目录
    if [[ ! -f "${DEPLOY_DIR}/backend/go.mod" ]] || [[ ! -f "${DEPLOY_DIR}/frontend/package.json" ]]; then
        log_error "请在 YDMS 项目根目录执行此脚本"
        exit 1
    fi

    log_info "部署配置："
    log_info "  远程服务器: ${REMOTE_USER}@${REMOTE_HOST}"
    log_info "  部署目录: ${REMOTE_DIR}"
    log_info "  镜像标签: ${IMAGE_NAME}:${IMAGE_TAG}"
    if [[ -n "${LOCAL_ENV_FILE}" ]]; then
        log_info "  环境配置: ${LOCAL_ENV_FILE} (将自动上传)"
    else
        log_info "  环境配置: 使用服务器现有或从模板创建"
    fi
    echo

    # 执行部署步骤
    check_dependencies
    build_image
    export_image

    local deploy_temp_dir
    deploy_temp_dir=$(prepare_deploy_files)

    transfer_files "${deploy_temp_dir}"
    remote_deploy
    cleanup

    show_deployment_info
}

# 错误处理
trap 'log_error "部署过程中发生错误，脚本退出"; exit 1' ERR

# 执行主函数
main "$@"