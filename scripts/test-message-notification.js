/**
 * 消息通知系统测试脚本
 * 
 * 使用方法：
 * node miniprogram-server/scripts/test-message-notification.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000'; // 本地测试时使用
// const BASE_URL = 'https://miniprogram-server.vercel.app'; // 生产环境使用

// 测试数据
const testData = {
  project_id: 'proj-test-123',
  project_name: '测试项目',
  submitter_uuid: 'u-001',
  leader_uuid: 'u-002',
  step_id: 'step-test-456',
  action: '提交申请'
};

async function testMessageSystem() {
  console.log('🧪 开始测试消息通知系统...\n');

  try {
    // 1. 测试获取未读消息数量
    console.log('1️⃣ 测试获取未读消息数量...');
    const unreadRes = await axios.get(`${BASE_URL}/api/message/unread-count`, {
      params: { uuid: testData.leader_uuid }
    });
    console.log('✅ 未读消息数量:', unreadRes.data);
    console.log('');

    // 2. 测试获取消息列表
    console.log('2️⃣ 测试获取消息列表...');
    const listRes = await axios.post(`${BASE_URL}/api/message/list`, {
      uuid: testData.leader_uuid,
      page: 1,
      pageSize: 10
    });
    console.log('✅ 消息列表:', listRes.data);
    console.log('');

    // 3. 如果有消息，测试标记为已读
    if (listRes.data.data?.messages?.length > 0) {
      const messageId = listRes.data.data.messages[0].message_id;
      console.log('3️⃣ 测试标记消息为已读...');
      const markReadRes = await axios.post(`${BASE_URL}/api/message/mark-read`, {
        message_id: messageId,
        uuid: testData.leader_uuid
      });
      console.log('✅ 标记已读结果:', markReadRes.data);
      console.log('');
    }

    // 4. 测试标记所有消息为已读
    console.log('4️⃣ 测试标记所有消息为已读...');
    const markAllRes = await axios.post(`${BASE_URL}/api/message/mark-all-read`, {
      uuid: testData.leader_uuid
    });
    console.log('✅ 标记全部已读结果:', markAllRes.data);
    console.log('');

    // 5. 再次获取未读消息数量（应该为0）
    console.log('5️⃣ 再次获取未读消息数量...');
    const unreadAfterRes = await axios.get(`${BASE_URL}/api/message/unread-count`, {
      params: { uuid: testData.leader_uuid }
    });
    console.log('✅ 未读消息数量（标记后）:', unreadAfterRes.data);
    console.log('');

    console.log('🎉 所有测试通过！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
testMessageSystem();
