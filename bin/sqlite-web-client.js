#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const { startServer } = require('../src/server/index');

// 设置版本和描述
program
  .version('1.0.0')
  .description('SQLite 客户端工具，提供命令行和 Web 界面管理 SQLite 数据库');

// 启动服务器命令
program
  .command('start')
  .description('启动 SQLite Web 客户端服务器')
  .option('-p, --port <port>', '指定服务器端口', '3000')
  .option('-d, --database <path>', '指定 SQLite 数据库文件路径')
  .action((options) => {
    const port = parseInt(options.port, 10);
    let dbPath = options.database;

    // 如果没有指定数据库路径，使用默认路径
    if (!dbPath) {
      dbPath = path.join(process.cwd(), 'sqlite-web-client.db');
      console.log(`未指定数据库路径，将使用默认路径: ${dbPath}`);
    } else {
      // 确保路径是绝对路径
      if (!path.isAbsolute(dbPath)) {
        dbPath = path.join(process.cwd(), dbPath);
      }
    }

    // 检查数据库文件是否存在，如果不存在则创建空数据库
    if (!fs.existsSync(dbPath)) {
      console.log(`数据库文件不存在，将创建新的数据库: ${dbPath}`);
      try {
        // 创建空文件
        fs.writeFileSync(dbPath, '');
      } catch (err) {
        console.error(`创建数据库文件失败: ${err.message}`);
        process.exit(1);
      }
    }

    // 启动服务器
    startServer(port, dbPath);
  });

// 解析命令行参数
program.parse(process.argv);

// 如果没有提供命令，显示帮助信息
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 