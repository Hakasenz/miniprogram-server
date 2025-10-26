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

// 项目提交接口
app.post('/api/project/submit', async (req, res) => {
  const projectLogger = new Logger('ProjectAPI');
  
  projectLogger.separator('收到项目提交请求');
  projectLogger.info('API版本: v1.1 - 支持成员列表和领导者字段');
  projectLogger.info(`请求时间: ${new Date().toISOString()}`);
  projectLogger.data('请求体', req.body);

  const { name, people, group, uuid, submitTime, members, leader } = req.body;

  // 验证必需参数
  const missingFields = [];
  if (!name) missingFields.push('name');
  if (!people) missingFields.push('people');
  if (!group) missingFields.push('group');
  if (!uuid) missingFields.push('uuid');
  if (!submitTime) missingFields.push('submitTime');

  if (missingFields.length > 0) {
    projectLogger.error(`缺少必需参数: ${missingFields.join(', ')}`);
    return res.status(400).json({ 
      error: '缺少必需参数',
      missing_fields: missingFields 
    });
  }

  // 组织项目数据对象
  const projectData = {
    name,
    people,
    group,
    uuid,
    submitTime,
    members,  // 可选：成员UUID数组
    leader    // 可选：领导者UUID，默认为提交者uuid
  };

  try {
    projectLogger.info('开始调用项目服务...');
    
    // 调用项目服务保存数据
    const result = await projectService.saveProject(projectData);
    projectLogger.info('项目服务调用完成');

    if (result.success) {
      projectLogger.success('项目提交成功');
      projectLogger.info('返回数据检查:');
      projectLogger.check('project_id', !!result.data.project_id, result.data.project_id);
      projectLogger.check('user_uuid', !!result.data.user_uuid, result.data.user_uuid);
      projectLogger.check('leader', !!result.data.leader, result.data.leader);
      projectLogger.check('members', Array.isArray(result.data.members), `${result.data.members?.length || 0} 个成员`);
      projectLogger.check('created_at', !!result.data.created_at);
      
      const responseData = {
        status: 'success',
        message: '项目提交成功',
        data: result.data
      };
      
      // 记录完整的响应体用于调试
      projectLogger.data('完整响应体', responseData);
      
      res.json(responseData);
      projectLogger.success('响应已发送给客户端');
      projectLogger.complete('项目提交处理完成');
    } else {
      projectLogger.error('项目提交失败');
      projectLogger.error(`失败原因: ${result.error}`);
      if (result.details) {
        projectLogger.error('详细信息:', result.details);
      }
      
      res.status(400).json({ 
        error: result.error,
        details: result.details || []
      });
      projectLogger.info('错误响应已发送给客户端');
    }

  } catch (err) {
    projectLogger.error('服务器异常捕获');
    projectLogger.error('异常类型:', err.name);
    projectLogger.error('异常信息:', err.message);
    projectLogger.debug('异常堆栈:', err.stack);
    res.status(500).json({ error: '服务器错误' });
    projectLogger.info('服务器错误响应已发送');
  }
});

// 查询用户作为领导者的项目接口
app.post('/api/project', async (req, res) => {
  const queryLogger = new Logger('ProjectQueryAPI');
  
  queryLogger.separator('收到项目查询请求');
  queryLogger.info('API版本: v1.0 - 查询用户领导的项目');
  queryLogger.info(`请求时间: ${new Date().toISOString()}`);
  queryLogger.data('请求体', req.body);

  const { uuid } = req.body;

  // 验证必需参数
  if (!uuid) {
    queryLogger.error('缺少必需参数: uuid');
    return res.status(400).json({ 
      error: '缺少必需参数',
      missing_fields: ['uuid']
    });
  }

  try {
    queryLogger.info('开始调用项目查询服务...');
    
    // 调用项目服务查询数据
    const result = await projectService.getProjectsByLeader(uuid);
    queryLogger.info('项目查询服务调用完成');

    if (result.success) {
      queryLogger.success('项目查询成功');
      queryLogger.info('返回数据检查:');
      queryLogger.check('项目数量', true, `${result.data.length} 个项目`);
      queryLogger.check('查询用户', true, uuid);
      
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
        details: result.details || []
      });
      queryLogger.info('错误响应已发送给客户端');
    }

  } catch (err) {
    queryLogger.error('服务器异常捕获');
    queryLogger.error('异常类型:', err.name);
    queryLogger.error('异常信息:', err.message);
    queryLogger.debug('异常堆栈:', err.stack);
    res.status(500).json({ error: '服务器错误' });
    queryLogger.info('服务器错误响应已发送');
  }
});

module.exports = app;
