#!/bin/bash
# ============================================================
# deploy.sh — 视频课程分销系统生产环境部署脚本
#
# 用法：
#   首次部署：./deploy.sh init
#   更新部署：./deploy.sh deploy
#   查看状态：./deploy.sh status
#   查看日志：./deploy.sh logs [service]
#   停止服务：./deploy.sh stop
# ============================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ---------- 检查前置条件 ----------
check_prereq() {
  log_info "检查前置条件..."

  # Docker 检查
  if ! command -v docker &> /dev/null; then
    log_error "Docker 未安装，请先安装 Docker：https://docs.docker.com/get-docker/"
    exit 1
  fi
  if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
    log_error "Docker Compose 未安装，请先安装 Docker Compose v2"
    exit 1
  fi

  # .env.production 检查
  if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
    log_error ".env.production 文件不存在，请先创建："
    log_error "  cp .env.production.example .env.production"
    log_error "  然后编辑 .env.production 填入所有必填值"
    exit 1
  fi

  # 必填环境变量检查
  set -a
  source "$PROJECT_ROOT/.env.production"
  set +a

  local missing=""
  [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "YOUR_JWT_SECRET_CHANGE_THIS" ] && missing="$missing JWT_SECRET"
  [ -z "$MYSQL_ROOT_PASSWORD" ] || [ "$MYSQL_ROOT_PASSWORD" = "YOUR_STRONG_MYSQL_PASSWORD" ] && missing="$missing MYSQL_ROOT_PASSWORD"
  [ -z "$WECHAT_APPID" ] || [ "$WECHAT_APPID" = "YOUR_WECHAT_APPID" ] && missing="$missing WECHAT_APPID"
  [ -z "$WECHAT_SECRET" ] || [ "$WECHAT_SECRET" = "YOUR_WECHAT_SECRET" ] && missing="$missing WECHAT_SECRET"

  if [ -n "$missing" ]; then
    log_error "以下必填环境变量未配置：$missing"
    log_error "请编辑 .env.production 填入真实值"
    exit 1
  fi

  log_info "前置条件检查通过"
}

