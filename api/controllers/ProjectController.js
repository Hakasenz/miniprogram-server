const ProjectService = require('../services/ProjectService');
const Logger = require('../utils/Logger');

class ProjectController {
  constructor() {
    this.projectService = new ProjectService();
  }

  /**
   * 项目查询接口 - 新格式（使用 leader 字段）
   */
  async queryProjects(req, res) {
    const queryLogger = new Logger('ProjectQueryAPI');
    
    queryLogger.separator('收到项目查询请求');
    queryLogger.info('API版本: v2.0 - 支持新的请求体格式');
    queryLogger.info(`请求时间: ${new Date().toISOString()}`);
    queryLogger.data('请求体', req.body);

    const { id, name, role, people, group, leader, submitTime } = req.body;

    // 验证必需参数
    const missingFields = [];
    if (!leader) missingFields.push('leader');

    if (missingFields.length > 0) {
      queryLogger.error(`缺少必需参数: ${missingFields.join(', ')}`);
      return res.status(400).json({ 
        error: '缺少必需参数',
        missing_fields: missingFields 
      });
    }

    // 记录接收到的完整数据
    queryLogger.info('接收到的项目数据:');
    queryLogger.check('id', !!id, id);
    queryLogger.check('name', !!name, name);
    queryLogger.check('role', !!role, role);
    queryLogger.check('people', !!people, people);
    queryLogger.check('group', !!group, group);
    queryLogger.check('leader', !!leader, leader);
    queryLogger.check('submitTime', !!submitTime, submitTime);

    try {
      queryLogger.info('开始调用项目查询服务...');
      
      // 调用项目服务查询数据
      const result = await this.projectService.getProjectsByLeader(leader);
      queryLogger.info('项目查询服务调用完成');

      if (result.success) {
        queryLogger.success('项目查询成功');
        queryLogger.info('返回数据检查:');
        queryLogger.check('项目数量', true, `${result.data.length} 个项目`);
        queryLogger.check('查询用户', true, leader);
        
        const responseData = {
          status: 'success',
          message: '项目查询成功',
          request_data: {
            id: id,
            name: name,
            role: role,
            people: people,
            group: group,
            leader: leader,
            submitTime: submitTime
          },
          data: {
            leader_uuid: leader,
            project_count: result.data.length,
            projects: result.data
          }
        };
        
        // 记录完整的响应体用于调试
        queryLogger.data('完整响应体', responseData);
        
        res.json(responseData);
        queryLogger.success('响应已发送给客户端');

      } else {
        queryLogger.error('项目查询失败');
        queryLogger.error('失败原因:', result.error);
        queryLogger.error('详细信息:', result.details);
        
        res.status(400).json({
          status: 'error',
          message: '项目查询失败',
          error: result.error,
          details: result.details || [],
          request_data: {
            id: id,
            name: name,
            role: role,
            people: people,
            group: group,
            leader: leader,
            submitTime: submitTime
          }
        });
        queryLogger.info('错误响应已发送给客户端');
      }

    } catch (err) {
      queryLogger.error('服务器异常捕获');
      queryLogger.error('异常类型:', err.name);
      queryLogger.error('异常信息:', err.message);
      queryLogger.debug('异常堆栈:', err.stack);
      res.status(500).json({ 
        error: '服务器错误',
        request_data: {
          id: id,
          name: name,
          role: role,
          people: people,
          group: group,
          leader: leader,
          submitTime: submitTime
        }
      });
      queryLogger.info('服务器错误响应已发送');
    }
  }

