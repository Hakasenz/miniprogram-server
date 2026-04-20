const express = require('express');
const bodyParser = require('body-parser');

// 导入路由
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/project');
const teamRoutes = require('./routes/team');
const messageRoutes = require('./routes/message');
const reportRoutes = require('./routes/report'); //报表路由
const noticeRoutes = require('./routes/notice'); //通知路由

const app = express();
app.use(bodyParser.json());

// 使用路由
app.use('/api', authRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/report', reportRoutes); //报表路由
app.use('/api/notices', noticeRoutes); //通知路由

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
