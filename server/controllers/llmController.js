const axios = require('axios');

/**
 * 与LLM进行对话，生成SQL查询
 * @param {string} token - LLM API的访问令牌
 * @param {string} url - LLM API的URL地址
 * @param {string} model - 要使用的LLM模型名称
 * @param {Array} messages - 对话消息历史
 * @returns {Promise<Object>} LLM的响应
 */
async function chatWithLLM(token, url, model, messages) {
  try {
    const payload = {
      'model': model,
      'messages': messages
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    
    const response = await axios.post(url, payload, { headers });
    
    if (response.status !== 200) {
      throw new Error(`LLM API 请求失败: ${response.status} ${JSON.stringify(response.data)}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('LLM 对话失败:', error.message);
    throw error;
  }
}

module.exports = {
  chatWithLLM
}; 