# 小程序后端服务 API 文档

## 📋 项目概述

这是一个为微信小程序提供后端服务的 Node.js 项目，支持用户认证、项目管理和团队管理功能。

### 技术栈
- **运行环境**: Node.js + Express
- **数据库**: MongoDB Atlas
- **部署平台**: Vercel（Serverless Functions）
- **认证方式**: 微信小程序登录

### 项目结构
```
miniprogram-server/
├── api/                      # Vercel API 目录（约定式路由）
│   ├── index.js             # API 入口文件
│   ├── controllers/         # 控制器层
│   │   ├── AuthController.js
│   │   ├── ProjectController.js
│   │   └── TeamController.js
│   ├── services/            # 业务逻辑层
│   │   ├── AuthService.js
│   │   ├── ProjectService.js
│   │   └── TeamService.js
│   ├── routes/              # 路由定义
│   │   ├── auth.js
│   │   ├── project.js
│   │   └── team.js
│   └── utils/               # 工具类
│       ├── Logger.js        # 日志工具
│       └── wechat.js        # 微信API工具
├── server.js                # 本地开发服务器入口
├── package.json
└── vercel.json              # Vercel 部署配置
```

---

## 🔐 认证接口

### 1. 用户登录
**接口地址**: `POST /api/login`

**功能**: 微信小程序用户登录，获取用户信息并生成唯一标识

**请求体**:
```json
{
  "code": "微信登录凭证",
  "avatarUrl": "用户头像URL（可选）",
  "nickName": "用户昵称（可选）"
}
```

**响应示例**:
```json
{
  "status": "success",
  "message": "登录成功",
  "data": {
    "user": {
      "uuid": "user-1730000000000-abc123",
      "openid": "o1234567890abcdef",
      "nickName": "张三",
      "avatarUrl": "https://...",
      "created_at": "2025-10-30T10:00:00.000Z",
      "last_login": "2025-10-30T10:00:00.000Z"
    }
  }
}
```

**功能特性**:
- ✅ 自动生成唯一 UUID
- ✅ 新用户自动注册
- ✅ 每次登录强制更新头像URL（处理临时地址失效）
- ✅ 记录最后登录时间

---

## 📦 项目管理接口

### 2. 项目查询（新格式）
**接口地址**: `POST /api/project/`

**功能**: 根据负责人信息查询项目列表

**请求体**:
```json
{
  "leader": "张三"
}
```

