#!/bin/bash
# ============================================================
# deploy.sh — 视频课程分销系统纯 Docker 部署脚本
#
# 核心原则：服务器上所有构建均在 Docker 容器内完成，无需在服务器安装 Node.js
#
# 工作流程：
#   1. 代码同步到服务器（Git pull，保持代码一致）
#   2. Docker 容器内构建前端 + 后端镜像
#   3. 启动全套生产服务
#
# 使用方式：
#   首次部署：./deploy.sh init user@your-server.com /path/to/repo
#   更新部署：./deploy.sh deploy user@your-server.com /path/to/repo
#   查看状态：./deploy.sh status user@your-server.com /path/to/repo
#   查看日志：./deploy.sh logs  user@your-server.com /path/to/repo [service]
#   停止服务：./deploy.sh stop  user@your-server.com /path/to/repo
# ============================================================

set -e

# ---------- 颜色输出 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $1"; }

# ---------- 参数检查 ----------
check_args() {
  if [ -z "$SSH_TARGET" ] || [ -z "$REMOTE_REPO" ]; then
    echo ""
    echo "用法: $0 {init|deploy|status|logs|stop} user@your-server.com /path/to/repo [service]"
    echo ""
    echo "  示例: $0 init  ubuntu@129.204.199.134 /home/ubuntu/course-distribute"
    echo "        $0 deploy ubuntu@129.204.199.134 /home/ubuntu/course-distribute"
    echo "        $0 logs  ubuntu@129.204.199.134 /home/ubuntu/course-distribute backend"
    echo ""
    exit 1
  fi
}

# ---------- 前置检查（本地） ----------
check_local_prereq() {
  log_info "检查本地前置条件..."

  if ! command -v git &> /dev/null; then
    log_error "Git 未安装"
    exit 1
  fi

  if ! command -v ssh &> /dev/null; then
    log_error "SSH 客户端未安装"
    exit 1
  fi

  if ! command -v docker &> /dev/null; then
    log_error "Docker 未安装"
    exit 1
  fi

  log_info "本地前置条件检查通过"
}

# ---------- 服务器前置检查 ----------
check_server_prereq() {
  log_step "检查服务器前置条件..."

  # Docker 检查
  if ! ssh "$SSH_TARGET" "docker --version" &> /dev/null; then
    log_error "服务器 Docker 未安装，请先在服务器安装 Docker"
    exit 1
  fi

  docker_version=$(ssh "$SSH_TARGET" "docker --version")
  log_info "服务器 Docker: $docker_version"

  # docker compose v2 检查
  if ! ssh "$SSH_TARGET" "docker compose version" &> /dev/null 2>&1; then
    log_error "服务器 Docker Compose v2 未安装"
    exit 1
  fi

  docker_compose_version=$(ssh "$SSH_TARGET" "docker compose version")
  log_info "服务器 Docker Compose: $docker_compose_version"

  # .env.production 检查
  if ! ssh "$SSH_TARGET" "test -f $REMOTE_REPO/.env.production"; then
    log_error ".env.production 不存在于服务器，请先复制 .env.production.example 为 .env.production 并填写真实值"
    exit 1
  fi

  # SSL 证书提示
  if ! ssh "$SSH_TARGET" "test -f $REMOTE_REPO/docker/nginx/ssl/fullchain.pem" &> /dev/null; then
    log_warn "SSL 证书未找到，将只启用 HTTP"
    log_warn "如需 HTTPS，请将证书放入 $REMOTE_REPO/docker/nginx/ssl/"
  fi

  log_info "服务器前置条件检查通过"
}

# ---------- 代码同步（Git） ----------
sync_code() {
  log_step "同步代码到服务器 (git pull)..."

  ssh "$SSH_TARGET" "cd $REMOTE_REPO && git pull origin master 2>&1 || git pull origin main 2>&1"
  log_info "代码同步完成"
}

