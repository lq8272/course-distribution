#!/usr/bin/env bash
# ============================================================
# deploy-production.sh — 纯 Docker 生产部署脚本（Linux/macOS）
#
# 核心原则：服务器上所有构建均在 Docker 容器内完成，无需在服务器安装 Node.js
#
# 使用方式：
#   首次部署：./scripts/deploy-production.sh init user@server.com /path/to/repo
#   更新部署：./scripts/deploy-production.sh deploy user@server.com /path/to/repo
#   查看状态：./scripts/deploy-production.sh status user@server.com /path/to/repo
#   查看日志：./scripts/deploy-production.sh logs user@server.com /path/to/repo [service]
#   停止服务：./scripts/deploy-production.sh stop user@server.com /path/to/repo
# ============================================================

set -e

SSH_TARGET="${2:-}"
REMOTE_REPO="${3:-}"
SERVICE="${4:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $1"; }

check_args() {
  local need_server=1
  case "$1" in
    status|stop|clean) need_server=0 ;;
  esac
  if [ $need_server -eq 1 ] && [ -z "$SSH_TARGET" ] || [ -z "$REMOTE_REPO" ]; then
    echo "用法: $0 {init|deploy|status|logs|stop|clean} user@server.com /path/to/repo [service]"
    echo ""
    echo "  示例: $0 init  ubuntu@129.204.199.134 /home/ubuntu/course-distribute"
    echo "        $0 deploy ubuntu@129.204.199.134 /home/ubuntu/course-distribute"
    echo "        $0 logs  ubuntu@129.204.199.134 /home/ubuntu/course-distribute backend"
    exit 1
  fi
}

ssh_cmd() {
  ssh -o StrictHostKeyChecking=no "$SSH_TARGET" "$@"
}

check_local() {
  log_info "检查本地前置条件..."
  command -v ssh &>/dev/null || { log_error "SSH 客户端未安装"; exit 1; }
  command -v docker &>/dev/null || { log_error "Docker 未安装"; exit 1; }
  log_info "本地前置条件检查通过"
}

check_server() {
  log_step "检查服务器前置条件..."
  log_info "Docker: $(ssh_cmd "docker --version")"
  log_info "Compose: $(ssh_cmd "docker compose version")"
  ssh_cmd "test -f $REMOTE_REPO/.env.production" || { log_error ".env.production 不存在"; exit 1; }
  log_info "服务器前置条件检查通过"
}

sync_code() {
  log_step "同步代码 (git pull)..."
  ssh_cmd "cd $REMOTE_REPO && git pull origin master 2>&1 || git pull origin main 2>&1"
  log_info "代码同步完成"
}

start_services() {
  log_step "启动生产服务 (docker compose up -d --build)..."
  ssh_cmd "cd $REMOTE_REPO && docker compose -f docker-compose.prod.yml up -d --build 2>&1"
  log_info "等待服务启动（30秒）..."
  sleep 30

  local max_wait=60 waited=0
  while [ $waited -lt $max_wait ]; do
    if ssh_cmd "curl -sf http://localhost/api/health" &>/dev/null; then
      log_info "后端健康检查通过"
      return 0
    fi
    echo "  等待中... ($((waited + 5))s / ${max_wait}s)"
    sleep 5
    waited=$((waited + 5))
  done
  log_warn "健康检查超时，请查看日志"
}

case "${1:-}" in
  init)
    check_args init
    check_local
    check_server
    sync_code
    start_services
    ;;
  deploy|update)
    check_args deploy
    check_local
    sync_code
    start_services
    ;;
  status)
    check_args status
    echo ""
    ssh_cmd "cd $REMOTE_REPO && docker compose -f docker-compose.prod.yml ps"
    echo ""
    log_info "API: $(ssh_cmd "curl -sf http://localhost/api/health")"
    ;;
  logs)
    check_args logs
    if [ -n "$SERVICE" ]; then
      ssh_cmd "cd $REMOTE_REPO && docker compose -f docker-compose.prod.yml logs -f $SERVICE"
    else
      ssh_cmd "cd $REMOTE_REPO && docker compose -f docker-compose.prod.yml logs -f"
    fi
    ;;
  stop)
    check_args stop
    log_info "停止所有服务..."
    ssh_cmd "cd $REMOTE_REPO && docker compose -f docker-compose.prod.yml down"
    log_info "服务已停止"
    ;;
  clean)
    check_args clean
    log_warn "清理 Docker 资源..."
    ssh_cmd "docker system prune -f"
    ;;
  *)
    echo "用法: $0 {init|deploy|status|logs|stop|clean} user@server.com /path/to/repo [service]"
    echo ""
    echo "  纯 Docker 原则：服务器无需 Node.js/npm，所有构建在容器内完成"
    exit 1
    ;;
esac
