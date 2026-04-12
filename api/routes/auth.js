const express = require('express');
const AuthController = require('../controllers/AuthController');

const router = express.Router();
const authController = new AuthController();

// 登录接口
router.post('/login', (req, res) => {
  authController.login(req, res);
});

// ⭐ 临时接口：更新用户权限（仅用于测试）
router.post('/update-permissions', (req, res) => {
  authController.updatePermissions(req, res);
});

module.exports = router;
