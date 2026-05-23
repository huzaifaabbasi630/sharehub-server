const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

const PUTER_TOKEN = process.env.PUTER_AUTH_TOKEN || '';

/**
 * Common function to prompt Puter AI (claude-3-5-sonnet)
 */
async function promptPuter(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: prompt }],
    });

    const options = {
      hostname: 'api.puter.com',
      path: '/ai/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PUTER_TOKEN}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // Puter returns choices[0].message.content
          const content =
            parsed?.choices?.[0]?.message?.content ||
            parsed?.message?.content ||
            parsed?.content ||
            null;
          resolve(content);
        } catch (e) {
          console.error('Puter AI parse error:', e.message, data);
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      console.error('Puter AI request error:', e.message);
      resolve(null);
    });

    req.write(body);
    req.end();
  });
}

/**
 * AI Smart Reply
 */
async function generateSmartReplies(lastMessage) {
  const prompt = `Based on this message: "${lastMessage}", generate 3 short, helpful, and friendly suggested replies (1-5 words each). Return only the suggestions as a JSON array of strings. Example: ["Yes, sure!", "Let me check.", "I'm busy now."]`;
  const response = await promptPuter(prompt);
  try {
    const match = response && response.match(/\[.*\]/s);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(response);
  } catch (e) {
    console.error('Failed to parse smart replies:', response);
    return ['Okay', 'Thanks', 'Got it'];
  }
}

/**
 * AI Chat Summarizer
 */
async function summarizeChat(messages) {
  const chatContext = messages.map(m => `${m.sender}: ${m.content}`).join('\n');
  const prompt = `Summarize the following chat conversation in 2-3 bullet points, highlighting the main topics and any pending actions:\n\n${chatContext}`;
  return await promptPuter(prompt);
}

/**
 * AI Message Improver
 */
async function improveMessage(text) {
  const prompt = `Rewrite the following message to be more professional, grammatically correct, and clear, while keeping the original intent. Only return the improved text:\n\n"${text}"`;
  return await promptPuter(prompt);
}

/**
 * AI Translator
 */
async function translateMessage(text, targetLang) {
  const prompt = `Translate the following text to ${targetLang}. Only return the translated text:\n\n"${text}"`;
  return await promptPuter(prompt);
}

/**
 * AI Chat Assistant Response
 */
async function getAssistantResponse(query, chatHistory = []) {
  try {
    const historyText = chatHistory
      .slice(-10)
      .map(m => {
        const role = (m.senderName === 'AI Work Assistant' || m.senderId === 'ai-assistant') ? 'Assistant' : 'User';
        return `${role}: ${m.content}`;
      })
      .join('\n');

    const prompt = historyText
      ? `You are a helpful AI Work Assistant in a team chat room. Here is the recent conversation:\n${historyText}\n\nUser: ${query}\nAssistant:`
      : `You are a helpful AI Work Assistant in a team chat room. Answer the following question concisely and helpfully:\n\n${query}`;

    const result = await promptPuter(prompt);
    return result || "I'm having trouble connecting right now. Please try again later.";
  } catch (error) {
    console.error('Assistant Error:', error);
    return "I'm having trouble connecting to my brain right now. Please try again later.";
  }
}

/**
 * AI Image Generator Command Parser
 * Using pollinations.ai for realistic AI image generation simulation
 */
async function generateImagePrompt(prompt) {
  const keywords = prompt.replace('/image', '').trim() || 'creative abstract art';
  const seed = Math.floor(Math.random() * 1000000);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(keywords)}?seed=${seed}&width=1024&height=1024&nologo=true`;
}

module.exports = {
  generateSmartReplies,
  summarizeChat,
  improveMessage,
  translateMessage,
  getAssistantResponse,
  generateImagePrompt,
};
