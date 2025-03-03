const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const readExcelFile = require('read-excel-file');
const csvParser = require('csv-parser');
const iconv = require('iconv-lite');
const { 
  executeQuery, 
  executeRun, 
  executeGet 
} = require('../db/database');
const { chatWithLLM } = require('../controllers/llmController');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    // 确保上传目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // 接受 Excel 和 CSV 文件
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/csv' ||
      file.originalname.endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('只接受 Excel 或 CSV 文件!'), false);
    }
  },
  // 添加文件大小限制，防止过大的文件导致处理问题
  limits: {
    fileSize: 10 * 1024 * 1024 // 限制为10MB
  }
});

// 获取数据库信息
router.get('/info', (req, res) => {
  try {
    // 获取 SQLite 版本
    const versionInfo = executeGet('SELECT sqlite_version() as version');
    
    // 获取所有表
    const tables = executeQuery(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    res.json({
      version: versionInfo.version,
      tables: tables.map(t => t.name)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取所有表
router.get('/tables', (req, res) => {
  try {
    const tables = executeQuery(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    res.json(tables.map(t => t.name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取表结构
router.get('/tables/:tableName/schema', (req, res) => {
  try {
    const { tableName } = req.params;
    
    // 检查表是否存在
    const tableExists = executeGet(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name = ?
    `, [tableName]);
    
    if (!tableExists) {
      return res.status(404).json({ error: '表不存在' });
    }
    
    // 获取表结构
    const schema = executeQuery(`PRAGMA table_info(${tableName})`);
    
    res.json(schema);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取表数据
router.get('/tables/:tableName/data', (req, res) => {
  try {
    const { tableName } = req.params;
    const { page = 1, limit = 50, orderBy, order = 'ASC' } = req.query;
    
    // 检查表是否存在
    const tableExists = executeGet(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name = ?
    `, [tableName]);
    
    if (!tableExists) {
      return res.status(404).json({ error: '表不存在' });
    }
    
    // 构建查询
    let query = `SELECT * FROM ${tableName}`;
    
    // 添加排序
    if (orderBy) {
      query += ` ORDER BY ${orderBy} ${order}`;
    }
    
    // 添加分页
    const offset = (page - 1) * limit;
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    // 执行查询
    const data = executeQuery(query);
    
    // 获取总记录数
    const countResult = executeGet(`SELECT COUNT(*) as count FROM ${tableName}`);
    const total = countResult.count;
    
    res.json({
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 执行自定义 SQL 查询
router.post('/query', (req, res) => {
  try {
    const { sql } = req.body;
    
    if (!sql) {
      return res.status(400).json({ error: 'SQL 查询不能为空' });
    }
    
    // 检查是否是查询语句
    const isQuery = sql.trim().toUpperCase().startsWith('SELECT');
    
    if (isQuery) {
      const result = executeQuery(sql);
      res.json({ result });
    } else {
      const result = executeRun(sql);
      res.json({ 
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 上传 Excel 或 CSV 文件并预览
router.post('/excel/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    
    const filePath = req.file.path;
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在或上传失败' });
    }
    
    // 检查文件大小
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      fs.unlinkSync(filePath); // 删除空文件
      return res.status(400).json({ error: '上传的文件为空' });
    }
    
    // 判断文件类型
    const isCSV = req.file.originalname.toLowerCase().endsWith('.csv');
    
    if (isCSV) {
      // 处理 CSV 文件
      const results = [];
      const headers = [];
      
      // 使用iconv-lite处理编码
      fs.createReadStream(filePath)
        .pipe(iconv.decodeStream('gbk')) // 尝试以GBK解码，这是中文常用编码
        .pipe(iconv.encodeStream('utf-8')) // 确保输出为UTF-8
        .pipe(csvParser())
        .on('headers', (csvHeaders) => {
          // 保存列名
          headers.push(...csvHeaders);
        })
        .on('data', (data) => {
          results.push(data);
        })
        .on('end', () => {
          if (headers.length === 0) {
            fs.unlinkSync(filePath); // 删除无效文件
            return res.status(400).json({ error: 'CSV文件不包含有效的列名' });
          }
          
          res.json({
            headers,
            data: results.slice(0, 10), // 只返回前 10 行预览
            totalRows: results.length,
            filePath
          });
        })
        .on('error', (err) => {
          // 删除无效文件
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          
          res.status(500).json({ error: `读取 CSV 文件失败: ${err.message}` });
        });
    } else {
      // 处理 Excel 文件
      readExcelFile(filePath).then(rows => {
        // 检查是否有数据
        if (!rows || rows.length === 0) {
          fs.unlinkSync(filePath); // 删除无效文件
          return res.status(400).json({ error: 'Excel文件不包含任何数据' });
        }
        
        // 第一行作为列名
        const headers = rows[0];
        
        // 检查列名是否有效
        if (!headers || headers.length === 0) {
          fs.unlinkSync(filePath); // 删除无效文件
          return res.status(400).json({ error: 'Excel文件不包含有效的列名' });
        }
        
        const data = rows.slice(1).map(row => {
          const rowData = {};
          headers.forEach((header, index) => {
            rowData[header] = row[index];
          });
          return rowData;
        });
        
        res.json({
          headers,
          data: data.slice(0, 10), // 只返回前 10 行预览
          totalRows: data.length,
          filePath
        });
      }).catch(err => {
        // 删除无效文件
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        // 提供更详细的错误信息
        let errorMessage = `读取 Excel 文件失败: ${err.message}`;
        
        if (err.message.includes('invalid zip')) {
          errorMessage = '无效的Excel文件格式。请确保上传的是有效的.xlsx或.xls文件，而不是其他格式的文件（如CSV）重命名的文件。';
        }
        
        res.status(500).json({ error: errorMessage });
      });
    }
  } catch (err) {
    // 确保在出错时删除上传的文件
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: `处理文件时出错: ${err.message}` });
  }
});

// 从 Excel 或 CSV 创建表并导入数据
router.post('/excel/import', (req, res) => {
  try {
    const { filePath, tableName, columns } = req.body;
    
    if (!filePath || !tableName || !columns || !columns.length) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查表名是否有效（只允许字母、数字和下划线）
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return res.status(400).json({ error: '表名只能包含字母、数字和下划线' });
    }
    
    // 检查列名是否有效
    for (const col of columns) {
      if (!col.name || !/^[a-zA-Z0-9_]+$/.test(col.name)) {
        return res.status(400).json({ error: `列名 "${col.name}" 无效，只能包含字母、数字和下划线` });
      }
      
      if (!col.type || !['TEXT', 'INTEGER', 'REAL', 'BLOB', 'NULL'].includes(col.type)) {
        return res.status(400).json({ error: `列 "${col.name}" 的数据类型 "${col.type}" 无效` });
      }
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在或已被删除，请重新上传' });
    }
    
    // 检查表是否已存在
    const tableExists = executeGet(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name = ?
    `, [tableName]);
    
    if (tableExists) {
      return res.status(400).json({ error: '表已存在' });
    }
    
    // 判断文件类型
    const isCSV = filePath.toLowerCase().endsWith('.csv');
    
    if (isCSV) {
      // 处理 CSV 文件
      const results = [];
      
      // 使用iconv-lite处理编码
      fs.createReadStream(filePath)
        .pipe(iconv.decodeStream('gbk')) // 尝试以GBK解码，这是中文常用编码
        .pipe(iconv.encodeStream('utf-8')) // 确保输出为UTF-8
        .pipe(csvParser())
        .on('data', (data) => {
          results.push(data);
        })
        .on('end', () => {
          try {
            // 创建表
            const createTableSQL = `
              CREATE TABLE ${tableName} (
                ${columns.map(col => `${col.name} ${col.type}`).join(', ')}
              )
            `;
            
            executeRun(createTableSQL);
            
            if (results.length === 0) {
              // 删除临时文件
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
              return res.json({ message: '表已创建，但没有数据可导入' });
            }
            
            // 构建插入语句
            const placeholders = columns.map(() => '?').join(', ');
            const insertSQL = `INSERT INTO ${tableName} VALUES (${placeholders})`;
            
            // 批量插入数据
            let insertedCount = 0;
            let errorCount = 0;
            
            results.forEach((row, index) => {
              try {
                // 准备行数据
                const rowData = columns.map(col => {
                  // 如果是源自文件的列，使用对应的值
                  if (col.sourceHeader) {
                    return row[col.sourceHeader] || null;
                  }
                  // 如果是新增列，返回null
                  return null;
                });
                
                executeRun(insertSQL, rowData);
                insertedCount++;
              } catch (err) {
                errorCount++;
                console.error(`插入第 ${index + 1} 行失败: ${err.message}`);
              }
            });
            
            // 删除临时文件
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            
            let message = `表 ${tableName} 已创建并导入了 ${insertedCount} 行数据`;
            if (errorCount > 0) {
              message += `，${errorCount} 行数据导入失败`;
            }
            
            res.json({ message });
          } catch (err) {
            // 如果创建表或插入数据失败，尝试删除已创建的表
            try {
              executeRun(`DROP TABLE IF EXISTS ${tableName}`);
            } catch (dropErr) {
              console.error(`删除表失败: ${dropErr.message}`);
            }
            
            // 删除临时文件
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            
            res.status(500).json({ error: `创建表或插入数据失败: ${err.message}` });
          }
        })
        .on('error', (err) => {
          // 删除临时文件
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          
          res.status(500).json({ error: `读取 CSV 文件失败: ${err.message}` });
        });
    } else {
      // 处理 Excel 文件
      readExcelFile(filePath).then(rows => {
        // 检查是否有数据
        if (!rows || rows.length <= 1) { // 只有表头或没有数据
          fs.unlinkSync(filePath); // 删除临时文件
          return res.status(400).json({ error: '文件不包含足够的数据行' });
        }
        
        try {
          // 创建表
          const createTableSQL = `
            CREATE TABLE ${tableName} (
              ${columns.map(col => `${col.name} ${col.type}`).join(', ')}
            )
          `;
          
          executeRun(createTableSQL);
          
          // 准备插入数据
          const data = rows.slice(1); // 跳过表头
          const headers = rows[0]; // 表头行
          
          if (data.length === 0) {
            return res.json({ message: '表已创建，但没有数据可导入' });
          }
          
          // 构建插入语句
          const placeholders = columns.map(() => '?').join(', ');
          const insertSQL = `INSERT INTO ${tableName} VALUES (${placeholders})`;
          
          // 创建源列名到索引的映射
          const headerIndexMap = {};
          headers.forEach((header, index) => {
            headerIndexMap[header] = index;
          });
          
          // 批量插入数据
          let insertedCount = 0;
          let errorCount = 0;
          
          data.forEach((row, rowIndex) => {
            try {
              // 准备行数据
              const rowData = columns.map(col => {
                // 如果是源自文件的列，使用对应的值
                if (col.sourceHeader && headerIndexMap[col.sourceHeader] !== undefined) {
                  return row[headerIndexMap[col.sourceHeader]] || null;
                }
                // 如果是新增列，返回null
                return null;
              });
              
              executeRun(insertSQL, rowData);
              insertedCount++;
            } catch (err) {
              errorCount++;
              console.error(`插入第 ${rowIndex + 2} 行失败: ${err.message}`);
            }
          });
          
          // 删除临时文件
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          
          let message = `表 ${tableName} 已创建并导入了 ${insertedCount} 行数据`;
          if (errorCount > 0) {
            message += `，${errorCount} 行数据导入失败`;
          }
          
          res.json({ message });
        } catch (err) {
          // 如果创建表或插入数据失败，尝试删除已创建的表
          try {
            executeRun(`DROP TABLE IF EXISTS ${tableName}`);
          } catch (dropErr) {
            console.error(`删除表失败: ${dropErr.message}`);
          }
          
          // 删除临时文件
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          
          res.status(500).json({ error: `创建表或插入数据失败: ${err.message}` });
        }
      }).catch(err => {
        // 删除临时文件
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        // 提供更详细的错误信息
        let errorMessage = `导入失败: ${err.message}`;
        
        if (err.message.includes('invalid zip')) {
          errorMessage = '无效的Excel文件格式。请确保上传的是有效的.xlsx或.xls文件，而不是其他格式的文件（如CSV）重命名的文件。';
        }
        
        res.status(500).json({ error: errorMessage });
      });
    }
  } catch (err) {
    res.status(500).json({ error: `处理导入请求时出错: ${err.message}` });
  }
});

// LLM聊天API端点
router.post('/chat', async (req, res) => {
  try {
    const { token, url, model, messages } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: '缺少LLM API令牌' });
    }
    
    if (!url) {
      return res.status(400).json({ error: '缺少LLM API URL' });
    }
    
    if (!model) {
      return res.status(400).json({ error: '缺少LLM模型名称' });
    }
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '消息格式无效' });
    }
    
    const llmResponse = await chatWithLLM(token, url, model, messages);
    res.json(llmResponse);
  } catch (error) {
    console.error('LLM聊天请求失败:', error);
    res.status(500).json({ 
      error: '与LLM通信失败', 
      details: error.message 
    });
  }
});

module.exports = router; 