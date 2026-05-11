#!/bin/sh
# ============================================================
# 视频课程分销系统 — 上线前检查脚本
# ============================================================
# 用法：sh scripts/launch-check.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo "${GREEN}[PASS]${NC} $1"; }
fail() { echo "${RED}[FAIL]${NC} $1"; }
warn() { echo "${YELLOW}[WARN]${NC} $1"; }
info() { echo "${BLUE}[INFO]${NC} $1"; }
section() { echo ""; echo "==== $1 ===="; }

# ---------- 加载 .env ----------
load_env() {
  if [ -f "$BACKEND_DIR/.env" ]; then
    set -a
    . "$BACKEND_DIR/.env"
    set +a
  fi
}

# ============================================================
section "1. 文件存在性检查"
# ============================================================

check_file() {
  if [ -f "$1" ]; then
    pass "文件存在: $1"
    return 0
  else
    fail "文件缺失: $1"
    return 1
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    pass "目录存在: $1"
    return 0
  else
    fail "目录缺失: $1"
    return 1
  fi
}

check_file "$BACKEND_DIR/.env"
check_file "$BACKEND_DIR/.env.production"
check_file "$PROJECT_DIR/docker-compose.yml"
check_file "$PROJECT_DIR/docker/nginx/conf.d/default.conf"

# ============================================================
section "2. 生产配置检查"
# ============================================================

load_env

check_production_config() {
  local key="$1"
  # 直接用 grep 读取 .env，不走 eval（避免 *** 等字符被 glob 展开）
  local value
  value="$(grep -m1 "^${key}=" "$BACKEND_DIR/.env" 2>/dev/null | sed "s/^[^=]*=//" | sed "s/^['\"]//;s/['\"]$//")"
  local display="${2:-$value}"

  # YOUR_/change_me/placeholder 视为缺失
  if [ -z "$value" ] || echo "$value" | grep -qiE "YOUR_|your_|change_me|placeholder|^undefined$|^[*]+$" 2>/dev/null; then
    fail "生产配置缺失/占位符: $key"
    return 1
  else
    pass "$key = $display"
    return 0
  fi
}

check_cors() {
  local origins="$CORS_ORIGINS"
  if [ "$origins" = "*" ]; then
    warn "CORS_ORIGINS = * (生产环境建议填写具体域名)"
  elif [ -z "$origins" ]; then
    fail "CORS_ORIGINS 未配置"
  else
    pass "CORS_ORIGINS = $origins"
  fi
}

check_node_env() {
  if [ "$NODE_ENV" = "production" ]; then
    pass "NODE_ENV = production"
  else
    warn "NODE_ENV = $NODE_ENV (建议设为 production)"
  fi
}

check_production_config "WECHAT_APPID" "${WECHAT_APPID:0:8}***"
check_production_config "WECHAT_SECRET" "***"
check_production_config "JWT_SECRET"
check_production_config "JWT_REFRESH_SECRET"
check_production_config "PROMO_BASE_URL"
check_production_config "DB_PASSWORD" "***"
check_cors
check_node_env

# 检查前端 BASE_URL 是否为正式域名
FRONTEND_BASE_URL="$(grep -m1 "BASE_URL" "$FRONTEND_DIR/src/config/index.js" 2>/dev/null | sed "s|.*BASE_URL.*=['\"]\(https\?://[^'\"]*\)['\"].*|\1|")"
info "前端 BASE_URL = $FRONTEND_BASE_URL"
if [ -z "$FRONTEND_BASE_URL" ]; then
  warn "前端 BASE_URL 未找到或格式异常"
elif echo "$FRONTEND_BASE_URL" | grep -qE "192\.168\.|10\.|172\.|localhost|127\.0\.0\.1"; then
  fail "前端 BASE_URL 使用内网 IP 或 localhost，需改为正式域名"
elif echo "$FRONTEND_BASE_URL" | grep -q "^http://"; then
  warn "前端 BASE_URL 使用 HTTP，建议改为 HTTPS"
else
  pass "前端 BASE_URL 配置正确"
fi

# ============================================================
section "3. Docker 容器健康检查"
# ============================================================

