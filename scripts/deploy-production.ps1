#!/usr/bin/env pwsh
# ============================================================
# deploy-production.ps1 — 一键生产部署脚本
#
# 使用前提：
#   1. 已完成域名备案
#   2. 已将 .env.production.example 复制为 .env.production 并填写真实值
#   3. SSL 证书已放入 docker/nginx/ssl/
#   4. 当前环境：Windows + Docker Desktop
#
# 使用方法：
#   .\deploy-production.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $ProjectRoot) { $ProjectRoot = Get-Location }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  视频课程分销 - 生产部署脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---------- 1. 前置检查 ----------
Write-Host "[1/5] 前置检查..." -ForegroundColor Yellow

# 检查 .env.production
$envFile = Join-Path $ProjectRoot ".env.production"
if (-not (Test-Path $envFile)) {
    Write-Host "  ERROR: .env.production 不存在" -ForegroundColor Red
    Write-Host "  请先复制 .env.production.example 为 .env.production 并填写真实值" -ForegroundColor Red
    exit 1
}

# 检查 SSL 证书
$sslDir = Join-Path $ProjectRoot "docker\nginx\ssl"
$sslCert = Join-Path $sslDir "fullchain.pem"
$sslKey  = Join-Path $sslDir "privkey.pem"
if (-not (Test-Path $sslCert) -or -not (Test-Path $sslKey)) {
    Write-Host "  WARNING: SSL 证书未找到（$sslCert / $sslKey）" -ForegroundColor Yellow
    Write-Host "  如需 HTTPS，请将证书放入 docker\nginx\ssl\ 目录" -ForegroundColor Yellow
    Write-Host "  如仅需 HTTP 测试，可忽略此警告" -ForegroundColor Yellow
}

# 检查 Docker
try {
    docker version | Out-Null
    Write-Host "  Docker: OK" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Docker 未运行" -ForegroundColor Red
    exit 1
}

# ---------- 2. 构建前端 ----------
Write-Host ""
Write-Host "[2/5] 构建前端生产版本..." -ForegroundColor Yellow
$frontendDir = Join-Path $ProjectRoot "frontend"
Push-Location $frontendDir
try {
    npm run build:mp-weixin
    if ($LASTEXITCODE -ne 0) { throw "前端构建失败" }
    Write-Host "  前端构建成功" -ForegroundColor Green

    # 复制 static 目录（uni-app 编译会清空 dist/dev/static）
    node -e @"
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
"@
} finally {
    Pop-Location
}

# ---------- 3. 启动生产服务 ----------
Write-Host ""
Write-Host "[3/5] 启动生产服务（MySQL + Redis + Backend + Nginx）..." -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
    # 加载 .env.production 并启动
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
        }
    }

    docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile production up -d --build

    Write-Host "  服务启动中，等待健康检查..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10

    # 检查后端健康状态
    $backendHealthy = $false
    for ($i = 0; $i -lt 6; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5
            if ($resp.StatusCode -eq 200) {
                $backendHealthy = $true
                break
            }
        } catch {}
        Start-Sleep -Seconds 5
    }

    if ($backendHealthy) {
        Write-Host "  后端健康检查: OK" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: 后端健康检查未通过，请检查容器日志" -ForegroundColor Yellow
        Write-Host "  查看日志: docker compose -f docker-compose.yml -f docker-compose.prod.yml logs backend" -ForegroundColor Yellow
    }

    # 检查 Nginx
    $nginxHealthy = $false
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost/api/health" -UseBasicParsing -TimeoutSec 5
        if ($resp.StatusCode -eq 200) { $nginxHealthy = $true }
    } catch {}

    if ($nginxHealthy) {
        Write-Host "  Nginx 代理: OK" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Nginx 未就绪（检查 SSL 证书配置）" -ForegroundColor Yellow
    }

} finally {
    Pop-Location
}

# ---------- 4. 启动监控栈（可选）----------
Write-Host ""
Write-Host "[4/5] 监控栈（Prometheus + Grafana，可选）..." -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
    $ans = Read-Host "  是否启动监控栈？(y/N)"
    if ($ans -eq 'y' -or $ans -eq 'Y') {
        docker compose -f docker-compose.yml -f docker-compose.monitoring.yml --profile monitoring up -d
        Write-Host "  Prometheus: http://localhost:9090" -ForegroundColor Green
        Write-Host "  Grafana:    http://localhost:3001 （admin/admin123）" -ForegroundColor Green
    }
} finally {
    Pop-Location
}

# ---------- 5. 完成 ----------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  部署完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  API 地址:    https://你的域名.com/api" -ForegroundColor White
Write-Host "  小程序导入:  frontend/dist/build/mp-weixin" -ForegroundColor White
Write-Host ""
Write-Host "  常用命令:" -ForegroundColor White
Write-Host "    查看日志: docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f" -ForegroundColor Gray
Write-Host "    停止服务: docker compose -f docker-compose.yml -f docker-compose.prod.yml down" -ForegroundColor Gray
Write-Host ""
