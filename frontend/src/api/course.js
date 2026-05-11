import { api } from './index';

export const courseApi = {
  list: (params) => api.get('/course/list', params),
  detail: (id) => api.get(`/course/detail/${id}`),
  categories: () => api.get('/course/categories'),
  create: (data) => api.post('/course/create', data),
  update: (id, data) => api.put(`/course/${id}`, data),
  // 管理员分类 CRUD
  categoryList: () => api.get('/admin/category/list'),
  categoryCreate: (data) => api.post('/admin/category', data),
  categoryUpdate: (id, data) => api.put(`/admin/category/${id}`, data),
  categoryDelete: (id) => api.delete(`/admin/category/${id}`),
};
