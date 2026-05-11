const mysql = require('mysql2/promise');
const config = require('./index');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      waitForConnections: config.database.waitForConnections,
      connectionLimit: config.database.connectionLimit,
      queueLimit: config.database.queueLimit,
      timezone: '+08:00',
      dateStrings: true,
      charset: 'utf8mb4',
      // initSql 在 pool.connect() 时对每个新连接执行，确保 session 变量正确
      initSql: ['SET NAMES utf8mb4', 'SET character_set_results = utf8mb4'],
    });
  }
  return pool;
}

// 供 health check 使用
async function checkConnection() {
  try {
    const conn = await getPool().getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch (e) {
    return false;
  }
}

async function query(sql, params) {
  const conn = await getConnection();
  try {
    const [rows] = await conn.query(sql, params);
    return rows;
  } finally {
    conn.release();
  }
}

async function execute(sql, params) {
  const conn = await getConnection();
  try {
    const [result] = await conn.execute(sql, params);
    return result;
  } finally {
    conn.release();
  }
}

async function getConnection() {
  const conn = await getPool().getConnection();
  // 双重保障：连接建立后再次设置字符集，防止服务端 init_connect 未执行
  await conn.query('SET NAMES utf8mb4, character_set_results = utf8mb4');
  return conn;
}

module.exports = { getPool, query, execute, getConnection, checkConnection };