check_health() {
  local container="$1"
  local port="$2"
  local health_path="${3:-/api/health}"

  # 检查容器是否运行
  running=$(docker ps --format "{{.Names}}" 2>/dev/null | grep "^${container}$" || true)
  if [ -z "$running" ]; then
    fail "容器未运行: $container"
    return 1
  fi

  # 检查健康状态（有 healthcheck 的容器）
  health=$(docker inspect --format "{{.State.Health.Status}}" "$container" 2>/dev/null || echo "no-healthcheck")
  if [ "$health" = "healthy" ]; then
    pass "容器健康: $container"
  elif [ "$health" = "no-healthcheck" ]; then
    warn "容器无健康检查: $container"
  else
    fail "容器不健康: $container (status=$health)"
  fi

  # 仅对 HTTP 服务检查端口（MySQL/Redis 不适用）
  if [ -n "$port" ] && echo "$health_path" | grep -q "^/"; then
    sleep 1
    if curl -sf --connect-timeout 5 "http://127.0.0.1:${port}${health_path}" > /dev/null 2>&1; then
      pass "端口响应正常: 127.0.0.1:$port$health_path"
    else
      fail "端口无响应: 127.0.0.1:$port$health_path"
    fi
  fi
}

check_health "course_mysql" "3306"
check_health "course_redis" "6379"
check_health "course_backend" "3000" "/api/health"

# ============================================================
section "4. 数据库检查"
# ============================================================

check_db_sql() {
  local sql="$1"
  docker exec course_mysql mysql -uroot -p"${DB_PASSWORD:-root123}" -sNe "$sql" 2>/dev/null | tail -1
}