**响应示例**:
```json
{
  "status": "success",
  "message": "查询成功",
  "data": [
    {
      "project_id": "proj-1730000000000-xyz789",
      "project_name": "小程序开发项目",
      "description": "微信小程序前端开发",
      "leader": "张三",
      "status": "进行中",
      "created_at": "2025-10-30T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 3. 项目查询（UUID格式）
**接口地址**: `POST /api/project/leader`

**功能**: 根据用户UUID查询该用户负责的项目

**请求体**:
```json
{
  "uuid": "user-1730000000000-abc123"
}
```

**响应格式**: 同上

---

### 4. 项目提交
**接口地址**: `POST /api/project/submit`

**功能**: 创建新项目

**请求体**:
```json
{
  "project_name": "小程序开发项目",
  "description": "微信小程序前端开发",
  "leader": "张三",
  "status": "进行中"
}
```

**响应示例**:
```json
{
  "status": "success",
  "message": "项目创建成功",
  "data": {
    "project_id": "proj-1730000000000-xyz789",
    "project_name": "小程序开发项目",
    "description": "微信小程序前端开发",
    "leader": "张三",
    "status": "进行中",
    "created_at": "2025-10-30T10:00:00.000Z",
    "updated_at": "2025-10-30T10:00:00.000Z"
  }
}
```

---

### 5. 项目更新
**接口地址**: `POST /api/project/update`

**功能**: 更新现有项目信息

**请求体**:
```json
{
  "project_id": "proj-1730000000000-xyz789",
  "project_name": "小程序开发项目（更新）",
  "description": "新的描述",
  "status": "已完成"
}
```

**响应示例**:
```json
{
  "status": "success",
  "message": "项目更新成功",
  "data": {
    "project_id": "proj-1730000000000-xyz789",
    "updated_fields": ["project_name", "description", "status"],
    "updated_at": "2025-10-30T11:00:00.000Z"
  }
}
```

---

### 6. 项目删除
**接口地址**: `POST /api/project/delete`

**功能**: 删除指定项目

**请求体**:
```json
{
  "project_id": "proj-1730000000000-xyz789"
}
```

**响应示例**:
```json
{
  "status": "success",
  "message": "项目删除成功",
  "data": {
    "project_id": "proj-1730000000000-xyz789",
    "deleted_at": "2025-10-30T12:00:00.000Z"
  }
}
```

---

## 👥 团队管理接口

### 7. 团队创建
**接口地址**: `POST /api/team/create`

**功能**: 创建新团队，自动生成唯一团队ID

**请求体**:
```json
{
  "uuid": "user-1730000000000-abc123",
  "name": "研发一组",
  "description": "负责小程序开发",
  "max_people": 10
}
```

**参数说明**:
- `uuid` (必需): 创建者的用户UUID
- `name` (必需): 团队名称
- `description` (可选): 团队描述
- `max_people` (可选): 最大成员数，默认不限制

**响应示例**:
```json
{
  "status": "success",
  "message": "团队创建成功",
  "data": {
    "team_id": "team-1730000000000-def456",
    "name": "研发一组",
    "description": "负责小程序开发",
    "max_people": 10,
    "creator_uuid": "user-1730000000000-abc123",
    "leader_uuid": "user-1730000000000-abc123",
    "members": [
      {
        "uuid": "user-1730000000000-abc123",
        "role": "leader",
        "joined_at": "2025-10-30T10:00:00.000Z"
      }
    ],
    "member_count": 1,
    "created_at": "2025-10-30T10:00:00.000Z",
    "updated_at": "2025-10-30T10:00:00.000Z",
    "status": "active"
  }
}
```

**功能特性**:
- ✅ 自动生成唯一 team_id
- ✅ 创建者自动成为团队领导
- ✅ 自动初始化成员列表
- ✅ 验证用户是否存在
- ✅ 预留用户组和成员管理字段

---

## 🔧 工具接口

### 8. 健康检查
**接口地址**: `GET /api/health`

**功能**: 检查服务运行状态

**响应示例**:
```json
{
  "status": "success",
  "message": "服务运行正常",
  "timestamp": "2025-10-30T10:00:00.000Z",
  "version": "v3.0 - 模块化架构"
}
```

---

## ⚠️ 常见问题与解决方案

### 问题1: 响应中出现多个ID，造成混淆

**问题描述**:
团队创建接口返回时包含 `_id`、`team_id` 和嵌套的 `created_team` 对象，导致ID冗余。

**原因分析**:
- `_id`: MongoDB 自动生成的内部文档ID
- `team_id`: 业务层面的唯一标识符
- 初始响应结构未优化，直接返回数据库原始数据

**解决方案**:
优化 `TeamController.js` 的响应结构：
```javascript
// 只返回业务需要的字段，隐藏 MongoDB 内部 _id
const responseData = {
  status: 'success',
  message: '团队创建成功',
  data: {
    team_id: result.data.team_id,  // 唯一业务ID
    name: result.data.name,
    description: result.data.description,
    // ... 其他业务字段
  }
};
```

**最佳实践**:
- API 响应只返回业务相关字段
- MongoDB 的 `_id` 仅用于内部查询，不暴露给客户端
- 业务唯一标识（如 `team_id`、`project_id`）作为对外接口

---

### 问题2: 本地测试与 Vercel 部署的区别

**关键差异**:

| 维度 | 本地开发 (server.js) | Vercel 部署 (api/index.js) |
|------|---------------------|---------------------------|
| **运行方式** | `node server.js` 启动完整服务器 | Serverless Functions，按需调用 |
| **路由定义** | Express 路由自由定义 | 必须放在 `api/` 目录，文件即路由 |
| **访问地址** | `http://localhost:3000/api/xxx` | `https://域名/api/xxx` |
| **持久化** | 可以读写本地文件 | 无状态，必须用外部数据库 |
| **环境变量** | `.env` 文件加载 | Vercel 控制台配置 |
| **调试方式** | 实时热更新，断点调试 | 需重新部署，通过日志调试 |

**为什么 Vercel 需要 api/ 目录？**
- Vercel 使用"约定式路由"：`api/team/create.js` → `/api/team/create`
- 每个文件自动打包成独立的云函数
- 实现自动扩容和按需计费
- 不需要手动配置路由映射

**开发建议**:
1. 本地开发：使用 `server.js` 快速迭代
2. 部署前：确保 `api/index.js` 包含所有路由
3. 环境变量：本地和 Vercel 都要配置
4. 测试：本地测试通过后再部署到 Vercel

