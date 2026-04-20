const { MongoClient, ObjectId } = require('mongodb');

class NoticeService {
  constructor() {
    this.db = null;
    this.client = null;
  }

  // 初始化数据库连接
  async initDatabase() {
    if (this.db) return;
    
    try {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
      const dbName = process.env.DATABASE_NAME || 'miniprogram';
      
      this.client = new MongoClient(uri);
      await this.client.connect();
      this.db = this.client.db(dbName);
      
      console.log('✅ 通知服务数据库连接成功');
    } catch (error) {
      console.error('❌ 数据库连接失败:', error);
      throw error;
    }
  }

  // 获取通知列表（根据权限过滤）
  async getNotices(userUuid, page = 1, limit = 10) {
    await this.initDatabase();
    
    try {
      // 获取用户信息以确定权限
      const user = await this.db.collection('users').findOne({ uuid: userUuid });
      
      if (!user) {
        throw new Error('用户不存在');
      }
      
      // 构建查询条件（根据权限）
      let filter = {};
      
      // 管理员可以看到所有通知
      if (user.system_roles?.includes('admin')) {
        filter = {};
      } 
      // 管理层(p7及以上)可以看到面向全公司或特定角色的通知
      else if (user.rank >= 7) {
        filter = {
          $or: [
            { targetRoles: { $size: 0 } },  // 面向全公司的通知
            { targetRoles: { $in: ['manager', 'admin'] } }  // 面向管理层的通知
          ]
        };
      } 
      // 普通员工只能看到面向全公司的通知
      else {
        filter = {
          $or: [
            { targetRoles: { $size: 0 } },  // 面向全公司的通知
            { targetRoles: 'employee' }     // 面向员工的通知
          ]
        };
      }
      
      // 计算分页
      const skip = (page - 1) * limit;
      
      // 查询总数
      const total = await this.db.collection('notices').countDocuments(filter);
      
      // 查询通知列表（按创建时间倒序）
      const notices = await this.db.collection('notices')
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      // 格式化返回数据
      const formattedNotices = notices.map(notice => ({
        _id: notice._id,
        title: notice.title,
        content: notice.content,
        type: notice.type,
        author: notice.author,
        targetRoles: notice.targetRoles,
        created_at: this.formatDate(notice.created_at)
      }));
      
      const result = {
        notices: formattedNotices,
        total,
        page,
        limit,
        hasMore: skip + formattedNotices.length < total
      };
      
      console.log(`✅ 获取到 ${formattedNotices.length} 条通知`);
      return result;
      
    } catch (error) {
      console.error('❌ 获取通知列表失败:', error);
      throw error;
    }
  }

  // 创建通知
  async createNotice({ title, content, type, authorUuid, targetRoles }) {
    await this.initDatabase();
    
    try {
      // 获取作者信息
      const author = await this.db.collection('users').findOne({ uuid: authorUuid });
      
      if (!author) {
        throw new Error('作者不存在');
      }
      
      // 检查权限（只有p7以上可以创建通知）
      if (author.rank < 7 && !author.system_roles?.includes('admin')) {
        throw new Error('权限不足，无法创建通知');
      }
      
      // 创建通知对象
      const notice = {
        title,
        content,
        type: type || 'general',
        author: author.username || author.wechat_name,
        authorUuid,
        targetRoles: targetRoles || [],
        created_at: new Date()
      };
      
      // 插入数据库
      const result = await this.db.collection('notices').insertOne(notice);
      
      console.log('✅ 通知创建成功');
      return {
        _id: result.insertedId,
        ...notice
      };
      
    } catch (error) {
      console.error('❌ 创建通知失败:', error);
      throw error;
    }
  }

  // 格式化日期
  formatDate(date) {
    if (!date) return '';
    
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
}

module.exports = NoticeService;