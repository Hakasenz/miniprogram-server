const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');
const Logger = require('../utils/Logger');

class AuthService {
  constructor() {
    this.db = null;
    this.mongoClient = null;
    this.APPID = process.env.APPID;
    this.APPSECRET = process.env.APPSECRET;
    this.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
    this.MONGODB_URI = process.env.MONGODB_URI;
    this.DATABASE_NAME = process.env.DATABASE_NAME || 'miniprogram';
    
    // 创建日志器实例
    this.logger = new Logger('AuthService');
  }

  /**
   * 初始化数据库连接
   */
  async initDatabase() {
    this.logger.info('开始初始化数据库连接...');
    this.logger.debug(`数据库连接状态 - db: ${!!this.db}, URI: ${!!this.MONGODB_URI}`);
    
    if (!this.db && this.MONGODB_URI) {
      try {
        this.logger.database('CONNECT', '正在连接到 MongoDB Atlas...');
        this.mongoClient = new MongoClient(this.MONGODB_URI);
        await this.mongoClient.connect();
        this.db = this.mongoClient.db(this.DATABASE_NAME);
        this.logger.success(`MongoDB 连接成功！数据库: ${this.DATABASE_NAME}`);
        
        // 测试数据库连接
        await this.db.admin().ping();
        this.logger.success('数据库 ping 测试成功');
      } catch (error) {
        this.logger.error('MongoDB 连接失败:', error.message);
        this.logger.error('错误详情:', error);
      }
    } else if (this.db) {
      this.logger.success('数据库连接已存在，跳过初始化');
    } else {
      this.logger.error('缺少 MONGODB_URI 环境变量');
    }
  }

