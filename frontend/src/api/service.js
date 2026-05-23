import { api } from './index';

export const serviceApi = {
  conversations: () => api.get('/service/conversations'),
  createConversation: (data) => api.post('/service/conversations', data),
  messages: (id) => api.get(`/service/messages/${id}`),
  sendMessage: (id, content) => api.post(`/service/messages/${id}`, { content }),
};

export const adminServiceApi = {
  stats: () => api.get('/admin/service/stats'),
  conversations: (params) => api.get('/admin/service/conversations', { params }),
  conversationDetail: (id) => api.get(`/admin/service/conversations/${id}`),
  messages: (id) => api.get(`/admin/service/messages/${id}`),
  sendMessage: (id, content) => api.post(`/admin/service/messages/${id}`, { content }),
  updateStatus: (id, status) => api.put(`/admin/service/conversations/${id}/status`, { status }),
};

export const feedbackApi = {
  submit: (data) => api.post('/feedbacks', data),
  list: (params) => api.get('/feedbacks', { params }),
  detail: (id) => api.get(`/feedbacks/${id}`),
};

export const adminFeedbackApi = {
  list: (params) => api.get('/admin/feedbacks', { params }),
  detail: (id) => api.get(`/admin/feedbacks/${id}`),
  reply: (id, data) => api.put(`/admin/feedbacks/${id}/reply`, data),
  stats: () => api.get('/admin/feedbacks/stats/summary'),
};