  /**
   * 项目查询接口 - UUID格式（使用 uuid 字段）
   */
  async queryProjectsByLeader(req, res) {
    const leaderQueryLogger = new Logger('ProjectLeaderAPI');
    
    leaderQueryLogger.separator('收到领导者项目查询请求');
    leaderQueryLogger.info('API版本: v1.0 - 根据UUID查询领导的项目');
    leaderQueryLogger.info(`请求时间: ${new Date().toISOString()}`);
    leaderQueryLogger.data('请求体', req.body);

    const { uuid } = req.body;

    // 验证必需参数
    if (!uuid) {
      leaderQueryLogger.error('缺少必需参数: uuid');
      return res.status(400).json({ 
        error: '缺少必需参数',
        missing_fields: ['uuid']
      });
    }

    leaderQueryLogger.info(`查询领导者UUID: ${uuid}`);

    try {
      leaderQueryLogger.info('开始调用项目查询服务...');
      
      // 调用项目服务查询数据
      const result = await this.projectService.getProjectsByLeader(uuid);
      leaderQueryLogger.info('项目查询服务调用完成');

      if (result.success) {
        leaderQueryLogger.success('项目查询成功');
        leaderQueryLogger.info('返回数据检查:');
        leaderQueryLogger.check('项目数量', true, `${result.data.length} 个项目`);
        leaderQueryLogger.check('查询UUID', true, uuid);
        
        const responseData = {
          status: 'success',
          message: '项目查询成功',
          data: {
            leader_uuid: uuid,
            project_count: result.data.length,
            projects: result.data
          }
        };
        
        // 记录完整的响应体用于调试
        leaderQueryLogger.data('完整响应体', responseData);
        
        res.json(responseData);
        leaderQueryLogger.success('响应已发送给客户端');

      } else {
        leaderQueryLogger.error('项目查询失败');
        leaderQueryLogger.error('失败原因:', result.error);
        leaderQueryLogger.error('详细信息:', result.details);
        
        res.status(400).json({
          status: 'error',
          message: '项目查询失败',
          error: result.error,
          details: result.details || []
        });
        leaderQueryLogger.info('错误响应已发送给客户端');
      }

    } catch (err) {
      leaderQueryLogger.error('服务器异常捕获');
      leaderQueryLogger.error('异常类型:', err.name);
      leaderQueryLogger.error('异常信息:', err.message);
      leaderQueryLogger.debug('异常堆栈:', err.stack);
      res.status(500).json({ 
        error: '服务器错误',
        leader_uuid: uuid
      });
      leaderQueryLogger.info('服务器错误响应已发送');
    }
  }

