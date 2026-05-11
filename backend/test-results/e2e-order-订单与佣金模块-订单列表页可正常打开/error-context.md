# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/order.spec.js >> 订单与佣金模块 >> 订单列表页可正常打开
- Location: e2e/order.spec.js:32:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/#/pages/order/list", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const API = 'http://localhost:3000/api';
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
  21 | test.describe('订单与佣金模块', () => {
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
  32 |   test('订单列表页可正常打开', async ({ page }) => {
> 33 |     await page.goto('/#/pages/order/list');
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  34 |     await page.waitForTimeout(3000);
  35 |     const hasContent =
  36 |       (await page.locator('.order-card').count()) > 0 ||
  37 |       (await page.locator('.empty-state').isVisible());
  38 |     expect(hasContent).toBeTruthy();
  39 |   });
  40 | 
  41 |   test('我的钱包页可正常打开，显示佣金信息', async ({ page }) => {
  42 |     await page.goto('/#/pages/user/wallet');
  43 |     await page.waitForTimeout(3000);
  44 |     const hasWallet =
  45 |       (await page.locator('.balance-card__amount').isVisible()) ||
  46 |       (await page.locator('.commission-info').isVisible());
  47 |     expect(hasWallet).toBeTruthy();
  48 |   });
  49 | });
  50 | 
```