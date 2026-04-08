# 我参与的项目不显示 - 调试指南

## 📋 问题描述

- ✅ "我管理的项目"显示正常
- ❌ "我参与的项目"中，通过邀请码加入的项目刷新后消失
- ✅ 数据库中项目存在，members 数组包含用户 UUID

---

## 🔍 调试步骤

### **步骤 1: 查看控制台日志**

刷新页面后，查看微信开发者工具控制台的输出：

```javascript
📊 后端返回的项目数量: X
📊 当前用户 UUID: u-002
项目 1: {
  name: "132",
  project_id: "proj-xxx",
  leader: "u-001",
  members: ["u-001", "u-002"],
  isLeader: false,      // ⭐ 应该是 false（不是负责人）
  isMember: true        // ⭐ 应该是 true（是成员）
}
📊 过滤结果: {
  managedCount: 0,      // ⭐ 管理的项目数量
  joinedCount: 1,       // ⭐ 参与的项目数量（应该有 1 个）
  managed: [],
  joined: ["132"]       // ⭐ 应该包含项目名称
}
```

---

### **步骤 2: 分析问题**

根据日志输出，可能出现的情况：

#### **情况 A: 后端没有返回项目**
```
📊 后端返回的项目数量: 0
```

**原因**：后端查询逻辑仍有问题
**解决**：检查后端日志，确认 `$or` 查询是否正确执行

---

#### **情况 B: 项目返回了，但 leader 字段缺失**
```
项目 1: {
  name: "132",
  leader: "",           // ❌ 空字符串
  members: ["u-001", "u-002"],
  isLeader: false,
  isMember: true
}
📊 过滤结果: {
  managedCount: 0,
  joinedCount: 1        // ✅ 应该在 joined 中
}
```

**原因**：数据库中缺少 `leader` 字段
**解决**：检查数据库，确保项目文档有 `leader` 字段

---

#### **情况 C: 项目返回了，但 members 字段缺失**
```
项目 1: {
  name: "132",
  leader: "u-001",
  members: undefined,   // ❌ undefined
  isLeader: false,
  isMember: false       // ❌ 应该是 true
}
📊 过滤结果: {
  managedCount: 0,
  joinedCount: 1        // ✅ 因为 leader !== uuid，所以在 joined 中
}
```

**原因**：数据库中缺少 `members` 字段
**解决**：检查数据库，确保项目文档有 `members` 数组

---

#### **情况 D: 过滤逻辑错误**
```
📊 过滤结果: {
  managedCount: 1,      // ❌ 错误：应该在 joined 中
  joinedCount: 0,       // ❌ 错误：应该是 1
  managed: ["132"],     // ❌ 错误
  joined: []            // ❌ 错误
}
```

**原因**：用户的 UUID 与项目中的 leader/members 不匹配
**解决**：检查 UUID 格式是否一致（大小写、前后空格等）

---

### **步骤 3: 验证数据库**

在 MongoDB Compass 中执行：

```javascript
// 查询用户 u-002 参与的所有项目
db.projects.find({ 
  $or: [
    { leader: "u-002" },
    { members: "u-002" }
  ]
})

// 预期结果
[
  {
    _id: ObjectId("..."),
    project_id: "proj-xxx",
    name: "132",
    leader: "u-001",          // ⭐ 必须有
    members: ["u-001", "u-002"],  // ⭐ 必须有
    invite_code: "BKV9TN",
    ...
  }
]
```

**检查要点**：
1. ✅ `leader` 字段存在且不为空
2. ✅ `members` 字段是数组且包含用户 UUID
3. ✅ UUID 格式与前端一致（无多余空格）

---

### **步骤 4: 验证后端 API**

使用 curl 或 Postman 测试：

```bash
curl -X POST https://miniprogram-server.vercel.app/api/project/leader \
  -H "Content-Type: application/json" \
  -d '{"uuid": "u-002"}'
```

