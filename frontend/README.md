# 视频课程分销小程序

基于 uni-app + Vue3 的视频课程分销小程序，界面风格参考小鹅通。

## 项目结构

```
course-distribute/
├── pages/
│   ├── index/          # 首页 - 课程列表
│   ├── course/         # 课程详情
│   ├── distribute/      # 分销中心
│   ├── team/           # 团队管理
│   └── user/           # 我的
├── common/styles/      # 公共样式
├── static/            # 静态资源
├── pages.json         # 路由配置
├── manifest.json      # 小程序配置
└── package.json       # 依赖配置
```

## 运行项目

### 1. 安装依赖

```bash
cd course-distribute
npm install
```

### 2. 开发模式（微信小程序）

```bash
npm run dev:mp-weixin
```

然后：
1. 打开微信开发者工具
2. 导入项目 `C:\Users\LQ\Videos\course-distribute`
3. 选择 `dist/dev/mp-weixin` 目录

### 3. 生产构建

```bash
npm run build:mp-weixin
```

## 功能模块

- **首页**：课程分类、搜索、课程卡片展示、分销佣金提示
- **课程详情**：课程信息、购买、分销佣金预览、课程大纲
- **分销中心**：推广码、佣金记录、提现、推广课程
- **团队管理**：团队统计、树形架构图、业绩趋势、分销规则
- **我的**：个人信息、订单、钱包、设置

## 小鹅通风格特点

- 橙色主色调 (#FF6B00)
- 白色/浅灰背景，简洁干净
- 卡片圆角 + 阴影
- 分销佣金金色高亮展示
- 树形团队架构展示

## 佣金规则

| 层级 | 比例 | 说明 |
|------|------|------|
| 直接推广 | 30% | 下线购买课程 |
| 二级管理奖 | 5% | 下线的下线购买 |
| 三级管理奖 | 3% | 三级下线购买 |

## 技术栈

- uni-app (Vue3)
- Vite
- SCSS
- 微信小程序
