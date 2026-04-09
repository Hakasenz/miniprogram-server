# 流程进度图功能实现文档

## 📋 功能概述

为项目详情页添加**流程进度图**功能，用于跟踪和展示项目成员提交的审批流程。支持多步骤流程管理，包括提交、审核、批准等操作。

---

## 🎯 功能特性

### **1. 流程节点管理**
- ✅ **提交流程**：任何项目成员都可以提交新的流程节点
- ✅ **状态跟踪**：每个节点有明确的状态（待处理、进行中、已通过、已拒绝）
- ✅ **时间记录**：自动记录提交时间和更新时间
- ✅ **操作历史**：完整保留所有流程节点的历史记录

### **2. 可视化时间线**
- 📊 **垂直时间线**：清晰展示流程的先后顺序
- 🎨 **状态颜色**：不同状态使用不同的颜色标识
- 👤 **提交者信息**：显示每个节点的提交者
- ⏰ **时间戳**：显示提交的具体时间

### **3. 交互操作**
- ➕ **提交流程**：点击按钮输入操作描述
- ✓ **通过节点**：对待处理的节点进行审核通过
- ✗ **拒绝节点**：对待处理的节点进行拒绝
- 🔄 **实时更新**：操作后立即刷新显示

---

## 🔧 技术实现

### **后端实现**

#### **1. 数据模型扩展**

在 `projects` 集合中添加 `workflow` 字段：

```javascript
{
  project_id: "proj-xxx",
  name: "测试项目",
  workflow: [  // ⭐ 新增字段
    {
      step_id: "step-1234567890-abc12",
      action: "提交申请",
      submitter: "u-001",
      status: "approved",  // pending | processing | approved | rejected
      submit_time: "2026-04-09T12:00:00.000Z",
      update_time: "2026-04-09T13:00:00.000Z"
    },
    {
      step_id: "step-1234567891-def34",
      action: "审核材料",
      submitter: "u-002",
      status: "pending",
      submit_time: "2026-04-09T14:00:00.000Z",
      update_time: null
    }
  ]
}
```

---

#### **2. API 接口**

##### **添加流程节点**
```
POST /api/project/workflow/add
```

**请求体**：
```json
{
  "project_id": "proj-xxx",
  "action": "提交申请",
  "submitter": "u-001",
  "status": "pending"
}
```

**响应**：
```json
{
  "status": "success",
  "message": "流程节点添加成功",
  "data": {
    "step_id": "step-1234567890-abc12",
    "action": "提交申请",
    "submitter": "u-001",
    "status": "pending",
    "submit_time": "2026-04-09T12:00:00.000Z",
    "update_time": null
  }
}
```

---

##### **更新流程节点状态**
```
POST /api/project/workflow/update
```

**请求体**：
```json
{
  "project_id": "proj-xxx",
  "step_id": "step-1234567890-abc12",
  "status": "approved"
}
```

**响应**：
```json
{
  "status": "success",
  "message": "流程节点状态更新成功",
  "data": {
    "step_id": "step-1234567890-abc12",
    "status": "approved",
    "update_time": "2026-04-09T13:00:00.000Z"
  }
}
```

---

#### **3. 服务层方法**

##### **addWorkflowStep**
```javascript
async addWorkflowStep({ project_id, action, submitter, status = 'pending' }) {
  // 1. 初始化数据库连接
  await this.initDatabase();

  // 2. 创建新的流程节点
  const newStep = {
    step_id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    action,
    submitter,
    status,
    submit_time: new Date().toISOString(),
    update_time: null
  };

  // 3. 使用 $push 添加到 workflow 数组
  await this.db.collection('projects').updateOne(
    { project_id: project_id },
    { 
      $push: { workflow: newStep },
      $set: { updated_at: new Date().toISOString() }
    }
  );

  return { success: true, data: newStep };
}
```

##### **updateWorkflowStep**
```javascript
async updateWorkflowStep({ project_id, step_id, status }) {
  // 1. 初始化数据库连接
  await this.initDatabase();

  // 2. 使用位置运算符 $ 更新指定节点
  await this.db.collection('projects').updateOne(
    { 
      project_id: project_id,
      'workflow.step_id': step_id
    },
    { 
      $set: { 
        'workflow.$.status': status,
        'workflow.$.update_time': new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
  );

  return { success: true, data: { step_id, status, update_time: ... } };
}
```

---

### **前端实现**

#### **1. 数据结构**

```javascript
Page({
  data: {
    projectId: '',
    projectData: {},
    workflow: [],  // ⭐ 流程进度数据
    currentUser: null  // ⭐ 当前用户信息
  }
});
```

---

#### **2. 核心方法**

##### **showSubmitWorkflow** - 显示提交流程对话框
```javascript
showSubmitWorkflow() {
  wx.showModal({
    title: '提交流程节点',
    editable: true,
    placeholderText: '请输入操作描述（如：提交申请、审核材料等）',
    success: (res) => {
      if (res.confirm && res.content) {
        this.submitWorkflowStep(res.content.trim());
      }
    }
  });
}
```