  /**
   * 项目提交接口
   */
  async submitProject(req, res) {
    const submitLogger = new Logger('ProjectSubmitAPI');
    
    submitLogger.separator('收到项目提交请求');
    submitLogger.info('API版本: v1.0 - 项目数据写入到数据库');
    submitLogger.info(`请求时间: ${new Date().toISOString()}`);
    submitLogger.data('请求体', req.body);

    const { id, name, role, people, group, uuid, submitTime, members, leader } = req.body;

    // 验证必需参数
    const missingFields = [];
    if (!name || name.trim() === '') missingFields.push('name');
    if (!people || people <= 0) missingFields.push('people');
    if (!group || group.trim() === '') missingFields.push('group');
    if (!uuid || uuid.trim() === '') missingFields.push('uuid');
    if (!submitTime) missingFields.push('submitTime');

    if (missingFields.length > 0) {
      submitLogger.error(`缺少必需参数: ${missingFields.join(', ')}`);
      return res.status(400).json({ 
        error: '缺少必需参数',
        missing_fields: missingFields 
      });
    }

    // 记录接收到的完整数据
    submitLogger.info('接收到的项目数据:');
    submitLogger.check('id', !!id, id);
    submitLogger.check('name', !!name, name);
    submitLogger.check('role', !!role, role);
    submitLogger.check('people', !!people, people);
    submitLogger.check('group', !!group, group);
    submitLogger.check('uuid', !!uuid, uuid);
    submitLogger.check('submitTime', !!submitTime, submitTime);
    submitLogger.check('members', !!members, members);
    submitLogger.check('leader', !!leader, leader);

    try {
      submitLogger.info('开始调用项目保存服务...');
      
      // 构建项目数据对象
      const projectData = {
        id: id,
        name: name,
        role: role,
        people: people,
        group: group,
        uuid: uuid,
        submitTime: submitTime,
        members: members,
        leader: leader
      };
      
      // 调用项目服务保存数据
      const result = await this.projectService.saveProject(projectData);
      submitLogger.info('项目保存服务调用完成');

      if (result.success) {
        submitLogger.success('项目提交成功');
        submitLogger.info('返回数据检查:');
        submitLogger.check('项目ID', true, result.data.project_id);
        submitLogger.check('插入ID', true, result.data._id);
        
        const responseData = {
          status: 'success',
          message: '项目提交成功',
          request_data: {
            id: id,
            name: name,
            role: role,
            people: people,
            group: group,
            uuid: uuid,
            submitTime: submitTime,
            members: members,
            leader: leader
          },
          data: {
            project_id: result.data.project_id,
            _id: result.data._id,
            saved_project: result.data
          }
        };
        
        // 记录完整的响应体用于调试
        submitLogger.data('完整响应体', responseData);
        
        res.json(responseData);
        submitLogger.success('响应已发送给客户端');

      } else {
        submitLogger.error('项目提交失败');
        submitLogger.error('失败原因:', result.error);
        submitLogger.error('详细信息:', result.details);
        
        res.status(400).json({
          status: 'error',
          message: '项目提交失败',
          error: result.error,
          details: result.details || [],
          request_data: {
            id: id,
            name: name,
            role: role,
            people: people,
            group: group,
            uuid: uuid,
            submitTime: submitTime,
            members: members,
            leader: leader
          }
        });
        submitLogger.info('错误响应已发送给客户端');
      }

    } catch (err) {
      submitLogger.error('服务器异常捕获');
      submitLogger.error('异常类型:', err.name);
      submitLogger.error('异常信息:', err.message);
      submitLogger.debug('异常堆栈:', err.stack);
      res.status(500).json({ 
        error: '服务器错误',
        request_data: {
          id: id,
          name: name,
          role: role,
          people: people,
          group: group,
          uuid: uuid,
          submitTime: submitTime,
          members: members,
          leader: leader
        }
      });
      submitLogger.info('服务器错误响应已发送');
    }
  }

  /**
   * 项目删除接口
   */
  async deleteProject(req, res) {
    const deleteLogger = new Logger('ProjectDeleteAPI');
    
    deleteLogger.separator('收到项目删除请求');
    deleteLogger.info('API版本: v1.0 - 项目删除功能');
    deleteLogger.info(`请求时间: ${new Date().toISOString()}`);
    deleteLogger.data('请求体', req.body);

    const { id } = req.body;

    // 验证必需参数
    if (!id || id.trim() === '') {
      deleteLogger.error('缺少必需参数: id');
      return res.status(400).json({ 
        error: '缺少必需参数',
        missing_fields: ['id'],
        message: '项目ID不能为空'
      });
    }

    // 记录接收到的删除请求
    deleteLogger.info('接收到的删除请求:');
    deleteLogger.check('项目ID', !!id, id);

    try {
      deleteLogger.info('开始调用项目删除服务...');
      
      // 调用项目服务删除数据
      const result = await this.projectService.deleteProject(id);
      deleteLogger.info('项目删除服务调用完成');

      if (result.success) {
        deleteLogger.success('项目删除成功');
        deleteLogger.info('返回数据检查:');
        deleteLogger.check('删除项目ID', true, result.data.project_id);
        deleteLogger.check('删除状态', true, result.data.deleted);
        
        const responseData = {
          status: 'success',
          message: '项目删除成功',
          data: {
            project_id: result.data.project_id,
            deleted: result.data.deleted,
            deleted_project: result.data.deleted_project || null
          }
        };
        
        // 记录完整的响应体用于调试
        deleteLogger.data('完整响应体', responseData);
        
        res.json(responseData);
        deleteLogger.success('响应已发送给客户端');

      } else {
        deleteLogger.error('项目删除失败');
        deleteLogger.error('失败原因:', result.error);
        deleteLogger.error('详细信息:', result.details);
        
        res.status(400).json({
          status: 'error',
          message: '项目删除失败',
          error: result.error,
          details: result.details || [],
          data: {
            project_id: id
          }
        });
        deleteLogger.info('错误响应已发送给客户端');
      }

    } catch (err) {
      deleteLogger.error('服务器异常捕获');
      deleteLogger.error('异常类型:', err.name);
      deleteLogger.error('异常信息:', err.message);
      deleteLogger.debug('异常堆栈:', err.stack);
      res.status(500).json({ 
        error: '服务器错误',
        message: '删除过程中发生服务器异常',
        data: {
          project_id: id
        }
      });
      deleteLogger.info('服务器错误响应已发送');
    }
  }

