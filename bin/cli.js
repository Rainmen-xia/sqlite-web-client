#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const { startServer } = require('../server/index');
const packageJson = require('../package.json');

// 配置命令行选项
program
  .version(packageJson.version)
  .description('启动 SQLite Web 客户端服务器')
  .option('-p, --port <number>', '服务器端口号', '3000')
  .option('-d, --database <path>', '数据库文件路径', path.join(process.cwd(), 'sqlite-web-client.db'))
  .option('--init', '如果数据库文件不存在，是否初始化一个新的数据库', false);

// 解析命令行参数
program.parse(process.argv);
const options = program.opts();

// 启动服务器
startServer(parseInt(options.port), options.database, options.init); 