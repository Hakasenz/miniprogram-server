const { getSessionFromWeChat } = require('../utils/wechat');
const jwt = require('jsonwebtoken');

const JWT_SECRET = '自定义密钥';

exports.login = async (req, res) => {
  const { code, userInfo } = req.body;
  console.log('收到前端请求：', { code, userInfo });

  const wxData = await getSessionFromWeChat(code);
  console.log('微信返回：', wxData);

  if (wxData.errcode) {
    return res.status(400).json({ error: wxData.errmsg });
  }

  const token = jwt.sign({ openid: wxData.openid }, JWT_SECRET, { expiresIn: '7d' });
  console.log('生成的 session_token：', token);

  res.json({ session_token: token });
};
