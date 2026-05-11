import { api } from './index';

export const authApi = {
  login: (code, nickname, promotionCode) => api.post('/auth/login', { code, nickname, promotion_code: promotionCode }),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: (token) => api.post('/auth/logout', { token }),
  userinfo: () => api.get('/auth/userinfo'),
};
