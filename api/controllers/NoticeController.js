const NoticeService = require('../services/NoticeService');

class NoticeController {
  constructor() {
    this.service = new NoticeService();
  }

  // 获取通知列表
  async getNotices(req, res) {
    try {
      const { uuid, page = 1, limit = 10 } = req.query;
      
      if (!uuid) {
        return res.status(400).json({
          success: false,
          error: '缺少用户UUID参数'
        });
      }
      
      console.log('📊 获取通知列表:', uuid);
      
      const data = await this.service.getNotices(uuid, parseInt(page), parseInt(limit));
      
      res.json({
        success: true,
        data
      });
      
    } catch (error) {
      console.error('❌ 获取通知列表失败:', error);
      res.status(500).json({
        success: false,
        error: error.message || '服务器内部错误'
      });
    }
  }

  // 创建通知
  async createNotice(req, res) {
    try {
      const { title, content, type, targetRoles, uuid } = req.body;
      
      // 从请求体中获取用户UUID（与getNotices保持一致）
      const authorUuid = uuid;
      
      if (!authorUuid) {
        return res.status(401).json({
          success: false,
          error: '缺少用户UUID参数'
        });
      }
      
      if (!title || !content) {
        return res.status(400).json({
          success: false,
          error: '标题和内容不能为空'
        });
      }
      
      console.log('📝 创建通知:', title, '| 作者UUID:', authorUuid);
      
      const notice = await this.service.createNotice({
        title,
        content,
        type: type || 'general',
        authorUuid,
        targetRoles: targetRoles || []
      });
      
      res.json({
        success: true,
        data: notice
      });
      
    } catch (error) {
      console.error('❌ 创建通知失败:', error);
      res.status(500).json({
        success: false,
        error: error.message || '服务器内部错误'
      });
    }
  }
}

module.exports = NoticeController;