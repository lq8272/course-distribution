/**
 * 共享配置文件
 * 所有 API 模块统一引用此处定义的常量，避免硬编码
 *
 * 注意：在 uni-app 项目中，@/ 等效于 src/ 目录
 * 开发环境：读取 VITE_API_BASE_URL（.env.development）
 * 生产环境：替换为已备案的正式域名（.env.production）
 */
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api';
