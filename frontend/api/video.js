import { BASE_URL } from './index';

/**
 * 直接请求（不走 api.get 封装），用于视频播放 URL
 * 原因：后端对 .m3u8 返回纯文本（text/plain），不是 JSON
 */
function directRequest(url, options = {}) {
  const token = uni.getStorageSync('token');
  const header = { 'Content-Type': 'application/json', ...options.header };
  if (token) header['Authorization'] = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + url,
      method: options.method || 'GET',
      data: options.data,
      header,
      responseType: options.responseType || 'text',
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          uni.removeStorageSync('token');
          uni.showToast({ title: '请重新登录', icon: 'none' });
          reject(new Error('Unauthorized'));
        } else {
          const msg = (res.data && res.data.message) || '请求失败';
          uni.showToast({ title: msg, icon: 'none' });
          reject(new Error(msg));
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络错误', icon: 'none' });
        reject(err);
      },
    });
  });
}

export const videoApi = {
  /**
   * 获取私有视频的签名播放 URL
   *
   * 逻辑：
   * 1. 后端判断 key 是否 .m3u8 结尾
   *    - .m3u8：后端返回纯文本 m3u8 内容（signedM3u8），前端直接当 src 使用
   *    - 普通视频：后端返回 { code: 0, data: { url: '...' } }，前端取 .url
   * 2. 由于 .m3u8 是 text/plain，所以不走 api.get() 的 JSON 解析逻辑
   *
   * @param {string} key - 七牛存储的 video_key（不含域名）
   * @returns {Promise<string>} 签名后的播放 URL（可直接用于 video src）
   */
  playUrl: async (key) => {
    const data = await directRequest(
      `/video/play-url/${encodeURIComponent(key)}`,
      { responseType: 'text' }
    );
    // .m3u8 返回纯文本（已经是完整 m3u8 内容）
    // 普通视频返回 JSON: { code: 0, data: { url: '...' } }
    if (typeof data === 'string') {
      // 纯文本 → 直接作为 video src（m3u8 内容或普通 URL）
      return data;
    }
    // JSON 格式 → 取 data.url
    if (data && data.code === 0 && data.data && data.data.url) {
      return data.data.url;
    }
    throw new Error(data?.message || '获取视频URL失败');
  },

  /**
   * 获取公开资源的 CDN 地址（封面图等，无需签名）
   * @param {string} key - 七牛存储的 key
   * @returns {Promise<string>} 完整公开 URL
   */
  cdnUrl: async (key) => {
    const data = await directRequest(`/video/cdn-url/${encodeURIComponent(key)}`);
    if (data && data.code === 0) return data.data;
    throw new Error(data?.message || '获取CDN地址失败');
  },
};
