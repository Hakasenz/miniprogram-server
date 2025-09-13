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
