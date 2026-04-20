/**
 * 初始化 notices 集合
 * 用于存储公司通知数据
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function initNoticesCollection() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.DATABASE_NAME || 'miniprogram';
  
  console.log('============================================================');
  console.log('🔍 初始化 notices 集合');
  console.log('============================================================');
  console.log(`📋 MONGODB_URI: ${uri.substring(0, 20)}...`);
  console.log(`📋 DATABASE_NAME: ${dbName}`);
  console.log('');

  let client;
  
  try {
    console.log('🔗 正在连接到 MongoDB...');
    client = new MongoClient(uri);
    await client.connect();
    console.log('✅ MongoDB 连接成功！');
    
    const db = client.db(dbName);
    
    // 检查 notices 集合是否存在
    const collections = await db.listCollections().toArray();
    const hasNoticesCollection = collections.some(c => c.name === 'notices');
    
    if (hasNoticesCollection) {
      console.log('⚠️  notices 集合已存在');
      
      // 显示现有数据量
      const count = await db.collection('notices').countDocuments();
      console.log(`📊 当前通知数量: ${count}`);
      
      if (count > 0) {
        console.log('ℹ️  跳过初始化，保留现有数据');
        return;
      }
    } else {
      console.log('🆕 创建 notices 集合...');
      await db.createCollection('notices');
      console.log('✅ notices 集合创建成功');
    }
    
    // 创建索引
    console.log('🔧 创建索引...');
    await db.collection('notices').createIndex({ created_at: -1 });
    await db.collection('notices').createIndex({ targetRoles: 1 });
    console.log('✅ 索引创建成功');
    
    // 插入示例数据（可选）
    const sampleNotices = [
      {
        title: '欢迎使用公司通知系统',
        content: '这是第一条系统通知。管理层可以推送重要通知给全体员工或特定角色。',
        type: 'system',
        author: '系统管理员',
        authorUuid: 'system',
        targetRoles: [],  // 空数组表示面向全公司
        created_at: new Date()
      },
      {
        title: '重要提醒',
        content: '请所有员工及时更新个人信息，确保联系方式准确无误。',
        type: 'important',
        author: '人力资源部',
        authorUuid: 'system',
        targetRoles: ['employee'],
        created_at: new Date(Date.now() - 86400000)  // 1天前
      }
    ];
    
    console.log('📝 插入示例数据...');
    const result = await db.collection('notices').insertMany(sampleNotices);
    console.log(`✅ 成功插入 ${result.insertedCount} 条示例通知`);
    
    console.log('');
    console.log('============================================================');
    console.log('✅ notices 集合初始化完成！');
    console.log('============================================================');
    
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    console.error('错误详情:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔒 数据库连接已关闭');
    }
  }
}

// 执行初始化
if (require.main === module) {
  initNoticesCollection()
    .then(() => {
      console.log('✨ 初始化脚本执行完毕');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 初始化脚本执行失败');
      process.exit(1);
    });
}

module.exports = initNoticesCollection;
