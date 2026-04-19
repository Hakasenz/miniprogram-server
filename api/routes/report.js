const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/ReportController');

// 创建控制器实例
const controller = new ReportController();

// 获取团队报表
router.get('/team', controller.getTeamReport.bind(controller));

// 获取项目报表
router.get('/projects', controller.getProjectReport.bind(controller));

module.exports = router;
