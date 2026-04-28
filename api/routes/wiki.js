const express = require('express');
const WikiController = require('../controllers/WikiController');

const router = express.Router();
const wikiController = new WikiController();

// ⭐ 获取Wiki列表
router.post('/list', (req, res) => {
  wikiController.getWikiList(req, res);
});

// ⭐ 上传附件
router.post('/upload-attachment', (req, res) => {
  wikiController.uploadAttachment(req, res);
});

// ⭐ 创建Wiki
router.post('/create', (req, res) => {
  wikiController.createWiki(req, res);
});

module.exports = router;
