const { MongoClient } = require('mongodb');
const Logger = require('../utils/Logger');

class TeamService {
  constructor() {
    this.db = null;
    this.mongoClient = null;
    this.MONGODB_URI = process.env.MONGODB_URI;
    this.DATABASE_NAME = process.env.DATABASE_NAME || 'miniprogram';
    
    // 创建日志器实例
    this.logger = new Logger('TeamService');
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
   * 生成团队ID
   */
  generateTeamId() {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const teamId = `team-${timestamp}-${randomSuffix}`;
    this.logger.info(`生成团队ID: ${teamId}`);
    return teamId;
  }

  /**
   * 验证团队数据
   */
  validateTeamData(teamData) {
    this.logger.info('开始验证团队数据...');
    this.logger.data('待验证数据', teamData);

    const errors = [];

    // 必需字段验证
    if (!teamData.uuid || typeof teamData.uuid !== 'string' || teamData.uuid.trim() === '') {
      errors.push('用户UUID不能为空');
    }

    if (!teamData.name || typeof teamData.name !== 'string' || teamData.name.trim() === '') {
      errors.push('团队名称不能为空');
    }

    if (teamData.description !== undefined) {
      if (typeof teamData.description !== 'string') {
        errors.push('团队描述必须是字符串类型');
      }
    }

    if (teamData.max_people !== undefined) {
      if (typeof teamData.max_people !== 'number' || teamData.max_people <= 0) {
        errors.push('最大人数必须是大于0的数字');
      }
    }

    if (errors.length > 0) {
      this.logger.error('数据验证失败:', errors);
      return { valid: false, errors };
    }

    this.logger.success('数据验证通过');
    return { valid: true, errors: [] };
  }

  /**
   * 检查用户是否存在
   */
  async checkUserExists(uuid) {
    this.logger.info(`检查用户是否存在: ${uuid}`);
    
    if (!this.db) {
      this.logger.warn('数据库未连接，跳过用户验证');
      return true; // 模拟模式下假定用户存在
    }

    try {
      this.logger.database('QUERY', 'db.users.findOne({ uuid: "..." })');
      const user = await this.db.collection('users').findOne({ uuid: uuid });
      
      if (user) {
        this.logger.success(`用户存在: ${user.username} (${uuid})`);
        return true;
      } else {
        this.logger.warn(`用户不存在: ${uuid}`);
        return false;
      }
    } catch (error) {
      this.logger.error('用户查询失败:', error.message);
      return false;
    }
  }

  /**
   * 创建团队
   */
  async createTeam(teamData) {
    this.logger.startFlow('团队创建');
    this.logger.data('团队数据', teamData);

    try {
      // 1. 初始化数据库连接
      this.logger.step(1, '初始化数据库连接');
      await this.initDatabase();

      // 2. 验证团队数据
      this.logger.step(2, '验证团队数据');
      const validation = this.validateTeamData(teamData);
      if (!validation.valid) {
        this.logger.endFlow('团队创建', false);
        return {
          success: false,
          error: '数据验证失败',
          details: validation.errors
        };
      }

      // 3. 检查用户是否存在
      this.logger.step(3, '验证用户存在性');
      const userExists = await this.checkUserExists(teamData.uuid);
      if (!userExists) {
        this.logger.endFlow('团队创建', false);
        return {
          success: false,
          error: '用户不存在',
          details: [`UUID ${teamData.uuid} 对应的用户不存在`]
        };
      }

      // 4. 构建团队文档
      this.logger.step(4, '构建团队文档');
      const teamId = this.generateTeamId();
      
      const teamDocument = {
        team_id: teamId,
        name: teamData.name.trim(),
        description: teamData.description ? teamData.description.trim() : '',
        max_people: teamData.max_people || null, // null 表示无限制
        creator_uuid: teamData.uuid,
        leader_uuid: teamData.uuid, // 创建者默认为团队领导者
        members: [teamData.uuid], // 创建者默认为第一个成员
        member_count: 1,
        created_at: new Date(),
        updated_at: new Date(),
        status: 'active' // active, inactive, disbanded
      };

      this.logger.data('完整团队文档', teamDocument);

      // 5. 保存到数据库
      this.logger.step(5, '保存到数据库');
      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟成功响应');
        const mockResult = {
          team_id: teamId,
          ...teamDocument,
          _id: 'mock_team_id'
        };
        this.logger.data('模拟保存结果', mockResult);
        this.logger.endFlow('团队创建', true);
        return {
          success: true,
          data: mockResult
        };
      }

      this.logger.database('INSERT', 'db.teams.insertOne()');
      const result = await this.db.collection('teams').insertOne(teamDocument);

      if (result.insertedId) {
        this.logger.success(`团队创建成功！插入ID: ${result.insertedId}`);
        
        const savedTeam = {
          _id: result.insertedId,
          ...teamDocument
        };

        this.logger.data('保存成功的团队', savedTeam);
        this.logger.endFlow('团队创建', true);

        return {
          success: true,
          data: savedTeam
        };
      } else {
        this.logger.endFlow('团队创建', false);
        return {
          success: false,
          error: '团队保存失败',
          details: ['数据库插入操作未生效']
        };
      }

    } catch (error) {
      this.logger.error('团队创建异常:', error.message);
      this.logger.error('异常详情:', error);
      this.logger.endFlow('团队创建', false);
      return {
        success: false,
        error: '创建过程中发生异常',
        details: [error.message]
      };
    }
  }

  /**
   * 关闭数据库连接
   */
  async closeConnection() {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.logger.info('数据库连接已关闭');
    }
  }
}

module.exports = TeamService;