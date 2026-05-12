# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.js >> 登录模块 >> 登录成功 → 跳转到首页（体验代理）
- Location: e2e/auth.spec.js:30:7

# Error details

```
Test timeout of 15000ms exceeded.
```

```
Error: locator.click: Test timeout of 15000ms exceeded.
Call log:
  - waiting for locator('.test-btn')

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
  2  | import { loginAs, logout } from './helpers.js';
  3  | 
  4  | test.describe('登录模块', () => {
  5  |   test('测试面板打开且显示测试用户列表', async ({ page }) => {
  6  |     await page.goto('/#/pages/login/index');
  7  |     await page.waitForTimeout(2000);
  8  | 
  9  |     // uni-button.test-btn 覆盖了内部的 <span>，用 force 绕过
  10 |     await page.locator('.test-btn').click({ force: true });
  11 |     await page.waitForTimeout(500);
  12 | 
  13 |     await expect(page.locator('.test-panel')).toBeVisible();
  14 |     const userItems = page.locator('.test-user-item');
  15 |     await expect(userItems).toHaveCount(3);
  16 |   });
  17 | 
  18 |   test('自定义 code 输入框可正常输入', async ({ page }) => {
  19 |     await page.goto('/#/pages/login/index');
  20 |     await page.waitForTimeout(2000);
  21 | 
  22 |     await page.locator('.test-btn').click({ force: true });
  23 |     await page.waitForTimeout(500);
  24 | 
  25 |     const input = page.locator('.test-custom-input input');
  26 |     await input.fill('test_user_999');
  27 |     await expect(input).toHaveValue('test_user_999');
  28 |   });
  29 | 
  30 |   test('登录成功 → 跳转到首页（体验代理）', async ({ page }) => {
  31 |     await page.goto('/#/pages/login/index');
  32 |     await page.waitForTimeout(2000);
  33 | 
> 34 |     await page.locator('.test-btn').click({ force: true });
     |                                     ^ Error: locator.click: Test timeout of 15000ms exceeded.
  35 |     await page.waitForTimeout(500);
  36 |     await page.locator('.test-login-btn').click({ force: true });
  37 |     await page.waitForTimeout(3000);
  38 | 
  39 |     const url = page.url();
  40 |     // 实际跳转到 /#/（根路径），部分代理用户可能需要申请页
  41 |     expect(url).toMatch(/#\/?$/);
  42 |   });
  43 | 
  44 |   test('游客先看看 → 跳转首页但未登录状态', async ({ page }) => {
  45 |     await page.goto('/#/pages/login/index');
  46 |     await page.waitForTimeout(2000);
  47 | 
  48 |     await page.click('text=先看看再说');
  49 |     await page.waitForTimeout(2000);
  50 | 
  51 |     // 验证在首页
  52 |     const url = page.url();
  53 |     expect(url).toMatch(/#\/?$/);
  54 |   });
  55 | });
  56 | 
```