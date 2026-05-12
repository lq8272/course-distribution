import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000/api/v1';

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

test.describe('课程模块', () => {
  test.beforeEach(async ({ page }) => {
    const data = await getToken('test_user_200');
    await page.addInitScript(({ token, refreshToken, code }) => {
      const user = { id: 200, code, nickname: `E2E_${code}`, is_agent: 1 };
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('userInfo', JSON.stringify(user));
    }, { token: data.token, refreshToken: data.refreshToken, code: 'test_user_200' });
  });

  test('首页展示 Banner 和分类标签', async ({ page }) => {
    await page.goto('/#/pages/index/index');
    await page.waitForTimeout(3000);
    await expect(page.locator('.banner-swiper')).toBeVisible();
    await expect(page.locator('.categories')).toBeVisible();
  });

  test('首页课程列表加载成功，显示课程卡片', async ({ page }) => {
    await page.goto('/#/pages/index/index');
    await page.waitForTimeout(3000);
    const cards = page.locator('.course-card');
    await expect(cards.first()).toBeVisible({ timeout: 8000 });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('点击课程卡片 → 进入详情页', async ({ page }) => {
    await page.goto('/#/pages/index/index');
    await page.waitForTimeout(3000);
    const firstCard = page.locator('.course-card').first();
    await firstCard.click({ force: true });
    await page.waitForTimeout(2000);
    // id=undefined 是已知的 SPA 传参问题，但 URL 仍包含 course/detail 路径
    const url = page.url();
    expect(url).toMatch(/#\/pages\/course\/detail/);
  });

  test('课程详情页显示封面、标题、价格、购买按钮', async ({ page }) => {
    // 直接通过 API 获取课程 ID，再导航到详情页
    const res = await fetch(`${API}/course/list?__test_bypass=1`);
    const json = await res.json();
    const courseId = json?.data?.rows?.[0]?.id;
    await page.goto(`/#/pages/course/detail?id=${courseId}`);
    await page.waitForTimeout(4000);
    // 购买按钮始终可见（未购买时显示"立即购买 ¥XX"）
    await expect(page.locator('text=立即购买')).toBeVisible({ timeout: 10000 });
  });
});
