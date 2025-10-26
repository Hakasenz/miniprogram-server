const { MongoClient } = require('mongodb');
const Logger = require('../utils/Logger');

class ProjectService {
  constructor() {
    this.db = null;
    this.mongoClient = null;
    this.MONGODB_URI = process.env.MONGODB_URI;
    this.DATABASE_NAME = process.env.DATABASE_NAME || 'miniprogram';
    
    // 创建日志器实例
    this.logger = new Logger('ProjectService');
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
   * 验证项目数据
   */
  validateProjectData(projectData) {
    this.logger.info('开始验证项目数据...');
    this.logger.data('待验证数据', projectData);

    const errors = [];

    // 必需字段验证
    if (!projectData.name || typeof projectData.name !== 'string' || projectData.name.trim() === '') {
      errors.push('项目名称不能为空');
    }

    if (!projectData.people || typeof projectData.people !== 'number' || projectData.people <= 0) {
      errors.push('人数必须是大于0的数字');
    }

    if (!projectData.group || typeof projectData.group !== 'string' || projectData.group.trim() === '') {
      errors.push('小组名称不能为空');
    }

    if (!projectData.uuid || typeof projectData.uuid !== 'string' || projectData.uuid.trim() === '') {
      errors.push('用户UUID不能为空');
    }

    if (!projectData.submitTime) {
      errors.push('提交时间不能为空');
    } else {
      // 验证时间格式
      const submitDate = new Date(projectData.submitTime);
      if (isNaN(submitDate.getTime())) {
        errors.push('提交时间格式不正确');
      }
    }

    // 验证可选字段
    if (projectData.members !== undefined) {
      if (!Array.isArray(projectData.members)) {
        errors.push('成员列表必须是数组格式');
      } else {
        // 验证成员列表中的每个UUID格式
        for (let i = 0; i < projectData.members.length; i++) {
          if (!projectData.members[i] || typeof projectData.members[i] !== 'string') {
            errors.push(`成员列表第${i + 1}项UUID格式不正确`);
          }
        }
      }
    }

    if (projectData.leader !== undefined) {
      if (!projectData.leader || typeof projectData.leader !== 'string' || projectData.leader.trim() === '') {
        errors.push('领导者UUID格式不正确');
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
   * 生成项目ID
   */
  generateProjectId() {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const projectId = `proj-${timestamp}-${randomSuffix}`;
    this.logger.info(`生成项目ID: ${projectId}`);
    return projectId;
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
   * 保存项目到数据库
   */
  async saveProject(projectData) {
    this.logger.startFlow('项目保存');
    this.logger.data('项目数据', projectData);

    try {
      // 1. 初始化数据库连接
      this.logger.step(1, '初始化数据库连接');
      await this.initDatabase();

      // 2. 验证项目数据
      this.logger.step(2, '验证项目数据');
      const validation = this.validateProjectData(projectData);
      if (!validation.valid) {
        this.logger.endFlow('项目保存', false);
        return {
          success: false,
          error: '数据验证失败',
          details: validation.errors
        };
      }

      // 3. 检查用户是否存在
      this.logger.step(3, '验证用户存在性');
      const userExists = await this.checkUserExists(projectData.uuid);
      if (!userExists) {
        this.logger.endFlow('项目保存', false);
        return {
          success: false,
          error: '用户不存在',
          details: [`UUID ${projectData.uuid} 对应的用户不存在`]
        };
      }

      // 4. 构建项目文档
      this.logger.step(4, '构建项目文档');
      const projectId = this.generateProjectId();
      
      // 构建成员列表和领导者
      // 如果前端传入了members，使用传入的；否则默认只有提交者
      const members = projectData.members && Array.isArray(projectData.members) 
        ? projectData.members 
        : [projectData.uuid]; // 默认至少包含提交者
      
      // 确保提交者在成员列表中
      if (!members.includes(projectData.uuid)) {
        members.push(projectData.uuid);
      }
      
      // 领导者默认为提交者，但如果前端传入了leader则使用传入的
      const leader = projectData.leader || projectData.uuid;
      
      this.logger.info(`项目成员: ${members.join(', ')}`);
      this.logger.info(`项目领导者: ${leader}`);
      
      const projectDocument = {
        project_id: projectId,
        name: projectData.name.trim(),
        people: projectData.people,
        group: projectData.group.trim(),
        user_uuid: projectData.uuid,
        members: members,                    // 成员UUID数组
        leader: leader,                      // 领导者UUID
        submit_time: new Date(projectData.submitTime),
        created_at: new Date(),
        status: 'submitted' // 可以添加状态字段
      };

      this.logger.data('完整项目文档', projectDocument);

      // 5. 保存到数据库
      this.logger.step(5, '保存到数据库');
      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟成功响应');
        const mockResult = {
          project_id: projectId,
          ...projectDocument,
          _id: 'mock_project_id'
        };
        this.logger.data('模拟保存结果', mockResult);
        this.logger.endFlow('项目保存', true);
        return {
          success: true,
          data: mockResult
        };
      }

      this.logger.database('INSERT', 'db.projects.insertOne()');
      const result = await this.db.collection('projects').insertOne(projectDocument);

      if (result.insertedId) {
        this.logger.success(`项目保存成功！插入ID: ${result.insertedId}`);
        
        const savedProject = {
          _id: result.insertedId,
          ...projectDocument
        };

        this.logger.data('保存成功的项目', savedProject);
        this.logger.endFlow('项目保存', true);

        return {
          success: true,
          data: savedProject
        };
      } else {
        this.logger.error('项目保存失败：未获得插入ID');
        this.logger.endFlow('项目保存', false);
        return {
          success: false,
          error: '数据库保存失败'
        };
      }

    } catch (error) {
      this.logger.error('项目保存异常:', error.message);
      this.logger.error('错误详情:', error);
      this.logger.endFlow('项目保存', false);
      
      return {
        success: false,
        error: '服务器内部错误',
        details: error.message
      };
    }
  }

  /**
   * 根据UUID查找用户作为领导者的项目
   */
  async getProjectsByLeader(uuid) {
    this.logger.startFlow('查找领导者项目');
    this.logger.info(`查找领导者: ${uuid}`);

    try {
      // 1. 初始化数据库连接
      this.logger.step(1, '初始化数据库连接');
      await this.initDatabase();

      // 2. 验证UUID格式
      this.logger.step(2, '验证UUID格式');
      if (!uuid || typeof uuid !== 'string' || uuid.trim() === '') {
        this.logger.endFlow('查找领导者项目', false);
        return {
          success: false,
          error: 'UUID格式不正确'
        };
      }

      // 3. 查询数据库
      this.logger.step(3, '查询数据库');
      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟数据');
        const mockProjects = [
          {
            _id: 'mock_project_1',
            project_id: 'proj-mock-001',
            name: '模拟项目 1',
            people: 3,
            group: '模拟组',
            user_uuid: uuid,
            members: [uuid, 'u-002'],
            leader: uuid,
            submit_time: new Date(),
            created_at: new Date(),
            status: 'submitted'
          }
        ];
        this.logger.data('模拟项目数据', mockProjects);
        this.logger.endFlow('查找领导者项目', true);
        return {
          success: true,
          data: mockProjects
        };
      }

      this.logger.database('QUERY', 'db.projects.find({ leader: "..." })');
      const projects = await this.db.collection('projects').find({ leader: uuid }).toArray();

      this.logger.success(`找到 ${projects.length} 个项目，用户 ${uuid} 为领导者`);
      
      if (projects.length > 0) {
        this.logger.info('项目列表:');
        projects.forEach((project, index) => {
          this.logger.info(`  ${index + 1}. ${project.name} (${project.project_id})`);
        });
      } else {
        this.logger.info('该用户不是任何项目的领导者');
      }

      this.logger.data('查询结果', projects);
      this.logger.endFlow('查找领导者项目', true);

      return {
        success: true,
        data: projects
      };

    } catch (error) {
      this.logger.error('查询项目失败:', error.message);
      this.logger.error('错误详情:', error);
      this.logger.endFlow('查找领导者项目', false);
      
      return {
        success: false,
        error: '查询失败',
        details: error.message
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

module.exports = ProjectService;