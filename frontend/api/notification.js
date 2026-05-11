import { api } from './index';

export const notificationApi = {
  list: (params) => api.get('/notifications', params),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};
