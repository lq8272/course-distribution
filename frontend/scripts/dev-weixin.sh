#!/bin/bash
# dev-weixin.sh — 启动微信小程序开发服务，编译完成自动复制 static/
cd /mnt/d/软件项目/Videos/course-distribute/frontend

npm run dev:mp-weixin &
VITE_PID=$!

echo "[dev-weixin] waiting for initial build..."
while true; do
  if grep -q "Build complete" /tmp/vite-dev.log 2>/dev/null; then
    echo "[dev-weixin] build complete, copying static..."
    node -e "
      const fs = require('fs'), path = require('path')
      const src = path.join('$PWD', 'static')
      const dst = path.join('$PWD', 'dist/dev/mp-weixin/static')
      fs.rmSync(dst, {recursive:true, force:true})
      fs.mkdirSync(dst, {recursive:true})
      fs.cpSync(src, dst, {recursive:true})
      console.log('[dev-weixin] static copied')
    "
    break
  fi
  sleep 2
done

echo "[dev-weixin] done, watching for changes..."

# 继续监听 Vite 输出，增量编译完成后也复制 static
tail -f /tmp/vite-dev.log | while read line; do
  if echo "$line" | grep -q "Build complete"; then
    echo "[dev-weixin] incremental build done, copying static..."
    node -e "
      const fs = require('fs'), path = require('path')
      const src = path.join('$PWD', 'static')
      const dst = path.join('$PWD', 'dist/dev/mp-weixin/static')
      try {
        fs.rmSync(dst, {recursive:true, force:true})
        fs.mkdirSync(dst, {recursive:true})
        fs.cpSync(src, dst, {recursive:true})
        console.log('[dev-weixin] static copied')
      } catch(e) { console.error('copy failed:', e.message) }
    "
  fi
done
