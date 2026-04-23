const express = require('express');
const CompanyController = require('../controllers/CompanyController');

const router = express.Router();
const companyController = new CompanyController();

// ⭐ 获取用户所属的组织信息
router.post('/info', (req, res) => {
  companyController.getUserCompany(req, res);
});

// ⭐ 创建新组织
router.post('/create', (req, res) => {
  companyController.createCompany(req, res);
});

// ⭐ 通过邀请码加入组织
router.post('/join', (req, res) => {
  companyController.joinCompany(req, res);
});

// ⭐ 申请加入组织
router.post('/apply', (req, res) => {
  companyController.applyJoinCompany(req, res);
});

// ⭐ 获取所有组织列表
router.get('/list', (req, res) => {
  companyController.getAllCompanies(req, res);
});

// ⭐ 生成组织邀请码
router.post('/generate-invite', (req, res) => {
  companyController.generateInviteCode(req, res);
});

// ⭐ 退出组织
router.post('/leave', (req, res) => {
  companyController.leaveCompany(req, res);
});

// ⭐ 审批加入申请（人事审批用）
router.post('/review', (req, res) => {
  companyController.reviewApplication(req, res);
});

// ⭐ 获取待审批的申请列表（人事审批用）
router.post('/pending-applications', (req, res) => {
  companyController.getPendingApplications(req, res);
});

module.exports = router;