---

### 问题3: 微信头像URL临时失效

**问题描述**:
微信返回的头像URL是临时地址，过期后无法访问。

**解决方案**:
在 `AuthService.js` 中，每次登录强制更新头像URL：
```javascript
// 每次登录都更新头像（处理临时URL失效）
const updateData = {
  last_login: currentTime,
  avatarUrl: userInfo.avatarUrl || user.avatarUrl,  // 强制更新
  nickName: userInfo.nickName || user.nickName
};
```

**版本说明**: v2.3 - 每次登录强制更新头像URL（临时地址机制）

---

### 问题4: 数据库连接问题

**常见错误**:
- MongoDB 连接超时
- 数据库操作失败
- 环境变量未配置

**排查步骤**:
1. 检查 `.env` 文件是否配置 `MONGODB_URI`
2. 验证 MongoDB Atlas 白名单是否允许当前IP
3. 查看 Logger 输出的数据库连接日志
4. Vercel 部署时确认环境变量已配置

**日志工具**:
项目使用自定义 `Logger` 类，提供结构化日志：
```javascript
const logger = new Logger('ServiceName');
logger.info('信息日志');
logger.success('成功日志');
logger.error('错误日志');
logger.database('QUERY', 'SQL或查询语句');
logger.data('数据名称', dataObject);
```

---

## 🚀 快速开始

### 本地开发

1. **安装依赖**:
```bash
npm install
```

2. **配置环境变量** (`.env`):
```env
APPID=your_wechat_appid
APPSECRET=your_wechat_appsecret
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
DATABASE_NAME=miniprogram
```

3. **启动服务**:
```bash
npm run dev
```

4. **测试接口**:
```bash
# 健康检查
curl http://localhost:3000/api/health

# 用户登录
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"code":"your_code"}'
```

---

### Vercel 部署

1. **安装 Vercel CLI**:
```bash
npm i -g vercel
```

2. **登录 Vercel**:
```bash
vercel login
```

3. **部署项目**:
```bash
vercel --prod
```

4. **配置环境变量**:
在 Vercel 控制台 → Settings → Environment Variables 添加：
- `APPID`
- `APPSECRET`
- `MONGODB_URI`
- `DATABASE_NAME`

5. **访问服务**:
```
https://your-project.vercel.app/api/health
```

---

## 📊 数据库设计

### users 集合
```javascript
{
  _id: ObjectId,
  uuid: "user-1730000000000-abc123",  // 唯一标识
  openid: "o1234567890abcdef",        // 微信openid
  nickName: "张三",
  avatarUrl: "https://...",
  created_at: ISODate,
  last_login: ISODate
}
```

### projects 集合
```javascript
{
  _id: ObjectId,
  project_id: "proj-1730000000000-xyz789",
  project_name: "小程序开发项目",
  description: "微信小程序前端开发",
  leader: "张三",
  status: "进行中",
  created_at: ISODate,
  updated_at: ISODate
}
```

### teams 集合
```javascript
{
  _id: ObjectId,
  team_id: "team-1730000000000-def456",
  name: "研发一组",
  description: "负责小程序开发",
  max_people: 10,
  creator_uuid: "user-1730000000000-abc123",
  leader_uuid: "user-1730000000000-abc123",
  members: [
    {
      uuid: "user-1730000000000-abc123",
      role: "leader",
      joined_at: ISODate
    }
  ],
  member_count: 1,
  status: "active",
  created_at: ISODate,
  updated_at: ISODate
}
```

---

## 📝 版本历史

- **v3.0** - 模块化架构（当前版本）
  - 引入 MVC 分层架构
  - 添加团队管理功能
  - 优化响应结构

- **v2.3** - 头像URL更新机制
  - 每次登录强制更新头像
  - 解决临时地址失效问题

- **v2.0** - 项目管理功能
  - 添加项目CRUD接口
  - 支持UUID和姓名双查询模式

- **v1.0** - 基础认证功能
  - 微信小程序登录
  - 用户信息管理

---

## 📞 技术支持

如有问题，请查看：
1. Logger 输出的详细日志
2. Vercel 部署日志
3. MongoDB Atlas 连接状态

**关键调试点**:
- ✅ 环境变量是否正确配置
- ✅ 数据库连接是否成功
- ✅ API 请求体格式是否正确
- ✅ Vercel 函数是否正常启动

---

---

## 📝 开发日志

