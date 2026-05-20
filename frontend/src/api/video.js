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
          // 强制转 string：uni.request 对非 JSON Content-Type 可能返回 ArrayBuffer 或对象
          let text;
          if (typeof res.data === 'string') {
            text = res.data;
          } else if (res.data instanceof ArrayBuffer || (typeof res.data === 'object' && res.data && res.data.type === 'ArrayBuffer')) {
            // ArrayBuffer 需要用 TextDecoder 解码
            try {
              const decoder = new TextDecoder('utf-8');
              text = decoder.decode(res.data);
            } catch (e) {
              text = '';
            }
          } else if (typeof res.data === 'object' && res.data !== null) {
            text = JSON.stringify(res.data);
          } else {
            text = String(res.data);
          }
          resolve(text);
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
   *    - .m3u8：后端返回纯文本 m3u8 内容（signedM3u8）
   *    - 普通视频：后端返回 { code: 0, data: { url: '...' } }，前端取 .url
   * 2. 返回值直接作为 video src
   *    - .m3u8：返回接口 URL，让视频组件自己请求 m3u8 并解析 .ts 分片
   *    - 普通视频：返回后端签名的 URL
   *
   * @param {string} key - 七牛存储的 video_key（不含域名）
   * @returns {Promise<string>} 签名后的播放 URL（可直接用于 video src）
   */
  playUrl: async (key) => {
    // 先请求接口，根据 Content-Type 判断类型
    const data = await directRequest(
      `/video/play-url/${encodeURIComponent(key)}`,
      { responseType: 'text' }
    );
    // 尝试解析为 JSON（普通视频返回 { code: 0, data: { url } }）
    let parsed = data;
    if (typeof data === 'string') {
      try { parsed = JSON.parse(data); } catch { /* 纯文本 m3u8 内容 */ }
    }
    // 普通视频：直接返回签名 URL
    if (parsed && parsed.code === 0 && parsed.data && parsed.data.url) {
      return parsed.data.url;
    }
    // .m3u8：返回接口 URL，让视频组件自己请求 m3u8 内容
    // 视频组件用 URL 作为 src 时，自己会请求 m3u8 并正确解析相对 .ts 路径
    if (typeof data === 'string' && data.includes('#EXTM3U')) {
      return BASE_URL + `/video/play-url/${encodeURIComponent(key)}`;
    }
    throw new Error(parsed?.message || '获取视频URL失败');
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
