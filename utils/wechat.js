const fetch = require('node-fetch');

const APPID = 'wxc4547c5534dafa7b';
const APPSECRET = 'a721a66791e1f9f32c7b5ad0367b70c5';

exports.getSessionFromWeChat = async (code) => {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${APPSECRET}&js_code=${code}&grant_type=authorization_code`;
  const resp = await fetch(url);
  return resp.json();
};