##### **submitWorkflowStep** - 提交流程节点
```javascript
submitWorkflowStep(action) {
  wx.request({
    url: `${BASE_URL}/api/project/workflow/add`,
    method: 'POST',
    data: {
      project_id: this.data.projectId,
      action: action,
      submitter: this.data.currentUser.uuid,
      status: 'pending'
    },
    success: (res) => {
      if (res.data?.status === 'success') {
        this.refreshWorkflow();  // 刷新流程数据
      }
    }
  });
}
```

##### **approveWorkflowStep / rejectWorkflowStep** - 审核操作
```javascript
approveWorkflowStep(e) {
  const stepId = e.currentTarget.dataset.stepId;
  this.updateWorkflowStatus(stepId, 'approved');
}

rejectWorkflowStep(e) {
  const stepId = e.currentTarget.dataset.stepId;
  this.updateWorkflowStatus(stepId, 'rejected');
}
```

---

#### **3. UI 组件**

##### **时间线布局**
```xml
<view class="workflow-timeline">
  <block wx:for="{{workflow}}" wx:key="step_id">
    <view class="workflow-item {{item.status}}">
      <!-- 时间线节点 -->
      <view class="timeline-node">
        <view class="node-dot"></view>
        <view class="node-line" wx:if="{{index < workflow.length - 1}}"></view>
      </view>

      <!-- 流程内容 -->
      <view class="workflow-content">
        <view class="workflow-header">
          <text class="workflow-action">{{item.action}}</text>
          <view class="status-badge {{item.status}}">
            <text>{{状态文本}}</text>
          </view>
        </view>
        
        <view class="workflow-meta">
          <text class="submitter">提交者: {{item.submitter}}</text>
          <text class="time">{{item.submit_time}}</text>
        </view>

        <!-- 操作按钮（仅待处理节点） -->
        <view class="workflow-actions" wx:if="{{item.status === 'pending'}}">
          <button class="approve-btn" bindtap="approveWorkflowStep">通过</button>
          <button class="reject-btn" bindtap="rejectWorkflowStep">拒绝</button>
        </view>
      </view>
    </view>
  </block>
</view>
```

---

## 📊 使用场景示例

### **场景 1: 项目申请流程**
```
1. 成员A 提交 "提交项目申请" → 状态: pending
2. 负责人B 点击"通过" → 状态: approved
3. 成员C 提交 "准备相关材料" → 状态: pending
4. 负责人B 点击"通过" → 状态: approved
5. 成员D 提交 "等待最终批准" → 状态: pending
6. 管理员E 点击"通过" → 状态: approved
```

### **场景 2: 材料审核流程**
```
1. 成员A 提交 "上传设计文档" → pending
2. 审核员B 点击"通过" → approved
3. 成员A 提交 "上传代码仓库" → pending
4. 审核员B 点击"拒绝"（原因：代码不规范）→ rejected
5. 成员A 重新提交 "修正后的代码" → pending
6. 审核员B 点击"通过" → approved
```

### **场景 3: 任务分配流程**
```
1. 负责人A 提交 "分配任务：前端开发" → pending
2. 成员B 点击"通过"（接受任务）→ approved
3. 成员B 提交 "完成前端开发" → pending
4. 负责人A 点击"通过"（验收通过）→ approved
```

---

## 🎨 视觉设计

### **状态颜色方案**

