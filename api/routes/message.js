const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/MessageController');

const messageController = new MessageController();

// 获取用户消息列表
router.post('/list', (req, res) => {
  messageController.getMessages(req, res);
});

// 标记消息为已读
router.post('/mark-read', (req, res) => {
  messageController.markAsRead(req, res);
});

// 标记所有消息为已读
router.post('/mark-all-read', (req, res) => {
  messageController.markAllAsRead(req, res);
});

// 删除消息
router.post('/delete', (req, res) => {
  messageController.deleteMessage(req, res);
});

// 获取未读消息数量
router.get('/unread-count', (req, res) => {
  messageController.getUnreadCount(req, res);
});

// ⭐ 发送团队聊天消息
router.post('/team-chat/send', (req, res) => {
  messageController.sendTeamChatMessage(req, res);
});

// ⭐ 获取团队聊天消息列表
router.get('/team-chat/list', (req, res) => {
  messageController.getTeamChatMessages(req, res);
});

// ⭐ 删除团队聊天消息
router.post('/team-chat/delete', (req, res) => {
  messageController.deleteTeamChatMessage(req, res);
});

module.exports = router;
