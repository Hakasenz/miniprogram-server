const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/ReportController');

const controller = new ReportController();

// 获取团队报表
router.get('/team', controller.getTeamReport);

// 获取项目报表
router.get('/projects', controller.getProjectReport);

module.exports = router;
