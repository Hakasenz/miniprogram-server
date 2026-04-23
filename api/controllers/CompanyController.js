const CompanyService = require('../services/CompanyService');
const Logger = require('../utils/Logger');

class CompanyController {
  constructor() {
    this.companyService = new CompanyService();
  }

  /**
   * ⭐ 获取用户所属的组织信息
   */
  async getUserCompany(req, res) {
    const logger = new Logger('CompanyController.getUserCompany');
    
    logger.separator('收到获取组织信息请求');
    logger.info('开始处理...');

    try {
      const { user_uuid } = req.body;

      if (!user_uuid) {
        logger.error('缺少用户UUID参数');
        return res.status(400).json({
          status: 'error',
          message: '缺少用户UUID参数'
        });
      }

      logger.info(`查询用户组织: ${user_uuid}`);
      const result = await this.companyService.getUserCompany(user_uuid);

      if (result.success) {
        logger.success('获取组织信息成功');
        res.json({
          status: 'success',
          data: result.data
        });
      } else {
        logger.error('获取组织信息失败:', result.error);
        res.status(400).json({
          status: 'error',
          message: result.error || '获取组织信息失败',
          details: result.details
        });
      }

    } catch (err) {
      logger.error('服务器异常:', err.message);
      logger.error('错误堆栈:', err.stack);
      res.status(500).json({
        status: 'error',
        message: '获取组织信息时发生异常',
        details: err.message
      });
    }
  }

  /**
   * ⭐ 创建新组织
   */
  async createCompany(req, res) {
    const logger = new Logger('CompanyController.createCompany');
    
    logger.separator('收到创建组织请求');
    logger.info('开始处理...');

    try {
      const { name, description, creator_uuid } = req.body;

      if (!name || !creator_uuid) {
        logger.error('缺少必需参数');
        return res.status(400).json({
          status: 'error',
          message: '缺少必需参数',
          required: ['name', 'creator_uuid']
        });
      }

      logger.info(`创建组织: ${name}`);
      const result = await this.companyService.createCompany({
        name,
        description: description || '',
        creator_uuid
      });

      if (result.success) {
        logger.success('组织创建成功');
        res.json({
          status: 'success',
          message: '组织创建成功',
          data: result.data
        });
      } else {
        logger.error('创建组织失败:', result.error);
        res.status(400).json({
          status: 'error',
          message: result.error || '创建组织失败',
          details: result.details
        });
      }

    } catch (err) {
      logger.error('服务器异常:', err.message);
      logger.error('错误堆栈:', err.stack);
      res.status(500).json({
        status: 'error',
        message: '创建组织时发生异常',
        details: err.message
      });
    }
  }

  /**
   * ⭐ 申请加入组织
   */
  async applyJoinCompany(req, res) {
    const logger = new Logger('CompanyController.applyJoinCompany');
    
    logger.separator('收到加入申请请求');
    logger.info('开始处理...');

    try {
      const { company_id, applicant_uuid, reason } = req.body;

      if (!company_id || !applicant_uuid) {
        logger.error('缺少必需参数');
        return res.status(400).json({
          status: 'error',
          message: '缺少必需参数',
          required: ['company_id', 'applicant_uuid']
        });
      }

      logger.info(`用户申请加入组织: ${company_id}`);
      const result = await this.companyService.applyJoinCompany({
        company_id,
        applicant_uuid,
        reason: reason || ''
      });

      if (result.success) {
        logger.success('申请提交成功');
        res.json({
          status: 'success',
          message: result.message || '申请已提交'
        });
      } else {
        logger.error('申请提交失败:', result.error);
        res.status(400).json({
          status: 'error',
          message: result.error || '申请提交失败',
          details: result.details
        });
      }

    } catch (err) {
      logger.error('服务器异常:', err.message);
      logger.error('错误堆栈:', err.stack);
      res.status(500).json({
        status: 'error',
        message: '提交申请时发生异常',
        details: err.message
      });
    }
  }

  /**
   * ⭐ 获取所有组织列表
   */
  async getAllCompanies(req, res) {
    const logger = new Logger('CompanyController.getAllCompanies');
    
    logger.separator('收到获取组织列表请求');
    logger.info('开始处理...');

    try {
      const result = await this.companyService.getAllCompanies();

      if (result.success) {
        logger.success('获取组织列表成功');
        res.json({
          status: 'success',
          data: result.data
        });
      } else {
        logger.error('获取组织列表失败:', result.error);
        res.status(400).json({
          status: 'error',
          message: result.error || '获取组织列表失败',
          details: result.details
        });
      }

    } catch (err) {
      logger.error('服务器异常:', err.message);
      logger.error('错误堆栈:', err.stack);
      res.status(500).json({
        status: 'error',
        message: '获取组织列表时发生异常',
        details: err.message
      });
    }
  }

  /**
   * ⭐ 审批加入申请
   */
  async reviewApplication(req, res) {
    const logger = new Logger('CompanyController.reviewApplication');
    
    logger.separator('收到审批申请请求');
    logger.info('开始处理...');

    try {
      const { application_id, reviewer_uuid, action } = req.body;

      if (!application_id || !reviewer_uuid || !action) {
        logger.error('缺少必需参数');
        return res.status(400).json({
          status: 'error',
          message: '缺少必需参数',
          required: ['application_id', 'reviewer_uuid', 'action']
        });
      }

      if (!['approve', 'reject'].includes(action)) {
        logger.error('无效的审批操作');
        return res.status(400).json({
          status: 'error',
          message: '无效的审批操作，必须是 approve 或 reject'
        });
      }

      logger.info(`审批申请: ${application_id}, 操作: ${action}`);
      const result = await this.companyService.reviewApplication({
        application_id,
        reviewer_uuid,
        action
      });

      if (result.success) {
        logger.success('审批完成');
        res.json({
          status: 'success',
          message: result.message
        });
      } else {
        logger.error('审批失败:', result.error);
        res.status(400).json({
          status: 'error',
          message: result.error || '审批失败',
          details: result.details
        });
      }

    } catch (err) {
      logger.error('服务器异常:', err.message);
      logger.error('错误堆栈:', err.stack);
      res.status(500).json({
        status: 'error',
        message: '审批申请时发生异常',
        details: err.message
      });
    }
  }

  /**
   * ⭐ 获取待审批的申请列表
   */
  async getPendingApplications(req, res) {
    const logger = new Logger('CompanyController.getPendingApplications');
    
    logger.separator('收到获取待审批申请请求');
    logger.info('开始处理...');

    try {
      const { admin_uuid } = req.body;

      if (!admin_uuid) {
        logger.error('缺少管理员UUID参数');
        return res.status(400).json({
          status: 'error',
          message: '缺少管理员UUID参数'
        });
      }

      logger.info(`获取管理员的待审批申请: ${admin_uuid}`);
      const result = await this.companyService.getPendingApplications(admin_uuid);

      if (result.success) {
        logger.success('获取待审批申请成功');
        res.json({
          status: 'success',
          data: result.data
        });
      } else {
        logger.error('获取待审批申请失败:', result.error);
        res.status(400).json({
          status: 'error',
          message: result.error || '获取待审批申请失败',
          details: result.details
        });
      }

    } catch (err) {
      logger.error('服务器异常:', err.message);
      logger.error('错误堆栈:', err.stack);
      res.status(500).json({
        status: 'error',
        message: '获取待审批申请时发生异常',
        details: err.message
      });
    }
  }
}

module.exports = CompanyController;
