// 统一请求封装
// 开发者工具调试用 BASE_URL（微信开发者工具中 127.0.0.1 = Windows 宿主机）
// 真机测试时需改成局域网 IP 或已备案域名
const BASE_URL = 'http://127.0.0.1:3000/api';

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
