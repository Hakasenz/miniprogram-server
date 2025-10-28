const AuthService = require('../services/AuthService');
const Logger = require('../utils/Logger');

class AuthController {
  constructor() {
    this.authService = new AuthService();
    this.logger = new Logger('LoginAPI');
  }

  /**
   * 用户登录接口
   */
  async login(req, res) {
    this.logger.separator('收到登录请求');
    this.logger.info('代码版本: v2.3 - 每次登录强制更新头像URL（临时地址机制）');
    this.logger.data('请求体', req.body);

    const { code, avatarUrl, nickName } = req.body;
    
    // 验证必需参数
    if (!code) {
      this.logger.error('缺少必需参数: code');
      return res.status(400).json({ error: '缺少 code' });
    }

    // 组织用户信息对象
    const userInfo = {
      nickName: nickName,
      avatarUrl: avatarUrl
    };

    try {
      this.logger.info('开始调用认证服务...');
      
      // 环境变量检查
      this.logger.info('环境变量检查:');
      this.logger.check('APPID', !!process.env.APPID);
      this.logger.check('APPSECRET', !!process.env.APPSECRET);
      this.logger.check('MONGODB_URI', !!process.env.MONGODB_URI);
      this.logger.check('DATABASE_NAME', true, process.env.DATABASE_NAME || 'miniprogram (默认)');
      
      // 调用认证服务进行登录
      const result = await this.authService.login(code, userInfo);
      this.logger.info('认证服务调用完成');

      if (result.success) {
        this.logger.success('登录成功，准备返回数据');
        this.logger.info('返回数据检查:');
        this.logger.check('openid', true, result.data.user?.openid || '未知');
        this.logger.check('user.uuid', true, result.data.user?.uuid || '未知');

        // 将数据发送给前端
        res.json({
          status: 'success',
          message: '登录成功',
          data: result.data
        });
        
        this.logger.success('登录响应已发送给客户端');
      } else {
        this.logger.error('登录失败');
        this.logger.error('失败原因:', result.error);
        this.logger.error('详细信息:', result.details);
        
        res.status(400).json({
          status: 'error',
          message: '登录失败',
          error: result.error,
          details: result.details || []
        });
        this.logger.info('错误响应已发送给客户端');
      }

    } catch (err) {
      this.logger.error('服务器异常捕获');
      this.logger.error('异常类型:', err.name);
      this.logger.error('异常信息:', err.message);
      this.logger.debug('异常堆栈:', err.stack);
      res.status(500).json({ error: '服务器错误' });
      this.logger.info('服务器错误响应已发送');
    }
  }
}

module.exports = AuthController;