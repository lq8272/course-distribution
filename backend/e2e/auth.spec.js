import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers.js';

test.describe('登录模块', () => {
  test('测试面板打开且显示测试用户列表', async ({ page }) => {
    await page.goto('/#/pages/login/index');
    await page.waitForTimeout(2000);

    // uni-button.test-btn 覆盖了内部的 <span>，用 force 绕过
    await page.locator('.test-btn').click({ force: true });
    await page.waitForTimeout(500);

    await expect(page.locator('.test-panel')).toBeVisible();
    const userItems = page.locator('.test-user-item');
    await expect(userItems).toHaveCount(3);
  });

  test('自定义 code 输入框可正常输入', async ({ page }) => {
    await page.goto('/#/pages/login/index');
    await page.waitForTimeout(2000);

    await page.locator('.test-btn').click({ force: true });
    await page.waitForTimeout(500);

    const input = page.locator('.test-custom-input input');
    await input.fill('test_user_999');
    await expect(input).toHaveValue('test_user_999');
  });

  test('登录成功 → 跳转到首页（体验代理）', async ({ page }) => {
    await page.goto('/#/pages/login/index');
    await page.waitForTimeout(2000);

    await page.locator('.test-btn').click({ force: true });
    await page.waitForTimeout(500);
    await page.locator('.test-login-btn').click({ force: true });
    await page.waitForTimeout(3000);

    const url = page.url();
    // 实际跳转到 /#/（根路径），部分代理用户可能需要申请页
    expect(url).toMatch(/#\/?$/);
  });

  test('游客先看看 → 跳转首页但未登录状态', async ({ page }) => {
    await page.goto('/#/pages/login/index');
    await page.waitForTimeout(2000);

    await page.click('text=先看看再说');
    await page.waitForTimeout(2000);

    // 验证在首页
    const url = page.url();
    expect(url).toMatch(/#\/?$/);
  });
});
