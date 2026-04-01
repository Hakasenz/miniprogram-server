/**
 * 批量为现有项目生成邀请码迁移脚本
 * 使用方法：node scripts/migrate-add-invite-codes.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.DATABASE_NAME || 'miniprogram';

// 邀请码生成函数
function generateInviteCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function migrateAddInviteCodes() {
  console.log('🚀 开始执行邀请码迁移脚本...');
  
  if (!MONGODB_URI) {
    console.error('❌ 错误：缺少 MONGODB_URI 环境变量');
    console.log('请在 .env 文件中配置 MONGODB_URI');
    process.exit(1);
  }

  let client;
  
  try {
    // 连接数据库
    console.log('📡 正在连接到 MongoDB Atlas...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ MongoDB 连接成功');
    
    const db = client.db(DATABASE_NAME);
    const projectsCollection = db.collection('projects');
    
    // 查询所有没有邀请码的项目
    console.log('🔍 查找需要更新的项目...');
    const projectsWithoutInvite = await projectsCollection.find({
      invite_code: { $exists: false }
    }).toArray();
    
    const totalCount = projectsWithoutInvite.length;
    console.log(`📊 找到 ${totalCount} 个项目需要添加邀请码`);
    
    if (totalCount === 0) {
      console.log('✨ 所有项目已有邀请码，无需迁移');
      return;
    }
    
    // 批量更新
    let successCount = 0;
    let failCount = 0;
    const existingCodes = new Set();
    
    console.log('⚙️ 开始批量生成并更新邀请码...');
    
    for (const project of projectsWithoutInvite) {
      try {
        // 生成唯一邀请码
        let inviteCode;
        let attempts = 0;
        do {
          inviteCode = generateInviteCode();
          attempts++;
          if (attempts > 10) {
            throw new Error('无法生成唯一邀请码');
          }
        } while (existingCodes.has(inviteCode));
        
        existingCodes.add(inviteCode);
        
        // 更新文档
        const result = await projectsCollection.updateOne(
          { _id: project._id },
          { $set: { invite_code: inviteCode } }
        );
        
        if (result.modifiedCount > 0) {
          successCount++;
          console.log(`  ✅ [${successCount}/${totalCount}] ${project.name} -> ${inviteCode}`);
        } else {
          failCount++;
          console.log(`  ⚠️  [${failCount}/${totalCount}] ${project.name} 更新失败`);
        }
        
      } catch (error) {
        failCount++;
        console.error(`  ❌ 项目 "${project.name}" 更新失败:`, error.message);
      }
    }
    
    // 输出统计
    console.log('\n' + '='.repeat(50));
    console.log('📊 迁移完成统计:');
    console.log(`  ✅ 成功：${successCount} 个项目`);
    console.log(`  ❌ 失败：${failCount} 个项目`);
    console.log(`  📈 成功率：${((successCount / totalCount) * 100).toFixed(2)}%`);
    console.log('='.repeat(50));
    
    if (failCount === 0) {
      console.log('🎉 迁移任务全部完成！');
    } else {
      console.log('⚠️  部分项目更新失败，请检查日志');
    }
    
  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('👋 MongoDB 连接已关闭');
    }
  }
}

// 执行迁移
migrateAddInviteCodes();
