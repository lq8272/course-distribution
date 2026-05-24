import { api } from './index.js';

export const agentApi = {
  login: (data) => api.post('/agent/login', data),
  logout: () => api.post('/agent/logout'),
  info: () => api.get('/agent/info'),

  // 会话
  conversations: (params) => api.get('/agent/conversations', { params }),
  messages: (id, params) => api.get(`/agent/conversations/${id}/messages`, { params }),
  reply: (id, data) => api.post(`/agent/conversations/${id}/reply`, data),
  close: (id) => api.put(`/agent/conversations/${id}/close`),

  // 队列
  queue: () => api.get('/agent/queue'),
  claim: (id) => api.post(`/agent/queue/${id}/claim`),
};
