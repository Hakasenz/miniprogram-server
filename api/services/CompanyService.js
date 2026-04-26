const { MongoClient } = require('mongodb');
const Logger = require('../utils/Logger');

class CompanyService {
  constructor() {
    this.db = null;
    this.mongoClient = null;
    this.MONGODB_URI = process.env.MONGODB_URI;
    this.DATABASE_NAME = process.env.DATABASE_NAME || 'miniprogram';
    
    // 创建日志器实例
    this.logger = new Logger('CompanyService');
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
        this.mongoClient = new MongoClient(this.MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
          socketTimeoutMS: 10000
        });
        
        const connectPromise = this.mongoClient.connect();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('数据库连接超时（5秒）')), 5000);
        });
        
        await Promise.race([connectPromise, timeoutPromise]);
        
        this.db = this.mongoClient.db(this.DATABASE_NAME);
        this.logger.success(`MongoDB 连接成功！数据库: ${this.DATABASE_NAME}`);
        
        await this.db.admin().ping();
        this.logger.success('数据库 ping 测试成功');
      } catch (error) {
        this.logger.error('MongoDB 连接失败:', error.message);
        this.logger.error('错误详情:', error);
        throw error;
      }
    } else if (this.db) {
      this.logger.success('✅ 数据库连接已存在，跳过初始化');
    } else {
      this.logger.warn('⚠️ MONGODB_URI 未配置，将使用模拟模式');
    }
  }

  /**
   * ⭐ 获取用户所属的组织信息
   */
  async getUserCompany(userUuid) {
    this.logger.info('开始获取用户组织信息...');
    this.logger.info(`用户UUID: ${userUuid}`);

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接');
        return {
          success: false,
          error: '数据库未连接'
        };
      }

      // ⭐ 查询用户信息，获取 company_id
      const user = await this.db.collection('users').findOne({ uuid: userUuid });
      
      if (!user) {
        this.logger.warn(`未找到用户: ${userUuid}`);
        return {
          success: false,
          error: '用户不存在'
        };
      }

      const companyId = user.company_id;

      // ⭐ 严格判断 company_id 是否为空（包括 null、undefined、空字符串）
      if (!companyId || companyId === '' || companyId === null || companyId === undefined) {
        this.logger.info('用户尚未加入任何组织');
        return {
          success: true,
          data: {
            has_company: false,
            company: null
          }
        };
      }

      // ⭐ 查询组织详细信息
      const company = await this.db.collection('companies').findOne({ 
        _id: this._convertToObjectId(companyId) 
      });

      if (!company) {
        this.logger.warn(`未找到组织: ${companyId}`);
        return {
          success: true,
          data: {
            has_company: false,
            company: null
          }
        };
      }

      this.logger.success('获取组织信息成功');
      return {
        success: true,
        data: {
          has_company: true,
          company: {
            id: company._id.toString(),
            name: company.name,
            description: company.description || '',
            logo: company.logo || '',
            created_at: company.created_at
          }
        }
      };

    } catch (error) {
      this.logger.error('获取组织信息失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '获取组织信息失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 通过邀请码加入组织
   */
  async joinCompanyByInviteCode({ user_uuid, invite_code }) {
    this.logger.info('开始加入组织...');
    this.logger.data('请求数据', { user_uuid, invite_code });

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接');
        return {
          success: false,
          error: '数据库未连接'
        };
      }

      // ⭐ 验证邀请码是否存在
      const company = await this.db.collection('companies').findOne({ 
        invite_code: invite_code 
      });

      if (!company) {
        this.logger.warn(`无效的邀请码: ${invite_code}`);
        return {
          success: false,
          error: '邀请码无效或已过期'
        };
      }

      // ⭐ 检查用户是否已经加入其他组织（严格排除空字符串）
      const existingUser = await this.db.collection('users').findOne({ 
        uuid: user_uuid,
        company_id: { 
          $exists: true, 
          $ne: null,
          $ne: ''  // ⭐ 排除空字符串
        }
      });

      if (existingUser) {
        this.logger.warn(`用户已加入组织: ${existingUser.company_id}`);
        return {
          success: false,
          error: '您已经加入了其他组织，请先退出当前组织'
        };
      }

      // ⭐ 更新用户的 company_id
      const result = await this.db.collection('users').updateOne(
        { uuid: user_uuid },
        { 
          $set: { 
            company_id: company._id.toString(),
            updated_at: new Date().toISOString()
          }
        }
      );

      if (result.matchedCount === 0) {
        this.logger.error('用户不存在');
        return {
          success: false,
          error: '用户不存在'
        };
      }

      this.logger.success(`用户成功加入组织: ${company.name}`);
      return {
        success: true,
        data: {
          company: {
            id: company._id.toString(),
            name: company.name,
            description: company.description || '',
            logo: company.logo || ''
          }
        }
      };

    } catch (error) {
      this.logger.error('加入组织失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '加入组织失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 创建新组织
   */
  async createCompany({ name, description, creator_uuid }) {
    this.logger.info('开始创建组织...');
    this.logger.data('组织信息', { name, description, creator_uuid });

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接');
        return {
          success: false,
          error: '数据库未连接'
        };
      }

      // ⭐ 检查用户是否已加入其他组织（严格排除空字符串）
      const existingUser = await this.db.collection('users').findOne({ 
        uuid: creator_uuid,
        company_id: { 
          $exists: true, 
          $ne: null,
          $ne: ''  // ⭐ 排除空字符串
        }
      });

      if (existingUser) {
        this.logger.warn(`用户已加入其他组织，无法创建新组织`);
        return {
          success: false,
          error: '您已加入其他组织，请先退出当前组织才能创建新组织'
        };
      }

      // ⭐ 创建组织文档
      const companyDoc = {
        name: name.trim(),
        description: description ? description.trim() : '',
        logo: '',
        creator_uuid: creator_uuid,
        admin_ids: [creator_uuid],  // 创建者自动成为管理员
        member_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      this.logger.database('INSERT', 'db.companies.insertOne - 创建新组织');

      // ⭐ 插入到 companies 集合
      const result = await this.db.collection('companies').insertOne(companyDoc);

      if (!result.insertedId) {
        this.logger.error('组织创建失败');
        return {
          success: false,
          error: '组织创建失败'
        };
      }

      const companyId = result.insertedId.toString();

      // ⭐ 更新用户的 company_id
      await this.db.collection('users').updateOne(
        { uuid: creator_uuid },
        { 
          $set: { 
            company_id: companyId,
            updated_at: new Date().toISOString()
          }
        }
      );

      this.logger.success(`组织创建成功！组织ID: ${companyId}`);
      
      return {
        success: true,
        data: {
          company: {
            id: companyId,
            name: companyDoc.name,
            description: companyDoc.description,
            logo: companyDoc.logo
          }
        }
      };

    } catch (error) {
      this.logger.error('创建组织失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '创建组织失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 申请加入组织（发送审批请求）
   */
  async applyJoinCompany({ company_id, applicant_uuid, reason }) {
    this.logger.info('开始处理加入申请...');
    this.logger.data('申请信息', { company_id, applicant_uuid, reason });

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接');
        return {
          success: false,
          error: '数据库未连接'
        };
      }

      // ⭐ 验证组织是否存在
      const company = await this.db.collection('companies').findOne({ 
        _id: this._convertToObjectId(company_id) 
      });

      if (!company) {
        this.logger.warn(`组织不存在: ${company_id}`);
        return {
          success: false,
          error: '组织不存在'
        };
      }

      // ⭐ 检查用户是否已加入其他组织（严格排除空字符串）
      const existingUser = await this.db.collection('users').findOne({ 
        uuid: applicant_uuid,
        company_id: { 
          $exists: true, 
          $ne: null,
          $ne: ''  // ⭐ 排除空字符串
        }
      });

      if (existingUser) {
        this.logger.warn(`用户已加入其他组织`);
        return {
          success: false,
          error: '您已加入其他组织，请先退出当前组织'
        };
      }

      // ⭐ 检查是否已有待审批的申请
      const existingApplication = await this.db.collection('company_applications').findOne({
        company_id: company_id,
        applicant_uuid: applicant_uuid,
        status: 'pending'
      });

      if (existingApplication) {
        this.logger.warn('已有待审批的申请');
        return {
          success: false,
          error: '您已有待审批的申请，请耐心等待'
        };
      }

      // ⭐ 创建申请记录
      const applicationDoc = {
        company_id: company_id,
        company_name: company.name,
        applicant_uuid: applicant_uuid,
        reason: reason || '',
        status: 'pending',  // pending, approved, rejected
        applied_at: new Date().toISOString(),
        reviewed_at: null,
        reviewer_uuid: null
      };

      this.logger.database('INSERT', 'db.company_applications.insertOne - 创建加入申请');

      const result = await this.db.collection('company_applications').insertOne(applicationDoc);

      if (!result.insertedId) {
        this.logger.error('申请提交失败');
        return {
          success: false,
          error: '申请提交失败'
        };
      }

      this.logger.success('申请提交成功，等待审批');

      // ⭐ TODO: 发送通知给组织管理员（人事审批）
      // 这里可以调用 MessageService 发送消息给 admin_ids 中的用户

      return {
        success: true,
        message: '申请已提交，等待组织管理员审批'
      };

    } catch (error) {
      this.logger.error('提交申请失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '提交申请失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 获取所有组织列表（用于申请时选择）
   */
  async getAllCompanies() {
    this.logger.info('开始获取组织列表...');

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接');
        return {
          success: false,
          error: '数据库未连接'
        };
      }

      this.logger.database('QUERY', 'db.companies.find - 获取所有组织');

      const companies = await this.db.collection('companies')
        .find({})
        .project({
          _id: 1,
          name: 1,
          description: 1,
          logo: 1,
          member_count: 1,
          created_at: 1
        })
        .sort({ created_at: -1 })
        .toArray();

      const formattedCompanies = companies.map(c => ({
        id: c._id.toString(),
        name: c.name,
        description: c.description || '',
        logo: c.logo || '',
        member_count: c.member_count || 0
      }));

      this.logger.success(`获取到 ${formattedCompanies.length} 个组织`);

      return {
        success: true,
        data: {
          companies: formattedCompanies
        }
      };

    } catch (error) {
      this.logger.error('获取组织列表失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '获取组织列表失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 审批加入申请（通过/拒绝）
   */
  async reviewApplication({ application_id, reviewer_uuid, action }) {
    this.logger.info('开始审批申请...');
    this.logger.data('审批信息', { application_id, reviewer_uuid, action });

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接');
        return {
          success: false,
          error: '数据库未连接'
        };
      }

      // ⭐ 查询申请记录
      const application = await this.db.collection('company_applications').findOne({
        _id: this._convertToObjectId(application_id)
      });

      if (!application) {
        this.logger.warn('申请记录不存在');
        return {
          success: false,
          error: '申请记录不存在'
        };
      }

      if (application.status !== 'pending') {
        this.logger.warn('申请已处理');
        return {
          success: false,
          error: '该申请已处理'
        };
      }

      // ⭐ 验证审批人是否为组织管理员
      const company = await this.db.collection('companies').findOne({
        _id: this._convertToObjectId(application.company_id)
      });

      if (!company || !company.admin_ids.includes(reviewer_uuid)) {
        this.logger.warn('无权审批此申请');
        return {
          success: false,
          error: '无权审批此申请'
        };
      }

      const now = new Date().toISOString();

      if (action === 'approve') {
        // ⭐ 通过申请：更新申请状态 + 更新用户 company_id + 增加组织成员数
        await this.db.collection('company_applications').updateOne(
          { _id: this._convertToObjectId(application_id) },
          {
            $set: {
              status: 'approved',
              reviewed_at: now,
              reviewer_uuid: reviewer_uuid
            }
          }
        );

        // 更新用户的 company_id
        await this.db.collection('users').updateOne(
          { uuid: application.applicant_uuid },
          {
            $set: {
              company_id: application.company_id,
              updated_at: now
            }
          }
        );

        // 增加组织成员数
        await this.db.collection('companies').updateOne(
          { _id: this._convertToObjectId(application.company_id) },
          {
            $inc: { member_count: 1 },
            $set: { updated_at: now }
          }
        );

        this.logger.success('申请已通过');

        // ⭐ TODO: 发送通知给申请人

        return {
          success: true,
          message: '申请已通过'
        };

      } else if (action === 'reject') {
        // ⭐ 拒绝申请
        await this.db.collection('company_applications').updateOne(
          { _id: this._convertToObjectId(application_id) },
          {
            $set: {
              status: 'rejected',
              reviewed_at: now,
              reviewer_uuid: reviewer_uuid
            }
          }
        );

        this.logger.success('申请已拒绝');

        // ⭐ TODO: 发送通知给申请人

        return {
          success: true,
          message: '申请已拒绝'
        };

      } else {
        return {
          success: false,
          error: '无效的审批操作'
        };
      }

    } catch (error) {
      this.logger.error('审批申请失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '审批申请失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 获取待审批的申请列表（人事审批用）
   */
  async getPendingApplications(admin_uuid) {
    this.logger.info('开始获取待审批申请列表...');
    this.logger.info(`管理员UUID: ${admin_uuid}`);

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接');
        return {
          success: false,
          error: '数据库未连接'
        };
      }

      // ⭐ 查询该管理员管理的组织的待审批申请
      const applications = await this.db.collection('company_applications')
        .aggregate([
          {
            $match: {
              status: 'pending'
            }
          },
          {
            $addFields: {
              company_id_obj: { $toObjectId: '$company_id' }  // ⭐ 将字符串转换为ObjectId
            }
          },
          {
            $lookup: {
              from: 'companies',
              localField: 'company_id_obj',  // ⭐ 使用转换后的ObjectId
              foreignField: '_id',
              as: 'company_info'
            }
          },
          {
            $unwind: '$company_info'
          },
          {
            $match: {
              'company_info.admin_ids': admin_uuid
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'applicant_uuid',
              foreignField: 'uuid',
              as: 'applicant_info'
            }
          },
          {
            $unwind: '$applicant_info'
          },
          {
            $sort: { applied_at: -1 }
          },
          {
            $project: {
              _id: 1,
              company_id: 1,
              company_name: 1,
              applicant_uuid: 1,
              applicant_name: '$applicant_info.username',
              applicant_avatar: '$applicant_info.avatar_url',
              reason: 1,
              applied_at: 1
            }
          }
        ])
        .toArray();

      const formattedApplications = applications.map(app => ({
        id: app._id.toString(),
        company_id: app.company_id,
        company_name: app.company_name,
        applicant_uuid: app.applicant_uuid,
        applicant_name: app.applicant_name || '未知用户',
        applicant_avatar: app.applicant_avatar || '/assets/default-avatar.png',
        reason: app.reason || '',
        applied_at: app.applied_at
      }));

      this.logger.success(`获取到 ${formattedApplications.length} 个待审批申请`);

      return {
        success: true,
        data: {
          applications: formattedApplications
        }
      };

    } catch (error) {
      this.logger.error('获取待审批申请失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '获取待审批申请失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 生成组织邀请码
   */
  async generateCompanyInviteCode({ company_id, admin_uuid }) {
    this.logger.info('开始生成组织邀请码...');
    this.logger.data('请求数据', { company_id, admin_uuid });

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接');
        return {
          success: false,
          error: '数据库未连接'
        };
      }

      // ⭐ 验证组织是否存在
      const company = await this.db.collection('companies').findOne({ 
        _id: this._convertToObjectId(company_id) 
      });

      if (!company) {
        this.logger.warn(`组织不存在: ${company_id}`);
        return {
          success: false,
          error: '组织不存在'
        };
      }

      // ⭐ 验证用户是否为组织管理员（简化版：假设创建者是管理员）
      // TODO: 后续可以添加更复杂的权限验证逻辑

      // ⭐ 生成6位随机邀请码
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // ⭐ 更新组织的邀请码
      await this.db.collection('companies').updateOne(
        { _id: this._convertToObjectId(company_id) },
        { 
          $set: { 
            invite_code: inviteCode,
            invite_code_updated_at: new Date().toISOString()
          }
        }
      );

      this.logger.success(`邀请码生成成功: ${inviteCode}`);
      return {
        success: true,
        data: {
          invite_code: inviteCode
        }
      };

    } catch (error) {
      this.logger.error('生成邀请码失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '生成邀请码失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 退出组织
   */
  async leaveCompany(user_uuid) {
    this.logger.info('开始退出组织...');
    this.logger.info(`用户UUID: ${user_uuid}`);

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接');
        return {
          success: false,
          error: '数据库未连接'
        };
      }

      // ⭐ 清空用户的 company_id
      const result = await this.db.collection('users').updateOne(
        { uuid: user_uuid },
        { 
          $set: { 
            company_id: null,
            updated_at: new Date().toISOString()
          }
        }
      );

      if (result.matchedCount === 0) {
        this.logger.error('用户不存在');
        return {
          success: false,
          error: '用户不存在'
        };
      }

      this.logger.success('用户成功退出组织');
      return {
        success: true,
        message: '已成功退出组织'
      };

    } catch (error) {
      this.logger.error('退出组织失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '退出组织失败',
        details: error.message
      };
    }
  }

  /**
   * 辅助方法：将字符串转换为 ObjectId
   */
  _convertToObjectId(id) {
    const { ObjectId } = require('mongodb');
    try {
      return new ObjectId(id);
    } catch (error) {
      return id;
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

module.exports = CompanyService;
