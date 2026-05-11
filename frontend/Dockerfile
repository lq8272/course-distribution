# ============================================================
# frontend/Dockerfile — 前端生产构建
#
# 多阶段构建：
#   Stage 1 (builder): node:18-alpine → npm build
#   Stage 2 (runtime): nginx:alpine → serve 静态文件
#
# 构建输出目录（uni-app 内部管理）：
#   dist/build/mp-weixin/
#
# 微信小程序 webview 版：
#   前端代码打包为 H5，放在 Nginx 中，由微信小程序 webview 标签加载。
#   微信中打开：https://yourdomain.com → 显示小程序 H5 页面
# ============================================================

# ---------- Stage 1: Build ----------
FROM node:18-alpine AS builder

WORKDIR /app

# 安装依赖（使用国内镜像加速）
COPY package*.json ./
RUN npm ci --registry=https://registry.npmmirror.com

# 复制源码并构建
COPY . .
RUN npm run build:mp-weixin

# ---------- Stage 2: Serve ----------
# 前端 H5 静态文件由 Nginx serve
# 如需独立运行此容器（不用 docker-compose），需先构建：
#   docker build --build-arg BUILDKIT_INLINE_CACHE=1 -t course-frontend .
#   docker run -p 80:80 course-frontend
FROM nginx:alpine

# Nginx 配置从项目根复制（需要 -f ../docker/nginx/... 或在 docker-compose 中覆盖）
# 本镜像默认使用 alpine 自带的 nginx.conf + conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist/build/mp-weixin /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
