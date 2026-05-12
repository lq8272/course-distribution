#!/usr/bin/env node
/**
 * ensure-user-api.js
 * 确保用户相关 API 页面配置正确
 * 目前为占位脚本，构建已成功
 */
const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'dist', 'build', 'mp-weixin', 'pages');
const userDir = path.join(pagesDir, 'user');

if (fs.existsSync(userDir)) {
  console.log('[ensure-user-api] user page directory exists:', userDir);
} else {
  console.log('[ensure-user-api] user page directory not found, skipping');
}
