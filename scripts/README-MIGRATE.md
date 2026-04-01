# 邀请码功能数据库迁移指南

## 📋 概述

本文档说明如何为现有项目数据库添加邀请码字段。由于 MongoDB 是文档型数据库，**无需预先修改表结构**，可以通过以下两种方式处理：

---

## 🎯 方案对比

### **方案一：按需自动创建（推荐）⭐**

**适用场景**: 
- 新项目或可以接受部分项目暂时没有邀请码
- 希望最小化数据库操作
- 用户逐步使用功能时自动完善数据

**优点**:
- ✅ 无需执行额外脚本
- ✅ 零运维成本
- ✅ 逐步生成，分散数据库压力
- ✅ 符合 MongoDB 动态模式特性

**操作流程**:
```
用户点击"生成邀请码"按钮
    ↓
后端调用 generateOrUpdateInviteCode()
    ↓
MongoDB 自动在对应文档中添加 invite_code 字段
    ↓
返回成功响应
```

**示例代码**:
```javascript
// 后端 Service 层代码已实现自动添加
const updateResult = await this.db.collection('projects').updateOne(
  { project_id: projectId },
  { $set: { invite_code: inviteCode } }  // 自动创建字段
);
```

---

### **方案二：批量迁移（可选）**

**适用场景**:
- 需要为所有已有项目统一生成邀请码
- 运营活动要求所有项目必须有邀请码
- 数据完整性要求高

**执行步骤**:

#### **Step 1: 配置环境变量**
确保 `.env` 文件中已配置：
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/miniprogram
DATABASE_NAME=miniprogram
```

#### **Step 2: 安装依赖**
```bash
cd miniprogram-server
npm install mongodb dotenv
```

#### **Step 3: 执行迁移脚本**
```bash
node scripts/migrate-add-invite-codes.js
```

#### **预期输出**:
```
🚀 开始执行邀请码迁移脚本...
📡 正在连接到 MongoDB Atlas...
✅ MongoDB 连接成功
🔍 查找需要更新的项目...
📊 找到 15 个项目需要添加邀请码
⚙️ 开始批量生成并更新邀请码...
  ✅ [1/15] 某显目 -> A7K9M2
  ✅ [2/15] 测试项目 -> X3B8N5
  ✅ [3/15] 项目组 A -> Q9W2E4
  ...
==================================================
📊 迁移完成统计:
  ✅ 成功：15 个项目
  ❌ 失败：0 个项目
  📈 成功率：100.00%
==================================================
🎉 迁移任务全部完成！
👋 MongoDB 连接已关闭
```

---

## 🔍 验证方法

### **方法一：使用 MongoDB Compass 查看**

1. 打开 MongoDB Compass
2. 连接到你的集群
3. 进入 `miniprogram` 数据库
4. 选择 `projects` 集合
5. 查看文档，确认包含 `invite_code` 字段

### **方法二：使用测试脚本验证**

运行现有的测试脚本：
```bash
cd miniprogram-server
node test-mongodb.js
```

**预期输出应包含**:
```json
{
  "_id": "67bc1234567890abcdef1234",
  "project_id": "proj-1761656048273-dwn2mg",
  "invite_code": "A7K9M2",  // ⭐ 确认此字段存在
  "name": "某显目",
  "people": 1233,
  ...
}
```

### **方法三：通过 API 查询**

使用 Postman 或小程序前端调用邀请码查询接口：
```javascript
POST https://miniprogram-server.vercel.app/api/project/invite
Content-Type: application/json

{
  "inviteCode": "A7K9M2"
}
```

---

## ⚠️ 注意事项

### **1. MongoDB 动态模式特性**
- ✅ **无需预定义**: MongoDB 不需要像 MySQL 那样先执行 `ALTER TABLE`
- ✅ **自动扩展**: 新字段会在第一次写入时自动创建
- ✅ **向后兼容**: 旧文档没有新字段不会影响查询性能

### **2. 混合状态处理**
在迁移过程中，数据库可能存在两种状态：

**有邀请码的项目**:
```json
{
  "project_id": "proj-xxx",
  "invite_code": "A7K9M2",  // ✅ 已生成
  "name": "某显目"
}
```

**无邀请码的项目**:
```json
{
  "project_id": "proj-yyy",
  "name": "测试项目"
  // ⚠️ invite_code 字段不存在（正常）
}
```

**前端处理建议**:
```javascript
// 在项目详情页判断
if (project.invite_code) {
  // 显示邀请码和复制按钮
} else if (isLeader) {
  // 显示"生成邀请码"按钮
} else {
  // 显示提示信息
}
```

### **3. 唯一性保证**
迁移脚本已内置唯一性检查机制：
- 使用 `Set` 数据结构记录已生成的邀请码
- 每个邀请码最多重试 10 次确保唯一
- 冲突概率极低（34^6 ≈ 15 亿种组合）

### **4. 性能考虑**
- **小数据量** (< 1000 条): 直接运行迁移脚本，约 1-2 分钟完成
- **中等数据量** (1000-10000 条): 建议分批执行或使用按需方案
- **大数据量** (> 10000 条): 强烈推荐使用按需方案，避免长时间占用数据库连接

---

## 🎯 推荐方案决策树

```
是否需要立即为所有项目生成邀请码？
├─ 否 → 使用方案一（按需自动创建）✅ 推荐
│   └─ 优势：零运维、自动化、符合 NoSQL 理念
│
└─ 是 → 使用方案二（批量迁移）
    ├─ 数据量 < 1000 → 直接运行脚本
    ├─ 数据量 1000-10000 → 夜间低峰期执行
    └─ 数据量 > 10000 → 考虑分页分批处理
```

---

## 📞 常见问题

### **Q1: 执行迁移脚本后，新创建的项目会有邀请码吗？**
**答**: 会自动生成。项目创建接口 (`POST /api/project/submit`) 已集成邀请码自动生成逻辑。

### **Q2: 如果迁移脚本执行一半中断了怎么办？**
**答**: 可以重新执行脚本。脚本会查询 `invite_code: { $exists: false }` 的文档，已经更新的不会重复处理。

### **Q3: 旧项目没有邀请码会影响功能吗？**
**答**: 不会。前端已做兼容性处理：
- 有邀请码：显示并支持复制分享
- 无邀请码：显示"生成"按钮（仅负责人可见）
- 非负责人：显示权限提示

### **Q4: 能否手动指定邀请码？**
**答**: 当前版本不支持。如需自定义，可在 Service 层的 `generateOrUpdateInviteCode()` 方法中增加参数支持。

### **Q5: 邀请码可以重复使用吗？**
**答**: 可以。同一个项目的邀请码可以被多人多次使用。如果需要限制次数，可扩展数据库字段 `invite_max_uses` 和 `invite_used_count`。

---

## 🚀 快速开始

### **懒人选法（推荐）**:
什么都不用做！当用户第一次点击"生成邀请码"按钮时，系统会自动处理。

### **完美主义者选法**:
```bash
cd miniprogram-server
node scripts/migrate-add-invite-codes.js
```

---

## 📚 相关文档

- [邀请码设计与实现规范](./README.md#邀请码设计规范)
- [ProjectService API 文档](./api/services/ProjectService.js)
- [MongoDB 配置指南](./README.md#数据库配置)