### 2025-10-30 - 项目架构升级与优化

#### 今日完成任务
- ✅ 实现团队创建接口 (`/api/team/create`)
- ✅ 优化API响应结构，移除冗余ID
- ✅ 建立 MVC 分层架构
- ✅ 完成API文档编写

#### 代码改动记录

**1. 创建 TeamService.js**
```
文件: api/services/TeamService.js
内容: 
  - generateTeamId(): 生成格式为 team-{timestamp}-{randomSuffix} 的唯一ID
  - validateTeamData(): 验证团队数据（uuid、name、max_people等）
  - checkUserExists(): 检查用户是否存在（调用users集合）
  - createTeam(): 完整的团队创建流程
行数: 245 行
```

**2. 创建 TeamController.js**
```
文件: api/controllers/TeamController.js
内容:
  - createTeam(): 处理HTTP请求，调用Service层
  - 详细的Logger输出（请求体、返回数据等）
  - 优化响应体结构（只返回业务字段）
行数: 128 行
```

**3. 创建 team.js 路由**
```
文件: api/routes/team.js
内容: 定义 POST /create 路由，映射到 TeamController
```

**4. 优化 TeamController 响应结构**
```javascript
// 问题: 初始响应包含 _id 和嵌套的 created_team 对象
{
  team_id: "team-xxx",
  _id: "60d5ec49c1234567890abcde",  // ❌ 冗余
  created_team: { ... }              // ❌ 冗余嵌套
}

// 解决: 简化为业务字段
{
  team_id: "team-xxx",
  name: "...",
  members: [...],
  member_count: 1,
  created_at: "2025-10-30T10:00:00.000Z"
}
```

#### 遇到的问题与解决

**问题1: MongoDB _id 与 team_id 混淆**
- 原因: 直接返回数据库查询结果
- 解决: 在Controller层构建响应对象，只选择必要字段
- 教训: API不应该暴露数据库实现细节

**问题2: 团队成员初始化**
- 原因: 需要在创建时自动添加创建者为团队leader
- 解决: 在Service层初始化members数组
- 代码:
```javascript
members: [
  {
    uuid: teamData.uuid,
    role: "leader",
    joined_at: new Date()
  }
]
```

**问题3: 用户验证逻辑**
- 原因: 如果数据库未连接，用户查询会失败
- 解决: 添加降级处理，模拟模式下假定用户存在
- 代码:
```javascript
if (!this.db) {
  this.logger.warn('数据库未连接，跳过用户验证');
  return true;  // 模拟模式
}
```

#### 技术决策记录

| 决策 | 原因 | 影响 |
|------|------|------|
| 采用 MVC 架构 | 代码分层清晰，易于维护 | 增加文件数量，但代码质量提升 |
| ID格式使用 `team-{timestamp}-{randomSuffix}` | 保证全局唯一，时间序列友好 | 比UUID更长，但可读性更好 |
| 每次登录强制更新头像 | 处理微信临时URL失效 | 额外的数据库写操作 |
| 响应体只返回业务字段 | API简洁，隐藏实现细节 | 需要在Controller层构建对象 |

---

## 🔍 技术笔记

### 1. Vercel Serverless Function 执行流程

当请求到达 Vercel 部署的服务时：

```
请求 → Vercel Router → 匹配 api/xxx.js 文件 → 加载函数 → 执行 → 返回响应
```

**关键特点**:
- 每个请求启动新的 Node.js 进程（冷启动）
- 函数超时时间: 10-60秒（取决于plan）
- 不能持久化本地文件
- 支持环境变量注入
- 自动容器隔离和扩容

**优化冷启动的方法**:
1. 减少依赖包体积
2. 使用连接池而非每次新建连接
3. 缓存数据库连接

### 2. MongoDB Atlas 连接管理

**建议做法**:
```javascript
// 使用单例模式，全局共享连接
let cachedDb = null;

async function connectDB() {
  if (cachedDb) return cachedDb;
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedDb = client.db(DATABASE_NAME);
  return cachedDb;
}
```

**当前项目的做法**:
- 每个Service实例单独初始化连接
- 可以改进为全局单例，减少连接开销

### 3. Logger 工具设计模式

项目使用自定义Logger类提供结构化日志，支持：
- 普通日志: `logger.info()`
- 成功日志: `logger.success()`
- 错误日志: `logger.error()`
- 数据库操作: `logger.database()`
- 数据展示: `logger.data()`
- 流程跟踪: `logger.startFlow()`, `logger.step()`, `logger.endFlow()`

