import { api } from './index';

export const teamApi = {
  overview: () => api.get('/team/overview'),
  tree: (params) => api.get('/team/tree', { params }),
};
