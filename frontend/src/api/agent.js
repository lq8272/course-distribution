import { api } from './index';

export const agentApi = {
  my: () => api.get('/agent/my'),
  apply: (data) => api.post('/agent/apply', data),
  stats: () => api.get('/agent/stats'),
  levels: () => api.get('/agent/levels'),
  team: () => api.get('/agent/team'),
  withdrawRecord: (params) => api.get('/agent/withdraw', params),
  // 升级相关
  upgradeProgress: () => api.get('/agent/upgrade/progress'),
  upgradeRecords: () => api.get('/agent/upgrade/records'),
  applyUpgrade: () => api.post('/agent/upgrade/apply'),
};
