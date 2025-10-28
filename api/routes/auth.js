const express = require('express');
const AuthController = require('../controllers/AuthController');

const router = express.Router();
const authController = new AuthController();

// 登录接口
router.post('/login', (req, res) => {
  authController.login(req, res);
});

module.exports = router;