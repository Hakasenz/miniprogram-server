const express = require('express');
const AuthController = require('../controllers/AuthController');

const router = express.Router();
const authController = new AuthController();

// 登录接口
router.post('/login', (req, res) => {
  authController.login(req, res);
});

// ⭐ 获取用户详细信息接口（包含权限信息）
router.get('/user-info', (req, res) => {
  authController.getUserInfo(req, res);
});

// ⭐ 更新用户权限接口（临时权限设置）
router.post('/update-permissions', (req, res) => {
  authController.updatePermissions(req, res);
});

// ⭐ 获取同组织成员列表（人事管理用）
router.post('/org-members', (req, res) => {
  authController.getOrganizationMembers(req, res);
});

// ⭐ 更新成员信息（rank和position）
router.post('/update-member-info', (req, res) => {
  authController.updateMemberInfo(req, res);
});

module.exports = router;
