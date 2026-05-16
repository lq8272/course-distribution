// 统一请求封装
// 环境变量说明：
//   .env           → VITE_API_BASE_URL=http://127.0.0.1:3000/api/v1  (本地开发)
//   .env.production → VITE_API_BASE_URL=https://hhlfedu.com/api  (生产)
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';

function request(url, options = {}) {
  const token = uni.getStorageSync('token');
  const header = { 'Content-Type': 'application/json', ...options.header };
  if (token) header['Authorization'] = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + url,
      method: options.method || 'GET',
      data: options.data,
      header,
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 0) {
          resolve(res.data.data);
        } else if (res.statusCode === 401) {
          uni.removeStorageSync('token');
          uni.showToast({ title: res.data.message || '请重新登录', icon: 'none' });
          reject(res.data);
        } else {
          uni.showToast({ title: res.data.message || '请求失败', icon: 'none' });
          reject(res.data);
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络错误', icon: 'none' });
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
