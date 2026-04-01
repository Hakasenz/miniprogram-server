const express = require('express');
const TeamController = require('../controllers/TeamController');

const router = express.Router();
const teamController = new TeamController();

// 团队创建接口
router.post('/create', (req, res) => {
  teamController.createTeam(req, res);
});

module.exports = router;