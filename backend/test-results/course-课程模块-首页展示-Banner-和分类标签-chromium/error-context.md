# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: course.spec.js >> 课程模块 >> 首页展示 Banner 和分类标签
- Location: e2e/course.spec.js:32:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.banner-swiper')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.banner-swiper')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - heading "403 Forbidden" [level=1] [ref=e3]
  - separator [ref=e4]
  - generic [ref=e5]: nginx/1.29.8
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
  33 |     await page.goto('/#/pages/index/index');
  34 |     await page.waitForTimeout(3000);
> 35 |     await expect(page.locator('.banner-swiper')).toBeVisible();
     |                                                  ^ Error: expect(locator).toBeVisible() failed
  36 |     await expect(page.locator('.categories')).toBeVisible();
  37 |   });
  38 | 
  39 |   test('首页课程列表加载成功，显示课程卡片', async ({ page }) => {
  40 |     await page.goto('/#/pages/index/index');
  41 |     await page.waitForTimeout(3000);
  42 |     const cards = page.locator('.course-card');
  43 |     await expect(cards.first()).toBeVisible({ timeout: 8000 });
  44 |     const count = await cards.count();
  45 |     expect(count).toBeGreaterThan(0);
  46 |   });
  47 | 
  48 |   test('点击课程卡片 → 进入详情页', async ({ page }) => {
  49 |     await page.goto('/#/pages/index/index');
  50 |     await page.waitForTimeout(3000);
  51 |     const firstCard = page.locator('.course-card').first();
  52 |     await firstCard.click({ force: true });
  53 |     await page.waitForTimeout(2000);
  54 |     // id=undefined 是已知的 SPA 传参问题，但 URL 仍包含 course/detail 路径
  55 |     const url = page.url();
  56 |     expect(url).toMatch(/#\/pages\/course\/detail/);
  57 |   });
  58 | 
  59 |   test('课程详情页显示封面、标题、价格、购买按钮', async ({ page }) => {
  60 |     // 直接通过 API 获取课程 ID，再导航到详情页
  61 |     const res = await fetch(`${API}/course/list?__test_bypass=1`);
  62 |     const json = await res.json();
  63 |     const courseId = json?.data?.rows?.[0]?.id;
  64 |     await page.goto(`/#/pages/course/detail?id=${courseId}`);
  65 |     await page.waitForTimeout(4000);
  66 |     // 购买按钮始终可见（未购买时显示"立即购买 ¥XX"）
  67 |     await expect(page.locator('text=立即购买')).toBeVisible({ timeout: 10000 });
  68 |   });
  69 | });
  70 | 
```