| 状态 | 颜色 | 含义 |
|------|------|------|
| **待处理** (pending) | 🟡 黄色 (#fff3cd) | 等待审核或处理 |
| **进行中** (processing) | 🔵 蓝色 (#cce5ff) | 正在处理中 |
| **已通过** (approved) | 🟢 绿色 (#d4edda) | 审核通过 |
| **已拒绝** (rejected) | 🔴 红色 (#f8d7da) | 审核拒绝 |

### **时间线样式**
- 🟣 **节点圆点**：紫色渐变，带白色边框
- 🟣 **连接线**：紫色渐变，连接相邻节点
- ⬜ **内容卡片**：浅灰背景，左侧紫色边框
- 🎯 **悬停效果**：卡片轻微放大

---

## 🧪 测试验证步骤

### **步骤 1: 测试提交流程**
```
1. 进入项目详情页
2. 滚动到"流程进度"区域
3. 点击"➕ 提交流程"按钮
4. 输入操作描述（如："提交申请"）
5. 点击"确定"
6. 预期结果：
   ✅ 显示"提交中..."加载提示
   ✅ 显示"提交流程成功"提示
   ✅ 时间线中出现新节点
   ✅ 节点状态为"待处理"（黄色徽章）
```

### **步骤 2: 测试通过节点**
```
1. 找到状态为"待处理"的节点
2. 点击"✓ 通过"按钮
3. 确认对话框中点击"确定"
4. 预期结果：
   ✅ 显示"处理中..."加载提示
   ✅ 显示"已通过"提示
   ✅ 节点状态变为"已通过"（绿色徽章）
   ✅ 操作按钮消失
```

### **步骤 3: 测试拒绝节点**
```
1. 找到状态为"待处理"的节点
2. 点击"✗ 拒绝"按钮
3. 确认对话框中点击"确定"
4. 预期结果：
   ✅ 显示"处理中..."加载提示
   ✅ 显示"已拒绝"提示
   ✅ 节点状态变为"已拒绝"（红色徽章）
   ✅ 操作按钮消失
```

### **步骤 4: 测试空状态**
```
1. 进入一个没有流程的项目详情页
2. 预期结果：
   ✅ 显示空状态图标 📋
   ✅ 显示"暂无流程记录"文字
   ✅ 显示"点击'提交流程'开始创建审批流程"提示
```

### **步骤 5: 测试多节点时间线**
```
1. 连续提交 3-5 个流程节点
2. 预期结果：
   ✅ 节点按时间顺序从上到下排列
   ✅ 每个节点之间有连接线
   ✅ 最后一个节点没有向下的连接线
   ✅ 时间线左侧对齐
```

---

## ⚠️ 重要说明

### **权限控制**

根据项目规范记忆：
> **查看与操作分离**: 前端可展示敏感信息以提升透明度，但所有写操作必须在服务层执行严格身份校验。

**当前实现**：
- ✅ **查看所有流程**：任何项目成员都可以查看
- ✅ **提交流程**：任何登录用户都可以提交
- ⚠️ **审核操作**：目前未限制，建议后续添加权限判断

**建议改进**：
```javascript
// 在 approveWorkflowStep 和 rejectWorkflowStep 中添加权限检查
approveWorkflowStep(e) {
  const { projectData, currentUser } = this.data;
  
  // 仅项目负责人可以审核
  if (projectData.leader !== currentUser.uuid) {
    wx.showToast({ title: '仅项目负责人可以审核', icon: 'none' });
    return;
  }
  
  // ... 原有逻辑
}
```

---

### **数据一致性**

根据经验教训记忆：
> **全量同步原则**：若系统同时使用内存状态、全局数据和本地存储，必须同时更新所有层级。

**当前实现**：
- ✅ 后端使用 MongoDB 的 `$push` 和位置运算符 `$` 确保原子性
- ✅ 前端通过 `refreshWorkflow()` 从缓存重新读取最新数据
- ⚠️ 建议：在后端返回成功后，同时更新三层缓存

**改进建议**：
```javascript
submitWorkflowStep(action) {
  wx.request({
    success: (res) => {
      if (res.data?.status === 'success') {
        // ⭐ 更新三层缓存
        const app = getApp();
        const allProjects = app.globalData.projectsData || [];
        const projectIndex = allProjects.findIndex(p => p.id === this.data.projectId);
        
        if (projectIndex !== -1) {
          // 1. 更新全局数据
          allProjects[projectIndex].workflow.push(res.data.data);
          app.globalData.projectsData = allProjects;
          
          // 2. 更新本地存储
          wx.setStorageSync('projectsData', allProjects);
          
          // 3. 更新全局状态管理
          const states = require('../../utils/state.js');
          states.setProjects(allProjects);
        }
        
        this.refreshWorkflow();
      }
    }
  });
}
```

---

## 🚀 后续优化建议

### **短期优化**
1. **添加备注字段**：允许在审核时添加备注说明
2. **权限控制**：限制只有项目负责人可以审核
3. **通知机制**：节点状态变更时通知相关成员
4. **撤销操作**：允许在一定时间内撤销已提交的节点

### **长期优化**
1. **流程图可视化**：使用图形化方式展示复杂流程
2. **条件分支**：支持根据条件跳转到不同节点
3. **并行节点**：支持多个节点同时进行处理
4. **流程模板**：预设常用流程模板，快速创建
5. **导出功能**：将流程历史导出为 PDF 或图片

---

## 📞 技术支持

如遇问题，请按以下步骤排查：

1. **检查后端日志**：
   ```
   [INFO] [ProjectService] 开始添加流程节点...
   [DATABASE] UPDATE db.projects.updateOne - $push workflow
   [SUCCESS] 流程节点添加成功！步骤ID: step-xxx
   ```

2. **检查前端控制台**：
   ```javascript
   console.log('流程数据:', this.data.workflow);
   ```

3. **验证数据库**：
   ```javascript
   db.projects.findOne(
     { project_id: "proj-xxx" },
     { workflow: 1 }
   )
   ```

4. **测试 API**：
   ```bash
   curl -X POST https://miniprogram-server.vercel.app/api/project/workflow/add \
     -H "Content-Type: application/json" \
     -d '{
       "project_id": "proj-xxx",
       "action": "测试流程",
       "submitter": "u-001",
       "status": "pending"
     }'
   ```

祝使用愉快！🎉
