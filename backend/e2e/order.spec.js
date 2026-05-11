import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000/api';

/**
 * 在 Node.js 端登录并获取 token
 */
async function getToken(code) {
  const res = await fetch(`${API}/auth/login?__test_bypass=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, nickname: `E2E_${code}`, promotion_code: null }),
  });
  const json = await res.json();
  if (json.code !== 0 || !json.data?.token) {
    throw new Error(`Login failed: ${JSON.stringify(json)}`);
  }
  return json.data;
}

test.describe('订单与佣金模块', () => {
  test.beforeEach(async ({ page }) => {
    const data = await getToken('test_user_200');
    await page.addInitScript(({ token, refreshToken, code }) => {
      const user = { id: 200, code, nickname: `E2E_${code}`, is_agent: 1 };
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('userInfo', JSON.stringify(user));
    }, { token: data.token, refreshToken: data.refreshToken, code: 'test_user_200' });
  });

  test('订单列表页可正常打开', async ({ page }) => {
    await page.goto('/#/pages/order/list');
    await page.waitForTimeout(3000);
    const hasContent =
      (await page.locator('.order-card').count()) > 0 ||
      (await page.locator('.empty-state').isVisible());
    expect(hasContent).toBeTruthy();
  });

  test('我的钱包页可正常打开，显示佣金信息', async ({ page }) => {
    await page.goto('/#/pages/user/wallet');
    await page.waitForTimeout(3000);
    const hasWallet =
      (await page.locator('.balance-card__amount').isVisible()) ||
      (await page.locator('.commission-info').isVisible());
    expect(hasWallet).toBeTruthy();
  });
});