# ---------- 启动生产服务 ----------
start_services() {
  log_step "启动生产服务..."

  ssh "$SSH_TARGET" "cd $REMOTE_REPO && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build 2>&1"

  log_info "等待服务启动（30秒）..."
  sleep 30

  # 健康检查
  local max_wait=60
  local waited=0
  while [ $waited -lt $max_wait ]; do
    if ssh "$SSH_TARGET" "curl -sf http://localhost/api/health" &> /dev/null; then
      log_info "后端健康检查通过"
      return 0
    fi
    echo "  等待中... ($((waited + 5))s / ${max_wait}s)"
    sleep 5
    waited=$((waited + 5))
  done

  log_warn "健康检查超时，请手动检查：./deploy.sh logs $SSH_TARGET $REMOTE_REPO backend"
  return 1
}

# ---------- 初始化 ----------
cmd_init() {
  log_info "========== 首次部署初始化 =========="
  check_local_prereq
  check_args
  check_server_prereq
  sync_code
  start_services

  log_info ""
  log_info "========== 部署完成 =========="
  cmd_status
}

# ---------- 更新部署 ----------
cmd_deploy() {
  log_info "========== 更新部署 =========="
  check_local_prereq
  check_args

  # 快速检查服务器就绪（跳过重复检查）
  sync_code
  start_services

  log_info "========== 更新完成 =========="
  cmd_status
}

# ---------- 查看状态 ----------
cmd_status() {
  check_args
  echo ""
  ssh "$SSH_TARGET" "cd $REMOTE_REPO && docker compose -f docker-compose.prod.yml --env-file .env.production ps"
  echo ""
  local health
  health=$(ssh "$SSH_TARGET" "curl -sf http://localhost/api/health 2>&1" || echo "FAILED")
  log_info "API 健康状态: $health"
}

# ---------- 查看日志 ----------
cmd_logs() {
  check_args
  local service="${1:-}"
  if [ -n "$service" ]; then
    ssh "$SSH_TARGET" "cd $REMOTE_REPO && docker compose -f docker-compose.prod.yml --env-file .env.production logs -f $service"
  else
    ssh "$SSH_TARGET" "cd $REMOTE_REPO && docker compose -f docker-compose.prod.yml logs -f"
  fi
}

# ---------- 停止服务 ----------
cmd_stop() {
  check_args
  log_info "停止所有服务..."
  ssh "$SSH_TARGET" "cd $REMOTE_REPO && docker compose -f docker-compose.prod.yml --env-file .env.production down"
  log_info "服务已停止"
}

# ---------- 清理 Docker 资源 ----------
cmd_clean() {
  check_args
  log_warn "清理未使用的 Docker 资源（镜像/卷/网络）..."
  ssh "$SSH_TARGET" "docker system prune -f"
  log_info "清理完成"
}

# ---------- 主入口 ----------
SSH_TARGET="${2:-}"
REMOTE_REPO="${3:-}"

case "${1:-}" in
  init)
    cmd_init
    ;;
  deploy|update)
    cmd_deploy
    ;;
  status|ps)
    cmd_status
    ;;
  logs)
    cmd_logs "$4"
    ;;
  stop|down)
    cmd_stop
    ;;
  clean)
    cmd_clean
    ;;
  *)
    echo ""
    echo "=========================================="
    echo "  视频课程分销系统 — 纯 Docker 部署"
    echo "=========================================="
    echo ""
    echo "  用法: $0 {init|deploy|status|logs|stop|clean} user@server.com /path/to/repo [service]"
    echo ""
    echo "  示例:"
    echo "    首次部署: $0 init  ubuntu@129.204.199.134 /home/ubuntu/course-distribute"
    echo "    更新部署: $0 deploy ubuntu@129.204.199.134 /home/ubuntu/course-distribute"
    echo "    查看状态: $0 status ubuntu@129.204.199.134 /home/ubuntu/course-distribute"
    echo "    查看日志: $0 logs  ubuntu@129.204.199.134 /home/ubuntu/course-distribute backend"
    echo "    停止服务: $0 stop  ubuntu@129.204.199.134 /home/ubuntu/course-distribute"
    echo ""
    echo "  纯 Docker 原则:"
    echo "    - 服务器无需安装 Node.js/npm"
    echo "    - 前端/后端均在 Docker 容器内构建"
    echo "    - 配置文件: docker-compose.prod.yml（独立完整）"
    echo ""
    exit 1
    ;;
esac
