# 邀请码自动生成功能 - 完整测试指南

## 📋 功能说明

### **核心需求**
✅ **创建项目时自动生成邀请码** - 无需手动点击生成按钮  
✅ **所有用户可见** - 进入项目详情页即可查看邀请码  
✅ **6 位唯一编码** - 大写字母 + 数字组合（排除易混淆字符）

---

## 🔧 后端修改内容

### **1. ProjectService.js - saveProject 方法**

#### **修改位置**: 第 278-300 行

**修改前**:
```javascript
const projectDocument = {
  project_id: projectId,
  name: projectData.name.trim(),
  people: projectData.people,
  group: projectData.group.trim(),
  user_uuid: projectData.uuid,
  members: members,
  leader: leader,
  submit_time: new Date(projectData.submitTime),
  created_at: new Date(),
  status: 'submitted'
};
```

**修改后**:
```javascript
// ⭐ 自动为项目生成唯一邀请码
const inviteCode = await this.generateUniqueInviteCode();
this.logger.info(`为项目生成邀请码：${inviteCode}`);

const projectDocument = {
  project_id: projectId,
  invite_code: inviteCode,              // ⭐ 自动添加邀请码字段
  name: projectData.name.trim(),
  people: projectData.people,
  group: projectData.group.trim(),
  user_uuid: projectData.uuid,
  members: members,
  leader: leader,
  submit_time: new Date(projectData.submitTime),
  created_at: new Date(),
  status: 'submitted'
};
```

#### **模拟模式处理**: 第 305-315 行

**修改前**:
```javascript
if (!this.db) {
  this.logger.warn('数据库未连接，返回模拟成功响应');
  const mockResult = {
    project_id: projectId,
    ...projectDocument,
    _id: 'mock_project_id'
  };
  return { success: true, data: mockResult };
}
```

**修改后**:
```javascript
if (!this.db) {
  this.logger.warn('数据库未连接，返回模拟成功响应');
  
  // ⭐ 模拟模式下也生成邀请码
  const mockInviteCode = this.generateInviteCode();
  const mockResult = {
    project_id: projectId,
    invite_code: mockInviteCode,        // ⭐ 模拟模式也包含邀请码
    ...projectDocument,
    _id: 'mock_project_id'
  };
  return { success: true, data: mockResult };
}
```

---

## 🎨 前端修改内容

### **1. project-detail.js**

#### **删除权限判断逻辑**: 第 10-30 行

**修改前**:
```javascript
onLoad(options) {
  const id = options.id;
  this.setData({ projectId: id });

  // 获取用户信息
  const app = getApp();
  const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
  const userUuid = userInfo.uuid || '';

  // 从缓存加载项目数据
  const allProjects = app.globalData.projectsData || wx.getStorageSync('projectsData') || [];
  const project = allProjects.find(p => String(p.id) === String(id));

  if (project) {
    const isLeader = project.leader === userUuid || project.user_uuid === userUuid;
    
    this.setData({ 
      projectData: project,
      inviteCode: project.invite_code || null,
      isLeader: isLeader,                // ❌ 多余的权限判断
      showInviteCode: !!project.invite_code
    });
  }
}
```

**修改后**:
```javascript
onLoad(options) {
  const id = options.id;
  this.setData({ projectId: id });

  // 从缓存加载项目数据
  const allProjects = app.globalData.projectsData || wx.getStorageSync('projectsData') || [];
  const project = allProjects.find(p => String(p.id) === String(id));

  if (project) {
    this.setData({ 
      projectData: project,
      inviteCode: project.invite_code || null,
      showInviteCode: !!project.invite_code  // ✅ 直接显示，无需判断身份
    });
  } else {
    wx.showToast({ title: '项目未找到', icon: 'none' });
  }
}
```

### **2. project-detail.wxml**

#### **移除权限条件**: 第 23 行

**修改前**:
```html
<!-- 邀请码功能区域 - 仅项目负责人可见 -->
<view class="invite-section" wx:if="{{isLeader}}">
  <!-- 邀请码卡片 -->
</view>

<!-- 非负责人提示 -->
<view class="non-leader-tip" wx:else>
  <text>只有项目负责人可以生成邀请码</text>
</view>
```

**修改后**:
```html
<!-- 邀请码功能区域 - 所有用户可见 ⭐ -->
<view class="invite-section">
  <!-- 邀请码卡片 -->
</view>
```