  /**
   * 调用微信接口获取用户信息
   */
  async getWeChatSession(code) {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${this.APPID}&secret=${this.APPSECRET}&js_code=${code}&grant_type=authorization_code`;
    
    try {
      this.logger.api('GET', 'WeChat jscode2session', '调用微信接口验证登录凭证');
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.errcode) {
        throw new Error(data.errmsg || '微信接口调用失败');
      }
      
      this.logger.success('微信接口调用成功');
      this.logger.data('微信返回数据', { openid: data.openid, session_key_length: data.session_key?.length });
      return data;
    } catch (error) {
      this.logger.error('微信接口调用失败:', error.message);
      throw error;
    }
  }

  /**
   * 生成用户 UUID
   */
  async generateUserUuid() {
    this.logger.info('开始生成用户 UUID...');
    
    if (!this.db) {
      const fallbackUuid = `u-${Date.now()}`;
      this.logger.error(`数据库未连接，使用时间戳 UUID: ${fallbackUuid}`);
      return fallbackUuid;
    }
    
    try {
      this.logger.database('QUERY', '查询最后一个用户的 UUID...');
      const lastUser = await this.db.collection('users').findOne(
        { uuid: { $regex: /^u-\d+$/ } },
        { sort: { uuid: -1 } }
      );
      
      let newUuid;
      if (lastUser && lastUser.uuid) {
        const lastNumber = parseInt(lastUser.uuid.split('-')[1]);
        const nextNumber = lastNumber + 1;
        newUuid = `u-${String(nextNumber).padStart(3, '0')}`;
        this.logger.success(`基于最后用户 ${lastUser.uuid}，生成新 UUID: ${newUuid}`);
      } else {
        newUuid = 'u-001';
        this.logger.success('没有现有用户，生成首个 UUID: u-001');
      }
      
      return newUuid;
    } catch (error) {
      const fallbackUuid = `u-${Date.now()}`;
      this.logger.error('UUID 生成失败，使用时间戳:', error.message);
      this.logger.info(`回退 UUID: ${fallbackUuid}`);
      return fallbackUuid;
    }
  }

  /**
   * 根据微信 openid 查找用户
   */
  async findUserByOpenId(openid) {
    this.logger.debug(`开始查询用户: ${openid}`);
    
    if (!this.db) {
      this.logger.error('数据库未连接，返回 null');
      return null;
    }
    
    try {
      this.logger.database('QUERY', 'db.users.findOne({ wechat_id: "..." })');
      const user = await this.db.collection('users').findOne({ wechat_id: openid });
      
      if (user) {
        this.logger.success(`找到现有用户: ${user.uuid} (${user.username})`);
        this.logger.info(`用户创建时间: ${user.created_at}`);
      } else {
        this.logger.warn('用户不存在，需要创建新用户');
      }
      
      return user;
    } catch (error) {
      this.logger.error('数据库查询失败:', error.message);
      this.logger.error('查询错误详情:', error);
      return null;
    }
  }

  /**
   * 创建新用户
   */
  async createUser(openid, userInfo) {
    this.logger.info(`开始创建新用户: openid=${openid}`);
    this.logger.data('用户信息', userInfo);
    
    if (!this.db) {
      this.logger.error('数据库未连接，返回模拟用户');
      const mockUser = {
        _id: 'mock_id',
        uuid: 'u-mock',
        username: userInfo?.nickName || '微信用户',
        gender: this.parseGender(userInfo?.gender),
        position: '',
        wechat_id: openid,
        wechat_name: userInfo?.nickName || '',
        company_id: '',
        created_at: new Date()
      };
      this.logger.data('模拟用户数据', mockUser);
      return mockUser;
    }

    try {
      this.logger.info('子步骤1: 生成用户 UUID...');
      const uuid = await this.generateUserUuid();
      
      this.logger.info('子步骤2: 构建新用户对象...');
      const newUser = {
        uuid: uuid,
        username: userInfo?.nickName || '微信用户',
        gender: this.parseGender(userInfo?.gender),
        position: '',
        wechat_id: openid,
        wechat_name: userInfo?.nickName || '',
        company_id: '',
        created_at: new Date()
      };
      
      this.logger.data('即将插入的用户数据', newUser);
      
      this.logger.info('子步骤3: 执行数据库插入...');
      this.logger.database('INSERT', 'db.users.insertOne()');
      const result = await this.db.collection('users').insertOne(newUser);
      
      this.logger.success(`用户创建成功！插入ID: ${result.insertedId}`);
      this.logger.success(`新用户 UUID: ${uuid}`);
      this.logger.success(`用户名: ${newUser.username}`);
      
      const finalUser = { _id: result.insertedId, ...newUser };
      this.logger.data('最终用户对象', finalUser);
      
      return finalUser;
    } catch (error) {
      this.logger.error('创建用户失败:', error.message);
      this.logger.error('错误详情:', error);
      throw error;
    }
  }

  /**
   * 解析微信性别字段
   */
  parseGender(genderCode) {
    if (genderCode === 1) return '男';
    if (genderCode === 2) return '女';
    return '';
  }

  /**
   * 生成 JWT Token
   */
  generateToken(user) {
    return jwt.sign(
      { 
        uuid: user.uuid, 
        openid: user.wechat_id 
      }, 
      this.JWT_SECRET, 
      { expiresIn: '7d' }
    );
  }

  /**
   * 主要登录方法
   */
  async login(code, userInfo) {
    this.logger.startFlow('用户登录');
    this.logger.data('输入参数 - code', code);
    this.logger.data('用户信息', userInfo);
    
    try {
      // 1. 初始化数据库连接
      this.logger.step(1, '初始化数据库连接');
      await this.initDatabase();

      // 2. 调用微信接口
      this.logger.step(2, '调用微信 jscode2session 接口');
      const wxData = await this.getWeChatSession(code);
      this.logger.auth(`获得 openid: ${wxData.openid}`);
      this.logger.auth(`session_key 长度: ${wxData.session_key?.length}`);

      // 3. 查找或创建用户
      this.logger.step(3, '用户数据处理');
      let user = await this.findUserByOpenId(wxData.openid);
      let isNewUser = false;

      if (!user) {
        this.logger.info('检测到新用户，开始创建流程...');
        user = await this.createUser(wxData.openid, userInfo);
        isNewUser = true;
        this.logger.success('新用户创建完成');
      } else {
        this.logger.info(`现有用户登录: ${user.uuid} (${user.username})`);
        this.logger.info(`用户注册时间: ${user.created_at}`);
      }

      // 4. 生成 JWT token
      this.logger.step(4, '生成访问令牌');
      const token = this.generateToken(user);
      this.logger.auth('JWT token 生成成功');
      this.logger.auth(`Token 载荷: uuid=${user.uuid}, openid=${user.wechat_id}`);

      // 5. 构建返回数据
      this.logger.step(5, '构建响应数据');
      const responseData = {
        status: 'success',
        message: '登录成功',
        session_token: token,
        user: user,
        isNewUser: isNewUser,
        loginTime: new Date().toISOString()
      };
      
      this.logger.success('响应数据构建完成');
      this.logger.info(`用户类型: ${isNewUser ? '新用户' : '老用户'}`);
      this.logger.info(`用户ID: ${user.uuid}`);
      this.logger.endFlow('用户登录', true);

      return {
        success: true,
        data: responseData
      };

    } catch (error) {
      this.logger.error('登录流程异常 - 错误类型:', error.name);
      this.logger.error('错误信息:', error.message);
      this.logger.debug('错误堆栈:', error.stack);
      this.logger.endFlow('用户登录', false);
      
      return {
        success: false,
        error: error.message || '登录失败'
      };
    }
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    if (this.mongoClient) {
      await this.mongoClient.close();
      console.log('[AuthService] MongoDB 连接已关闭');
    }
  }
}

module.exports = AuthService;