# 流程进度图功能调试指南

## 🔍 **问题排查清单**

### **问题 1: 点击通过/拒绝按钮没有反应**

#### **可能原因及解决方案**

##### **A. step_id 未正确传递**

**检查步骤**：
1. 打开微信开发者工具的控制台
2. 点击"通过"或"拒绝"按钮
3. 查看控制台输出：

```javascript
// ✅ 正常情况
🔍 点击通过按钮，事件对象: {currentTarget: {...}, ...}
📋 获取到的 step_id: step-1712649600000-abc12

// ❌ 异常情况
🔍 点击通过按钮，事件对象: {currentTarget: {...}, ...}
📋 获取到的 step_id: undefined
❌ step_id 为空，无法执行操作
```

**如果 step_id 为 undefined**：

检查 WXML 中的数据绑定：
```xml
<!-- 正确的写法 -->
<button class="approve-btn" bindtap="approveWorkflowStep" data-step-id="{{item.step_id}}">

<!-- 常见错误 -->
<button class="approve-btn" bindtap="approveWorkflowStep" data-stepId="{{item.step_id}}">
<!-- ⚠️ data-stepId 会被转换为 dataset.stepid（全小写） -->
```

**修复方法**：
确保使用 `data-step-id`（短横线命名），在 JS 中通过 `e.currentTarget.dataset.stepId` 访问（驼峰命名）。

---

##### **B. 后端 API 返回错误**

**检查步骤**：
1. 查看控制台日志：
```javascript
📤 准备更新流程节点: {project_id: "xxx", step_id: "yyy", status: "approved"}
✅ 用户确认操作，开始发送请求...
📥 收到后端响应: {status: "error", message: "..."}
```

2. 检查 Vercel 日志：
```bash
vercel logs <deployment-url>
```

**常见错误**：
- `项目不存在` - project_id 错误
- `项目或流程节点不存在` - step_id 错误或已被删除
- `服务器错误` - MongoDB 连接失败

---

##### **C. 网络请求失败**

**检查步骤**：
```javascript
❌ 网络请求失败: {errMsg: "request:fail ..."}
```

**解决方案**：
1. 检查网络连接
2. 确认 BASE_URL 是否正确
3. 检查 Vercel 部署是否成功

---

### **问题 2: 提交流程后需要手动刷新才能看到更新**

#### **已实施的解决方案**

##### **A. 改进的 refreshWorkflow() 方法**

```javascript
refreshWorkflow() {
  // 1. 从后端重新获取项目列表
  wx.request({
    url: `${BASE_URL}/api/project/leader`,
    method: 'POST',
    data: { uuid: userInfo.uuid },
    success: (res) => {
      // 2. 更新三层缓存
      app.globalData.projectsData = projects;
      wx.setStorageSync('projectsData', projects);
      states.setProjects(projects);

      // 3. 更新页面数据
      this.setData({
        workflow: project.workflow || [],
        projectData: project
      });
    }
  });
}
```

**关键改进**：
- ✅ 从后端重新拉取最新数据，而不是从本地缓存读取
- ✅ 同步更新三层缓存（globalData、Storage、state）
- ✅ 添加加载提示和错误处理

---

##### **B. 延迟刷新机制**

在审核操作成功后，延迟 500ms 再刷新：

```javascript
if (res.data?.status === 'success') {
  wx.showToast({ title: `已${statusText}`, icon: 'success' });
  
  // ⭐ 延迟 500ms 后刷新，确保数据库已更新
  setTimeout(() => {
    this.refreshWorkflow();
  }, 500);
}
```

**原因**：
- MongoDB 的写入操作是异步的
- 立即刷新可能读取到旧数据
- 500ms 延迟确保数据已持久化

---

## 🧪 **完整测试流程**

### **测试 1: 提交流程节点**

```
1. 进入项目详情页
2. 滚动到"流程进度"区域
3. 点击"➕ 提交流程"
4. 输入"测试流程节点"
5. 点击"确定"

预期控制台输出：
📤 准备提交流程节点: {project_id: "xxx", action: "测试流程节点", ...}
📥 收到后端响应: {status: "success", data: {...}}
✅ 提交流程成功
🔄 开始刷新流程数据...
✅ 流程数据已刷新，节点数量: 1

预期 UI 变化：
- 显示"提交中..."加载提示
- 显示"提交流程成功"Toast
- 时间线中立即出现新节点
- 节点状态为"待处理"（黄色徽章）
```

---

### **测试 2: 审核流程节点**

```
1. 找到状态为"待处理"的节点
2. 点击"✓ 通过"按钮

预期控制台输出：
🔍 点击通过按钮，事件对象: {...}
📋 获取到的 step_id: step-xxx
📤 准备更新流程节点: {project_id: "xxx", step_id: "step-xxx", status: "approved"}
✅ 用户确认操作，开始发送请求...
📥 收到后端响应: {status: "success", ...}
✅ 更新成功，开始刷新数据...
🔄 开始刷新流程数据...
✅ 流程数据已刷新，节点数量: 1

预期 UI 变化：
- 弹出确认对话框
- 显示"处理中..."加载提示
- 显示"已通过"Toast
- 节点状态变为"已通过"（绿色徽章）
- 操作按钮消失
```

