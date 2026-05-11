# 🧪 测试报告 — 视频分销小程序后端

**生成时间**: 2026-05-06 21:41
**测试命令**: `npm test` + `npx playwright test`
**后端地址**: `http://localhost:3000`（Docker）
**前端地址**: `http://localhost:8080`（H5）

---

## 一、测试结果总览

| 测试类型 | 通过 | 失败 | 总数 | 耗时 |
|:--------:|:----:|:----:|:----:|:----:|
| Jest 单元 | 72 | 0 | 72 | ~7s |
| Playwright E2E | 10 | 0 | 10 | ~49s |

**结论**: ✅ 全部通过

---

## 二、Jest 单元测试详情

| 测试文件 | 用例数 | 通过 | 失败 |
|:--------|:------:|:----:|:----:|
| ✅ `edge-cases.test.js` | 36 | 36 | 0 |
| ✅ `business.test.js` | 27 | 27 | 0 |
| ✅ `auth.test.js` | 9 | 9 | 0 |

---

## 三、Playwright E2E 端到端测试详情

| 测试用例 | 测试文件 | 结果 |
|:--------|:--------|:----:|
| 🛠 测试面板/强制模式点击 | `auth.spec.js` | ✅ |
| 🛠 自定义code登录 | `auth.spec.js` | ✅ |
| 🛠 正常微信登录 | `auth.spec.js` | ✅ |
| 🛠 游客模式 | `auth.spec.js` | ✅ |
| 📚 课程首页Banner | `course.spec.js` | ✅ |
| 📚 课程卡片列表 | `course.spec.js` | ✅ |
| 📚 点击课程卡片进入详情 | `course.spec.js` | ✅ |
| 📚 详情页购买按钮 | `course.spec.js` | ✅ |
| 💰 订单列表 | `order.spec.js` | ✅ |
| 💰 钱包佣金信息 | `order.spec.js` | ✅ |

---

## 四、已修复 Bug 记录

| # | 问题描述 | 根因 | 修复位置 | 验证方式 |
|:--|:-----|:-----|:---------|:--------|
| 1 | 负数价格无校验，可创建-5元课程 | 路由层无参数校验 | `src/routes/admin-course.js` 第44行 | curl 验证返回 40003 |
| 1b | 超长标题(500字符)→500崩溃 | MySQL bind参数校验 | `src/routes/admin-course.js` 第44行 | curl 验证返回 40002 |
| 1c | 部分字段undefined→mysql2报错500 | `||` 改为 `??` 正确处理undefined | `src/models/Course.js` 第98行 | curl 验证返回 0 成功 |
| 2 | refreshToken异常统一返回50000 | catch {} 吞掉错误类型 | `src/routes/auth.js` 第75行 | curl 无效token→40101明确消息 |
| 3 | page=0/-1 → MySQL OFFSET负数→500 | offset=(page-1)*pageSize，page<1为负 | `src/routes/course.js` 第133行 | curl page=0→200 ✅ |

---

## 五、测试账号

| 账号 | 角色 | 说明 |
|:----|:----|:----|
| `test_user_001/003/100` | 普通用户 | 微信登录测试
| `test_admin_001` | 管理员 | is_admin=1，可操作管理端API
| `test_user_200` | 普通用户 | 佣金结算测试

---

## 六、关键 API 端点

| 端点 | 方法 | 说明 |
|:----|:----|:----|
| `/api/auth/login` | POST | 微信登录，含测试模式bypass
| `/api/auth/refresh` | POST | Token续期（O4机制）
| `/api/auth/logout` | POST | 登出（黑名单+删除refreshToken）
| `/api/course/list` | GET | 课程列表（分页+分类+搜索）
| `/api/course/detail/:id` | GET | 课程详情（含购买状态）
| `/api/order/create` | POST | 创建订单（含推广码）
| `/api/order/my` | GET | 我的订单列表
| `/api/admin/course/create` | POST | 创建课程（管理员）
| `/api/admin/course/list` | GET | 管理员课程列表
| `/api/wallet/info` | GET | 钱包佣金信息


*报告自动生成 — 视频分销小程序 QA*