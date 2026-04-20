const express = require('express');
const router = express.Router();
const NoticeController = require('../controllers/NoticeController');

const controller = new NoticeController();

// 获取通知列表
router.get('/', (req, res) => {
  controller.getNotices(req, res);
});

// 创建通知
router.post('/', (req, res) => {
  controller.createNotice(req, res);
});

module.exports = router;