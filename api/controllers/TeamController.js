const TeamService = require('../services/TeamService');
const Logger = require('../utils/Logger');

class TeamController {
  constructor() {
    this.teamService = new TeamService();
  }

  /**
   * 团队创建接口
   */
  async createTeam(req, res) {
    const createLogger = new Logger('TeamCreateAPI');
    
    createLogger.separator('收到团队创建请求');
    createLogger.info('API版本: v1.0 - 团队数据创建并写入数据库');
    createLogger.info(`请求时间: ${new Date().toISOString()}`);
    createLogger.data('请求体', req.body);

    const { uuid, name, description, max_people } = req.body;

    // 验证必需参数
    const missingFields = [];
    if (!uuid || uuid.trim() === '') missingFields.push('uuid');
    if (!name || name.trim() === '') missingFields.push('name');

    if (missingFields.length > 0) {
      createLogger.error(`缺少必需参数: ${missingFields.join(', ')}`);
      return res.status(400).json({ 
        error: '缺少必需参数',
        missing_fields: missingFields 
      });
    }

    // 记录接收到的完整数据
    createLogger.info('接收到的团队数据:');
    createLogger.check('uuid', !!uuid, uuid);
    createLogger.check('name', !!name, name);
    createLogger.check('description', description !== undefined, description);
    createLogger.check('max_people', max_people !== undefined, max_people);

    try {
      createLogger.info('开始调用团队创建服务...');
      
      // 构建团队数据对象
      const teamData = {
        uuid: uuid,
        name: name,
        description: description,
        max_people: max_people
      };
      
      // 调用团队服务创建数据
      const result = await this.teamService.createTeam(teamData);
      createLogger.info('团队创建服务调用完成');

      if (result.success) {
        createLogger.success('团队创建成功');
        createLogger.info('返回数据检查:');
        createLogger.check('团队ID', true, result.data.team_id);
        createLogger.check('插入ID', true, result.data._id);
        
        // 构建简化的响应体，避免ID冗余
        const responseData = {
          status: 'success',
          message: '团队创建成功',
          data: {
            team_id: result.data.team_id,
            name: result.data.name,
            description: result.data.description,
            max_people: result.data.max_people,
            creator_uuid: result.data.creator_uuid,
            leader_uuid: result.data.leader_uuid,
            members: result.data.members,
            member_count: result.data.member_count,
            created_at: result.data.created_at,
            updated_at: result.data.updated_at,
            status: result.data.status
          }
        };
        
        // 记录完整的响应体用于调试
        createLogger.data('简化响应体', responseData);
        
        res.json(responseData);
        createLogger.success('响应已发送给客户端');

      } else {
        createLogger.error('团队创建失败');
        createLogger.error('失败原因:', result.error);
        createLogger.error('详细信息:', result.details);
        
        res.status(400).json({
          status: 'error',
          message: '团队创建失败',
          error: result.error,
          details: result.details || [],
          request_data: {
            uuid: uuid,
            name: name,
            description: description,
            max_people: max_people
          }
        });
        createLogger.info('错误响应已发送给客户端');
      }

    } catch (err) {
      createLogger.error('服务器异常捕获');
      createLogger.error('异常类型:', err.name);
      createLogger.error('异常信息:', err.message);
      createLogger.debug('异常堆栈:', err.stack);
      res.status(500).json({ 
        error: '服务器错误',
        message: '创建过程中发生服务器异常',
        request_data: {
          uuid: uuid,
          name: name,
          description: description,
          max_people: max_people
        }
      });
      createLogger.info('服务器错误响应已发送');
    }
  }
}

module.exports = TeamController;