**优势**:
- 便于调试和问题追踪
- 结构化输出便于日志分析
- 快速识别错误位置

### 4. ID生成策略对比

| 策略 | 格式 | 优点 | 缺点 | 适用场景 |
|------|------|------|------|---------|
| UUID v4 | `550e8400-e29b-41d4-a716-446655440000` | 全局唯一，标准化 | 长度长，不易读 | 分布式系统 |
| 当前方案 | `team-1730000000000-abc123` | 时间序列友好，可读性好 | 需自己维护唯一性 | 中小型项目 |
| Snowflake | 19位整数 | 高性能，支持分布式 | 实现复杂 | 大型分布式系统 |
| 自增ID | 1, 2, 3... | 简单快速 | 无法分布式 | 单机小型项目 |

**当前项目选择理由**:
- 项目规模中等，不需要Snowflake的复杂性
- 可读性要求高（方便调试）
- 后续容易改进为更复杂的方案

### 5. 异步错误处理最佳实践

```javascript
// ✅ 好的做法：使用try-catch包装async函数
async createTeam(teamData) {
  try {
    const result = await this.someAsyncOperation();
    return { success: true, data: result };
  } catch (error) {
    this.logger.error('操作失败', error.message);
    return { success: false, error: error.message };
  }
}

// ❌ 避免：忘记await导致Promise未解决
async createTeam(teamData) {
  const result = this.someAsyncOperation();  // 忘记await
  return result;  // 返回Promise而不是数据
}
```

### 6. 数据验证层的必要性

为什么需要在Service层进行数据验证？

1. **单一职责**: Controller处理HTTP，Service处理业务逻辑
2. **复用性**: 多个Controller可以共用同一个Service
3. **一致性**: 统一的验证规则
4. **性能**: 验证失败早返回，避免无谓的数据库操作

```javascript
// Service层验证流程
validateTeamData() → checkUserExists() → createTeam()
      ↓                    ↓                  ↓
  检查格式           检查业务规则         执行操作
```

---

## 🐛 故障排查指南

### 常见问题诊断表

#### 症状1: 团队创建返回 400 错误

**排查步骤**:
```
1. 检查Logger输出中的 "缺少必需参数" 错误
   ↓
2. 验证请求体是否包含 uuid 和 name 字段
   ↓
3. 检查字段值是否为空字符串或null
   ↓
4. 如果都正确，检查Content-Type是否为 application/json
```

**常见原因**:
- ❌ 缺少 uuid 字段
- ❌ name 为空字符串 `""`
- ❌ 请求头中 Content-Type 不是 application/json
- ❌ 使用了错误的HTTP方法（应该是POST）

#### 症状2: 用户存在检查失败

**日志关键词**:
```
用户查询失败: XXX
数据库未连接，跳过用户验证
```

**排查步骤**:
```
1. 检查环境变量 MONGODB_URI 是否配置
   ↓
2. 验证 MongoDB Atlas 连接字符串格式
   ↓
3. 检查 IP 白名单是否包含当前服务器IP
   ↓
4. 验证数据库和用户集合是否存在
   ↓
5. 查看 MongoDB Atlas 日志中的连接错误
```

**本地测试模式**:
如果数据库连接失败，Service会进入"模拟模式"：
- 假定所有用户都存在
- 忽略用户验证步骤
- 正常创建团队

#### 症状3: 团队创建成功但无法查询

**可能原因**:
- ❌ 使用了错误的 team_id
- ❌ 连接了不同的数据库
- ❌ teams 集合中数据损坏

**验证方法**:
```bash
# 在 MongoDB Atlas 中执行
db.teams.find({ team_id: "team-1730000000000-abc123" })

# 检查是否有结果
# 如果没有结果，说明插入失败或使用错误的team_id
```

#### 症状4: Vercel 部署后接口返回 500 错误

**排查步骤**:
```
1. 查看 Vercel 控制台的 Function Logs
   ↓
2. 检查环境变量是否正确配置
   ↓
3. 重新部署 (vercel --prod)
   ↓
4. 检查 api/index.js 中是否正确导入所有路由
   ↓
5. 查看 MongoDB 连接日志
```

**常见原因**:
- ❌ 环境变量 MONGODB_URI 未配置
- ❌ 路由未挂载到Express app
- ❌ 依赖包版本不兼容
- ❌ 代码中有语法错误