**预期响应**：
```json
{
  "status": "success",
  "data": {
    "leader_uuid": "u-002",
    "project_count": 1,
    "projects": [
      {
        "project_id": "proj-xxx",
        "name": "132",
        "leader": "u-001",
        "members": ["u-001", "u-002"],
        "invite_code": "BKV9TN",
        ...
      }
    ]
  }
}
```

**检查要点**：
1. ✅ `project_count` 应该是 1（或更多）
2. ✅ `projects` 数组包含目标项目
3. ✅ 每个项目都有 `leader` 和 `members` 字段

---

### **步骤 5: 检查前端缓存**

在微信开发者工具控制台执行：

```javascript
// 检查全局状态管理
const states = require('./utils/state.js');
const { projects } = states.getProjects();
console.log('缓存中的项目:', projects);

// 检查全局数据
console.log('globalData:', getApp().globalData.projectsData);

// 检查本地存储
console.log('Storage:', wx.getStorageSync('projectsData'));
```

**检查要点**：
1. ✅ 三层缓存中的数据一致
2. ✅ 项目包含 `leader` 和 `members` 字段
3. ✅ UUID 格式正确

---

## 🛠️ 常见解决方案

### **方案 1: 清除缓存并重新登录**

```javascript
// 在控制台执行
wx.clearStorageSync();
// 然后重新登录
```

---

### **方案 2: 手动触发刷新**

1. 进入项目列表页面
2. 点击顶部 🔄 刷新按钮
3. 或下拉刷新
4. 查看控制台日志，确认项目数量

---

### **方案 3: 修复数据库中的缺失字段**

如果数据库中项目缺少 `leader` 或 `members` 字段：

```javascript
// 在 MongoDB Compass 中执行
db.projects.updateOne(
  { project_id: "proj-xxx" },
  { 
    $set: { 
      leader: "u-001",
      members: ["u-001", "u-002"]
    }
  }
)
```

---

### **方案 4: 检查 UUID 格式一致性**

```javascript
// 在前端控制台检查
const { userInfo } = require('./utils/state.js').getState();
console.log('用户 UUID:', userInfo.uuid);
console.log('UUID 长度:', userInfo.uuid.length);
console.log('UUID 类型:', typeof userInfo.uuid);

// 在后端日志检查
// 确认数据库中存储的 UUID 格式与前端一致
```

**常见问题**：
- ❌ 前端：`"u-002"` vs 后端：`"U-002"`（大小写不一致）
- ❌ 前端：`"u-002"` vs 后端：`" u-002 "`（有空格）
- ❌ 前端：`"u-002"` vs 后端：`"user-002"`（格式不同）

---

## 📊 预期的完整日志输出

当一切正常时，应该看到：

```
📊 后端返回的项目数量: 2
📊 当前用户 UUID: u-002
项目 1: {
  name: "我的项目",
  project_id: "proj-001",
  leader: "u-002",
  members: ["u-002"],
  isLeader: true,       // ✅ 是负责人
  isMember: true        // ✅ 也是成员
}
项目 2: {
  name: "132",
  project_id: "proj-002",
  leader: "u-001",
  members: ["u-001", "u-002"],
  isLeader: false,      // ✅ 不是负责人
  isMember: true        // ✅ 是成员
}
📊 过滤结果: {
  managedCount: 1,      // ✅ 1 个管理的项目
  joinedCount: 1,       // ✅ 1 个参与的项目
  managed: ["我的项目"],
  joined: ["132"]
}
✅ 数据刷新成功，项目数量: 2
```

---

## 🎯 验收标准

- [ ] ✅ 控制台显示正确的项目数量
- [ ] ✅ 每个项目的 `isMember` 为 `true`
- [ ] ✅ `joinedCount` 大于 0
- [ ] ✅ "我参与的项目"列表中显示项目
- [ ] ✅ 刷新后项目不消失

---

## 📞 技术支持

如果以上步骤都无法解决问题，请提供：

1. **控制台完整日志**（从刷新到显示结果）
2. **数据库项目文档截图**（包含所有字段）
3. **后端日志**（查询执行的 SQL/MongoDB 语句）
4. **用户 UUID**（前端和后端的一致性检查）

祝调试顺利！🎉
