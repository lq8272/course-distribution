# 视频课程分销系统 - 后端API

基于 Node.js + Express + MySQL 的后端服务，支持无限层级分销体系。

## 项目结构

```
course-distribute-backend/
├── src/
│   ├── config/          # 配置
│   │   ├── index.js     # 环境配置
│   │   └── database.js  # 数据库连接
│   ├── models/          # 数据模型
│   │   ├── User.js      # 用户模型
│   │   ├── Course.js    # 课程模型
│   │   ├── Commission.js # 佣金模型
│   │   └── Team.js      # 团队模型
│   ├── routes/          # 路由
│   │   ├── auth.js      # 认证接口
│   │   ├── course.js    # 课程接口
│   │   ├── team.js      # 团队接口
│   │   └── commission.js # 佣金接口
│   ├── middleware/      # 中间件
│   │   └── auth.js      # JWT认证
│   ├── scripts/         # 脚本
│   │   └── initDb.js    # 数据库初始化
│   └── index.js         # 入口文件
├── .env                 # 环境变量
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
cd course-distribute-backend
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，修改数据库配置：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=course_distribute

JWT_SECRET=your_jwt_secret_key_here
PORT=3000
```

### 3. 初始化数据库

```bash
npm run init-db
```

### 4. 启动开发服务器

```bash
npm run dev
```

服务将在 http://localhost:3000 启动。

## API 接口

### 认证接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 微信登录 |
| `/api/auth/userinfo` | GET | 获取用户信息 |

### 课程接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/course/list` | GET | 课程列表 |
| `/api/course/detail` | GET | 课程详情 |
| `/api/course/categories` | GET | 课程分类 |
| `/api/course/share` | POST | 生成分销链接 |
| `/api/course/distribution-courses` | GET | 可分销课程 |

### 团队接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/team/overview` | GET | 团队概览统计 |
| `/api/team/tree` | GET | 团队完整树形结构 |
| `/api/team/subtree` | GET | 指定节点的下级树 |

### 佣金接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/commission/list` | GET | 佣金记录 |
| `/api/commission/stats` | GET | 佣金统计 |
| `/api/commission/withdraw` | POST | 申请提现 |
| `/api/commission/buy` | POST | 模拟购买（测试） |

## 分销机制

### 佣金计算规则

| 层级 | 角色 | 比例 | 说明 |
|------|------|------|------|
| 1级 | 直接推广人 | 30% | 下线购买课程 |
| 2级 | 上级的上级 | 5% | 管理奖 |
| 3级 | 更上级 | 3% | 管理奖 |

### 佣金计算示例

课程价格: ¥100

- 用户D购买课程
- 用户C（直接推广人）获得: ¥100 × 30% = ¥30
- 用户B（C的上级）获得管理奖: ¥100 × 5% = ¥5
- 用户A（B的上级）获得管理奖: ¥100 × 3% = ¥3

### 佣金状态

| 状态码 | 说明 |
|--------|------|
| 0 | 待确认 |
| 1 | 可提现 |
| 2 | 已提现 |
| 3 | 已失效 |

## 数据库表结构

### user 表（用户）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| openid | VARCHAR(64) | 微信openid |
| parent_id | BIGINT | 直接上级ID |
| parent_path | VARCHAR(1024) | 上级链路 |
| level | INT | 代理级别 |

`parent_path` 格式: `,1,2,3,` - 记录所有上级ID，用于快速查询整棵下线树。

### commission 表（佣金）

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | BIGINT | 获得佣金的用户 |
| course_id | BIGINT | 关联课程 |
| level | INT | 分销级别 |
| type | TINYINT | 类型(推广/管理奖) |
| amount | DECIMAL | 佣金金额 |
| status | TINYINT | 状态 |

## 技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js
- **数据库**: MySQL 8.0
- **缓存**: Redis 6.0
- **认证**: JWT

## 开发指南

### 添加新接口

1. 在 `src/models/` 创建或修改数据模型
2. 在 `src/routes/` 添加路由文件
3. 在 `src/index.js` 注册路由

### 认证方式

除登录接口外，其他接口需要在 Header 中携带 Token:

```
Authorization: Bearer <token>
```
