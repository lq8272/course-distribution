# ============================================================
# deploy-production.ps1 — 视频课程分销系统生产部署脚本（Windows）
#
# 核心原则：服务器上所有构建均在 Docker 容器内完成，无需在服务器安装 Node.js
#
# 使用前提：
#   1. 已安装 OpenSSH / Git Bash / WSL（用于执行 SSH）
#   2. 已将 .env.production.example 复制为 .env.production 并填写真实值
#   3. SSL 证书已放入 docker/nginx/ssl/
#
# 使用方法（PowerShell）：
#   .\scripts\deploy-production.ps1 -Action init    -Server "ubuntu@129.204.199.134" -Repo "/home/ubuntu/course-distribute"
#   .\scripts\deploy-production.ps1 -Action deploy  -Server "ubuntu@129.204.199.134" -Repo "/home/ubuntu/course-distribute"
#   .\scripts\deploy-production.ps1 -Action status  -Server "ubuntu@129.204.199.134" -Repo "/home/ubuntu/course-distribute"
#   .\scripts\deploy-production.ps1 -Action logs     -Server "ubuntu@129.204.199.134" -Repo "/home/ubuntu/course-distribute" -Service "backend"
#   .\scripts\deploy-production.ps1 -Action stop     -Server "ubuntu@129.204.199.134" -Repo "/home/ubuntu/course-distribute"
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("init", "deploy", "status", "logs", "stop", "clean")]
    [string]$Action,

    [Parameter(Mandatory=$false)]
    [string]$Server,

    [Parameter(Mandatory=$false)]
    [string]$Repo,

    [Parameter(Mandatory=$false)]
    [string]$Service
)

$ErrorActionPreference = "Stop"

# ---------- 颜色输出函数 ----------
function Write-LogInfo  { Write-Host "[INFO]  $args" -ForegroundColor Green }
function Write-LogWarn  { Write-Host "[WARN]  $args" -ForegroundColor Yellow }
function Write-LogError { Write-Host "[ERROR] $args" -ForegroundColor Red }
function Write-LogStep  { Write-Host "[STEP]  $args" -ForegroundColor Cyan }

# ---------- 参数检查 ----------
function Check-Args {
    if ($Action -eq "status" -or $Action -eq "stop" -or $Action -eq "clean") {
        return  # 这些命令不需要 Server/Repo
    }
    if ([string]::IsNullOrWhiteSpace($Server) -or [string]::IsNullOrWhiteSpace($Repo)) {
        Write-LogError "Server 和 Repo 参数不能为空"
        exit 1
    }
}

# ---------- 前置检查 ----------
function Check-LocalPrereq {
    Write-LogInfo "检查本地前置条件..."

    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerCmd) {
        Write-LogError "Docker 未安装"
        exit 1
    }
    Write-LogInfo "本地 Docker: $(docker --version)"

    # SSH 检查
    $sshCmd = Get-Command ssh -ErrorAction SilentlyContinue
    if (-not $sshCmd) {
        Write-LogError "SSH 客户端未安装（请安装 Git Bash 或 OpenSSH）"
        exit 1
    }

    Write-LogInfo "本地前置条件检查通过"
}

function Check-ServerPrereq {
    Write-LogStep "检查服务器前置条件..."

    # Docker 检查
    $dockerVersion = & ssh $Server "docker --version" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-LogError "服务器 Docker 未安装"
        exit 1
    }
    Write-LogInfo "服务器 Docker: $dockerVersion"

    # docker compose v2 检查
    $composeVersion = & ssh $Server "docker compose version" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-LogError "服务器 Docker Compose v2 未安装"
        exit 1
    }
    Write-LogInfo "服务器 Docker Compose: $composeVersion"

    # .env.production 检查
    $envExists = & ssh $Server "test -f $Repo/.env.production && echo EXISTS" 2>&1
    if ($envExists -ne "EXISTS") {
        Write-LogError ".env.production 不存在于服务器，请先创建"
        exit 1
    }

    # SSL 证书检查
    $sslExists = & ssh $Server "test -f $Repo/docker/nginx/ssl/fullchain.pem && echo EXISTS" 2>&1
    if ($sslExists -ne "EXISTS") {
        Write-LogWarn "SSL 证书未找到，将只启用 HTTP"
    }

    Write-LogInfo "服务器前置条件检查通过"
}

# ---------- 代码同步 ----------
function Sync-Code {
    Write-LogStep "同步代码到服务器 (git pull)..."
    & ssh $Server "cd $Repo && git pull origin master 2>&1 || git pull origin main 2>&1"
    Write-LogInfo "代码同步完成"
}

# ---------- 启动服务 ----------
function Start-Services {
    Write-LogStep "启动生产服务 (docker compose up -d --build)..."
    & ssh $Server "cd $Repo && docker compose -f docker-compose.prod.yml up -d --build 2>&1"

    Write-LogInfo "等待服务启动（30秒）..."
    Start-Sleep -Seconds 30

    # 健康检查
    $maxWait = 60
    $waited = 0
    while ($waited -lt $maxWait) {
        $health = & ssh $Server "curl -sf http://localhost/api/health" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-LogInfo "后端健康检查通过: $health"
            return
        }
        Write-Host "  等待中... ($($waited + 5)s / ${maxWait}s)" -NoNewline
        Write-Host ""
        Start-Sleep -Seconds 5
        $waited += 5
    }

    Write-LogWarn "健康检查超时，请手动检查日志"
}

# ---------- 命令实现 ----------
function Invoke-Init {
    Write-LogInfo "========== 首次部署初始化 =========="
    Check-Args
    Check-LocalPrereq
    Check-ServerPrereq
    Sync-Code
    Start-Services
    Invoke-Status
}

function Invoke-Deploy {
    Write-LogInfo "========== 更新部署 =========="
    Check-Args
    Check-LocalPrereq
    Sync-Code
    Start-Services
    Invoke-Status
}

function Invoke-Status {
    if ([string]::IsNullOrWhiteSpace($Server)) {
        $Server = $script:Server
        $Repo = $script:Repo
    }
    Write-Host ""
    & ssh $Server "cd $Repo && docker compose -f docker-compose.prod.yml ps"
    Write-Host ""
    $health = & ssh $Server "curl -sf http://localhost/api/health 2>&1" | ConvertFrom-Json
    if ($health) {
        Write-LogInfo "API 状态: $($health.status) | MySQL: $($health.mysql) | Redis: $($health.redis)"
    }
}

function Invoke-Logs {
    if ([string]::IsNullOrWhiteSpace($Service)) {
        & ssh $Server "cd $Repo && docker compose -f docker-compose.prod.yml logs -f"
    } else {
        & ssh $Server "cd $Repo && docker compose -f docker-compose.prod.yml logs -f $Service"
    }
}

function Invoke-Stop {
    Write-LogInfo "停止所有服务..."
    & ssh $Server "cd $Repo && docker compose -f docker-compose.prod.yml down"
    Write-LogInfo "服务已停止"
}

function Invoke-Clean {
    Write-LogWarn "清理未使用的 Docker 资源..."
    & ssh $Server "docker system prune -f"
    Write-LogInfo "清理完成"
}

# ---------- 主入口 ----------
Check-Args

switch ($Action) {
    "init"   { Invoke-Init }
    "deploy" { Invoke-Deploy }
    "status" { Invoke-Status }
    "logs"   { Invoke-Logs }
    "stop"   { Invoke-Stop }
    "clean"  { Invoke-Clean }
}
