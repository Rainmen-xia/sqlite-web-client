const Database = require('better-sqlite3');

let db = null;

/**
 * 初始化数据库连接
 * @param {string} dbPath - 数据库文件路径
 * @returns {object} 数据库连接实例
 */
function initDatabase(dbPath) {
  try {
    db = new Database(dbPath, { verbose: console.log });
    
    // 启用外键约束
    db.pragma('foreign_keys = ON');
    
    return db;
  } catch (err) {
    console.error(`初始化数据库失败: ${err.message}`);
    throw err;
  }
}

/**
 * 获取数据库连接实例
 * @returns {object} 数据库连接实例
 */
function getDatabase() {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
}

/**
 * 执行 SQL 查询
 * @param {string} sql - SQL 查询语句
 * @param {Array} params - 查询参数
 * @returns {Array} 查询结果
 */
function executeQuery(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(params);
  } catch (err) {
    console.error(`执行查询失败: ${err.message}`);
    throw err;
  }
}

/**
 * 执行 SQL 语句（不返回结果）
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数
 * @returns {object} 执行结果
 */
function executeRun(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.run(params);
  } catch (err) {
    console.error(`执行语句失败: ${err.message}`);
    throw err;
  }
}

/**
 * 执行事务
 * @param {Function} callback - 事务回调函数
 * @returns {any} 事务执行结果
 */
function executeTransaction(callback) {
  const transaction = db.transaction(callback);
  return transaction();
}

/**
 * 获取单行结果
 * @param {string} sql - SQL 查询语句
 * @param {Array} params - 查询参数
 * @returns {object|undefined} 查询结果
 */
function executeGet(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.get(params);
  } catch (err) {
    console.error(`执行查询失败: ${err.message}`);
    throw err;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  executeQuery,
  executeRun,
  executeTransaction,
  executeGet
}; 