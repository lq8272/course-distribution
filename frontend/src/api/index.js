// 统一请求封装
// 通过 VITE_API_BASE_URL 环境变量配置（.env.development / .env.production）
// 开发环境：VITE_API_BASE_URL=http://127.0.0.1:3000/api/v1（微信开发者工具中 127.0.0.1 = Windows）
// 生产环境：VITE_API_BASE_URL=https://yourdomain.com/api/v1
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!BASE_URL) {
  throw new Error('环境变量 VITE_API_BASE_URL 未配置，请检查 .env.production');
}
const REQUEST_TIMEOUT = 10000; // 10秒超时

function request(url, options = {}) {
  const token = uni.getStorageSync('token');
  const header = { 'Content-Type': 'application/json', ...options.header };
  if (token) header['Authorization'] = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      uni.showToast({ title: '请求超时，请稍后重试', icon: 'none' });
      reject(new Error('请求超时'));
    }, REQUEST_TIMEOUT);

    uni.request({
      url: BASE_URL + url,
      method: options.method || 'GET',
      data: options.data,
      header,
      success: (res) => {
        if (timedOut) return;
        clearTimeout(timer);

        if (res.statusCode === 200 && res.data.code === 0) {
          resolve(res.data.data);
        } else if (res.statusCode === 401) {
          uni.removeStorageSync('token');
          uni.showToast({ title: res.data.message || '请重新登录', icon: 'none' });
          // 跳转登录页
          uni.reLaunch({ url: '/pages/login/index' });
          reject(res.data);
        } else {
          uni.showToast({ title: res.data.message || '请求失败', icon: 'none' });
          reject(res.data);
        }
      },
      fail: (err) => {
        if (timedOut) return;
        clearTimeout(timer);
        uni.showToast({ title: '网络错误，请检查网络连接', icon: 'none' });
        reject(err);
      },
    });
  });
}

export const api = {
  get: (url, data) => request(url, { method: 'GET', data }),
  post: (url, data) => request(url, { method: 'POST', data }),
  put: (url, data) => request(url, { method: 'PUT', data }),
  delete: (url, data) => request(url, { method: 'DELETE', data }),
};

export { BASE_URL };
