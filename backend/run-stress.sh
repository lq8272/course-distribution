#!/bin/bash
# 快速压测脚本：用 curl + 文件分离状态码
# 用法: bash run-stress.sh [并发数] [持续秒数]

CONC=${1:-10}
SECS=${2:-5}
BASE="http://localhost:3000/api"

echo "========================================="
echo "  压测配置：并发 $CONC，持续 ${SECS}s"
echo "========================================="

# 获取 token
echo "获取 token..."
TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"code":"test_user_001","nickname":"压测"}' \
  | node -pe "try{JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).data.token}catch(e){''}")

if [ -z "$TOKEN" ]; then
  echo "❌ Token 获取失败"
  exit 1
fi
echo "✓ Token: ${TOKEN:0:20}..."

# 定义测试端点
declare -a ENDPOINTS=(
  "health|H|"
  "course/list|G|"
  "course/categories|G|"
  "auth/userinfo|G|$TOKEN"
  "commission/list|G|$TOKEN"
  "commission/stats|G|$TOKEN"
  "team/overview|G|$TOKEN"
  "order/my|G|$TOKEN"
)

for entry in "${ENDPOINTS[@]}"; do
  IFS='|' read -r name method token_arg <<< "$entry"
  path="$BASE/$name"

  ok=0
  fail=0
  start_time=$(date +%s%3N)

  # 计算结束时间戳（毫秒）
  end_ts=$(($(date +%s) * 1000 + SECS * 1000))

  while [ $(date +%s%3N) -lt $end_ts ]; do
    if [ -n "$token_arg" ]; then
      code=$(curl -s -o /tmp/curl_body.txt -w '%{http_code}' \
        -H "Authorization: Bearer $token_arg" \
        "$path" 2>/dev/null | grep -oE '[0-9]+$')
    else
      code=$(curl -s -o /tmp/curl_body.txt -w '%{http_code}' \
        "$path" 2>/dev/null | grep -oE '[0-9]+$')
    fi
    if [ -n "$code" ] && [ "$code" -ge 200 ] && [ "$code" -lt 500 ]; then
      ((ok++))
    else
      ((fail++))
    fi
  done

  end_time=$(date +%s%3N)
  elapsed=$((end_time - start_time))
  total=$((ok + fail))
  rps=$(echo "scale=1; $total / $SECS" | bc)
  err_rate=$(echo "scale=2; $fail * 100 / $total" | bc 2>/dev/null || echo "0")

  printf "%-25s RPS:%7s  成功:%5d  失败:%4d  错误率:%5s%%\n" "/$name" "$rps" "$ok" "$fail" "$err_rate"
done

echo "========================================="
echo "  压测完成"
echo "========================================="
