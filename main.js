// Tidepal main process: Pip, a small desktop pet you can talk to.
// The camera (SmartSpectra) sees your face, breathing and heartbeat;
// speech goes through fun-asr-realtime, replies come from DeepSeek, and
// macOS speaks them.
'use strict';

const path = require('path');
const { app, BrowserWindow, session, ipcMain, screen } = require('electron');
const { bindSmartSpectraIpc } = require('@smartspectra/node-sdk/main');
const { env } = require('./lib/env');
const { createAsr } = require('./lib/asr');
const { createChat } = require('./lib/chat');
const { createTts } = require('./lib/tts');
const { transcribe } = require('./lib/stt');

const SIZE = { width: 340, height: 580 };

let win;
const send = (ch, ...a) => { if (win && !win.isDestroyed()) win.webContents.send(ch, ...a); };

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    ...SIZE,
    x: workArea.x + workArea.width - SIZE.width - 24,
    y: workArea.y + workArea.height - SIZE.height - 24,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false, // our preload requires the SDK's preload bridge
      nodeIntegration: false,
      backgroundThrottling: false, // keep reading camera and mic when the window is not focused
    },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true);
  bindSmartSpectraIpc(win);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('console-message', (e, _level, message) => {
    const m = (e && e.message) || message;
    if (typeof m === 'string' && m.startsWith('[tidepal]')) console.log(m);
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  if (process.env.TIDEPAL_DEVTOOLS === '1') win.webContents.openDevTools({ mode: 'detach' });
}

// ---- speech in ----
const asr = createAsr({
  onPartial: (t) => send('asr:partial', t),
  onFinal: (t) => { console.log('[tidepal] you:', t); send('asr:final', t); },
  onError: (e) => { console.log('[tidepal] asr error', e); send('asr:state', 'error', e); },
  onState: (s) => { console.log('[tidepal] asr', s); send('asr:state', s); },
});
// Streaming (Alibaba fun-asr-realtime) when its key is set; otherwise the
// renderer cuts speech at pauses and each piece goes to SiliconFlow SenseVoice.
ipcMain.handle('asr:mode', () => (env('DASHSCOPE_API_KEY') ? 'stream' : env('SILICONFLOW_API_KEY') ? 'chunks' : 'none'));
ipcMain.on('asr:start', () => asr.start());
ipcMain.on('stt:utterance', async (_e, buf) => {
  try {
    const text = await transcribe(Buffer.from(buf));
    console.log('[tidepal] you:', text);
    send(text ? 'asr:final' : 'asr:state', text || 'empty');
  } catch (e) { console.log('[tidepal] stt error', e.message); send('asr:state', 'error', e.message); }
});
ipcMain.on('asr:stop', () => asr.stop());
ipcMain.on('asr:audio', (_e, buf) => asr.send(Buffer.from(buf)));

// ---- thinking + speech out ----
const tts = createTts({
  onStart: (t) => send('tts:start', t),
  onEnd: (last) => { if (last) send('tts:end'); },
});
const chat = createChat();
ipcMain.on('chat:say', (_e, text, cues, lang) => {
  tts.stop();
  console.log('[tidepal] cues', JSON.stringify(cues));
  chat.reply(text, cues, {
    onMood: (m) => send('chat:mood', m),
    onSentence: (s) => { send('chat:sentence', s); tts.speak(s, lang); },
    onDone: (full) => { console.log('[tidepal] pip:', full); send('chat:done', full); },
    onError: (e) => { console.log('[tidepal] chat error', e); send('chat:error', e); },
  }, lang);
});
ipcMain.on('tts:stop', () => tts.stop());

ipcMain.handle('tidepal:apiKey', () => env('PRESAGE_API_KEY'));
ipcMain.handle('tidepal:keys', () => ({
  presage: !!env('PRESAGE_API_KEY'),
  chat: !!(env('DEEPSEEK_API_KEY') || env('AIPING_API_KEY') || env('AI_PING_API_KEY') || env('SILICONFLOW_API_KEY')),
  ears: !!(env('DASHSCOPE_API_KEY') || env('SILICONFLOW_API_KEY')),
}));
ipcMain.on('tidepal:quit', () => app.quit());
// Recording mode: a bigger window for screen recordings, kept in the same corner.
const SIZES = { normal: SIZE, rec: { width: 440, height: 760 } };
ipcMain.on('win:mode', (_e, mode) => {
  if (!win || !SIZES[mode]) return;
  const b = win.getBounds(), s = SIZES[mode];
  win.setResizable(true);
  win.setBounds({ x: b.x + b.width - s.width, y: Math.max(0, b.y + b.height - s.height), ...s });
  win.setResizable(false);
});

app.whenReady().then(() => {
  // Camera and microphone, only for our own local page.
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const url = (details && details.requestingUrl) || (wc && wc.getURL()) || '';
    callback(permission === 'media' && url.startsWith('file://'));
  });
  createWindow();
});

app.on('window-all-closed', () => { asr.stop(); tts.stop(); app.quit(); });