---

### **测试 3: 拒绝流程节点**

```
1. 找到状态为"待处理"的节点
2. 点击"✗ 拒绝"按钮

预期控制台输出：
🔍 点击拒绝按钮，事件对象: {...}
📋 获取到的 step_id: step-xxx
📤 准备更新流程节点: {project_id: "xxx", step_id: "step-xxx", status: "rejected"}
✅ 用户确认操作，开始发送请求...
📥 收到后端响应: {status: "success", ...}
✅ 更新成功，开始刷新数据...

预期 UI 变化：
- 节点状态变为"已拒绝"（红色徽章）
- 操作按钮消失
```

---

## 🐛 **常见问题与解决方案**

### **问题 A: step_id 始终为 undefined**

**原因**：WXML 中的属性名使用了驼峰命名

**错误示例**：
```xml
<button data-stepId="{{item.step_id}}">  <!-- ❌ 错误 -->
```

**正确示例**：
```xml
<button data-step-id="{{item.step_id}}">  <!-- ✅ 正确 -->
```

**验证方法**：
```javascript
// 在 approveWorkflowStep 中添加
console.log('完整 dataset:', e.currentTarget.dataset);
// 应该输出: {stepId: "step-xxx"}
// 如果输出: {stepid: "step-xxx"}，说明属性名错误
```

---

### **问题 B: 刷新后 workflow 仍为空**

**原因 1**：后端返回的项目中没有 workflow 字段

**检查方法**：
```javascript
// 在 refreshWorkflow 的 success 回调中添加
console.log('项目完整数据:', project);
console.log('workflow 字段:', project.workflow);
```

**解决方案**：
检查数据库中项目是否有 workflow 字段：
```javascript
db.projects.findOne(
  { project_id: "proj-xxx" },
  { workflow: 1 }
)
```

---

**原因 2**：projectId 匹配失败

**检查方法**：
```javascript
console.log('当前 projectId:', projectId);
console.log('所有项目 IDs:', projects.map(p => ({id: p.id, project_id: p.project_id})));
```

**解决方案**：
确保匹配逻辑同时检查 `id` 和 `project_id`：
```javascript
const project = projects.find(p => 
  String(p.project_id) === String(projectId) || 
  String(p.id) === String(projectId)
);
```

---

### **问题 C: 审核后状态没有变化**

**原因**：数据库更新失败

**检查 Vercel 日志**：
```bash
vercel logs <deployment-url> --follow
```

**查找关键日志**：
```
[INFO] [ProjectService] 开始更新流程节点状态...
[DATABASE] UPDATE db.projects.updateOne - 更新 workflow 节点状态
[SUCCESS] 流程节点状态更新成功！步骤ID: step-xxx, 新状态: approved
```

**如果没有看到这些日志**：
1. 确认后端代码已重新部署
2. 检查 MongoDB 连接是否正常
3. 验证 project_id 和 step_id 是否正确

---

## 📊 **调试日志速查表**

| 日志前缀 | 含义 | 正常输出示例 |
|---------|------|------------|
| `🔍` | 用户交互事件 | `点击通过按钮，事件对象: {...}` |
| `📋` | 数据提取 | `获取到的 step_id: step-xxx` |
| `📤` | 发送请求 | `准备更新流程节点: {...}` |
| `✅` | 操作成功 | `用户确认操作，开始发送请求...` |
| `📥` | 接收响应 | `收到后端响应: {status: "success"}` |
| `🔄` | 刷新数据 | `开始刷新流程数据...` |
| `❌` | 错误信息 | `step_id 为空，无法执行操作` |
| `⚠️` | 警告信息 | `用户取消操作` |

---

## 🎯 **快速定位问题**

### **步骤 1: 检查控制台日志**
打开微信开发者工具控制台，执行操作后查看是否有完整的日志链路：
```
🔍 → 📋 → 📤 → ✅ → 📥 → 🔄 → ✅
```

### **步骤 2: 检查 Vercel 日志**
```bash
vercel logs <your-deployment-url> --follow
```

### **步骤 3: 检查数据库**
```javascript
db.projects.findOne(
  { project_id: "proj-xxx" },
  { workflow: 1, name: 1 }
)
```

### **步骤 4: 检查网络请求**
在微信开发者工具的 **Network** 面板中查看：
- 请求 URL 是否正确
- 请求体是否包含必需字段
- 响应状态码是否为 200
- 响应体中 `status` 是否为 `"success"`

---

## ✨ **最佳实践建议**

1. **始终添加调试日志**：在关键路径上记录输入输出
2. **使用可选链操作符**：`res.data?.status` 避免空指针错误
3. **提供友好错误提示**：区分网络错误、业务错误、数据错误
4. **延迟刷新策略**：写操作后延迟 500ms 再读取，确保数据一致性
5. **三层缓存同步**：globalData、Storage、state 必须同时更新

祝调试顺利！🎉
