'use strict';
// SmartSpectra's bridge (exposes window.__smartspectraBridge) plus a small bridge of our own.
require('@smartspectra/node-sdk/preload');
const { contextBridge, ipcRenderer } = require('electron');

const on = (ch, fn) => ipcRenderer.on(ch, (_e, ...a) => fn(...a));

contextBridge.exposeInMainWorld('tidepal', {
  getApiKey: () => ipcRenderer.invoke('tidepal:apiKey'),
  keys: () => ipcRenderer.invoke('tidepal:keys'),
  quit: () => ipcRenderer.send('tidepal:quit'),
  setWinMode: (m) => ipcRenderer.send('win:mode', m),
  // speech recognition
  asrMode: () => ipcRenderer.invoke('asr:mode'),
  asrStart: () => ipcRenderer.send('asr:start'),
  utterance: (buf) => ipcRenderer.send('stt:utterance', buf),
  asrStop: () => ipcRenderer.send('asr:stop'),
  asrAudio: (buf) => ipcRenderer.send('asr:audio', buf),
  onPartial: (fn) => on('asr:partial', fn),
  onFinal: (fn) => on('asr:final', fn),
  onAsrState: (fn) => on('asr:state', fn),
  // conversation
  say: (text, cues, lang) => ipcRenderer.send('chat:say', text, cues, lang),
  stopTalking: () => ipcRenderer.send('tts:stop'),
  onMood: (fn) => on('chat:mood', fn),
  onSentence: (fn) => on('chat:sentence', fn),
  onDone: (fn) => on('chat:done', fn),
  onChatError: (fn) => on('chat:error', fn),
  onTtsStart: (fn) => on('tts:start', fn),
  onTtsEnd: (fn) => on('tts:end', fn),
});