---

## 🧪 完整测试流程

### **测试场景 1: 创建新项目（自动获得邀请码）**

#### **步骤**:
1. 打开小程序，进入"创建项目"页面
2. 填写项目信息：
   - 项目名称：`测试项目 A`
   - 项目人数：`10`
   - 项目组别：`开发一组`
3. 点击"提交"按钮

#### **预期结果**:
```
✅ 显示"创建成功"提示
✅ 自动跳转到项目详情页
✅ 页面立即显示 6 位邀请码（如：A7K9M2）
✅ 可以看到"复制"和"分享"按钮
```

#### **验证方法**:
```javascript
// 在微信开发者工具 Console 中执行
const projects = wx.getStorageSync('projectsData');
console.log('最新项目:', projects[0]);
// 应该看到 invite_code 字段
```

---

### **测试场景 2: 查看已有项目（无邀请码的处理）**

#### **步骤**:
1. 进入在项目详情页（该项目是之前创建的，没有邀请码）
2. 观察页面显示

#### **预期结果**:
```
✅ 显示"暂无邀请码"占位符
✅ 显示"✨ 生成邀请码"按钮
✅ 任何用户都可以看到该区域（无权限提示）
```

#### **点击生成按钮后**:
```
✅ 弹出确认对话框
✅ 确认后显示 Loading 提示
✅ 生成成功后显示 6 位邀请码
✅ 自动更新本地缓存
```

---

### **测试场景 3: 不同用户查看同一项目**

#### **步骤**:
1. 用户 A（项目负责人）进入项目详情页
2. 用户 B（普通成员）进入同一项目详情页
3. 用户 C（新加入）进入同一项目详情页

#### **预期结果**:
```
✅ 用户 A：可以看到邀请码区域
✅ 用户 B：可以看到邀请码区域（与 A 相同）
✅ 用户 C：可以看到邀请码区域（与 A 相同）
❌ 不会显示"只有负责人可见"的提示
```

---

### **测试场景 4: 后端数据库验证**

#### **步骤**:
```bash
# 1. 使用测试脚本验证 MongoDB 数据
cd miniprogram-server
node test-mongodb.js

# 2. 查找最新创建的项目
db.projects.find().sort({ created_at: -1 }).limit(1)
```

#### **预期输出**:
```json
{
  "_id": ObjectId("67bc1234567890abcdef1234"),
  "project_id": "proj-1761656048273-dwn2mg",
  "invite_code": "A7K9M2",              // ⭐ 必须存在此字段
  "name": "测试项目 A",
  "people": 10,
  "group": "开发一组",
  "user_uuid": "u-001",
  "members": ["u-001"],
  "leader": "u-001",
  "submit_time": ISODate("2026-04-01T13:46:37.275Z"),
  "created_at": ISODate("2026-04-01T21:54:18.000Z")
}
```

---

## 🔍 调试技巧

### **1. 检查后端日志**

启动后端服务时查看详细日志：
```bash
cd miniprogram-server
node api/index.js
```

**关键日志信息**:
```
[INFO] 为项目生成邀请码：A7K9M2
[INFO] 生成唯一邀请码：A7K9M2
[DATABASE] INSERT db.projects.insertOne()
[SUCCESS] 项目保存成功
```

如果看到以下日志，说明是模拟模式：
```
[WARN] 数据库未连接，返回模拟成功响应
[INFO] 生成邀请码：X3B8N5
```

---

### **2. 前端控制台调试**

在微信开发者工具的 Console 中执行：

#### **检查缓存数据**:
```javascript
// 查看所有项目
const projects = wx.getStorageSync('projectsData');
console.table(projects.map(p => ({
  名称：p.name,
  邀请码：p.invite_code || '无',
  ID: p.project_id || p.id
})));
```

#### **手动刷新项目数据**:
```javascript
// 清除缓存并重新加载
wx.removeStorageSync('projectsData');
wx.navigateBack(); // 返回上一页再重新进入
```

---

### **3. 网络请求监控**

打开微信开发者工具的 **Network** 标签：

