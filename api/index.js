const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

const app = express();
app.use(bodyParser.json());

const APPID = process.env.APPID;       // 从 Vercel 环境变量读取
const APPSECRET = process.env.APPSECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

app.post('/api/login', async (req, res) => {
  const { code, userInfo } = req.body;
  if (!code) return res.status(400).json({ error: '缺少 code' });

  try {
    const wxResp = await fetch(
      `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${APPSECRET}&js_code=${code}&grant_type=authorization_code`
    );
    const wxData = await wxResp.json();
    if (wxData.errcode) return res.status(400).json({ error: wxData.errmsg });

    const token = jwt.sign({ openid: wxData.openid }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ session_token: token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = app; // 关键：不要 app.listen()
