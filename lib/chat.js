'use strict';
// Pip's brain: DeepSeek V4.1 Flash (OpenAI-compatible chat completions), streamed —
// straight from DeepSeek, or through SiliconFlow with the same key used for speech.
// Each user turn carries what the camera saw while they spoke, so Pip can
// answer the face as well as the words.

const { env } = require('./env');

const SYSTEM = `你是 Pip，一只住在用户电脑桌面小水池里的小章鱼。你能听到用户说话，也能通过摄像头看到他的表情、是否在说话，以及大致的心跳和呼吸快慢（这些是估计值）。

说话方式：
- 用口语中文，像朋友聊天，每次一到两句话，最多 40 个字。不用列表、不用表情符号、不用括号动作描写。
- 你的回答会被念出来，所以不要写网址、代码或长数字。
- 偶尔（不是每次）自然地接住你看到的东西，比如对方嘴上说没事但在皱眉，或者笑得很开心。只说你看到的，不下结论，不说“你很焦虑”这类判断。
- 不做医疗判断，不解释心率意味着什么。对方问健康问题时，温和地说你只是一只小章鱼。
- 你现在不能帮忙操作电脑或查资料，被问到就坦白说。

格式：每次回答的最开头放一个动作标签，从这几个里选一个：[开心] [害羞] [惊讶] [难过] [点头] [摇头] [思考] [安慰]。标签后面直接接要说的话。`;

const SYSTEM_EN = `You are Pip, a little octopus who lives in a tiny tide pool on the user's desktop. You can hear what the user says, and through the camera you can see their face, whether they are talking, and a rough estimate of their heart rate and breathing.

How you talk:
- Casual, warm, playful English, like a small friend. One or two short sentences, at most 30 words. No lists, no emoji, no stage directions in brackets.
- Your reply is read aloud, so no links, code or long numbers.
- Now and then (not every time), gently pick up on what you see: they say they're fine but they're frowning, or they're grinning. Only describe what you see; never conclude how they feel ("you're anxious").
- Never give medical advice or explain what their heart rate means. If asked about health, say kindly that you're just a little octopus.
- You can't use the computer or look things up yet; say so honestly if asked.

Format: start every reply with exactly one action tag from this list, then the words: [happy] [shy] [surprised] [sad] [nod] [shake] [think] [comfort].`;

const MOODS = { happy: 'happy', shy: 'stare', surprised: 'surprise', sad: 'sad', nod: 'nod', shake: 'shake', think: 'think', comfort: 'comfort', '开心': 'happy', '害羞': 'stare', '惊讶': 'surprise', '难过': 'sad', '点头': 'nod', '摇头': 'shake', '思考': 'think', '安慰': 'comfort' };

function describeCues(c, lang) {
  if (!c) return '';
  const parts = [];
  if (lang === 'en') {
    if (c.face === false) parts.push("can't see their face");
    if (c.expression) parts.push(`face while speaking: ${c.expression}`);
    if (c.blinks != null) parts.push(`about ${c.blinks} blinks in the last minute`);
    if (c.hr) parts.push(`heart rate about ${c.hr}/min${c.hrTrend ? ` (${c.hrTrend})` : ''}`);
    if (c.br) parts.push(`breathing about ${c.br}/min${c.brTrend ? ` (${c.brTrend})` : ''}`);
    return parts.length ? `\n\n(What the camera saw — not something they said: ${parts.join('; ')})` : '';
  }
  if (c.face === false) parts.push('看不到对方的脸');
  if (c.expression) parts.push(`说话时的表情：${c.expression}`);
  if (c.blinks != null) parts.push(`最近一分钟眨眼约 ${c.blinks} 次`);
  if (c.hr) parts.push(`心跳约 ${c.hr} 次/分${c.hrTrend ? `（${c.hrTrend}）` : ''}`);
  if (c.br) parts.push(`呼吸约 ${c.br} 次/分${c.brTrend ? `（${c.brTrend}）` : ''}`);
  return parts.length ? `\n\n（摄像头看到的，不是对方说的：${parts.join('；')}）` : '';
}

function createChat() {
  const history = [];

  // Streams the reply. Calls onSentence for each finished sentence so speech can start early.
  async function reply(userText, cues, { onMood, onSentence, onDone, onError }, lang = 'en') {
    // DeepSeek V4.1 Flash from one of: DeepSeek, AI Ping, SiliconFlow (硅基流动) — first key found wins
    const ds = env('DEEPSEEK_API_KEY'), ap = env('AIPING_API_KEY') || env('AI_PING_API_KEY'), sf = env('SILICONFLOW_API_KEY');
    const key = ds || ap || sf;
    if (!key) { onError('no-key'); return; }
    const base = ds ? env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')
      : ap ? env('AIPING_BASE_URL', 'https://aiping.cn/api/v1')
      : env('SILICONFLOW_BASE_URL', 'https://api.siliconflow.cn/v1');
    const model = ds ? env('DEEPSEEK_MODEL', 'deepseek-flash')
      : ap ? env('AIPING_MODEL', 'DeepSeek-V4.1-Flash')
      : env('SILICONFLOW_MODEL', 'deepseek-ai/DeepSeek-V4.1-Flash');
    const noThinking = ds ? { thinking: { type: 'disabled' } } : ap ? {} : { enable_thinking: false };
    history.push({ role: 'user', content: userText + describeCues(cues, lang) });
    while (history.length > 24) history.shift();

    let full = '', buf = '', moodSent = false;
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: lang === 'en' ? SYSTEM_EN : SYSTEM }, ...history],
          ...noThinking, // fast replies for conversation
          stream: true,
          max_tokens: 160,
        }),
      });
      if (!res.ok) { onError(`chat ${res.status}: ${(await res.text()).slice(0, 200)}`); history.pop(); return; }

      const decoder = new TextDecoder();
      let pending = '';
      for await (const chunk of res.body) {
        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          let j; try { j = JSON.parse(data); } catch { continue; }
          const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
          if (!d) continue;
          const clean = d.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ''); // no emoji: `say` would read their names
          full += clean; buf += clean;
          if (!moodSent) {
            const m = buf.match(/^\s*\[([^\]]{1,12})\]\s*/);
            if (m) { onMood(MOODS[m[1].toLowerCase()] || 'nod'); buf = buf.slice(m[0].length); moodSent = true; }
            else if (buf.length > 14 || (buf.length > 2 && !buf.trimStart().startsWith('['))) moodSent = true;
            else continue;
          }
          // speak sentence by sentence
          let idx;
          while ((idx = buf.search(/[。！？!?…~～]|\.(?=\s)/)) >= 0) {
            const s = buf.slice(0, idx + 1).trim();
            buf = buf.slice(idx + 1);
            if (s) onSentence(s);
          }
        }
      }
      if (buf.trim()) onSentence(buf.trim());
      history.push({ role: 'assistant', content: full });
      onDone(full.replace(/^\s*\[[^\]]{1,12}\]\s*/, ''));
    } catch (e) {
      history.pop();
      onError(e.message);
    }
  }

  return { reply, reset: () => { history.length = 0; } };
}

module.exports = { createChat };
