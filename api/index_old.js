const express = require('express');
const bodyParser = require('body-parser');
const AuthService = require('./services/AuthService');
const ProjectService = require('./services/ProjectService');
const Logger = require('./utils/Logger');

const app = express();
app.use(bodyParser.json());

// 创建服务实例
const authService = new AuthService();
const projectService = new ProjectService();
const logger = new Logger('LoginAPI');

// 登录接口
app.post('/api/login', async (req, res) => {
  logger.separator('收到登录请求');
  logger.info('代码版本: v2.3 - 每次登录强制更新头像URL（临时地址机制）');
  logger.data('请求体', req.body);

  const { code, avatarUrl, nickName } = req.body;
  
  // 验证必需参数
  if (!code) {
    logger.error('缺少必需参数: code');
    return res.status(400).json({ error: '缺少 code' });
  }

  // 组织用户信息对象
  const userInfo = {
    nickName: nickName,
    avatarUrl: avatarUrl
  };

  try {
    logger.info('开始调用认证服务...');
    
    // 环境变量检查
    logger.info('环境变量检查:');
    logger.check('APPID', !!process.env.APPID);
    logger.check('APPSECRET', !!process.env.APPSECRET);
    logger.check('MONGODB_URI', !!process.env.MONGODB_URI);
    logger.check('DATABASE_NAME', true, process.env.DATABASE_NAME || 'miniprogram (默认)');
    
    // 调用认证服务进行登录
    const result = await authService.login(code, userInfo);
    logger.info('认证服务调用完成');

    if (result.success) {
      logger.success('登录成功，准备返回数据');
      logger.info('返回数据检查:');
      logger.check('session_token', !!result.data.session_token);
      logger.check('user.uuid', true, result.data.user?.uuid || '未知');
      logger.check('user.avatar_url', !!result.data.user?.avatar_url, result.data.user?.avatar_url || '无头像');
      logger.check('isNewUser', true, result.data.isNewUser);
      
      // 添加完整的返回数据日志以便调试
      logger.data('完整返回数据结构', result.data);
      
      res.json(result.data);
      logger.success('响应已发送给客户端');
      logger.complete('登录请求处理完成');
    } else {
      logger.error('登录失败');
      logger.error(`失败原因: ${result.error}`);
      res.status(400).json({ error: result.error });
      logger.info('错误响应已发送给客户端');
    }

  } catch (err) {
    logger.error('服务器异常捕获');
    logger.error('异常类型:', err.name);
    logger.error('异常信息:', err.message);
    logger.debug('异常堆栈:', err.stack);
    res.status(500).json({ error: '服务器错误' });
    logger.info('服务器错误响应已发送');
  }
});


// 查询用户作为领导者的项目接口
app.post('/api/project', async (req, res) => {
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
    const result = await projectService.getProjectsByLeader(leader);
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
      queryLogger.complete('项目查询处理完成');
    } else {
      queryLogger.error('项目查询失败');
      queryLogger.error(`失败原因: ${result.error}`);
      if (result.details) {
        queryLogger.error('详细信息:', result.details);
      }
      
      res.status(400).json({ 
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
});

// 根据UUID查询用户领导的项目接口
app.post('/api/project/leader', async (req, res) => {
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
    const result = await projectService.getProjectsByLeader(uuid);
    leaderQueryLogger.info('项目查询服务调用完成');

    if (result.success) {
      leaderQueryLogger.success('领导者项目查询成功');
      leaderQueryLogger.info('返回数据检查:');
      leaderQueryLogger.check('查询UUID', true, uuid);
      leaderQueryLogger.check('项目数量', true, `${result.data.length} 个项目`);
      
      // 记录每个项目的基本信息
      if (result.data.length > 0) {
        leaderQueryLogger.info('找到的项目列表:');
        result.data.forEach((project, index) => {
          leaderQueryLogger.info(`  ${index + 1}. ${project.name || '未命名项目'} (ID: ${project.project_id || 'N/A'})`);
        });
      } else {
        leaderQueryLogger.info('该用户不是任何项目的领导者');
      }
      
      const responseData = {
        status: 'success',
        message: '领导者项目查询成功',
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
      leaderQueryLogger.complete('领导者项目查询处理完成');
    } else {
      leaderQueryLogger.error('领导者项目查询失败');
      leaderQueryLogger.error(`失败原因: ${result.error}`);
      if (result.details) {
        leaderQueryLogger.error('详细信息:', result.details);
      }
      
      res.status(400).json({ 
        error: result.error,
        details: result.details || [],
        leader_uuid: uuid
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
});

// 项目提交接口
app.post('/api/project/submit', async (req, res) => {
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
    const result = await projectService.saveProject(projectData);
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
});

module.exports = app;
