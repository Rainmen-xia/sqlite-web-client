const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/database');
const apiRoutes = require('./routes/api');

// 存储数据库连接实例
let dbInstance = null;

/**
 * 启动服务器
 * @param {number} port - 服务器端口
 * @param {string} dbPath - 数据库文件路径
 */
function startServer(port, dbPath) {
  const app = express();

  // 初始化数据库连接
  try {
    dbInstance = initDatabase(dbPath);
    console.log(`成功连接到数据库: ${dbPath}`);
  } catch (err) {
    console.error(`连接数据库失败: ${err.message}`);
    process.exit(1);
  }

  // 中间件
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 静态文件服务
  app.use(express.static(path.join(__dirname, '../client/public')));

  // API 路由
  app.use('/api', apiRoutes);

  // 前端路由 - 所有未匹配的路由返回 index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/index.html'));
  });

  // 启动服务器
  app.listen(port, () => {
    console.log(`SQLite Web 客户端服务器已启动: http://localhost:${port}`);
  });

  // 处理进程退出
  process.on('SIGINT', () => {
    console.log('正在关闭服务器...');
    if (dbInstance) {
      dbInstance.close();
      console.log('数据库连接已关闭');
    }
    process.exit(0);
  });
}

// 如果直接运行此文件
if (require.main === module) {
  const port = process.env.PORT || 3000;
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'sqlite-web-client.db');
  startServer(port, dbPath);
}

module.exports = { startServer }; 