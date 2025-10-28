const express = require('express');
const ProjectController = require('../controllers/ProjectController');

const router = express.Router();
const projectController = new ProjectController();

// 项目查询接口 - 新格式（使用 leader 字段）
router.post('/', (req, res) => {
  projectController.queryProjects(req, res);
});

// 项目查询接口 - UUID格式（使用 uuid 字段）
router.post('/leader', (req, res) => {
  projectController.queryProjectsByLeader(req, res);
});

// 项目提交接口
router.post('/submit', (req, res) => {
  projectController.submitProject(req, res);
});

// 项目删除接口
router.post('/delete', (req, res) => {
  projectController.deleteProject(req, res);
});

module.exports = router;