#### **创建项目请求**:
```
POST /api/project/submit
Request:
{
  "name": "测试项目 A",
  "people": 10,
  "group": "开发一组",
  "uuid": "u-001",
  "submitTime": "2026-04-01T13:46:37.275Z"
}

Response:
{
  "status": "success",
  "data": {
    "project_id": "proj-1761656048273-dwn2mg",
    "invite_code": "A7K9M2",    // ⭐ 检查是否返回
    "saved_project": { ... }
  }
}
```

---

## ⚠️ 常见问题排查

### **问题 1: 创建项目后没有显示邀请码**

**可能原因**:
1. 后端未自动生成（代码未更新）
2. 前端缓存未刷新
3. 数据库写入失败

**解决方法**:
```javascript
// 1. 检查后端日志是否有错误
// 2. 手动刷新缓存
const app = getApp();
const projects = wx.getStorageSync('projectsData');
console.log('第一个项目的邀请码:', projects[0]?.invite_code);

// 3. 如果为 undefined，重新进入项目详情页
```

---

### **问题 2: 仍然显示"暂无邀请码"**

**可能原因**:
- 该项目是旧数据，创建时还未实现自动生成功能

**解决方法**:
```
方案 1: 点击"生成邀请码"按钮手动生成
方案 2: 删除旧项目，重新创建新项目
```

---

### **问题 3: 邀请码重复或格式错误**

**可能原因**:
- `generateUniqueInviteCode()` 方法未正确实现

**解决方法**:
```javascript
// 检查 Service 中的方法
console.log(ProjectService.generateInviteCode()); 
// 应该输出类似 "A7K9M2" 的 6 位字符串
```

---

## 📊 验收标准清单

### **功能性验收**
- [ ] ✅ 创建新项目时自动显示 6 位邀请码
- [ ] ✅ 邀请码由大写字母和数字组成
- [ ] ✅ 所有用户进入详情页都能看到邀请码
- [ ] ✅ 可以点击"复制"按钮复制邀请码
- [ ] ✅ 可以点击"分享"按钮分享给好友
- [ ] ✅ 旧项目如果没有邀请码，可以手动生成

### **数据一致性验收**
- [ ] ✅ MongoDB 数据库中正确保存 `invite_code` 字段
- [ ] ✅ 前端缓存与数据库保持一致
- [ ] ✅ 刷新页面后邀请码依然存在
- [ ] ✅ 不同用户看到的是同一个邀请码

### **用户体验验收**
- [ ] ✅ 创建过程中无需额外操作即可自动获得邀请码
- [ ] ✅ 邀请码显示清晰，字体大小适中
- [ ] ✅ 复制成功有明确提示
- [ ] ✅ 无任何权限相关的错误提示

---

## 🎯 完整数据流转验证

```
1. 前端提交创建表单
   ↓
2. POST /api/project/submit
   ↓
3. ProjectService.saveProject()
   ↓
4. 调用 generateUniqueInviteCode()
   │  ├─ 生成 6 位随机码
   │  └─ 查询数据库确保唯一性
   ↓
5. 构建项目文档
   └─ 包含 invite_code 字段
   ↓
6. 写入 MongoDB
   └─ db.projects.insertOne({...invite_code: "A7K9M2"...})
   ↓
7. 返回成功响应
   └─ data: { project_id, invite_code, saved_project }
   ↓
8. 前端接收并更新缓存
   └─ projectsData.unshift(newProject)
   ↓
9. 跳转到项目详情页
   └─ 读取 project.invite_code 并显示
   ↓
10. ✅ 用户看到粉色邀请码卡片
```

---

## 🚀 性能优化建议

### **1. 批量创建场景**
如果需要一次性创建多个项目：
```javascript
// 建议在 Service 层批量生成邀请码
async function createMultipleProjects(projectsData) {
  const results = [];
  for (const data of projectsData) {
    const inviteCode = await this.generateUniqueInviteCode();
    // ... 创建逻辑
  }
  return results;
}
```

### **2. 缓存优化**
```javascript
// 在前端 onLoad 时优先从缓存读取
onLoad() {
  const cached = wx.getStorageSync('projectsData');
  if (cached && cached.length > 0) {
    // 直接使用缓存，避免重复请求
    this.setData({ projects: cached });
  }
}
```

---

## 📞 技术支持

如遇问题，请提供以下信息：
1. 完整的错误日志（前后端）
2. Network 面板中的请求和响应
3. MongoDB 中的数据截图
4. 微信开发者工具 Console 输出

祝测试顺利！🎉
