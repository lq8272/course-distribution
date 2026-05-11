import { api } from './index';

export const purchaseApi = {
  /** 获取拿货配置（价格+最低数量） */
  config: () => api.get('/purchase/config'),

  /** 获取拿货记录 */
  records: (params) => api.get('/purchase/records', params),

  /** 提交拿货申请 */
  apply: (data) => api.post('/purchase/apply', data),
};
