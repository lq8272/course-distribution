/**
 * 数据库初始化脚本
 * 用法: npm run init-db
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mysql = require('mysql2/promise');

async function main() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    charset: 'utf8mb4',
  };

  console.log('[initDb] 连接 MySQL...');
  const conn = await mysql.createConnection(config);
  // 显式 SET NAMES + character_set_results，确保执行 init.sql 的连接使用 utf8mb4
  await conn.query('SET NAMES utf8mb4, character_set_results = utf8mb4');

  // Docker 容器内路径: /app/docker/mysql/
  // 本地开发路径: 项目根目录/docker/mysql/
  const possiblePaths = [
    path.join(__dirname, '../../../docker/mysql/init/init.sql'),
    path.join('/app/docker/mysql/init/init.sql'),
  ];
  const initSqlPath = possiblePaths.find(p => fs.existsSync(p));
  // 种子数据统一使用 init/seed.sql（含正确分销等级 DR/MXJ/CJHH）
  const seedSqlPath = initSqlPath?.replace('/init/init.sql', '/init/seed.sql');

  if (!initSqlPath) {
    console.error('[initDb] 找不到 init.sql，所有路径均不存在');
    console.error('  尝试过:', possiblePaths);
    process.exit(1);
  }

  console.log('[initDb] 执行建表脚本:', initSqlPath);
  const initSql = fs.readFileSync(initSqlPath, 'utf8');
  await conn.query(initSql);
  console.log('[initDb] 建表完成');

  const seedSqlExists = seedSqlPath && fs.existsSync(seedSqlPath);
  if (seedSqlExists) {
    console.log('[initDb] 执行种子数据:', seedSqlPath);
    const seedSql = fs.readFileSync(seedSqlPath, 'utf8');
    await conn.query(seedSql);
    console.log('[initDb] 种子数据完成');
  } else {
    console.log('[initDb] seed.sql 未找到，跳过');
  }

  await conn.end();
  console.log('[initDb] 数据库初始化成功!');
}

main().catch(err => {
  console.error('[initDb] 失败:', err.message);
  process.exit(1);
});
