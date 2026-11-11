'use strict';
// Speech recognition for one finished utterance, with SiliconFlow (硅基流动) SenseVoiceSmall.
// The renderer cuts your speech at pauses; each piece is uploaded as a small WAV file.
// Docs: https://docs.siliconflow.cn/cn/api-reference/audio/create-audio-transcriptions

const { env } = require('./env');

function wav(pcm16, sampleRate = 16000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm16.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm16.length, 40);
  return Buffer.concat([h, pcm16]);
}

async function transcribe(pcm16) {
  const key = env('SILICONFLOW_API_KEY');
  if (!key) throw new Error('no-key');
  const form = new FormData();
  form.append('file', new Blob([wav(pcm16)], { type: 'audio/wav' }), 'speech.wav');
  form.append('model', env('STT_MODEL', 'FunAudioLLM/SenseVoiceSmall'));
  const res = await fetch(`${env('SILICONFLOW_BASE_URL', 'https://api.siliconflow.cn/v1')}/audio/transcriptions`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form,
  });
  if (!res.ok) throw new Error(`SiliconFlow STT ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  // SenseVoice may add tags like <|zh|><|NEUTRAL|>; keep only the words
  const text = String(j.text || '').replace(/<\|[^|]*\|>/g, '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
  return /[\p{L}\p{N}]/u.test(text) ? text : ''; // noise or music tags only → nothing heard
}

module.exports = { transcribe };
