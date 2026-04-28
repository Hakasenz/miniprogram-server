const AuthService = require('../services/AuthService');
const Logger = require('../utils/Logger');
const { MongoClient } = require('mongodb');

class AuthController {
  constructor() {
    this.authService = new AuthService();
    this.logger = new Logger('AuthAPI');
    this.db = null;
    this.MONGODB_URI = process.env.MONGODB_URI || 'your_mongodb_connection_string';
    this.DATABASE_NAME = process.env.DATABASE_NAME || 'miniprogram';
  }

  /**
   * 初始化数据库连接
   */
  async initDatabase() {
    if (this.db) return;
    
    try {
      const mongoClient = new MongoClient(this.MONGODB_URI);
      await mongoClient.connect();
      this.db = mongoClient.db(this.DATABASE_NAME);
      this.logger.success('MongoDB 连接成功');
    } catch (error) {
      this.logger.error('MongoDB 连接失败:', error.message);
    }
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

  /**
   * ⭐ 获取用户详细信息（包含权限信息）
   */
  async getUserInfo(req, res) {
    const logger = new Logger('AuthController.getUserInfo');
    
    logger.separator('收到获取用户信息请求');
    logger.info('开始处理...');

    try {
      const { uuid } = req.query;

      if (!uuid) {
        logger.error('缺少uuid参数');
        return res.status(400).json({
          success: false,
          error: '缺少uuid参数'
        });
      }

      logger.info(`查询用户信息: ${uuid}`);
      
      await this.initDatabase();

      if (!this.db) {
        return res.status(500).json({
          success: false,
          error: '数据库连接失败'
        });
      }

      // 查询用户信息
      const user = await this.db.collection('users').findOne(
        { uuid: uuid },
        { 
          projection: {
            uuid: 1,
            username: 1,
            nickname: 1,
            avatar_url: 1,
            rank: 1,
            position: 1,
            system_roles: 1,
            company_id: 1,
            managed_team_ids: 1,
            joined_team_ids: 1,
            created_at: 1,
            updated_at: 1
          }
        }
      );

      if (!user) {
        logger.warn(`用户不存在: ${uuid}`);
        return res.status(404).json({
          success: false,
          error: '用户不存在'
        });
      }

      logger.success('获取用户信息成功');

      res.json({
        success: true,
        data: user
      });

    } catch (err) {
      logger.error('服务器异常:', err.message);
      logger.error('错误堆栈:', err.stack);
      res.status(500).json({
        success: false,
        error: '获取用户信息时发生异常',
        details: err.message
      });
    }
  }

  /**
   * ⭐ 更新用户权限（临时权限设置）
   */
  async updatePermissions(req, res) {
    this.logger.separator('收到更新权限请求');
    
    const { uuid, role } = req.body;
    
    // 验证必需参数
    if (!uuid || !role) {
      this.logger.error('缺少必需参数: uuid 或 role');
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数' 
      });
    }

    // 定义角色配置
    const roleConfig = {
      admin: {
        position: '系统管理员',
        rank: 10,
        system_roles: ['admin'],
        managed_team_ids: []
      },
      manager: {
        position: '团队管理者',
        rank: 7,
        system_roles: [],
        managed_team_ids: []
      },
      employee: {
        position: '',
        rank: 1,
        system_roles: [],
        managed_team_ids: []
      }
    };

    const config = roleConfig[role];
    if (!config) {
      this.logger.error(`无效的角色类型: ${role}`);
      return res.status(400).json({
        success: false,
        error: '无效的角色类型，必须是 admin、manager 或 employee'
      });
    }

