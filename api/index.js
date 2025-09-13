const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

const app = express();
app.use(bodyParser.json());

const APPID = process.env.APPID;
const APPSECRET = process.env.APPSECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

// 登录接口
app.post('/api/login', async (req, res) => {
  console.log('=== [LOGIN API] 收到请求 ===');
  console.log('请求体:', req.body);

  const { code, userInfo } = req.body;
  if (!code) {
    console.warn('[LOGIN API] 缺少 code');
    return res.status(400).json({ error: '缺少 code' });
  }

  try {
    console.log('[LOGIN API] 调用微信 jscode2session...');
    const wxResp = await fetch(
      `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${APPSECRET}&js_code=${code}&grant_type=authorization_code`
    );
    const wxData = await wxResp.json();
    console.log('[LOGIN API] 微信返回:', wxData);

    if (wxData.errcode) {
      console.error('[LOGIN API] 微信接口错误:', wxData.errmsg);
      return res.status(400).json({ error: wxData.errmsg });
    }

    // 生成 token
    const token = jwt.sign({ openid: wxData.openid }, JWT_SECRET, { expiresIn: '7d' });
    console.log('[LOGIN API] 生成 session_token:', token);

    // 模拟业务数据（可替换为数据库查询）
    const extraInfo = {
      userId: 'U' + wxData.openid.slice(0, 6),
      role: 'member',
      points: 120,
      level: 'VIP 2',
      loginTime: new Date().toISOString()
    };
    console.log('[LOGIN API] 返回的额外信息:', extraInfo);

    // 返回给前端
    res.json({
      status: 'success',
      message: '登录成功',
      session_token: token,
      ...extraInfo
    });

    console.log('=== [LOGIN API] 请求处理完成 ===');
  } catch (err) {
    console.error('[LOGIN API] 服务器异常:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = app;
