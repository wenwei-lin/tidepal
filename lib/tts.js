'use strict';
// Pip's voice: macOS built-in speech (`say`), local and free.
// Sentences are queued so Pip can start talking before the whole reply arrives.

const { spawn } = require('child_process');
const { env } = require('./env');

function createTts({ onStart, onEnd }) {
  const queue = [];
  let proc = null;

  function next() {
    if (proc || !queue.length) return;
    const { text, lang } = queue.shift();
    if (process.platform !== 'darwin') { onStart(text); setTimeout(() => { onEnd(); next(); }, 120 * text.length); return; }
    onStart(text);
    const voice = lang === 'en' ? env('TTS_VOICE_EN', 'Samantha') : env('TTS_VOICE', 'Tingting');
    proc = spawn('say', ['-v', voice, '-r', env('TTS_RATE', lang === 'en' ? '185' : '200'), text]);
    proc.on('exit', () => { proc = null; if (!queue.length) onEnd(true); next(); });
    proc.on('error', () => { proc = null; onEnd(true); });
  }

  return {
    speak(text, lang = 'en') { queue.push({ text, lang }); next(); },
    stop() { queue.length = 0; if (proc) { proc.kill(); proc = null; } },
    get busy() { return !!proc || queue.length > 0; },
  };
}

module.exports = { createTts };
