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

    // ⭐ 验证可选字段：workflow（流程进度）
    if (projectData.workflow !== undefined) {
      if (!Array.isArray(projectData.workflow)) {
        errors.push('流程数据必须是数组格式');
      } else {
        // 验证每个流程节点
        projectData.workflow.forEach((step, index) => {
          if (!step.action || typeof step.action !== 'string') {
            errors.push(`流程步骤${index + 1}缺少操作描述`);
          }
          if (!step.submitter || typeof step.submitter !== 'string') {
            errors.push(`流程步骤${index + 1}缺少提交者`);
          }
          if (!step.submit_time || isNaN(new Date(step.submit_time).getTime())) {
            errors.push(`流程步骤${index + 1}时间格式不正确`);
          }
        });
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
   * 生成项目 ID
   */
  generateProjectId() {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const projectId = `proj-${timestamp}-${randomSuffix}`;
    this.logger.info(`生成项目 ID: ${projectId}`);
    return projectId;
  }

  /**
   * 生成 6 位随机邀请码
   * @returns {string} 6 位邀请码
   */
  generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除 I、O、0、1
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.logger.info(`生成邀请码：${code}`);
    return code;
  }

  /**
   * 生成唯一的 6 位邀请码（确保不重复）
   * @returns {Promise<string>} 唯一的 6 位邀请码
   */
  async generateUniqueInviteCode() {
    const maxRetries = 10;
    
    for (let i = 0; i < maxRetries; i++) {
      const inviteCode = this.generateInviteCode();
      
      // 检查是否已存在
      const existing = await this.db.collection('projects').findOne({ invite_code: inviteCode });
      
      if (!existing) {
        this.logger.success(`生成唯一邀请码：${inviteCode}`);
        return inviteCode;
      }
      
      this.logger.warn(`邀请码 ${inviteCode} 已存在，重新生成... (${i + 1}/${maxRetries})`);
    }
    
    throw new Error(`无法生成唯一邀请码，已重试 ${maxRetries} 次`);
  }

  /**
   * 为指定项目生成或更新邀请码
   * @param {string} projectId - 项目 ID
   * @returns {Promise<Object>} 包含成功状态和邀请码
   */
  async generateOrUpdateInviteCode(projectId) {
    this.logger.startFlow('生成项目邀请码');
    this.logger.info(`项目 ID: ${projectId}`);

    try {
      // 1. 初始化数据库连接
      await this.initDatabase();

      // 2. 验证项目是否存在
      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟邀请码');
        const mockInviteCode = this.generateInviteCode();
        return {
          success: true,
          invite_code: mockInviteCode,
          message: '模拟模式下生成成功'
        };
      }

      // 3. 检查项目是否存在
      const project = await this.db.collection('projects').findOne({ project_id: projectId });
      
      if (!project) {
        this.logger.error(`项目不存在：${projectId}`);
        return {
          success: false,
          error: '项目不存在',
          code: 'PROJECT_NOT_FOUND'
        };
      }

      // 4. 生成唯一邀请码
      const inviteCode = await this.generateUniqueInviteCode();
      this.logger.success(`生成新邀请码：${inviteCode}`);

      // 5. 更新数据库
      this.logger.database('UPDATE', `db.projects.updateOne({ project_id: "${projectId}" }, { $set: { invite_code: "${inviteCode}" } })`);
      
      const updateResult = await this.db.collection('projects').updateOne(
        { project_id: projectId },
        { $set: { invite_code: inviteCode } }
      );

      if (updateResult.modifiedCount > 0 || updateResult.matchedCount > 0) {
        this.logger.success(`邀请码更新成功！项目：${project.name}`);
        this.logger.data('更新结果', {
          project_id: projectId,
          invite_code: inviteCode,
          modified_count: updateResult.modifiedCount
        });

        return {
          success: true,
          invite_code: inviteCode,
          project_name: project.name,
          message: '邀请码生成成功'
        };
      } else {
        this.logger.error('邀请码更新失败：未找到匹配的项目');
        return {
          success: false,
          error: '更新失败',
          code: 'UPDATE_FAILED'
        };
      }

    } catch (error) {
      this.logger.error('生成邀请码异常:', error.message);
      this.logger.error('错误详情:', error);
      
      return {
        success: false,
        error: '服务器内部错误',
        details: error.message
      };
    }
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
      
      // ⭐ 自动为项目生成唯一邀请码
      const inviteCode = await this.generateUniqueInviteCode();
      this.logger.info(`为项目生成邀请码：${inviteCode}`);
      
      // 构建成员列表和领导者
      // 如果前端传入了 members，使用传入的；否则默认只有提交者
      const members = projectData.members && Array.isArray(projectData.members) 
        ? projectData.members 
        : [projectData.uuid]; // 默认至少包含提交者
      
      // 确保提交者在成员列表中
      if (!members.includes(projectData.uuid)) {
        members.push(projectData.uuid);
      }
      
      // 领导者默认为提交者，但如果前端传入了 leader 则使用传入的
      const leader = projectData.leader || projectData.uuid;
      
      this.logger.info(`项目成员：${members.join(', ')}`);
      this.logger.info(`项目领导者：${leader}`);
      
      const projectDocument = {
        project_id: projectId,
        invite_code: inviteCode,              // ⭐ 自动添加邀请码字段
        name: projectData.name.trim(),
        people: projectData.people,
        group: projectData.group.trim(),
        user_uuid: projectData.uuid,
        members: members,                    // 成员 UUID 数组
        leader: leader,                      // 领导者 UUID
        submit_time: new Date(projectData.submitTime),
        created_at: new Date(),
        status: 'submitted' // 可以添加状态字段
      };

      this.logger.data('完整项目文档', projectDocument);

      // 5. 保存到数据库
      this.logger.step(5, '保存到数据库');
      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟成功响应');
        
        // ⭐ 模拟模式下也生成邀请码
        const mockInviteCode = this.generateInviteCode();
        const mockResult = {
          project_id: projectId,
          invite_code: mockInviteCode,        // ⭐ 模拟模式也包含邀请码
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

      // 3. ⭐ 查询数据库：返回用户作为领导者或成员的所有项目
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

      // ⭐ 使用 $or 查询：leader 是用户 OR members 包含用户
      this.logger.database('QUERY', `db.projects.find({ $or: [{ leader: "${uuid}" }, { members: "${uuid}" }] })`);
      const projects = await this.db.collection('projects').find({ 
        $or: [
          { leader: uuid },           // 用户是项目负责人
          { members: uuid }           // ⭐ 用户是项目成员
        ]
      }).toArray();

      this.logger.success(`找到 ${projects.length} 个项目，用户 ${uuid} 为领导者或成员`);
      
      if (projects.length > 0) {
        this.logger.info('项目列表:');
        projects.forEach((project, index) => {
          const role = project.leader === uuid ? '负责人' : '成员';
          this.logger.info(`  ${index + 1}. ${project.name} (${project.project_id}) - ${role}`);
        });
      } else {
        this.logger.info('该用户没有参与任何项目');
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
   * 根据邀请码查询项目
   * @param {string} inviteCode - 邀请码
   * @returns {Promise<Object>} 查询结果
   */
  async getProjectByInviteCode(inviteCode) {
    this.logger.startFlow('通过邀请码查询项目');
    this.logger.info(`邀请码：${inviteCode}`);

    try {
      // 1. 初始化数据库连接
      this.logger.step(1, '初始化数据库连接');
      await this.initDatabase();

      // 2. 验证邀请码格式
      this.logger.step(2, '验证邀请码格式');
      if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.trim() === '') {
        this.logger.endFlow('通过邀请码查询项目', false);
        return {
          success: false,
          error: '邀请码格式不正确'
        };
      }

      // 3. 查询数据库
      this.logger.step(3, '查询数据库');
      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟数据');
        const mockProject = {
          _id: 'mock_project_invite',
          project_id: 'proj-mock-invite-001',
          invite_code: inviteCode,
          name: '模拟项目（通过邀请码）',
          people: 5,
          group: '邀请测试组',
          user_uuid: 'u-creator-001',
          members: ['u-creator-001', 'u-member-002'],
          leader: 'u-creator-001',
          submit_time: new Date(),
          created_at: new Date(),
          status: 'submitted'
        };
        this.logger.data('模拟项目数据', mockProject);
        this.logger.endFlow('通过邀请码查询项目', true);
        return {
          success: true,
          data: mockProject
        };
      }

      this.logger.database('QUERY', `db.projects.findOne({ invite_code: "${inviteCode}" })`);
      const project = await this.db.collection('projects').findOne({ invite_code: inviteCode.toUpperCase() });

      if (project) {
        this.logger.success(`找到项目：${project.name} (${project.project_id})`);
        this.logger.data('项目详情', project);
        this.logger.endFlow('通过邀请码查询项目', true);
        return {
          success: true,
          data: project
        };
      } else {
        this.logger.warn(`未找到邀请码对应的项目：${inviteCode}`);
        this.logger.endFlow('通过邀请码查询项目', true);
        return {
          success: false,
          error: '邀请码不存在',
          data: null
        };
      }

    } catch (error) {
      this.logger.error('查询异常:', error.message);
      this.logger.error('错误详情:', error);
      this.logger.endFlow('通过邀请码查询项目', false);
      
      return {
        success: false,
        error: '服务器内部错误',
        details: error.message
      };
    }
  }

  /**
   * 通过邀请码加入项目
   * @param {string} inviteCode - 邀请码
   * @param {string} userUuid - 用户 UUID
   * @returns {Promise<Object>} 加入结果
   */
  async joinProjectByInviteCode(inviteCode, userUuid) {
    this.logger.startFlow('通过邀请码加入项目');
    this.logger.info(`邀请码：${inviteCode}, 用户UUID：${userUuid}`);

    try {
      // 1. 初始化数据库连接
      await this.initDatabase();

      // 2. 验证参数
      if (!inviteCode || !userUuid) {
        this.logger.error('缺少必需参数');
        return {
          success: false,
          error: '缺少必需参数',
          code: 'MISSING_PARAMS'
        };
      }

      // 3. 查询项目
      this.logger.step(1, '查询项目');
      const project = await this.db.collection('projects').findOne({ 
        invite_code: inviteCode.toUpperCase() 
      });

      if (!project) {
        this.logger.error(`邀请码不存在：${inviteCode}`);
        return {
          success: false,
          error: '邀请码不存在或已失效',
          code: 'INVITE_CODE_NOT_FOUND'
        };
      }

      this.logger.success(`找到项目：${project.name} (${project.project_id})`);

      // 4. 检查用户是否已是成员
      if (project.members && project.members.includes(userUuid)) {
        this.logger.warn(`用户 ${userUuid} 已是项目成员`);
        return {
          success: false,
          error: '您已经是该项目的成员',
          code: 'ALREADY_MEMBER'
        };
      }

      // 5. 将用户添加到成员列表
      this.logger.step(2, '更新成员列表');
      const updateResult = await this.db.collection('projects').updateOne(
        { project_id: project.project_id },
        { 
          $addToSet: { members: userUuid },  // 使用 $addToSet 避免重复
          $set: { updated_at: new Date() }
        }
      );

      if (updateResult.modifiedCount > 0) {
        this.logger.success(`用户 ${userUuid} 成功加入项目 ${project.name}`);
        
        // ⭐ 获取更新后的完整项目信息（包含 invite_code）
        const updatedProject = await this.db.collection('projects').findOne({ 
          project_id: project.project_id 
        });

        return {
          success: true,
          message: '加入项目成功',
          data: {
            project_id: updatedProject.project_id,
            project_name: updatedProject.name,
            invite_code: updatedProject.invite_code || null,  // ⭐ 包含邀请码
            group: updatedProject.group,
            people: updatedProject.people,
            leader: updatedProject.leader,
            members: updatedProject.members || [],
            members_count: updatedProject.members ? updatedProject.members.length : 1
          }
        };
      } else {
        this.logger.error('加入项目失败：未更新任何记录');
        return {
          success: false,
          error: '加入项目失败',
          code: 'JOIN_FAILED'
        };
      }

    } catch (error) {
      this.logger.error('加入项目异常:', error.message);
      this.logger.error('错误详情:', error);
      
      return {
        success: false,
        error: '服务器内部错误',
        details: error.message
      };
    }
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId) {
    this.logger.startFlow('项目删除');
    this.logger.data('项目ID', projectId);

    try {
      // 1. 初始化数据库连接
      this.logger.step(1, '初始化数据库连接');
      await this.initDatabase();

      // 2. 验证项目ID
      this.logger.step(2, '验证项目ID');
      if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
        this.logger.endFlow('项目删除', false);
        return {
          success: false,
          error: '项目ID不能为空',
          details: ['项目ID必须是非空字符串']
        };
      }

      // 3. 检查项目是否存在
      this.logger.step(3, '检查项目是否存在');
      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟成功响应');
        this.logger.endFlow('项目删除', true);
        return {
          success: true,
          data: {
            project_id: projectId,
            deleted: true,
            message: '模拟删除成功'
          }
        };
      }

      // 先查找项目
      this.logger.database('QUERY', 'db.projects.findOne()');
      const existingProject = await this.db.collection('projects').findOne({ 
        project_id: projectId 
      });

      if (!existingProject) {
        this.logger.endFlow('项目删除', false);
        return {
          success: false,
          error: '项目不存在',
          details: [`项目ID ${projectId} 不存在`]
        };
      }

      this.logger.info(`找到项目: ${existingProject.name} (${existingProject.project_id})`);

      // 4. 执行删除操作
      this.logger.step(4, '执行删除操作');
      this.logger.database('DELETE', 'db.projects.deleteOne()');
      const deleteResult = await this.db.collection('projects').deleteOne({ 
        project_id: projectId 
      });

      if (deleteResult.deletedCount === 1) {
        this.logger.success(`项目删除成功！项目ID: ${projectId}`);
        
        const result = {
          project_id: projectId,
          deleted: true,
          deleted_project: {
            name: existingProject.name,
            group: existingProject.group,
            people: existingProject.people,
            leader: existingProject.leader
          }
        };

        this.logger.data('删除成功的项目', result);
        this.logger.endFlow('项目删除', true);

        return {
          success: true,
          data: result
        };
      } else {
        this.logger.endFlow('项目删除', false);
        return {
          success: false,
          error: '删除操作失败',
          details: ['数据库删除操作未生效']
        };
      }

    } catch (error) {
      this.logger.error('项目删除异常:', error.message);
      this.logger.error('异常详情:', error);
      this.logger.endFlow('项目删除', false);
      return {
        success: false,
        error: '删除过程中发生异常',
        details: [error.message]
      };
    }
  }

  /**
   * 更新项目信息
   */
  async updateProject(projectId, userUuid, updateData) {
    this.logger.startFlow('项目更新');
    this.logger.data('项目ID', projectId);
    this.logger.data('操作用户', userUuid);
    this.logger.data('更新数据', updateData);

    try {
      // 1. 初始化数据库连接
      this.logger.step(1, '初始化数据库连接');
      await this.initDatabase();

      // 2. 验证参数
      this.logger.step(2, '验证参数');
      if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
        this.logger.endFlow('项目更新', false);
        return {
          success: false,
          error: '项目ID不能为空',
          details: ['项目ID必须是非空字符串']
        };
      }

      if (!userUuid || typeof userUuid !== 'string' || userUuid.trim() === '') {
        this.logger.endFlow('项目更新', false);
        return {
          success: false,
          error: '用户UUID不能为空',
          details: ['用户UUID必须是非空字符串']
        };
      }

      // 3. 验证更新数据
      this.logger.step(3, '验证更新数据');
      const allowedFields = ['name', 'group', 'people'];
      const updateFields = {};
      const errors = [];

      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          if (key === 'name' && value !== undefined) {
            if (typeof value !== 'string' || value.trim() === '') {
              errors.push('项目名称必须是非空字符串');
            } else {
              updateFields.name = value.trim();
            }
          } else if (key === 'group' && value !== undefined) {
            if (typeof value !== 'string' || value.trim() === '') {
              errors.push('项目组别必须是非空字符串');
            } else {
              updateFields.group = value.trim();
            }
          } else if (key === 'people' && value !== undefined) {
            if (typeof value !== 'number' || value <= 0) {
              errors.push('项目人数必须是大于0的数字');
            } else {
              updateFields.people = value;
            }
          }
        }
      }

      if (errors.length > 0) {
        this.logger.endFlow('项目更新', false);
        return {
          success: false,
          error: '数据验证失败',
          details: errors
        };
      }

      if (Object.keys(updateFields).length === 0) {
        this.logger.endFlow('项目更新', false);
        return {
          success: false,
          error: '没有有效的更新字段',
          details: ['至少需要提供一个有效的更新字段(name, group, people)']
        };
      }

      // 4. 检查项目是否存在
      this.logger.step(4, '检查项目是否存在');
      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟成功响应');
        const mockProject = {
          _id: 'mock_id',
          project_id: projectId,
          ...updateFields,
          user_uuid: userUuid,
          members: [userUuid],
          leader: userUuid,
          submit_time: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
          status: 'submitted'
        };
        this.logger.endFlow('项目更新', true);
        return {
          success: true,
          data: mockProject
        };
      }

      this.logger.database('QUERY', 'db.projects.findOne()');
      this.logger.info(`查询条件详情: { project_id: "${projectId}" }`);
      this.logger.info(`project_id 类型: ${typeof projectId}, 长度: ${projectId.length}`);
      
      const existingProject = await this.db.collection('projects').findOne({
        project_id: projectId
      });

      this.logger.info(`查询结果: ${existingProject ? '找到项目' : '未找到项目'}`);
      if (existingProject) {
        this.logger.info(`找到的项目: ${existingProject.name} (ID: ${existingProject.project_id})`);
        this.logger.info(`数据库中的 project_id 类型: ${typeof existingProject.project_id}`);
        this.logger.info(`project_id 比较: "${projectId}" === "${existingProject.project_id}" = ${projectId === existingProject.project_id}`);
      } else {
        // 尝试查询所有项目的project_id来调试
        this.logger.warn('项目未找到，查询所有项目的 project_id 进行调试...');
        const allProjects = await this.db.collection('projects').find({}, { projection: { project_id: 1, name: 1 } }).limit(5).toArray();
        this.logger.data('数据库中的项目列表（前5个）', allProjects);
      }

      if (!existingProject) {
        this.logger.endFlow('项目更新', false);
        return {
          success: false,
          error: '项目不存在',
          details: [`项目ID ${projectId} 不存在`]
        };
      }

      // 5. 权限验证（检查用户是否为项目的领导者或创建者）
      this.logger.step(5, '权限验证');
      if (existingProject.leader !== userUuid && existingProject.user_uuid !== userUuid) {
        this.logger.endFlow('项目更新', false);
        return {
          success: false,
          error: '权限不足',
          details: ['只有项目领导者或创建者可以更新项目信息']
        };
      }

      this.logger.info(`权限验证通过，用户 ${userUuid} 可以更新项目 ${existingProject.name}`);

      // 6. 执行更新操作
      this.logger.step(6, '执行更新操作');
      updateFields.updated_at = new Date();
      
      this.logger.database('UPDATE', 'db.projects.updateOne()');
      this.logger.data('更新字段', updateFields);
      this.logger.data('查询条件', { project_id: projectId });
      this.logger.info(`更新操作详情:`);
      this.logger.info(`- 集合: projects`);
      this.logger.info(`- 查询条件: { project_id: "${projectId}" }`);
      this.logger.info(`- 更新字段数量: ${Object.keys(updateFields).length}`);
      
      // 先尝试使用 updateOne 进行更新
      const updateResult = await this.db.collection('projects').updateOne(
        { project_id: projectId },
        { $set: updateFields }
      );

      this.logger.data('updateOne 完整结果', updateResult);
      this.logger.info(`更新统计详情:`);
      this.logger.info(`- 匹配文档数: ${updateResult.matchedCount}`);
      this.logger.info(`- 修改文档数: ${updateResult.modifiedCount}`);
      this.logger.info(`- 确认: ${updateResult.acknowledged}`);
      this.logger.info(`- 操作ID: ${updateResult.upsertedId || 'N/A'}`);

      if (updateResult.matchedCount === 0) {
        this.logger.error('更新失败: 没有找到匹配的项目');
        this.logger.error(`查询条件 { project_id: "${projectId}" } 没有匹配任何文档`);
        
        // 再次尝试查找项目进行调试
        this.logger.info('进行二次查询确认项目是否存在...');
        const doubleCheck = await this.db.collection('projects').findOne({ project_id: projectId });
        this.logger.info(`二次查询结果: ${doubleCheck ? '项目存在' : '项目不存在'}`);
        
        this.logger.endFlow('项目更新', false);
        return {
          success: false,
          error: '项目不存在',
          details: [
            `没有找到项目ID为 ${projectId} 的项目`,
            `匹配文档数: ${updateResult.matchedCount}`,
            `二次查询结果: ${doubleCheck ? '存在' : '不存在'}`
          ]
        };
      }

      if (updateResult.modifiedCount === 0) {
        this.logger.warn('更新操作没有修改任何数据（可能数据相同）');
      }

      // 查询更新后的项目数据
      this.logger.database('QUERY', 'db.projects.findOne() - 获取更新后数据');
      const updatedProject = await this.db.collection('projects').findOne({ project_id: projectId });

      if (!updatedProject) {
        this.logger.error('更新后查询项目失败');
        this.logger.endFlow('项目更新', false);
        return {
          success: false,
          error: '更新后查询失败',
          details: ['项目更新成功但无法获取更新后的数据']
        };
      }

      this.logger.success(`项目更新成功！项目ID: ${projectId}`);
      this.logger.info('更新后的项目信息:');
      this.logger.info(`  名称: ${updatedProject.name}`);
      this.logger.info(`  组别: ${updatedProject.group}`);
      this.logger.info(`  人数: ${updatedProject.people}`);
      this.logger.info(`  更新时间: ${updatedProject.updated_at}`);
      
      this.logger.data('更新后的完整项目', updatedProject);
      this.logger.endFlow('项目更新', true);

      return {
        success: true,
        data: updatedProject
      };

    } catch (error) {
      this.logger.error('项目更新异常:', error.message);
      this.logger.error('异常详情:', error);
      this.logger.endFlow('项目更新', false);
      return {
        success: false,
        error: '更新失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 添加流程节点
   */
  async addWorkflowStep({ project_id, action, submitter, status = 'pending' }) {
    this.logger.info('开始添加流程节点...');
    this.logger.data('流程节点数据', { project_id, action, submitter, status });

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟数据');
        const mockStep = {
          step_id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          action,
          submitter,
          status,
          submit_time: new Date().toISOString(),
          update_time: null
        };
        return {
          success: true,
          data: mockStep
        };
      }

      // 创建新的流程节点
      const newStep = {
        step_id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        action,
        submitter,
        status,
        submit_time: new Date().toISOString(),
        update_time: null
      };

      this.logger.database('UPDATE', 'db.projects.updateOne - $push workflow');
      
      // 将新节点添加到项目的 workflow 数组中
      const result = await this.db.collection('projects').updateOne(
        { project_id: project_id },
        { 
          $push: { workflow: newStep },
          $set: { updated_at: new Date().toISOString() }
        }
      );

      if (result.matchedCount === 0) {
        this.logger.error('未找到指定项目');
        return {
          success: false,
          error: '项目不存在'
        };
      }

      this.logger.success(`流程节点添加成功！步骤ID: ${newStep.step_id}`);
      this.logger.info(`操作: ${action}, 提交者: ${submitter}, 状态: ${status}`);

      return {
        success: true,
        data: newStep
      };

    } catch (error) {
      this.logger.error('添加流程节点失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '添加失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 更新流程节点状态
   */
  async updateWorkflowStep({ project_id, step_id, status }) {
    this.logger.info('开始更新流程节点状态...');
    this.logger.data('更新数据', { project_id, step_id, status });

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟成功');
        return {
          success: true,
          data: { step_id, status, update_time: new Date().toISOString() }
        };
      }

      this.logger.database('UPDATE', 'db.projects.updateOne - 更新 workflow 节点状态');
      
      // 更新指定流程节点的状态
      const result = await this.db.collection('projects').updateOne(
        { 
          project_id: project_id,
          'workflow.step_id': step_id
        },
        { 
          $set: { 
            'workflow.$.status': status,
            'workflow.$.update_time': new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
      );

      if (result.matchedCount === 0) {
        this.logger.error('未找到指定的项目或流程节点');
        return {
          success: false,
          error: '项目或流程节点不存在'
        };
      }

      this.logger.success(`流程节点状态更新成功！步骤ID: ${step_id}, 新状态: ${status}`);

      return {
        success: true,
        data: {
          step_id,
          status,
          update_time: new Date().toISOString()
        }
      };

    } catch (error) {
      this.logger.error('更新流程节点状态失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '更新失败',
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