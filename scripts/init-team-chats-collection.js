/**
 * 团队聊天消息集合初始化脚本
 * 
 * 功能：
 * 1. 创建 team_chats 集合
 * 2. 创建必要的索引以优化查询性能
 * 
 * 使用方法：
 * node scripts/init-team-chats-collection.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'your_mongodb_connection_string';
const DATABASE_NAME = process.env.DATABASE_NAME || 'miniprogram';

async function initTeamChatsCollection() {
  let client;
  
  try {
    console.log('🔌 正在连接 MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ MongoDB 连接成功');
    
    const db = client.db(DATABASE_NAME);
    
    // 1. 检查 team_chats 集合是否存在
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    if (collectionNames.includes('team_chats')) {
      console.log('ℹ️  team_chats 集合已存在');
    } else {
      console.log('📝 创建 team_chats 集合...');
      await db.createCollection('team_chats');
      console.log('✅ team_chats 集合创建成功');
    }
    
    // 2. 创建复合索引：project_id + created_at（用于按项目查询并排序）
    console.log('🔧 创建索引: project_id + created_at...');
    await db.collection('team_chats').createIndex(
      { project_id: 1, created_at: -1 },
      { name: 'idx_project_created' }
    );
    console.log('✅ 索引创建成功');
    
    // 3. 创建索引：sender_uuid（用于查询用户发送的消息）
    console.log('🔧 创建索引: sender_uuid...');
    await db.collection('team_chats').createIndex(
      { sender_uuid: 1 },
      { name: 'idx_sender' }
    );
    console.log('✅ 索引创建成功');
    
    // 4. 创建索引：is_deleted（用于过滤已删除的消息）
    console.log('🔧 创建索引: is_deleted...');
    await db.collection('team_chats').createIndex(
      { is_deleted: 1 },
      { name: 'idx_deleted' }
    );
    console.log('✅ 索引创建成功');
    
    // 5. 显示集合统计信息
    const stats = await db.collection('team_chats').stats();
    console.log('\n📊 team_chats 集合统计信息:');
    console.log(`   - 文档数量: ${stats.count}`);
    console.log(`   - 存储大小: ${(stats.storageSize / 1024).toFixed(2)} KB`);
    console.log(`   - 索引数量: ${stats.nindexes}`);
    console.log(`   - 索引大小: ${(stats.totalIndexSize / 1024).toFixed(2)} KB`);
    
    console.log('\n✅ team_chats 集合初始化完成！');
    
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔒 数据库连接已关闭');
    }
  }
}

// 执行初始化
initTeamChatsCollection();
