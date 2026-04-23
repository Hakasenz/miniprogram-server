const Logger = require('../utils/Logger');
const { MongoClient } = require('mongodb');

class MessageService {
  constructor() {
    this.logger = new Logger('MessageService');
    this.mongoClient = null;
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
      this.mongoClient = new MongoClient(this.MONGODB_URI);

      await this.mongoClient.connect();
      this.db = this.mongoClient.db(this.DATABASE_NAME);
      this.logger.success('MongoDB 连接成功');
    } catch (error) {
      this.logger.error('MongoDB 连接失败:', error.message);
      this.db = null;
    }
  }

  /**
   * 创建消息
   */
  async createMessage({ type, title, content, project_id, project_name, sender_uuid, receiver_uuid, related_step_id }) {
    this.logger.info('开始创建消息...');
    this.logger.data('消息数据', { type, title, receiver_uuid });

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟数据');
        const mockMessage = {
          message_id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          type,
          title,
          content,
          project_id,
          project_name,
          sender_uuid,
          receiver_uuid,
          related_step_id: related_step_id || null,
          is_read: false,
          created_at: new Date().toISOString()
        };
        return {
          success: true,
          data: mockMessage
        };
      }

      const message = {
        message_id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type,
        title,
        content,
        project_id,
        project_name,
        sender_uuid,
        receiver_uuid,
        related_step_id: related_step_id || null,
        is_read: false,
        created_at: new Date().toISOString()
      };

      this.logger.database('INSERT', 'db.messages.insertOne');
      
      const result = await this.db.collection('messages').insertOne(message);

      this.logger.success(`消息创建成功！消息ID: ${message.message_id}`);

      return {
        success: true,
        data: message
      };

    } catch (error) {
      this.logger.error('创建消息失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '创建失败',
        details: error.message
      };
    }
  }

  /**
   * 获取用户消息列表
   */
  async getUserMessages({ uuid, page = 1, pageSize = 20, is_read = null }) {
    this.logger.info('开始获取用户消息列表...');
    this.logger.data('查询参数', { uuid, page, pageSize, is_read });

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接，返回空列表');
        return {
          success: true,
          data: {
            messages: [],
            total: 0,
            page,
            pageSize
          }
        };
      }

      // 构建查询条件
      const query = { receiver_uuid: uuid };
      if (is_read !== null) {
        query.is_read = is_read;
      }

      // 计算分页
      const skip = (page - 1) * pageSize;

      // 查询总数
      const total = await this.db.collection('messages').countDocuments(query);

      // 查询消息列表（按创建时间倒序）
      const messages = await this.db.collection('messages')
        .find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(pageSize)
        .toArray();

      this.logger.success(`获取消息列表成功！共 ${total} 条消息`);

      return {
        success: true,
        data: {
          messages,
          total,
          page,
          pageSize
        }
      };

    } catch (error) {
      this.logger.error('获取消息列表失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '获取失败',
        details: error.message
      };
    }
  }

  /**
   * 标记消息为已读
   */
  async markAsRead({ message_id, uuid }) {
    this.logger.info('开始标记消息为已读...');
    this.logger.data('消息ID', message_id);

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟成功');
        return {
          success: true,
          data: { message_id, is_read: true }
        };
      }

      const result = await this.db.collection('messages').updateOne(
        { 
          message_id: message_id,
          receiver_uuid: uuid  // 确保只能标记自己的消息
        },
        { $set: { is_read: true } }
      );

      if (result.matchedCount === 0) {
        this.logger.error('未找到指定的消息');
        return {
          success: false,
          error: '消息不存在'
        };
      }

      this.logger.success('消息已标记为已读');

      return {
        success: true,
        data: { message_id, is_read: true }
      };

    } catch (error) {
      this.logger.error('标记消息已读失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '标记失败',
        details: error.message
      };
    }
  }

  /**
   * 标记所有消息为已读
   */
  async markAllAsRead({ uuid }) {
    this.logger.info('开始标记所有消息为已读...');
    this.logger.data('用户UUID', uuid);

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟成功');
        return {
          success: true,
          data: { marked_count: 0 }
        };
      }

      const result = await this.db.collection('messages').updateMany(
        { 
          receiver_uuid: uuid,
          is_read: false
        },
        { $set: { is_read: true } }
      );

      this.logger.success(`已标记 ${result.modifiedCount} 条消息为已读`);

      return {
        success: true,
        data: { marked_count: result.modifiedCount }
      };

    } catch (error) {
      this.logger.error('标记所有消息已读失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '标记失败',
        details: error.message
      };
    }
  }

  /**
   * 删除消息
   */
  async deleteMessage({ message_id, uuid }) {
    this.logger.info('开始删除消息...');
    this.logger.data('消息ID', message_id);

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟成功');
        return {
          success: true,
          data: { message_id, deleted: true }
        };
      }

      const result = await this.db.collection('messages').deleteOne(
        { 
          message_id: message_id,
          receiver_uuid: uuid  // 确保只能删除自己的消息
        }
      );

      if (result.deletedCount === 0) {
        this.logger.error('未找到指定的消息');
        return {
          success: false,
          error: '消息不存在'
        };
      }

      this.logger.success('消息删除成功');

      return {
        success: true,
        data: { message_id, deleted: true }
      };

    } catch (error) {
      this.logger.error('删除消息失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '删除失败',
        details: error.message
      };
    }
  }

  /**
   * 获取未读消息数量
   */
  async getUnreadCount({ uuid }) {
    this.logger.info('开始获取未读消息数量...');
    this.logger.data('用户UUID', uuid);

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接，返回0');
        return {
          success: true,
          data: { unread_count: 0 }
        };
      }

      const count = await this.db.collection('messages').countDocuments({
        receiver_uuid: uuid,
        is_read: false
      });

      this.logger.success(`未读消息数量: ${count}`);

      return {
        success: true,
        data: { unread_count: count }
      };

    } catch (error) {
      this.logger.error('获取未读消息数量失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '获取失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 发送流程提交通知给项目负责人
   */
  async sendWorkflowSubmitNotification({ project_id, project_name, step_id, action, submitter_uuid, leader_uuid }) {
    this.logger.info('发送流程提交通知...');

    try {
      // 获取提交者信息（这里简化处理，实际应该查询用户表）
      const senderName = submitter_uuid; // 可以后续优化为查询用户名

      const message = await this.createMessage({
        type: 'workflow_submit',
        title: '新流程待审批',
        content: `${senderName} 提交了新的流程节点："${action}"，请及时审批`,
        project_id,
        project_name,
        sender_uuid: submitter_uuid,
        receiver_uuid: leader_uuid,
        related_step_id: step_id
      });

      return message;

    } catch (error) {
      this.logger.error('发送流程提交通知失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * ⭐ 发送流程审批结果通知给提交者
   */
  async sendWorkflowApprovalNotification({ project_id, project_name, step_id, action, submitter_uuid, approver_uuid, status }) {
    this.logger.info('发送流程审批结果通知...');

    try {
      const statusText = status === 'approved' ? '已通过' : '已拒绝';
      const senderName = approver_uuid; // 可以后续优化为查询用户名

      const message = await this.createMessage({
        type: status === 'approved' ? 'workflow_approve' : 'workflow_reject',
        title: `流程${statusText}`,
        content: `您的流程节点"${action}"已被${statusText}`,
        project_id,
        project_name,
        sender_uuid: approver_uuid,
        receiver_uuid: submitter_uuid,
        related_step_id: step_id
      });

      return message;

    } catch (error) {
      this.logger.error('发送流程审批结果通知失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * ⭐ 发送团队聊天消息（使用独立的 team_chats 集合）
   */
  async sendTeamChatMessage({ content, project_id, sender_uuid, sender_name, sender_avatar }) {
    this.logger.info('开始发送团队聊天消息...');
    this.logger.data('消息数据', { project_id, sender_uuid });

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟数据');
        const mockMessage = {
          chat_id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          content,
          project_id,
          sender_uuid,
          sender_name,
          sender_avatar,
          is_deleted: false,
          created_at: new Date().toISOString()
        };
        return {
          success: true,
          data: mockMessage
        };
      }

      const message = {
        chat_id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        content,
        project_id,
        sender_uuid,
        sender_name,
        sender_avatar,
        is_deleted: false,
        created_at: new Date().toISOString()
      };

      this.logger.database('INSERT', 'db.team_chats.insertOne');
      
      const result = await this.db.collection('team_chats').insertOne(message);

      this.logger.success(`团队消息发送成功！消息ID: ${message.chat_id}`);

      return {
        success: true,
        data: message
      };

    } catch (error) {
      this.logger.error('发送团队消息失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '发送失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 获取团队聊天消息列表（从独立的 team_chats 集合）
   */
  async getTeamChatMessages({ project_id, page = 1, pageSize = 30 }) {
    this.logger.info('开始获取团队聊天消息列表...');
    this.logger.data('查询参数', { project_id, page, pageSize });

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接，返回空列表');
        return {
          success: true,
          data: {
            messages: [],
            total: 0,
            page,
            pageSize
          }
        };
      }

      // 构建查询条件（使用独立的 team_chats 集合）
      const query = { 
        project_id: project_id,
        is_deleted: false
      };

      // 计算分页
      const skip = (page - 1) * pageSize;

      // 查询总数
      const total = await this.db.collection('team_chats').countDocuments(query);

      // 查询消息列表（按创建时间正序）
      const messages = await this.db.collection('team_chats')
        .find(query)
        .sort({ created_at: 1 })
        .skip(skip)
        .limit(pageSize)
        .toArray();

      this.logger.success(`获取团队消息列表成功！共 ${total} 条消息`);

      return {
        success: true,
        data: {
          messages,
          total,
          page,
          pageSize
        }
      };

    } catch (error) {
      this.logger.error('获取团队消息列表失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '获取失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 删除团队聊天消息（从独立的 team_chats 集合）
   */
  async deleteTeamChatMessage({ message_id, uuid }) {
    this.logger.info('开始删除团队聊天消息...');
    this.logger.data('消息ID', message_id);

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟成功');
        return {
          success: true,
          data: { message_id, deleted: true }
        };
      }

      // 软删除：只标记为已删除，不真正删除（使用独立的 team_chats 集合）
      const result = await this.db.collection('team_chats').updateOne(
        { 
          chat_id: message_id,
          sender_uuid: uuid  // 确保只能删除自己发送的消息
        },
        { $set: { is_deleted: true } }
      );

      if (result.matchedCount === 0) {
        this.logger.error('未找到指定的消息或无权限删除');
        return {
          success: false,
          error: '消息不存在或无权限删除'
        };
      }

      this.logger.success('团队消息删除成功');

      return {
        success: true,
        data: { message_id, deleted: true }
      };

    } catch (error) {
      this.logger.error('删除团队消息失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '删除失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 发送项目完成通知给所有成员
   */
  async sendProjectCompletionNotification({ project_id, project_name, completed_by, members }) {
    this.logger.info('发送项目完成通知...');
    this.logger.data('通知数据', { project_id, project_name, completed_by, members_count: members?.length || 0 });

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接，跳过发送通知');
        return { success: true, message: '模拟发送成功' };
      }

      // 获取完成者信息
      const completer = await this.db.collection('users').findOne({ uuid: completed_by });
      const completerName = completer?.name || completed_by;

      // 为每个成员创建通知（排除完成者自己）
      const notifications = [];
      for (const memberUuid of (members || [])) {
        // 不给自己发送通知
        if (memberUuid === completed_by) {
          continue;
        }

        const message = {
          message_id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'project_completed',
          title: '项目已完成',
          content: `项目"${project_name}"已被${completerName}标记为完成`,
          project_id,
          project_name,
          sender_uuid: completed_by,
          receiver_uuid: memberUuid,
          is_read: false,
          created_at: new Date().toISOString()
        };

        await this.db.collection('messages').insertOne(message);
        notifications.push(message);
      }

      this.logger.success(`项目完成通知已发送给 ${notifications.length} 个成员`);
      return {
        success: true,
        data: {
          sent_count: notifications.length,
          notifications
        }
      };

    } catch (error) {
      this.logger.error('发送项目完成通知失败:', error.message);
      this.logger.error('错误详情:', error);
      // ⭐ 通知失败不影响主流程，返回成功但记录错误
      return {
        success: true,
        warning: '通知发送失败，但项目状态已更新',
        error: error.message
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

module.exports = MessageService;