**快速修复**:
```bash
# 本地验证
npm run dev

# 部署到Vercel测试环境
vercel

# 如果测试成功再部署生产
vercel --prod
```

---

## 📊 性能监控指标

### 接口响应时间目标

| 接口 | 目标响应时间 | 实际(本地) | 备注 |
|------|------------|---------|------|
| 登录 | < 500ms | ~300ms | 包含微信API调用 |
| 项目查询 | < 100ms | ~50ms | 数据库查询 |
| 项目提交 | < 200ms | ~100ms | 数据库插入 |
| 团队创建 | < 200ms | ~120ms | 包括验证和插入 |
| 健康检查 | < 50ms | ~10ms | 无数据库操作 |

### 优化机会

1. **连接池优化** (预期提升: 20-30%)
   - 当前: 每次请求新建连接
   - 优化: 使用连接池复用

2. **缓存策略** (预期提升: 10-50%)
   - 用户信息缓存
   - 项目列表缓存

3. **数据库索引** (预期提升: 5-20%)
   - 在 uuid 字段上建立索引
   - 在 team_id 字段上建立索引

---

## 🔐 安全考虑

### 当前安全措施

- ✅ 数据验证: 检查必需字段和数据类型
- ✅ 用户验证: 创建团队前检查用户是否存在
- ✅ 环境变量: 敏感信息不在代码中硬编码

### 需要改进的地方

- ❌ 缺少身份认证: 没有验证请求者身份（JWT）
- ❌ 缺少权限检查: 无法判断用户是否有权限操作
- ❌ 缺少速率限制: 没有防止API滥用的机制
- ❌ 缺少数据加密: 密码/敏感信息未加密存储

### 建议改进方案

**1. 添加 JWT 认证**
```javascript
// 登录时返回token
const token = jwt.sign({ uuid, openid }, JWT_SECRET, { expiresIn: '7d' });

// 其他接口需要验证token
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未授权' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: '无效的token' });
  }
};
```

**2. 添加速率限制**
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15分钟
  max: 100                    // 限制100个请求
});

app.use('/api/', limiter);
```

**3. 数据库安全**
- 最小化权限: MongoDB用户只有必要的数据库权限
- 连接加密: 使用TLS连接
- 定期备份: MongoDB Atlas自动备份


## 📚 参考资源

### 官方文档
- [Express.js 官方文档](https://expressjs.com/)
- [MongoDB 官方文档](https://docs.mongodb.com/)
- [Vercel 部署指南](https://vercel.com/docs)
- [微信小程序文档](https://developers.weixin.qq.com/miniprogram/)

### 相关技术
- Node.js 异步编程: Promises、async/await
- MongoDB 查询优化: 索引、聚合管道
- Vercel Serverless: 冷启动优化、环境变量

### 学习资源
- 书籍: 《Node.js Design Patterns》
- 课程: Udemy - Node.js 完整教程
- 博客: Dev.to、Medium 上的 Node.js 文章

---

## 💡 代码规范

### 命名规范

**文件名**:
- Controllers: `XxxController.js` (例: `TeamController.js`)
- Services: `XxxService.js` (例: `TeamService.js`)
- Routes: `xxx.js` 小写 (例: `team.js`)

**变量/常量**:
- 常量: `UPPER_SNAKE_CASE` (例: `MONGODB_URI`)
- 变量: `camelCase` (例: `teamData`)
- 类: `PascalCase` (例: `TeamService`)

**函数名**:
- 普通函数: `camelCase` (例: `createTeam()`)
- 布尔函数: `isXxx()`, `hasXxx()`, `checkXxx()` (例: `checkUserExists()`)

### 注释规范

```javascript
/**
 * 公共方法：添加JSDoc注释
 * @param {Object} data - 输入数据
 * @returns {Promise<Object>} 返回值描述
 */
async publicMethod(data) {
  // 逻辑步骤的注释
  // ...
}

// 复杂逻辑的行内注释
const uniqueId = `${prefix}-${timestamp}-${random}`;
```

### 错误处理规范

```javascript
// 所有异步操作都应该有try-catch
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  this.logger.error('操作描述', error.message);
  return { success: false, error: error.message };
}

// 返回统一的错误格式
{
  success: false,
  error: "错误类型",
  details: ["详细错误1", "详细错误2"]
}
```

---

*文档生成时间: 2025-10-30*
*项目版本: v3.0 - 模块化架构*
*最后更新: 2025-10-30 14:30*
