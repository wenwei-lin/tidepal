'use strict';
// Streaming speech recognition with Alibaba Cloud Model Studio (DashScope) fun-asr-realtime.
// Audio: 16 kHz mono 16-bit PCM, sent as binary WebSocket frames.
// Docs: https://help.aliyun.com/zh/model-studio/fun-asr-realtime-websocket-api

const WebSocket = require('ws');
const { randomUUID } = require('crypto');
const { env } = require('./env');

const DEFAULT_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference';

function createAsr({ onPartial, onFinal, onError, onState }) {
  let ws = null;
  let taskId = null;
  let ready = false;
  let closing = false;
  let retryTimer = null;

  function start() {
    const key = env('DASHSCOPE_API_KEY');
    if (!key) { onState('no-key'); return false; }
    closing = false;
    taskId = randomUUID();
    ws = new WebSocket(env('DASHSCOPE_WS_URL', DEFAULT_URL), { headers: { Authorization: `Bearer ${key}` } });
    ws.on('open', () => {
      ws.send(JSON.stringify({
        header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
        payload: {
          task_group: 'audio', task: 'asr', function: 'recognition',
          model: env('ASR_MODEL', 'fun-asr-realtime'),
          parameters: {
            format: 'pcm', sample_rate: 16000, language_hints: ['zh'],
            max_sentence_silence: 700, // end a sentence after 0.7 s of silence
            heartbeat: true,
          },
          input: {},
        },
      }));
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      let msg; try { msg = JSON.parse(data.toString()); } catch { return; }
      const ev = msg.header && msg.header.event;
      if (ev === 'task-started') { ready = true; onState('listening'); }
      else if (ev === 'result-generated') {
        const s = msg.payload && msg.payload.output && msg.payload.output.sentence;
        if (!s || s.heartbeat) return;
        if (s.sentence_end) { if (s.text && s.text.trim()) onFinal(s.text.trim()); }
        else if (s.text) onPartial(s.text);
      } else if (ev === 'task-failed') {
        onError(`${msg.header.error_code}: ${msg.header.error_message}`);
      }
    });
    ws.on('error', (e) => onError(e.message));
    ws.on('close', () => {
      ready = false;
      if (!closing) { onState('reconnecting'); retryTimer = setTimeout(start, 1500); }
      else onState('stopped');
    });
    return true;
  }

  function send(pcm) {
    if (ready && ws && ws.readyState === WebSocket.OPEN) ws.send(pcm);
  }

  function stop() {
    closing = true;
    clearTimeout(retryTimer);
    if (ws && ws.readyState === WebSocket.OPEN && ready) {
      ws.send(JSON.stringify({ header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' }, payload: { input: {} } }));
      setTimeout(() => { try { ws.close(); } catch {} }, 500);
    } else if (ws) { try { ws.close(); } catch {} }
    ready = false;
  }

  return { start, send, stop };
}

module.exports = { createAsr };
