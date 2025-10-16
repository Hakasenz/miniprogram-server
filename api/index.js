const express = require('express');
const bodyParser = require('body-parser');
const AuthService = require('./services/AuthService');
const Logger = require('./utils/Logger');

const app = express();
app.use(bodyParser.json());

// 创建服务实例
const authService = new AuthService();
const logger = new Logger('LoginAPI');

// 登录接口
app.post('/api/login', async (req, res) => {
  logger.separator('收到登录请求');
  logger.info('代码版本: v2.3 - 每次登录强制更新头像URL（临时地址机制）');
  logger.data('请求体', req.body);

  const { code, avatarUrl, nickName } = req.body;
  
  // 验证必需参数
  if (!code) {
    logger.error('缺少必需参数: code');
    return res.status(400).json({ error: '缺少 code' });
  }

  // 组织用户信息对象
  const userInfo = {
    nickName: nickName,
    avatarUrl: avatarUrl
  };

  try {
    logger.info('开始调用认证服务...');
    
    // 环境变量检查
    logger.info('环境变量检查:');
    logger.check('APPID', !!process.env.APPID);
    logger.check('APPSECRET', !!process.env.APPSECRET);
    logger.check('MONGODB_URI', !!process.env.MONGODB_URI);
    logger.check('DATABASE_NAME', true, process.env.DATABASE_NAME || 'miniprogram (默认)');
    
    // 调用认证服务进行登录
    const result = await authService.login(code, userInfo);
    logger.info('认证服务调用完成');

    if (result.success) {
      logger.success('登录成功，准备返回数据');
      logger.info('返回数据检查:');
      logger.check('session_token', !!result.data.session_token);
      logger.check('user.uuid', true, result.data.user?.uuid || '未知');
      logger.check('user.avatar_url', !!result.data.user?.avatar_url, result.data.user?.avatar_url || '无头像');
      logger.check('isNewUser', true, result.data.isNewUser);
      
      // 添加完整的返回数据日志以便调试
      logger.data('完整返回数据结构', result.data);
      
      res.json(result.data);
      logger.success('响应已发送给客户端');
      logger.complete('登录请求处理完成');
    } else {
      logger.error('登录失败');
      logger.error(`失败原因: ${result.error}`);
      res.status(400).json({ error: result.error });
      logger.info('错误响应已发送给客户端');
    }

  } catch (err) {
    logger.error('服务器异常捕获');
    logger.error('异常类型:', err.name);
    logger.error('异常信息:', err.message);
    logger.debug('异常堆栈:', err.stack);
    res.status(500).json({ error: '服务器错误' });
    logger.info('服务器错误响应已发送');
  }
});

module.exports = app;