  /**
   * 项目更新接口
   */
  async updateProject(req, res) {
    const updateLogger = new Logger('ProjectUpdateAPI');
    
    updateLogger.separator('收到项目更新请求');
    updateLogger.info('API版本: v1.0 - 项目信息更新');
    updateLogger.info(`请求时间: ${new Date().toISOString()}`);
    updateLogger.data('请求体', req.body);

    const { project_id, uuid, name, group, people } = req.body;

    // 验证必需参数
    const missingFields = [];
    if (!project_id || project_id.trim() === '') missingFields.push('project_id');
    if (!uuid || uuid.trim() === '') missingFields.push('uuid');

    if (missingFields.length > 0) {
      updateLogger.error(`缺少必需参数: ${missingFields.join(', ')}`);
      return res.status(400).json({ 
        error: '缺少必需参数',
        missing_fields: missingFields 
      });
    }

    // 检查是否有要更新的字段
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (group !== undefined) updateData.group = group;
    if (people !== undefined) updateData.people = people;

    if (Object.keys(updateData).length === 0) {
      updateLogger.error('没有提供要更新的字段');
      return res.status(400).json({ 
        error: '没有要更新的字段',
        details: ['至少需要提供一个要更新的字段(name, group, people)']
      });
    }

    // 记录接收到的完整数据
    updateLogger.info('接收到的更新数据:');
    updateLogger.check('project_id', !!project_id, project_id);
    updateLogger.check('uuid', !!uuid, uuid);
    updateLogger.check('name', name !== undefined, name);
    updateLogger.check('group', group !== undefined, group);
    updateLogger.check('people', people !== undefined, people);

    try {
      updateLogger.info('开始调用项目更新服务...');
      
      // 调用项目服务更新数据
      const result = await this.projectService.updateProject(project_id, uuid, updateData);
      updateLogger.info('项目更新服务调用完成');

      if (result.success) {
        updateLogger.success('项目更新成功');
        updateLogger.info('返回数据检查:');
        updateLogger.check('项目ID', true, result.data.project_id);
        updateLogger.check('更新时间', true, result.data.updated_at);
        
        const responseData = {
          status: 'success',
          message: '项目更新成功',
          request_data: {
            project_id: project_id,
            uuid: uuid,
            update_fields: updateData
          },
          data: {
            project_id: result.data.project_id,
            updated_project: result.data
          }
        };
        
        // 记录完整的响应体用于调试
        updateLogger.data('完整响应体', responseData);
        
        res.json(responseData);
        updateLogger.success('响应已发送给客户端');

      } else {
        updateLogger.error('项目更新失败');
        updateLogger.error('失败原因:', result.error);
        updateLogger.error('详细信息:', result.details);
        
        res.status(400).json({
          status: 'error',
          message: '项目更新失败',
          error: result.error,
          details: result.details || [],
          request_data: {
            project_id: project_id,
            uuid: uuid,
            update_fields: updateData
          }
        });
        updateLogger.info('错误响应已发送给客户端');
      }

    } catch (err) {
      updateLogger.error('服务器异常捕获');
      updateLogger.error('异常类型:', err.name);
      updateLogger.error('异常信息:', err.message);
      updateLogger.debug('异常堆栈:', err.stack);
      res.status(500).json({ 
        error: '服务器错误',
        message: '更新过程中发生服务器异常',
        request_data: {
          project_id: project_id,
          uuid: uuid,
          update_fields: updateData
        }
      });
      updateLogger.info('服务器错误响应已发送');
    }
  }
}

module.exports = ProjectController;