import { api } from './index';

export const orderApi = {
  create: (data) => api.post('/order/create', data),
  list: (params) => api.get('/order/list', params),
  detail: (id) => api.get(`/order/${id}`),
  confirm: (id) => api.post(`/order/${id}/confirm`),
};