# ---------- 构建前端 ----------
build_frontend() {
  log_info "构建前端（微信小程序 H5 版）..."

  if [ ! -d "$PROJECT_ROOT/frontend/node_modules" ]; then
    log_info "安装前端依赖..."
    (cd "$PROJECT_ROOT/frontend" && npm ci --registry=https://registry.npmmirror.com)
  fi

  log_info "执行 npm run build:mp-weixin ..."
  (cd "$PROJECT_ROOT/frontend" && npm run build:mp-weixin)

  if [ ! -d "$PROJECT_ROOT/frontend/dist/build/mp-weixin" ]; then
    log_error "前端构建失败，输出目录不存在"
    exit 1
  fi

  log_info "前端构建完成"
}

# ---------- 构建后端 Docker 镜像 ----------
build_backend() {
  log_info "构建后端 Docker 镜像..."
  docker build -t course-backend:prod -f "$PROJECT_ROOT/backend/Dockerfile.prod" "$PROJECT_ROOT/backend"
}

# ---------- 启动服务 ----------
start_services() {
  log_info "启动生产服务..."

  # 加载环境变量
  set -a
  source "$PROJECT_ROOT/.env.production"
  set +a

  # 停止旧容器（如果存在）
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" \
                  -f "$PROJECT_ROOT/docker-compose.prod.yml" \
                  --profile production down 2>/dev/null || true

  # 启动
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" \
                 -f "$PROJECT_ROOT/docker-compose.prod.yml" \
                 --profile production up -d

  log_info "等待服务启动..."
  sleep 10

  # 健康检查
  local max_wait=60
  local waited=0
  while [ $waited -lt $max_wait ]; do
    if curl -sf http://localhost/api/health > /dev/null 2>&1; then
      log_info "后端健康检查通过"
      return 0
    fi
    sleep 2
    waited=$((waited + 2))
  done

  log_error "后端健康检查超时，请检查日志：./deploy.sh logs backend"
  return 1
}

# ---------- 初始化（首次部署） ----------
cmd_init() {
  log_info "========== 首次部署初始化 =========="
  check_prereq
  build_frontend
  build_backend
  start_services

  log_info ""
  log_info "========== 部署完成 =========="
  log_info "服务状态："
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" \
                 -f "$PROJECT_ROOT/docker-compose.prod.yml" ps
  log_info ""
  log_info "访问地址："
  log_info "  HTTP:  http://localhost:80"
  log_info "  API:   http://localhost/api/health"
  log_info ""
  log_warn "下一步："
  log_warn "  1. 在微信公众平台配置服务器域名"
  log_warn "  2. 用微信开发者工具导入 frontend/dist/build/mp-weixin"
  log_warn "  3. 上传审核前先在微信开发者工具中完整测试一遍"
}

# ---------- 更新部署 ----------
cmd_deploy() {
  log_info "========== 更新部署 =========="
  check_prereq
  build_frontend

  set -a
  source "$PROJECT_ROOT/.env.production"
  set +a

  log_info "重启后端容器（加载新代码）..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" \
                 -f "$PROJECT_ROOT/docker-compose.prod.yml" \
                 --profile production up -d --build backend

  sleep 5
  health_check
}

# ---------- 健康检查 ----------
health_check() {
  log_info "API 健康检查..."
  if curl -sf http://localhost/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'MySQL: {d[\"mysql\"]}, Redis: {d[\"redis\"]}, Status: {d[\"status\"]}')" 2>/dev/null; then
    log_info "健康检查通过"
  else
    log_error "健康检查失败"
    exit 1
  fi
}

# ---------- 查看状态 ----------
cmd_status() {
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" \
                 -f "$PROJECT_ROOT/docker-compose.prod.yml" ps
  echo ""
  health_check || true
}

# ---------- 查看日志 ----------
cmd_logs() {
  local service="${1:-}"
  if [ -n "$service" ]; then
    docker compose -f "$PROJECT_ROOT/docker-compose.yml" \
                   -f "$PROJECT_ROOT/docker-compose.prod.yml" logs -f "$service"
  else
    docker compose -f "$PROJECT_ROOT/docker-compose.yml" \
                   -f "$PROJECT_ROOT/docker-compose.prod.yml" logs -f
  fi
}

# ---------- 停止服务 ----------
cmd_stop() {
  log_info "停止所有服务..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" \
                 -f "$PROJECT_ROOT/docker-compose.prod.yml" \
                 --profile production down
  log_info "服务已停止"
}

# ---------- 启动监控服务 ----------
cmd_monitoring() {
  log_info "启动监控服务（Prometheus + Grafana + Alertmanager）..."

  set -a
  source "$PROJECT_ROOT/.env.production"
  set +a

  docker compose -f "$PROJECT_ROOT/docker-compose.yml" \
                 -f "$PROJECT_ROOT/docker-compose.monitoring.yml" \
                 --profile monitoring up -d

  log_info "监控服务已启动："
  log_info "  Prometheus:   http://localhost:9090"
  log_info "  Grafana:      http://localhost:3001"
  log_info "  Alertmanager: http://localhost:9093"
  log_info ""
  log_warn "告警 Webhook 配置："
  log_warn "  ALERT_WEBHOOK_URL=${ALERT_WEBHOOK_URL:-未设置}"
  log_warn "  ALERT_WEBHOOK_CRITICAL_URL=${ALERT_WEBHOOK_CRITICAL_URL:-未设置}"
}

# ---------- 停止监控服务 ----------
cmd_monitoring_stop() {
  log_info "停止监控服务..."
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" \
                 -f "$PROJECT_ROOT/docker-compose.monitoring.yml" \
                 --profile monitoring down
  log_info "监控服务已停止"
}

# ---------- 主入口 ----------
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
    cmd_logs "$2"
    ;;
  stop|down)
    cmd_stop
    ;;
  health)
    health_check
    ;;
  monitoring)
    cmd_monitoring
    ;;
  monitoring-stop)
    cmd_monitoring_stop
    ;;
  *)
    echo "用法: $0 {init|deploy|status|logs|stop|health|monitoring|monitoring-stop}"
    echo ""
    echo "  init              — 首次部署（构建+启动）"
    echo "  deploy            — 更新部署（只重新构建+重启变更服务）"
    echo "  status            — 查看服务状态"
    echo "  logs              — 查看日志（可指定服务名）"
    echo "  stop              — 停止所有服务"
    echo "  health            — 健康检查"
    echo "  monitoring        — 启动监控服务（Prometheus+Grafana+Alertmanager）"
    echo "  monitoring-stop   — 停止监控服务"
    exit 1
    ;;
esac
