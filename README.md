# 微信小程序后端服务 API 文档

## 项目概述

这是一个部署在 Vercel 的微信小程序后端服务，主要提供用户登录验证功能。通过微信小程序的登录凭证（code）换取用户身份信息，并生成 JWT token 用于后续的身份验证。系统使用 MongoDB 存储用户数据。

## 技术栈

- **运行环境**: Node.js
- **框架**: Express.js
- **数据库**: MongoDB
- **部署平台**: Vercel
- **身份验证**: JWT (JSON Web Token)
- **第三方服务**: 微信小程序登录接口

## 环境配置

### 必需的环境变量

在 Vercel 部署时，需要配置以下环境变量：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `APPID` | 微信小程序的 AppID | `wxc4547c5534dafa7b` |
| `APPSECRET` | 微信小程序的 AppSecret | `a721a66791e1f9f32c7b5ad0367b70c5` |
| `JWT_SECRET` | JWT 签名密钥（可选，默认为 'dev_secret'） | `your_jwt_secret_key` |
| `MONGODB_URI` | MongoDB Atlas 连接字符串 | `mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority&appName=AppName` |
| `DATABASE_NAME` | 数据库名称（可选，默认为 'miniprogram'） | `companydb` |

### 获取微信小程序凭证

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入小程序管理后台
3. 在 "开发" -> "开发管理" -> "开发设置" 中获取 AppID 和 AppSecret

### MongoDB Atlas 配置

#### **网络访问设置**
为了让 Vercel 能够访问 MongoDB Atlas，需要配置网络访问：

