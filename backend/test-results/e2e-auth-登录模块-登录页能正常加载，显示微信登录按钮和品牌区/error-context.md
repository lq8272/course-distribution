# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/auth.spec.js >> 登录模块 >> 登录页能正常加载，显示微信登录按钮和品牌区
- Location: e2e/auth.spec.js:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.brand__name')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.brand__name')

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
  3  | test.describe('登录模块', () => {
  4  |   test('登录页能正常加载，显示微信登录按钮和品牌区', async ({ page }) => {
  5  |     await page.goto('http://localhost:8080/#/pages/login/index');
  6  |     await page.waitForTimeout(2000);
  7  | 
  8  |     // 验证品牌区
> 9  |     await expect(page.locator('.brand__name')).toBeVisible();
     |                                                ^ Error: expect(locator).toBeVisible() failed
  10 |     await expect(page.locator('.brand__tagline')).toBeVisible();
  11 | 
  12 |     // 验证微信登录按钮
  13 |     await expect(page.locator('.btn-wechat')).toBeVisible();
  14 | 
  15 |     // 验证管理员入口
  16 |     await expect(page.locator('.admin-entry')).toBeVisible();
  17 | 
  18 |     // 验证协议区域
  19 |     await expect(page.locator('.agreement')).toBeVisible();
  20 |   });
  21 | 
  22 |   test('管理员登录入口可点击', async ({ page }) => {
  23 |     await page.goto('http://localhost:8080/#/pages/login/index');
  24 |     await page.waitForTimeout(2000);
  25 | 
  26 |     // 点击管理员入口
  27 |     await page.locator('.admin-entry').click();
  28 |     await page.waitForTimeout(1500);
  29 | 
  30 |     // 应跳转到管理员登录页
  31 |     const url = page.url();
  32 |     expect(url).toMatch(/admin/);
  33 |   });
  34 | 
  35 |   test('协议复选框可切换状态', async ({ page }) => {
  36 |     await page.goto('http://localhost:8080/#/pages/login/index');
  37 |     await page.waitForTimeout(2000);
  38 | 
  39 |     const checkbox = page.locator('.agreement__checkbox');
  40 |     await expect(checkbox).toBeVisible();
  41 | 
  42 |     // 默认未选中
  43 |     const initialChecked = await checkbox.evaluate(el => el.classList.contains('is-checked'));
  44 |     expect(initialChecked).toBe(false);
  45 | 
  46 |     // 点击选中
  47 |     await checkbox.click();
  48 |     await page.waitForTimeout(300);
  49 | 
  50 |     const afterClickChecked = await checkbox.evaluate(el => el.classList.contains('is-checked'));
  51 |     expect(afterClickChecked).toBe(true);
  52 |   });
  53 | });
  54 | 
```