    try {
      await this.initDatabase();
      
      this.logger.info(`更新用户权限: uuid=${uuid}, role=${role}`);
      
      // 更新数据库中的用户信息
      const result = await this.db.collection('users').updateOne(
        { uuid: uuid },
        { 
          $set: {
            position: config.position,
            rank: config.rank,
            system_roles: config.system_roles,
            managed_team_ids: config.managed_team_ids,
            updated_at: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        this.logger.warn(`用户不存在: ${uuid}`);
        return res.status(404).json({
          success: false,
          error: '用户不存在'
        });
      }

      this.logger.success('权限更新成功');
      this.logger.data('新权限配置', config);

      // 获取更新后的用户信息
      const updatedUser = await this.db.collection('users').findOne(
        { uuid: uuid },
        {
          projection: {
            _id: 1,
            uuid: 1,
            username: 1,
            position: 1,
            rank: 1,
            system_roles: 1,
            managed_team_ids: 1,
            wechat_id: 1,
            wechat_name: 1,
            avatar_url: 1,
            company_id: 1,
            created_at: 1,
            updated_at: 1
          }
        }
      );

      res.json({
        success: true,
        message: '权限更新成功',
        data: updatedUser
      });

    } catch (err) {
      this.logger.error('更新权限失败:', err.message);
      this.logger.debug('错误堆栈:', err.stack);
      res.status(500).json({
        success: false,
        error: '服务器错误',
        message: err.message
      });
    }
  }

  /**
   * ⭐ 获取同组织成员列表（人事管理用）
   */
  async getOrganizationMembers(req, res) {
    const logger = new Logger('AuthController.getOrganizationMembers');
    
    logger.separator('收到获取组织成员请求');
    logger.info('开始处理...');

    try {
      const { company_id } = req.body;

      if (!company_id) {
        logger.error('缺少公司ID参数');
        return res.status(400).json({
          status: 'error',
          message: '缺少 company_id 参数'
        });
      }

      logger.info(`查询组织成员: ${company_id}`);
      
      await this.initDatabase();

      if (!this.db) {
        return res.status(500).json({
          status: 'error',
          message: '数据库连接失败'
        });
      }

      // 查询同一组织的所有用户
      const members = await this.db.collection('users')
        .find({ 
          company_id: company_id,
          uuid: { $ne: '' }  // 排除空UUID
        })
        .project({
          uuid: 1,
          username: 1,
          wechat_name: 1,
          avatar_url: 1,
          rank: 1,
          position: 1,
          gender: 1,
          company_id: 1
        })
        .toArray();

      logger.success(`获取到 ${members.length} 个组织成员`);

      res.json({
        status: 'success',
        data: {
          members: members
        }
      });

    } catch (err) {
      logger.error('服务器异常:', err.message);
      logger.error('错误堆栈:', err.stack);
      res.status(500).json({
        status: 'error',
        message: '获取组织成员时发生异常',
        details: err.message
      });
    }
  }

  /**
   * ⭐ 更新成员信息（rank和position）
   */
  async updateMemberInfo(req, res) {
    const logger = new Logger('AuthController.updateMemberInfo');
    
    logger.separator('收到更新成员信息请求');
    logger.info('开始处理...');

    try {
      const { target_uuid, rank, position } = req.body;

      if (!target_uuid) {
        logger.error('缺少目标用户UUID参数');
        return res.status(400).json({
          status: 'error',
          message: '缺少 target_uuid 参数'
        });
      }

      logger.info(`更新用户信息: ${target_uuid}`, { rank, position });
      
      await this.initDatabase();

      if (!this.db) {
        return res.status(500).json({
          status: 'error',
          message: '数据库连接失败'
        });
      }

      // 构建更新字段
      const updateFields = {};
      if (rank !== undefined && rank !== null) {
        updateFields.rank = parseInt(rank);
      }
      if (position !== undefined && position !== null) {
        updateFields.position = String(position);
      }
      updateFields.updated_at = new Date().toISOString();

      // 更新用户信息
      const result = await this.db.collection('users').updateOne(
        { uuid: target_uuid },
        { $set: updateFields }
      );

      if (result.matchedCount === 0) {
        logger.warn('用户不存在');
        return res.status(404).json({
          status: 'error',
          message: '用户不存在'
        });
      }

      logger.success('用户信息更新成功');

      // 获取更新后的用户信息
      const updatedUser = await this.db.collection('users').findOne(
        { uuid: target_uuid },
        {
          projection: {
            uuid: 1,
            username: 1,
            rank: 1,
            position: 1,
            updated_at: 1
          }
        }
      );

      res.json({
        status: 'success',
        message: '更新成功',
        data: updatedUser
      });

    } catch (err) {
      logger.error('服务器异常:', err.message);
      logger.error('错误堆栈:', err.stack);
      res.status(500).json({
        status: 'error',
        message: '更新成员信息时发生异常',
        details: err.message
      });
    }
  }
}

module.exports = AuthController;
