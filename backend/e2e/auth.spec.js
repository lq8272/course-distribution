import { test, expect } from '@playwright/test';

test.describe('登录模块', () => {
  test('登录页能正常加载，显示微信登录按钮和品牌区', async ({ page }) => {
    await page.goto('http://localhost:8080/#/pages/login/index');
    await page.waitForTimeout(2000);

    // 验证品牌区
    await expect(page.locator('.brand__name')).toBeVisible();
    await expect(page.locator('.brand__tagline')).toBeVisible();

    // 验证微信登录按钮
    await expect(page.locator('.btn-wechat')).toBeVisible();

    // 验证管理员入口
    await expect(page.locator('.admin-entry')).toBeVisible();

    // 验证协议区域
    await expect(page.locator('.agreement')).toBeVisible();
  });

  test('管理员登录入口可点击', async ({ page }) => {
    await page.goto('http://localhost:8080/#/pages/login/index');
    await page.waitForTimeout(2000);

    // 点击管理员入口
    await page.locator('.admin-entry').click();
    await page.waitForTimeout(1500);

    // 应跳转到管理员登录页
    const url = page.url();
    expect(url).toMatch(/admin/);
  });

  test('协议复选框可切换状态', async ({ page }) => {
    await page.goto('http://localhost:8080/#/pages/login/index');
    await page.waitForTimeout(2000);

    const checkbox = page.locator('.agreement__checkbox');
    await expect(checkbox).toBeVisible();

    // 默认未选中
    const initialChecked = await checkbox.evaluate(el => el.classList.contains('is-checked'));
    expect(initialChecked).toBe(false);

    // 点击选中
    await checkbox.click();
    await page.waitForTimeout(300);

    const afterClickChecked = await checkbox.evaluate(el => el.classList.contains('is-checked'));
    expect(afterClickChecked).toBe(true);
  });
});
