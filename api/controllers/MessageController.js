const MessageService = require('../services/MessageService');
const Logger = require('../utils/Logger');

class MessageController {
  constructor() {
    this.messageService = new MessageService();
  }

  /**
   * 获取用户消息列表
   */
  async getMessages(req, res) {
    const logger = new Logger('MessageController.getMessages');
    
    try {
      const { uuid, page = 1, pageSize = 20, is_read } = req.body;

      if (!uuid) {
        return res.status(400).json({
          status: 'error',
          message: '缺少用户UUID'
        });
      }

      const result = await this.messageService.getUserMessages({
        uuid,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        is_read: is_read !== undefined ? (is_read === 'true' || is_read === true) : null
      });

      if (result.success) {
        return res.json({
          status: 'success',
          data: result.data
        });
      } else {
        return res.status(500).json({
          status: 'error',
          message: result.error
        });
      }

    } catch (error) {
      logger.error('获取消息列表失败:', error);
      return res.status(500).json({
        status: 'error',
        message: '服务器内部错误'
      });
    }
  }

  /**
   * 标记消息为已读
   */
  async markAsRead(req, res) {
    const logger = new Logger('MessageController.markAsRead');
    
    try {
      const { message_id, uuid } = req.body;

      if (!message_id || !uuid) {
        return res.status(400).json({
          status: 'error',
          message: '缺少必要参数'
        });
      }

      const result = await this.messageService.markAsRead({ message_id, uuid });

      if (result.success) {
        return res.json({
          status: 'success',
          data: result.data
        });
      } else {
        return res.status(500).json({
          status: 'error',
          message: result.error
        });
      }

    } catch (error) {
      logger.error('标记消息已读失败:', error);
      return res.status(500).json({
        status: 'error',
        message: '服务器内部错误'
      });
    }
  }

  /**
   * 标记所有消息为已读
   */
  async markAllAsRead(req, res) {
    const logger = new Logger('MessageController.markAllAsRead');
    
    try {
      const { uuid } = req.body;

      if (!uuid) {
        return res.status(400).json({
          status: 'error',
          message: '缺少用户UUID'
        });
      }

      const result = await this.messageService.markAllAsRead({ uuid });

      if (result.success) {
        return res.json({
          status: 'success',
          data: result.data
        });
      } else {
        return res.status(500).json({
          status: 'error',
          message: result.error
        });
      }

    } catch (error) {
      logger.error('标记所有消息已读失败:', error);
      return res.status(500).json({
        status: 'error',
        message: '服务器内部错误'
      });
    }
  }

  /**
   * 删除消息
   */
  async deleteMessage(req, res) {
    const logger = new Logger('MessageController.deleteMessage');
    
    try {
      const { message_id, uuid } = req.body;

      if (!message_id || !uuid) {
        return res.status(400).json({
          status: 'error',
          message: '缺少必要参数'
        });
      }

      const result = await this.messageService.deleteMessage({ message_id, uuid });

      if (result.success) {
        return res.json({
          status: 'success',
          data: result.data
        });
      } else {
        return res.status(500).json({
          status: 'error',
          message: result.error
        });
      }

    } catch (error) {
      logger.error('删除消息失败:', error);
      return res.status(500).json({
        status: 'error',
        message: '服务器内部错误'
      });
    }
  }

  /**
   * 获取未读消息数量
   */
  async getUnreadCount(req, res) {
    const logger = new Logger('MessageController.getUnreadCount');
    
    try {
      const { uuid } = req.query || req.body;

      if (!uuid) {
        return res.status(400).json({
          status: 'error',
          message: '缺少用户UUID'
        });
      }

      const result = await this.messageService.getUnreadCount({ uuid });

      if (result.success) {
        return res.json({
          status: 'success',
          data: result.data
        });
      } else {
        return res.status(500).json({
          status: 'error',
          message: result.error
        });
      }

    } catch (error) {
      logger.error('获取未读消息数量失败:', error);
      return res.status(500).json({
        status: 'error',
        message: '服务器内部错误'
      });
    }
  }
}

module.exports = MessageController;
