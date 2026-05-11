#!/usr/bin/env bash
# ============================================================
# deploy-production.sh — 一键生产部署脚本（Linux/macOS）
#
# 使用前提：
#   1. 已完成域名备案
#   2. 已将 .env.production.example 复制为 .env.production 并填写真实值
#   3. SSL 证书已放入 docker/nginx/ssl/
#
# 使用方法：
#   bash scripts/deploy-production.sh
# ============================================================

set -e
cd "$(dirname "$0")/.."

echo "========================================"
echo "  视频课程分销 - 生产部署脚本"
echo "========================================"
echo ""

# ---------- 1. 前置检查 ----------
echo "[1/5] 前置检查..."
if [ ! -f ".env.production" ]; then
    echo "  ERROR: .env.production 不存在"
    echo "  请先复制 .env.production.example 为 .env.production 并填写真实值"
    exit 1
fi

SSL_CERT="./docker/nginx/ssl/fullchain.pem"
SSL_KEY="./docker/nginx/ssl/privkey.pem"
if [ ! -f "$SSL_CERT" ] || [ ! -f "$SSL_KEY" ]; then
    echo "  WARNING: SSL 证书未找到"
    echo "  如需 HTTPS，请将证书放入 docker/nginx/ssl/ 目录"
fi

if ! command -v docker &> /dev/null; then
    echo "  ERROR: Docker 未安装"
    exit 1
fi
echo "  Docker: OK"

# ---------- 2. 构建前端 ----------
echo ""
echo "[2/5] 构建前端生产版本..."
cd frontend
npm run build:mp-weixin

# 复制 static 目录
node -e "
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'static');
const dst = path.join(__dirname, 'dist', 'build', 'mp-weixin', 'static');
if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.cpSync(src, dst, { recursive: true });
    console.log('static/ copied');
} else {
    console.log('static/ not found, skipping');
}
"
cd ..

# ---------- 3. 启动生产服务 ----------
echo ""
echo "[3/5] 启动生产服务（MySQL + Redis + Backend + Nginx）..."

set +e
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile production up -d --build
SETUP_EXIT=$?
set -e

if [ $SETUP_EXIT -ne 0 ]; then
    echo "  ERROR: Docker Compose 启动失败"
    exit 1
fi

echo "  服务启动中，等待健康检查（30秒）..."
sleep 30

# 检查后端
BACKEND_OK=false
for i in $(seq 1 6); do
    if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        BACKEND_OK=true
        break
    fi
    echo "  等待后端就绪... ($i/6)"
    sleep 5
done

if $BACKEND_OK; then
    echo "  后端健康检查: OK"
else
    echo "  WARNING: 后端健康检查未通过，请检查容器日志"
    echo "  查看日志: docker compose -f docker-compose.yml -f docker-compose.prod.yml logs backend"
fi

# 检查 Nginx
if curl -sf http://localhost/api/health > /dev/null 2>&1; then
    echo "  Nginx 代理: OK"
else
    echo "  WARNING: Nginx 未就绪（检查 SSL 证书配置）"
fi

# ---------- 4. 监控栈 ----------
echo ""
echo "[4/5] 监控栈（Prometheus + Grafana，可选）..."
read -p "  是否启动监控栈？(y/N): " ans
if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
    docker compose -f docker-compose.yml -f docker-compose.monitoring.yml --profile monitoring up -d
    echo "  Prometheus: http://localhost:9090"
    echo "  Grafana:    http://localhost:3001 （admin/admin123）"
fi

# ---------- 5. 完成 ----------
echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
echo "  API 地址:    https://你的域名.com/api"
echo "  小程序导入:  frontend/dist/build/mp-weixin"
echo ""
echo "  常用命令:"
echo "    查看日志: docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend"
echo "    停止服务: docker compose -f docker-compose.yml -f docker-compose.prod.yml down"
echo ""