check_table() {
  local table="$1"
  count=$(check_db_sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='course_distribute' AND table_name='$table';")
  if [ "$count" = "1" ]; then
    pass "数据表存在: $table"
  else
    fail "数据表缺失: $table"
  fi
}

check_column() {
  local table="$1"
  local col="$2"
  local exists=$(check_db_sql "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='course_distribute' AND table_name='$table' AND column_name='$col';")
  if [ "$exists" = "1" ]; then
    pass "字段存在: $table.$col"
  else
    fail "字段缺失: $table.$col"
  fi
}

check_table "users"
check_table "agents"
check_table "promotion_codes"
check_table "orders"
check_table "commissions"
check_table "courses"
check_table "teams"

# 检查关键字段
check_column "users" "openid"
check_column "users" "is_admin"
check_column "agents" "status"
check_column "agents" "referral_count"
check_column "commissions" "level"
check_column "commissions" "status"

# ============================================================
section "5. 后端 API 接口检查"
# ============================================================

check_api() {
  local method="$1"
  local path="$2"
  local expected_code="${3:-200}"
  local body="$4"

  local url="http://127.0.0.1:3000${path}"
  local actual_code

  if [ "$method" = "GET" ]; then
    actual_code=$(curl -sf -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  else
    actual_code=$(curl -sf -o /dev/null -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$body" "$url" 2>/dev/null || echo "000")
  fi

  # 截取前3位（HTTP状态码）
  actual_code="$(echo "$actual_code" | cut -c1-3)"

  if [ "$actual_code" = "$expected_code" ]; then
    pass "[$method] $path → $actual_code"
  else
    fail "[$method] $path → $actual_code (期望 $expected_code)"
  fi
}

check_api "GET" "/api/health"
check_api "POST" "/api/auth/login" "400" '{"code":""}'
check_api "POST" "/api/auth/login" "400" '{"code":"test_check","nickname":""}'

# 测试登录（test_ 前缀走后端 mock 逻辑）
LOGIN_RESP=$(curl -sf -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test_launch_check","nickname":"上线检查"}' 2>/dev/null)
TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || true)

if [ -n "$TOKEN" ]; then
  pass "POST /api/auth/login → 成功获取 token"

  # 测试 userinfo
  USERINFO_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    http://127.0.0.1:3000/api/auth/userinfo 2>/dev/null || echo "000")
  if [ "$USERINFO_CODE" = "200" ]; then
    pass "GET /api/auth/userinfo (带 token) → 200"
  else
    fail "GET /api/auth/userinfo (带 token) → $USERINFO_CODE"
  fi

  # 测试无 token 访问
  NOAUTH_RESP=$(curl -sf -o /dev/null -w "%{http_code}" \
    http://127.0.0.1:3000/api/auth/userinfo 2>/dev/null || echo "000")
  NOAUTH_CODE="$(echo "$NOAUTH_RESP" | cut -c1-3)"
  if [ "$NOAUTH_CODE" = "401" ]; then
    pass "GET /api/auth/userinfo (无 token) → 401 (正确拦截)"
  else
    fail "GET /api/auth/userinfo (无 token) → $NOAUTH_CODE (期望 401)"
  fi

  # 测试 refresh token
  REFRESH_RESP=$(curl -sf -X POST http://127.0.0.1:3000/api/auth/refresh \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"$(echo $LOGIN_RESP | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)\"}" 2>/dev/null)
  if echo "$REFRESH_RESP" | grep -q '"code":0'; then
    pass "POST /api/auth/refresh → 成功续期"
  else
    fail "POST /api/auth/refresh → 失败"
  fi

  # 检查推广码 API（promotion_codes 表应在 init.sql 中创建）
  PROMO_COUNT=$(check_db_sql "SELECT COUNT(*) FROM course_distribute.promotion_codes;")
  if [ -n "$PROMO_COUNT" ] && [ "$PROMO_COUNT" -ge "0" ] 2>/dev/null; then
    pass "推广码表可查询: promotion_codes (count=$PROMO_COUNT)"
  else
    warn "推广码表查询异常: count=$PROMO_COUNT"
  fi

else
  fail "POST /api/auth/login → 未获取到 token"
fi

# ============================================================
section "6. Nginx 配置检查"
# ============================================================

if docker ps --format "{{.Names}}" 2>/dev/null | grep -q "^course_nginx$"; then
  nginx_running=true
  pass "Nginx 容器运行中"

  # 检查 Nginx 配置语法
  if docker exec course_nginx nginx -t 2>/dev/null; then
    pass "Nginx 配置语法正确"
  else
    fail "Nginx 配置语法错误"
  fi
else
  warn "Nginx 容器未启动 (生产环境需启动)"
fi

# ============================================================
section "7. 微信小程序配置检查"
# ============================================================

WX_APPID_PATTERN='wxa[0-9a-f]{16}'
if echo "$WECHAT_APPID" | grep -qiE "$WX_APPID_PATTERN"; then
  pass "微信 AppID 格式正确: ${WECHAT_APPID}"
else
  fail "微信 AppID 未配置或格式错误: $WECHAT_APPID"
fi

if echo "$WECHAT_SECRET" | grep -qiE "^[a-f0-9]{32}$"; then
  pass "微信 AppSecret 已配置"
else
  fail "微信 AppSecret 未配置或格式错误"
fi

# ============================================================
section "8. 前端构建产物检查"
# ============================================================

check_production_dist() {
  local dist_dir="$FRONTEND_DIR/dist/build/mp-weixin"
  if [ -d "$dist_dir" ]; then
    pass "前端构建产物存在: $dist_dir"

    # 检查关键文件
    for f in "app.js" "app.json" "pages/login/index.js"; do
      if [ -f "$dist_dir/$f" ]; then
        pass "  关键文件: $f"
      else
        fail "  关键文件缺失: $f"
      fi
    done
  else
    warn "前端构建产物不存在: $dist_dir (生产部署前需运行 npm run build:mp-weixin)"
  fi
}

check_production_dist

# ============================================================
section "9. SSL/HTTPS 检查（生产必需）"
# ============================================================

if [ -f "$PROJECT_DIR/docker/nginx/ssl/fullchain.pem" ] && [ -f "$PROJECT_DIR/docker/nginx/ssl/privkey.pem" ]; then
  pass "SSL 证书文件存在"
else
  warn "SSL 证书文件缺失 (生产环境需配置 HTTPS)"
fi

# ============================================================
section "10. 安全检查"
# ============================================================

# ---------- 安全检查 ----------
JWTSECRET_VAL="$(grep -m1 "^JWT_SECRET=" "$BACKEND_DIR/.env" 2>/dev/null | sed "s/^[^=]*=//")"
if echo "$JWTSECRET_VAL" | grep -qiE "your_jwt|change_me|secret123|^[*]+$"; then
  fail "JWT_SECRET 使用了默认/弱值"
else
  pass "JWT_SECRET 配置正常"
fi

# 检查 CORS
if [ "$CORS_ORIGINS" = "*" ]; then
  warn "CORS_ORIGINS = * (生产环境建议限制具体域名)"
else
  pass "CORS_ORIGINS 已限制"
fi

# 检查 NODE_ENV
if [ "$NODE_ENV" = "production" ]; then
  pass "NODE_ENV = production"
else
  warn "NODE_ENV = $NODE_ENV (生产部署前设为 production)"
fi

# ============================================================
section "总结"
# ============================================================

echo ""
echo "上线前请确保："
echo "  1. 所有 FAIL 项已修复"
echo "  2. 微信后台已配置服务器域名 (request/ws 合法域名)"
echo "  3. 前端已执行 npm run build:mp-weixin"
echo "  4. docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
echo ""
echo "参考文档："
echo "  生产配置：backend/.env.production"
echo "  上线步骤：docs/部署文档.md"
