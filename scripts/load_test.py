#!/usr/bin/env python3
"""
轻量级 API 压测脚本
用法: python3 load_test.py [并发数] [持续秒数]
默认: 100 并发, 30 秒
"""

import sys
import time
import threading
import requests
from collections import defaultdict

BASE_URL = "http://127.0.0.1:3000"
CONCURRENCY = int(sys.argv[1]) if len(sys.argv) > 1 else 100
DURATION = int(sys.argv[2]) if len(sys.argv) > 2 else 30

# 关键 API 路径
ENDPOINTS = [
    ("GET", "/api/health", None),
    ("GET", "/api/course/list", None),
    ("GET", "/api/agent/levels", None),
]

results = defaultdict(list)
stop_flag = threading.Event()
stats_lock = threading.Lock()

def worker(endpoint_idx):
    """每个线程循环发请求直到超时"""
    method, path, body = ENDPOINTS[endpoint_idx]
    url = BASE_URL + path
    while not stop_flag.is_set():
        start = time.perf_counter()
        try:
            r = requests.request(method, url, json=body, timeout=5)
            elapsed = (time.perf_counter() - start) * 1000
            status = r.status_code
        except Exception as e:
            elapsed = (time.perf_counter() - start) * 1000
            status = 0
        with stats_lock:
            results[(method, path)].append((elapsed, status))

def get_stats(values):
    """计算统计数据"""
    vals = sorted(values)
    count = len(vals)
    if count == 0:
        return "N/A"
    avg = sum(vals) / count
    p50 = vals[int(count * 0.50)]
    p95 = vals[int(count * 0.95)]
    p99 = vals[int(count * 0.99)]
    return f"{count} req | avg={avg:.0f}ms | p50={p50:.0f}ms | p95={p95:.0f}ms | p99={p99:.0f}ms"

# 预热
print("预热中...", end=" ")
for method, path, body in ENDPOINTS:
    try:
        requests.request(method, BASE_URL + path, json=body, timeout=5)
    except:
        pass
print("完成")

print(f"\n{'='*60}")
print(f"压测开始: {CONCURRENCY} 并发 | {DURATION} 秒 | {BASE_URL}")
print(f"{'='*60}")

# 启动线程
threads = []
for i in range(CONCURRENCY):
    t = threading.Thread(target=worker, args=(i % len(ENDPOINTS),))
    t.start()
    threads.append(t)

# 运行指定时长
time.sleep(DURATION)
stop_flag.set()

# 等待结束
for t in threads:
    t.join(timeout=3)

# 打印结果
print(f"\n{'='*60}")
print(f"压测结果汇总 ({DURATION}秒 × {CONCURRENCY}并发)")
print(f"{'='*60}")

total_ok = 0
total_err = 0
for (method, path), data in sorted(results.items()):
    latencies = [d[0] for d in data]
    statuses = [d[1] for d in data]
    ok = sum(1 for s in statuses if 200 <= s < 300)
    err = len(statuses) - ok
    total_ok += ok
    total_err += err
    tag = "✓" if err == 0 else "✗"
    print(f"  {tag} {method} {path}")
    print(f"     {get_stats(latencies)} | 2xx={ok} | error={err}")

total = total_ok + total_err
print(f"\n总计: {total} 请求 | {total_ok} 成功 | {total_err} 失败")
print(f"QPS: {total / DURATION:.1f}")
