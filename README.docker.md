# Docker 环境配置指南

使用 Docker 统一开发、测试、生产环境。

## 目录结构

```
course-distribute/
├── docker/
│   ├── mysql/
│   │   └── init/
│   │       └── init.sql      # MySQL 初始化脚本
│   └── nginx/
│       ├── nginx.conf         # Nginx 主配置
│       ├── conf.d/            # 子配置
│       └── ssl/               # SSL 证书目录
├── backend/                   # 后端代码（运行容器内）
├── frontend/                  # 前端代码（运行容器内）
├── docker-compose.yml         # Docker Compose 配置
├── .env.docker               # 环境变量模板
└── README.docker.md          # 本文档
```

## 快速开始

### 1. 安装 Docker

- Windows: 下载 [Docker Desktop](https://www.docker.com/products/docker-desktop)
- macOS: `brew install --cask docker`
- Linux: `curl -fsSL https://get.docker.com | sh`

### 2. 配置环境变量

```bash
# 在项目根目录
copy .env.docker .env

# 编辑 .env 文件，修改密码和配置
```

### 3. 初始化 Docker 环境

```bash
# 复制前后端代码到 Docker 工作目录
node setup-docker.js

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f backend
```

### 4. 访问服务

| 服务 | 地址 |
|------|------|
| 后端 API | http://localhost:3000 |
| 前端开发 | http://localhost:5173 |
| Nginx | http://localhost:80 |
| MySQL | localhost:3306 |

## 环境说明

### 开发环境 (development)

```bash
NODE_ENV=development docker-compose up -d
```

- 代码通过 volume 挂载，修改实时生效
- 使用 nodemon 自动重启
- 开启 sourcemap 和日志

### 测试环境 (testing)

```bash
NODE_ENV=testing docker-compose -f docker-compose.yml -f docker-compose.test.yml up -d
```

### 生产环境 (production)

```bash
NODE_ENV=production docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

- 使用生产级 Dockerfile
- Nginx 作为反向代理
- 无 sourcemap

## Docker Compose 服务

| 服务 | 说明 | 端口 |
|------|------|------|
| mysql | MySQL 8.0 数据库 | 3306 |
| redis | Redis 6.2 缓存 | 6379 |
| backend | Node.js API 服务 | 3000 |
| frontend | Vite 开发服务器 | 5173 |
| nginx | 反向代理（生产） | 80, 443 |

## 常用命令

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重建服务
docker-compose up -d --build

# 查看日志
docker-compose logs -f [service]

# 进入容器
docker exec -it course_backend sh
docker exec -it course_mysql mysql -uroot -p

# 初始化数据库（首次启动后）
docker exec course_backend npm run init-db

# 清理所有数据
docker-compose down -v
```

## 数据库连接

容器间通过服务名通信：

```javascript
// 后端配置
DB_HOST=mysql       // 不是 localhost
DB_PORT=3306
DB_NAME=course_distribute

REDIS_HOST=redis    // 不是 localhost
REDIS_PORT=6379
```

## 生产部署 Checklist

1. [ ] 修改 `.env` 中的密码和密钥
2. [ ] 配置微信 AppID 和 Secret
3. [ ] 配置阿里云 OSS
4. [ ] 申请 SSL 证书
5. [ ] 修改 Nginx 配置中的域名
6. [ ] 运行 `docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d`

## 故障排查

### MySQL 连接失败

```bash
# 检查 MySQL 是否就绪
docker exec course_mysql mysqladmin ping -h localhost -uroot -p
```

### 后端启动失败

```bash
# 查看详细日志
docker-compose logs backend
```

### 端口冲突

```bash
# 检查端口占用
netstat -ano | findstr :3000
```

## 性能优化

- 开发环境：前后端代码通过 volume 挂载
- 生产环境：使用多阶段构建，减小镜像体积
- MySQL：配置合理的连接池大小
- Redis：开启持久化和内存限制
