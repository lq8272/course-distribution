# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/course.spec.js >> 课程模块 >> 首页展示 Banner 和分类标签
- Location: e2e/course.spec.js:32:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/#/pages/index/index", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const API = 'http://localhost:3000/api/v1';
  4  | 
  5  | /**
  6  |  * 在 Node.js 端登录并获取 token
  7  |  */
  8  | async function getToken(code) {
  9  |   const res = await fetch(`${API}/auth/login?__test_bypass=1`, {
  10 |     method: 'POST',
  11 |     headers: { 'Content-Type': 'application/json' },
  12 |     body: JSON.stringify({ code, nickname: `E2E_${code}`, promotion_code: null }),
  13 |   });
  14 |   const json = await res.json();
  15 |   if (json.code !== 0 || !json.data?.token) {
  16 |     throw new Error(`Login failed: ${JSON.stringify(json)}`);
  17 |   }
  18 |   return json.data;
  19 | }
  20 | 
  21 | test.describe('课程模块', () => {
  22 |   test.beforeEach(async ({ page }) => {
  23 |     const data = await getToken('test_user_200');
  24 |     await page.addInitScript(({ token, refreshToken, code }) => {
  25 |       const user = { id: 200, code, nickname: `E2E_${code}`, is_agent: 1 };
  26 |       localStorage.setItem('token', token);
  27 |       localStorage.setItem('refreshToken', refreshToken);
  28 |       localStorage.setItem('userInfo', JSON.stringify(user));
  29 |     }, { token: data.token, refreshToken: data.refreshToken, code: 'test_user_200' });
  30 |   });
  31 | 
  32 |   test('首页展示 Banner 和分类标签', async ({ page }) => {
> 33 |     await page.goto('/#/pages/index/index');
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  34 |     // 等待页面加载
  35 |     await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  36 |     // 验证关键元素
  37 |     const banner = page.locator('.banner-swiper');
  38 |     const categories = page.locator('.categories');
  39 |     const bannerVisible = await banner.isVisible().catch(() => false);
  40 |     const categoriesVisible = await categories.isVisible().catch(() => false);
  41 |     // 至少有一个元素可见即可通过（CI 环境可能缺数据）
  42 |     expect(bannerVisible || categoriesVisible).toBeTruthy();
  43 |   });
  44 | 
  45 |   test('首页课程列表加载成功，显示课程卡片', async ({ page }) => {
  46 |     await page.goto('/#/pages/index/index');
  47 |     await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  48 |     // 课程卡片可能为空列表，只需页面不崩溃即可
  49 |     const cards = page.locator('.course-card');
  50 |     const count = await cards.count();
  51 |     // 允许 count = 0（CI 无课程数据），但不能崩溃
  52 |     expect(count).toBeGreaterThanOrEqual(0);
  53 |   });
  54 | 
  55 |   test('点击课程卡片 → 进入详情页', async ({ page }) => {
  56 |     await page.goto('/#/pages/index/index');
  57 |     await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  58 |     const firstCard = page.locator('.course-card').first();
  59 |     const cardExists = await firstCard.count() > 0;
  60 |     if (!cardExists) {
  61 |       // 无课程卡片时跳过（课程列表为空）
  62 |       test.skip();
  63 |     }
  64 |     await firstCard.click({ force: true });
  65 |     await page.waitForTimeout(1500);
  66 |     const url = page.url();
  67 |     expect(url).toMatch(/#\/pages\/course\/detail/);
  68 |   });
  69 | 
  70 |   test('课程详情页显示封面、标题、价格、购买按钮', async ({ page }) => {
  71 |     // 直接通过 API 获取课程 ID
  72 |     const res = await fetch(`${API}/course/list?__test_bypass=1`);
  73 |     const json = await res.json();
  74 |     const courseId = json?.data?.rows?.[0]?.id;
  75 |     if (!courseId) {
  76 |       // 无课程数据时跳过
  77 |       test.skip();
  78 |     }
  79 |     await page.goto(`/#/pages/course/detail?id=${courseId}`);
  80 |     await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  81 |     // 验证购买按钮
  82 |     const buyBtn = page.locator('text=立即购买');
  83 |     await expect(buyBtn).toBeVisible({ timeout: 10000 });
  84 |   });
  85 | });
  86 | 
```