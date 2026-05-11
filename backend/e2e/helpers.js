/**
 * E2E 测试辅助：直接通过 fetch 登录，绕过 UI
 * 因为测试模式 code 固定，我们可以先登录拿 token，
 * 再通过 localStorage 注入了会话，跳过登录页直接进入业务页
 */
import { test } from '@playwright/test';

const API = 'http://localhost:3000/api';

/**
 * 登录并返回 { token, refreshToken }
 * 使用 page.addInitScript 在每个页面创建前注入 localStorage
 */
export async function loginAs(page, code = 'test_user_200') {
  const url = `${API}/auth/login?__test_bypass=1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, nickname: `E2E_${code}`, promotion_code: null }),
  });
  const json = await res.json();
  if (json.code !== 0 || !json.data?.token) {
    throw new Error(`Login failed: ${JSON.stringify(json)}`);
  }
  const { token, refreshToken } = json.data;

  // 通过 navigation API 注入（避免 uni 不在 evaluate 上下文的问题）
  await page.addInitScript(() => {
    // 空操作，storage 已在 evaluate 中设置
  });

  // 使用 route API 拦截并注入 storage
  await page.route('**/pages/index/index', async route => {
    await route.continue();
  });

  return { token, refreshToken };
}

/**
 * 同步注入 localStorage：在下一个页面加载前完成
 * 必须在 goto 之前调用
 */
export async function injectLocalStorage(page, token, refreshToken, code) {
  await page.addInitScript(({ token, refreshToken, code }) => {
    const user = { id: 200, code, nickname: `E2E_${code}`, is_agent: 1 };
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('userInfo', JSON.stringify(user));
    } catch (e) {
      console.error('localStorage injection failed:', e);
    }
  }, { token, refreshToken, code });
}

/**
 * 清除登录状态
 */
export async function logout(page) {
  await page.evaluate(() => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userInfo');
    } catch (e) { /* ignore */ }
  });
}