1. 登录 [MongoDB Atlas](https://www.mongodb.com/atlas)
2. 进入你的项目 (CompanyDB)
3. 点击左侧 "Network Access"
4. 点击 "ADD IP ADDRESS"
5. **选择 "ALLOW ACCESS FROM ANYWHERE" (0.0.0.0/0)**
6. 或者添加 Vercel 的 IP 范围（推荐用 0.0.0.0/0 因为 Vercel IP 会变动）

#### **数据库用户权限**
确保数据库用户 `hakasenz` 有以下权限：
- **读写权限** (readWrite) 到 `companydb` 数据库
- 或者 **数据库管理员** (dbAdmin) 权限

## 数据库设计

### Users 集合结构

用户数据存储在 MongoDB 的 `users` 集合中，数据结构如下：

```json
{
  "_id": "68e163d05c795f26b0c5fff9",
  "uuid": "u-001",
  "username": "张三",
  "gender": "男",
  "position": "前端工程师",
  "wechat_id": "wx123456",
  "wechat_name": "小张",
  "company_id": "652f1a2b3c4d5e6f7a8b9c0d",
  "created_at": "2025-10-05T02:30:00.000Z"
}
```

**字段说明**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `_id` | ObjectId | MongoDB 自动生成的文档ID |
| `uuid` | String | 系统生成的用户唯一标识符 |
| `username` | String | 用户姓名 |
| `gender` | String | 用户性别（"男"/"女"） |
| `position` | String | 职位信息 |
| `wechat_id` | String | 微信 openid |
| `wechat_name` | String | 微信昵称 |
| `company_id` | String | 所属公司ID |
| `created_at` | Date | 用户创建时间 |

## API 接口

### 用户登录

**接口地址**: `POST /api/login`

**功能描述**: 微信小程序用户登录验证，将微信登录凭证转换为应用内的身份认证信息。

**业务流程**:
1. 接收微信小程序的 `code` 和用户信息
2. 调用微信 API 获取用户的 `openid`
3. 根据 `openid` 在 MongoDB 中查询用户是否存在
4. 如果用户不存在，创建新用户记录
5. 生成 JWT token 并返回用户完整信息

#### 请求参数

**Content-Type**: `application/json`

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | String | 是 | 微信小程序 `wx.login()` 获取的临时登录凭证 |
| `nickName` | String | 否 | 用户昵称 |
| `avatarUrl` | String | 否 | 用户头像URL（微信本地文件路径） |

#### 请求示例

```json
{
  "code": "081xXxxx2xxx",
  "avatarUrl": "wxfile://tmp_abc.jpg",
  "nickName": "张三"
}
```

#### 响应参数

**成功响应** (HTTP 200):
```json
{
  "status": "success",
  "message": "登录成功",
  "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "68e163d05c795f26b0c5fff9",
    "uuid": "u-001",
    "username": "张三",
    "gender": "男",
    "position": "前端工程师",
    "wechat_id": "wx123456",
    "wechat_name": "小张",
    "company_id": "652f1a2b3c4d5e6f7a8b9c0d",
    "created_at": "2025-10-05T02:30:00.000Z"
  },
  "isNewUser": false,
  "loginTime": "2025-10-07T12:00:00.000Z"
}
```

**错误响应** (HTTP 400/500):
```json
{
  "error": "错误描述信息"
}
```

#### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `status` | String | 请求状态，成功为 "success" |
| `message` | String | 响应消息 |
| `session_token` | String | JWT 访问令牌，有效期 7 天 |
| `user` | Object | 用户完整信息对象 |
| `user._id` | String | 用户在 MongoDB 中的文档ID |
| `user.uuid` | String | 用户唯一标识符 |
| `user.username` | String | 用户姓名 |
| `user.gender` | String | 用户性别 |
| `user.position` | String | 用户职位 |
| `user.wechat_id` | String | 微信 openid |
| `user.wechat_name` | String | 微信昵称 |
| `user.company_id` | String | 所属公司ID |
| `user.created_at` | String | 用户创建时间 |
| `isNewUser` | Boolean | 是否为新注册用户 |
| `loginTime` | String | 登录时间 (ISO 格式) |

## 业务逻辑说明

### 用户登录流程

1. **微信授权**: 用户在小程序中授权登录，获得临时登录凭证 `code`
2. **服务端验证**: 后端使用 `code` 调用微信接口获取 `openid`
3. **用户查询**: 根据 `openid` 在 `users` 集合中查询用户
4. **用户处理**:
   - **已存在用户**: 更新最后登录时间，返回用户信息
   - **新用户**: 创建新的用户记录，分配 `uuid`，设置默认信息
5. **Token 生成**: 生成包含用户 `uuid` 的 JWT token
6. **响应返回**: 返回用户信息和 token

### 新用户创建规则

当检测到新用户时，系统会自动创建用户记录：
- `uuid`: 系统自动生成（格式：u-001, u-002...）
- `username`: 使用微信昵称或默认值
- `wechat_id`: 微信 openid
- `wechat_name`: 微信昵称
- `gender`: 从微信用户信息获取或默认为空
- `position`: 默认为空，后续可更新
- `company_id`: 默认为空，需要后续分配
- `created_at`: 当前时间

## 客户端调用示例

### 微信小程序调用

```javascript
// 在小程序页面中
Page({
  async handleLogin() {
    try {
      // 1. 获取微信登录凭证
      const loginRes = await wx.login();
      if (!loginRes.code) {
        throw new Error('获取登录凭证失败');
      }

      // 2. 获取用户信息（可选）
      const userInfoRes = await wx.getUserProfile({
        desc: '用于完善会员资料'
      });

      // 3. 调用后端登录接口
      const response = await wx.request({
        url: 'https://your-domain.vercel.app/api/login',
        method: 'POST',
        data: {
          code: loginRes.code,
          nickName: userInfoRes.userInfo.nickName,
          avatarUrl: userInfoRes.userInfo.avatarUrl
        }
      });

      console.log('登录成功:', response.data);
      
      // 4. 保存认证信息
      wx.setStorageSync('session_token', response.data.session_token);
      wx.setStorageSync('userInfo', response.data);

    } catch (error) {
      console.error('登录失败:', error);
      wx.showToast({
        title: '登录失败',
        icon: 'error'
      });
    }
  }
});
```

### Web 端调用 (JavaScript)

```javascript
async function loginToMiniProgram(code, userInfo) {
  try {
    const response = await fetch('https://your-domain.vercel.app/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: code,
        userInfo: userInfo
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      localStorage.setItem('session_token', data.session_token);
      console.log('登录成功:', data);
      return data;
    } else {
      throw new Error(data.error || '登录失败');
    }
  } catch (error) {
    console.error('登录错误:', error);
    throw error;
  }
}
```

### cURL 命令行测试

```bash
curl -X POST https://your-domain.vercel.app/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "code": "081xXxxx2xxx",
    "userInfo": {
      "nickName": "测试用户",
      "avatarUrl": "https://example.com/avatar.jpg",
      "gender": 1
    }
  }'
```

## 部署说明

### Vercel 部署

#### **1. 配置文件**
项目包含 `vercel.json` 配置文件，所有请求都路由到 `api/index.js`

#### **2. 环境变量配置**
在 Vercel 项目设置中配置以下环境变量：

| 变量名 | 值 | 说明 |
|--------|---|------|
| `APPID` | `wxc4547c5534dafa7b` | 微信小程序 AppID |
| `APPSECRET` | `a721a66791e1f9f32c7b5ad0367b70c5` | 微信小程序 AppSecret |
| `JWT_SECRET` | `your_production_jwt_secret` | 生产环境 JWT 密钥 |
| `MONGODB_URI` | `mongodb+srv://hakasenz:密码@companydb.pfw2hab.mongodb.net/?retryWrites=true&w=majority&appName=CompanyDB` | MongoDB Atlas 连接字符串 |
| `DATABASE_NAME` | `companydb` | 数据库名称 |

#### **3. 部署步骤**
```bash
# 方式1：使用 Vercel CLI
npm i -g vercel
vercel --prod

# 方式2：GitHub 自动部署
# 推送代码到 GitHub，在 Vercel 控制台连接仓库即可自动部署
```

#### **4. 重要注意事项**
- ❗ **不要** 在代码中硬编码敏感信息
- ❗ Vercel 会自动安装 `package.json` 中的依赖
- ❗ `.env` 文件不会上传到 Vercel（被 .gitignore 忽略）
- ✅ 所有配置通过 Vercel 环境变量管理

#### **5. 部署前检查清单**

**代码准备**:
- [ ] `package.json` 包含所有必需依赖
- [ ] `vercel.json` 配置正确
- [ ] 代码中没有硬编码的敏感信息
- [ ] `.gitignore` 包含 `.env` 和 `node_modules/`

**MongoDB Atlas 准备**:
- [ ] 网络访问允许 "0.0.0.0/0" (所有 IP)
- [ ] 数据库用户 `hakasenz` 有 `companydb` 读写权限
- [ ] 连接字符串测试通过

**Vercel 环境变量**:
- [ ] `APPID` - 微信小程序 AppID
- [ ] `APPSECRET` - 微信小程序 AppSecret
- [ ] `JWT_SECRET` - JWT 签名密钥
- [ ] `MONGODB_URI` - MongoDB Atlas 完整连接字符串
- [ ] `DATABASE_NAME` - `companydb`

### 本地开发

1. **安装依赖**:
   ```bash
   npm install
   ```

2. **设置环境变量**:
   创建 `.env` 文件并填入：
   ```
   APPID=your_wechat_appid
   APPSECRET=your_wechat_appsecret
   JWT_SECRET=your_jwt_secret
   MONGODB_URI=mongodb://localhost:27017/miniprogram
   ```

3. **启动开发服务器**:
   ```bash
   node server.js
   ```
   服务将在 `http://localhost:3000` 启动

## 错误代码说明

| HTTP 状态码 | 错误类型 | 说明 |
|-------------|----------|------|
| 400 | Bad Request | 请求参数错误（如缺少 code） |
| 400 | WeChat API Error | 微信接口返回错误 |
| 500 | Internal Server Error | 服务器内部错误 |

常见错误信息：
- `缺少 code`: 请求中未提供微信登录凭证
- `invalid code`: 微信登录凭证无效或已过期
- `服务器错误`: 后端服务异常

## 安全说明

1. **HTTPS**: 生产环境必须使用 HTTPS 协议
2. **密钥管理**: AppSecret 和 JWT_SECRET 应妥善保管，不要提交到代码仓库
3. **Token 有效期**: JWT token 默认 7 天有效期，建议根据业务需求调整
4. **环境隔离**: 开发、测试、生产环境应使用不同的微信小程序配置

## 项目结构

```
miniprogram-server/
├── api/
│   └── index.js          # Vercel 部署入口文件
├── controllers/
│   └── authController.js # 认证控制器（本地开发用）
├── routes/
│   └── auth.js          # 路由定义（本地开发用）
├── utils/
│   └── wechat.js        # 微信接口工具（本地开发用）
├── server.js            # 本地开发服务器
├── package.json         # 项目依赖
├── vercel.json          # Vercel 部署配置
└── README.md           # 项目文档
```

## 版本信息

- **当前版本**: 1.0.0
- **Node.js**: >= 14.0.0
- **更新日期**: 2025年10月7日

## 联系方式

如有问题或建议，请通过以下方式联系：
- 项目仓库: [GitHub 链接]
- 邮箱: [联系邮箱]

---

*本文档最后更新时间: 2025年10月7日*