#!/bin/sh
set -e

# 确保测试环境变量传递到所有子进程
export NODE_ENV="${NODE_ENV:-test}"

echo "[entrypoint] NODE_ENV=$NODE_ENV"

echo "[entrypoint] 等待 MySQL 就绪..."

MAX_RETRIES=30
RETRY_INTERVAL=3

for i in $(seq 1 $MAX_RETRIES); do
  if mysqladmin ping -h "$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" --silent --skip-ssl 2>/dev/null; then
    echo "[entrypoint] MySQL 已就绪"
    break
  fi
  echo "[entrypoint] MySQL 未就绪，等待 ${RETRY_INTERVAL}s... ($i/$MAX_RETRIES)"
  sleep $RETRY_INTERVAL
done

echo "[entrypoint] 启动应用: $@"
exec "$@"
