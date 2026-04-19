const ReportService = require('../services/ReportService');

class ReportController {
  constructor() {
    this.service = new ReportService();
  }

  // 获取团队报表
  async getTeamReport(req, res) {
    try {
      const { uuid } = req.query;
      
      if (!uuid) {
        return res.status(400).json({
          success: false,
          error: '缺少用户UUID参数'
        });
      }
      
      console.log('📊 获取团队报表:', uuid);
      
      const data = await this.service.getTeamReport(uuid);
      
      res.json({
        success: true,
        data
      });
      
    } catch (error) {
      console.error('❌ 获取团队报表失败:', error);
      res.status(500).json({
        success: false,
        error: error.message || '服务器内部错误'
      });
    }
  }

  // 获取项目报表
  async getProjectReport(req, res) {
    try {
      const { uuid } = req.query;
      
      if (!uuid) {
        return res.status(400).json({
          success: false,
          error: '缺少用户UUID参数'
        });
      }
      
      console.log('📊 获取项目报表:', uuid);
      
      const data = await this.service.getProjectReport(uuid);
      
      res.json({
        success: true,
        data
      });
      
    } catch (error) {
      console.error('❌ 获取项目报表失败:', error);
      res.status(500).json({
        success: false,
        error: error.message || '服务器内部错误'
      });
    }
  }
}

module.exports = ReportController;
