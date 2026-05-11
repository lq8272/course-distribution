import { api } from './index';

export const commissionApi = {
  list: (params) => api.get('/commission/list', params),
  stats: () => api.get('/commission/stats'),
  withdraw: (amount) => api.post('/commission/withdraw', { amount }),
};
