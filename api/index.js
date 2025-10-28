const express = require('express');
const bodyParser = require('body-parser');

// 导入路由
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/project');

const app = express();
app.use(bodyParser.json());

// 使用路由
app.use('/api', authRoutes);
app.use('/api/project', projectRoutes);

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: '服务运行正常',
    timestamp: new Date().toISOString(),
    version: 'v3.0 - 模块化架构'
  });
});

module.exports = app;