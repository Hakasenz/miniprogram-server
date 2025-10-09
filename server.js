// 本地开发时加载环境变量，Vercel 部署时会忽略
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');

const app = express();
app.use(bodyParser.json());

// 挂载路由
app.use('/api', authRoutes);

app.listen(3000, () => {
  console.log('后端服务已启动：http://localhost:3000');
  
});
