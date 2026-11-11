'use strict';

// Pip: a desktop pet you can talk to.
// Ears: fun-asr-realtime (via main). Brain: DeepSeek (via main). Voice: macOS say.
// Eyes: SmartSpectra — your face, blinks, talking, heartbeat and breathing.

const { drawPip } = require('./pet');
const signals = require('./signals');
const { state } = signals;

// ---------- words ----------
const T = {
  zh: {
    consentTitle: '嗨，我是 Pip',
    consentBody: '我是一只住在你桌面上的小章鱼，可以陪你聊天。我会用麦克风听你说话，用摄像头看你的表情、呼吸和心跳，好知道你说话时的样子。画面只在这台电脑上处理，不录像、不保存。你说的话会转成文字，和我看到的表情、心跳一起发给对话模型。',
    allow: '好呀', demo: '先只看看',
    listening: '我在听～', thinking: '想一想……', noMic: '听不到你，打字跟我说吧',
    typeHere: '打字跟 Pip 说……',
    noKeys: (k) => `还缺 ${k}，先打字聊吧`,
    hello: '嗨！想聊点什么？',
    fix: { 1: '我找不到你的脸～', 2: '画面里有好几个人。', 3: '往画面中间挪一挪？', 5: '有点暗，我看不清你。', 6: '太亮啦。', 13: '离我近了点。', 14: '离我太远啦。', 15: '你在画面太上面了。', 16: '你在画面太下面了。', 17: '看向屏幕这边～' },
    exp: { happy: '在笑', sad: '有点难过的样子', surprise: '有点惊讶', angry: '皱着眉', neutral: '表情平静' },
    trendUp: '比刚才快', trendDown: '比刚才慢',
    r: { happy: ['嘿嘿～', '你笑啦！'], surprise: ['哇！', '咦？！'], sad: ['抱抱？', '怎么啦？'], angry: ['哎呀，皱眉了……', '别生气嘛～'], stare: ['盯着我干嘛……'], nod: ['嗯！'], shake: ['不要吗？'] },
  },
  en: {
    consentTitle: "Hi, I'm Pip",
    consentBody: "I'm a little octopus who lives on your desktop. I listen through the microphone and look through the camera at your face, breathing and heartbeat, so I know how you look while you talk. Video stays on this computer and is never recorded. What you say is turned into text and sent to the chat model together with what I see.",
    allow: 'Sure', demo: 'Just looking',
    listening: "I'm listening~", thinking: 'Hmm…', noMic: "Can't hear you — type to me",
    typeHere: 'Type to Pip…',
    noKeys: (k) => `Missing ${k} — type for now`,
    hello: 'Hi! What shall we talk about?',
    fix: { 1: "I can't find your face~", 2: 'I see more than one face.', 3: 'Move a little toward the middle?', 5: "It's a bit dark.", 6: "It's too bright.", 13: "You're a bit close.", 14: "You're too far away.", 15: "You're too high in the picture.", 16: "You're too low in the picture.", 17: 'Look this way~' },
    exp: { happy: 'smiling', sad: 'looking a bit sad', surprise: 'looking surprised', angry: 'frowning', neutral: 'calm face' },
    trendUp: 'faster than earlier', trendDown: 'slower than earlier',
    r: { happy: ['Hehe~', 'You smiled!', 'That smile!'], surprise: ['Whoa!', 'What?!'], sad: ['Aww, hug?', 'You okay?'], angry: ['Uh-oh, frowny face…', 'Easy there~'], stare: ['Why are you staring…', 'Is there something on my face?'], nod: ['Yes!'], shake: ['No?'] },
  },
};
let lang = (() => { try { return localStorage.getItem('pip-lang'); } catch { return null; } })() || 'en';
const t = (k, ...a) => (typeof T[lang][k] === 'function' ? T[lang][k](...a) : T[lang][k]);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const lerp = (a, b, k) => a + (b - a) * k;

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const ctx = canvas.getContext('2d');
const host = window.tidepal || null;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);
resize();

// ---------- conversation state ----------
let convo = 'idle'; // idle | listening | thinking | speaking
let micLevel = 0;
let micOn = false;
let micStatus = 'off';
const bubble = $('bubble');
const heard = $('heard');
let bubbleTimer = null;

function setConvo(s) { convo = s; document.body.dataset.convo = s; }
function showBubble(text, ms = 0) {
  bubble.textContent = text;
  bubble.hidden = !text;
  clearTimeout(bubbleTimer);
  if (ms) bubbleTimer = setTimeout(() => { bubble.hidden = true; }, ms);
}

// ---------- Pip's look and reactions ----------
const look = { breath: 0.5, gazeX: 0, gazeY: 0, blink: 0, happy: 0, surprise: 0, sleepy: 0, stretch: 0, glow: 0, wobble: 0 };
const anim = { hop: 0, tilt: 0, mouth: 0, sad: 0, cross: 0, shy: 0, wave: 0 };
const fx = [];
let act = null;
let blinkAnim = 0;

function play(kind, ms = 1000, marks = null) {
  const now = performance.now();
  act = { kind, start: now, until: now + ms };
  if (marks) for (let i = 0; i < marks.n; i++) fx.push({ ch: marks.ch, born: now + i * 120, dx: (Math.random() - 0.5) * 80 });
}
signals.onBlink(() => { setTimeout(() => { blinkAnim = 0.22; }, 180); }); // Pip blinks back

const cool = {};
let prevHappy = 0, prevSurprise = 0, lastGestureAt = 0, stareFor = 0, sadFor = 0, angryFor = 0;
function freeReactions(now, dt) {
  const tryReact = (kind, ms, coolMs, marks, say) => {
    if (cool[kind] && now < cool[kind]) return;
    cool[kind] = now + coolMs;
    play(kind, ms, marks);
    if (say && convo === 'idle' && bubble.hidden) showBubble(pick(T[lang].r[kind]), 1800);
  };
  if (convo === 'speaking' || convo === 'thinking') return;
  if (state.happy > 0.5 && prevHappy <= 0.5) tryReact('happy', 900, 2500, { ch: '♥', n: 3 }, true);
  if (state.surprise > 0.45 && prevSurprise <= 0.45) tryReact('surprise', 700, 2500, { ch: '!', n: 1 }, true);
  prevHappy = state.happy; prevSurprise = state.surprise;
  sadFor = state.sad > 0.4 ? sadFor + dt : 0;
  angryFor = state.angry > 0.4 ? angryFor + dt : 0;
  if (sadFor > 1.2) { tryReact('sad', 2200, 8000, null, true); sadFor = 0; }
  if (angryFor > 1.2) { tryReact('angry', 2000, 8000, null, true); angryFor = 0; }
  if (state.gesture && state.gesture.at !== lastGestureAt) { lastGestureAt = state.gesture.at; tryReact(state.gesture.kind, 1000, 1500, null, true); }
  const centred = state.facePresent && Math.abs(state.faceX - 0.5) < 0.12 && !state.talking && convo === 'idle';
  stareFor = centred ? stareFor + dt : 0;
  if (stareFor > 8) { tryReact('stare', 2500, 90000, { ch: '…', n: 1 }, true); stareFor = 0; }
}

// mood tag from the chat model → a reaction
const MOOD = {
  happy: ['happy', 1100, { ch: '♥', n: 3 }], stare: ['stare', 1800, null], surprise: ['surprise', 800, { ch: '!', n: 1 }],
  sad: ['sad', 2200, null], nod: ['nod', 1000, null], shake: ['shake', 1000, null],
  think: ['think', 1600, { ch: '?', n: 1 }], comfort: ['comfort', 2200, { ch: '♥', n: 1 }],
};

function animate(now) {
  const on = act && now < act.until ? act.kind : null;
  const k = on ? (now - act.start) / (act.until - act.start) : 1;
  anim.hop = on === 'happy' ? -Math.abs(Math.sin(k * Math.PI * 2)) * 0.2
    : on === 'surprise' ? -Math.sin(k * Math.PI) * 0.35
    : on === 'nod' ? Math.sin(k * Math.PI * 4) * 0.05
    : on === 'angry' ? 0.1 : 0;
  anim.tilt = on === 'shake' ? Math.sin(k * Math.PI * 4) * 0.2
    : on === 'stare' ? -0.15
    : on === 'think' ? 0.2
    : convo === 'listening' && state.talking ? Math.sin(now / 350) * 0.06 + 0.1 : 0;
  // mouth moves while Pip is speaking
  anim.mouth = convo === 'speaking' ? Math.abs(Math.sin(now / 95)) * (0.55 + 0.45 * Math.sin(now / 410)) : 0;
  anim.sad = lerp(anim.sad, on === 'sad' ? 1 : 0, 0.12);
  anim.shy = lerp(anim.shy, on === 'stare' ? 1 : 0, 0.12);
  anim.cross = lerp(anim.cross, on === 'angry' ? 1 : 0, 0.12);
  anim.wave = lerp(anim.wave, on === 'comfort' ? 0.6 : on === 'sad' ? 0.35 : 0, 0.12);
}

// ---------- what the camera saw while you spoke ----------
const recent = []; // expressions, last 8 s
const vitals = []; // stable heart / breathing readings, last 10 min
setInterval(() => {
  const now = performance.now();
  recent.push({ t: now, happy: state.happy, sad: state.sad, surprise: state.surprise, angry: state.angry });
  while (recent.length && now - recent[0].t > 8000) recent.shift();
  vitals.push({ t: now, hr: state.pulseRateStable ? state.pulseRate : null, br: state.breathRateStable ? state.breathRate : null });
  while (vitals.length && now - vitals[0].t > 10 * 60000) vitals.shift();
}, 250);

let blinkTimes = [];
signals.onBlink(() => { blinkTimes.push(performance.now()); });

function cues() {
  if (state.source !== 'sdk') return null;
  const c = { face: state.facePresent };
  const peak = (k) => Math.max(0, ...recent.map((r) => r[k]));
  const p = { happy: peak('happy'), sad: peak('sad'), surprise: peak('surprise'), angry: peak('angry') };
  const top = Object.entries(p).sort((a, b) => b[1] - a[1])[0];
  c.expression = top && top[1] > 0.4 ? T[lang].exp[top[0]] : T[lang].exp.neutral;
  const now = performance.now();
  blinkTimes = blinkTimes.filter((x) => now - x < 60000);
  c.blinks = blinkTimes.length;
  const avg = (rows, k) => { const v = rows.map((r) => r[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const lastRows = vitals.filter((r) => now - r.t < 15000);
  const earlier = vitals.filter((r) => now - r.t >= 60000);
  const hr = avg(lastRows, 'hr'), br = avg(lastRows, 'br');
  const hr0 = avg(earlier, 'hr'), br0 = avg(earlier, 'br');
  if (hr) { c.hr = Math.round(hr); if (hr0 && Math.abs(hr - hr0) >= 6) c.hrTrend = hr > hr0 ? t('trendUp') : t('trendDown'); }
  if (br) { c.br = Math.round(br); if (br0 && Math.abs(br - br0) >= 3) c.brTrend = br > br0 ? t('trendUp') : t('trendDown'); }
  return c;
}

// ---------- talking with Pip ----------
function userSaid(text) {
  if (!host || !text) return;
  heard.textContent = (recMode ? 'You: ' : '') + text;
  setConvo('thinking');
  showBubble(t('thinking'));
  host.say(text, cues(), lang);
}

if (host) {
  host.onPartial((txt) => { if (convo !== 'speaking' && convo !== 'thinking') { heard.textContent = txt; setConvo('listening'); } });
  host.onFinal((txt) => { if (convo !== 'speaking') userSaid(txt); });
  host.onAsrState((s) => {
    if (s === 'no-key') micStatus = 'nokey';
    else if (s === 'error') { micStatus = 'error'; if (convo === 'thinking') { setConvo('idle'); bubble.hidden = true; } }
    else if (s === 'empty' && convo === 'thinking') { setConvo('idle'); bubble.hidden = true; heard.textContent = ''; }
    else if (s === 'listening') micStatus = 'ok';
  });
  host.onMood((m) => { const r = MOOD[m]; if (r) play(r[0], r[1], r[2]); });
  host.onTtsStart((s) => { setConvo('speaking'); showBubble(s); });
  host.onTtsEnd(() => {
    setConvo('idle');
    heard.textContent = '';
    setTimeout(() => { if (convo === 'idle') bubble.hidden = true; }, 2500);
  });
  host.onChatError((e) => { setConvo('idle'); showBubble(e === 'no-key' ? t('noKeys', 'SILICONFLOW_API_KEY') : '……', 4000); });
}

// click Pip while it talks to stop it
canvas.addEventListener('click', () => { if (convo === 'speaking' && host) { host.stopTalking(); setConvo('idle'); } });

$('type').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing && e.target.value.trim()) { userSaid(e.target.value.trim()); e.target.value = ''; }
});

// ---------- cutting speech at pauses (used with SiliconFlow) ----------
// 100 ms chunks; speech = louder than the room's noise floor.
const vad = {
  floor: 0.01, chunks: [], speaking: false, silent: 0, voiced: 0,
  reset() { this.chunks = []; this.speaking = false; this.silent = 0; this.voiced = 0; },
  push(buf) {
    const pcm = new Int16Array(buf);
    let sum = 0;
    for (let i = 0; i < pcm.length; i++) sum += (pcm[i] / 32768) ** 2;
    const rms = Math.sqrt(sum / pcm.length);
    const loud = rms > Math.max(0.02, this.floor * 3);
    if (!this.speaking) {
      this.floor = this.floor * 0.95 + rms * 0.05;           // learn the room
      this.chunks.push(buf); if (this.chunks.length > 3) this.chunks.shift(); // keep 300 ms before speech
      if (loud) { this.voiced++; if (this.voiced >= 2) { this.speaking = true; console.log('[tidepal] vad start rms', rms.toFixed(3), 'floor', this.floor.toFixed(3)); setConvo('listening'); heard.textContent = '…'; } }
      else this.voiced = 0;
      return;
    }
    this.chunks.push(buf);
    this.silent = loud ? 0 : this.silent + 1;
    const len = this.chunks.length;
    if (this.silent >= 8 || len >= 200) {                      // 0.8 s pause, or 20 s max
      const total = this.chunks.reduce((n, c) => n + c.byteLength, 0);
      const out = new Uint8Array(total);
      let o = 0; for (const c of this.chunks) { out.set(new Uint8Array(c), o); o += c.byteLength; }
      const voicedChunks = len - this.silent;
      this.reset();
      console.log('[tidepal] vad end, voiced chunks', voicedChunks);
      if (voicedChunks >= 4) { setConvo('thinking'); showBubble(t('thinking')); host.utterance(out.buffer); }
      else if (convo === 'listening') { setConvo('idle'); heard.textContent = ''; }
    }
  },
};

// ---------- microphone → 16 kHz PCM → speech recognition ----------
async function startMic() {
  if (!host) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    const ac = new AudioContext({ sampleRate: 16000 });
    await ac.audioWorklet.addModule('audio-worklet.js');
    const src = ac.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ac, 'pcm-chunker');
    const mode = await host.asrMode();
    console.log('[tidepal] mic on, asr mode', mode);
    setInterval(() => console.log('[tidepal] mic level', micLevel.toFixed(3), 'floor', vad.floor.toFixed(3), 'convo', convo), 5000);
    node.port.onmessage = (e) => {
      if (e.data.level != null) { micLevel = lerp(micLevel, e.data.level, 0.3); return; }
      if (!e.data.pcm) return;
      // don't listen to ourselves while Pip is speaking or thinking
      if (convo === 'speaking' || convo === 'thinking') { vad.reset(); return; }
      if (mode === 'stream') host.asrAudio(e.data.pcm);
      else if (mode === 'chunks') vad.push(e.data.pcm);
    };
    src.connect(node);
    micOn = true;
    if (mode === 'stream') host.asrStart();
    else if (mode === 'none') micStatus = 'nokey';
  } catch (e) {
    console.log('[tidepal] mic failed', e && e.name, e && e.message);
    micStatus = 'error';
  }
}

// ---------- drawing ----------
function drawWater(x0, x1, level, bottom, time, amp, scale) {
  const layers = [
    { c: 'rgba(110, 196, 205, 0.55)', a: 1.0, f: 1.0, sp: 1.1, off: 0 },
    { c: 'rgba(64, 160, 185, 0.75)', a: 0.7, f: 1.6, sp: -0.8, off: scale * 0.06 },
  ];
  for (const L of layers) {
    ctx.fillStyle = L.c;
    ctx.beginPath();
    ctx.moveTo(x0, bottom);
    for (let x = x0; x <= x1 + 4; x += 4) {
      const u = (x - x0) / scale;
      const y = level + L.off
        + Math.sin(u * 2.2 * L.f + time * L.sp) * scale * 0.035 * amp * L.a
        + Math.sin(u * 5.1 * L.f - time * L.sp * 1.7) * scale * 0.012 * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(x1, bottom);
    ctx.closePath();
    ctx.fill();
  }
}

function drawFx(cx, top, now) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    const age = (now - f.born) / 1400;
    if (age < 0) continue;
    if (age > 1) { fx.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = f.ch === '♥' ? '#ff5d7a' : '#4a5a7a';
    ctx.font = `700 ${f.ch === '♥' ? 22 : 24}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(f.ch, cx + f.dx + Math.sin(age * 6) * 6, top - age * 60);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'start';
}

function drawPool(time, now) {
  const W = innerWidth, H = innerHeight;
  const R = Math.min(W * 0.38, H * 0.24);
  const cx = W / 2, cy = H - R - 64;

  // listening ring: grows with your voice
  if (micOn && convo !== 'speaking') {
    const v = Math.min(1, micLevel * 12);
    ctx.strokeStyle = `rgba(127, 209, 185, ${0.3 + 0.6 * v})`;
    ctx.lineWidth = 3 + 6 * v;
    ctx.beginPath(); ctx.arc(cx, cy, R + 7 + 6 * v, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  const sky = ctx.createLinearGradient(0, cy - R, 0, cy + R);
  sky.addColorStop(0, '#fdf6ec'); sky.addColorStop(1, '#e6f4f1');
  ctx.fillStyle = sky; ctx.fill();
  ctx.clip();
  const level = cy + R * lerp(0.32, 0.08, look.breath);
  drawWater(cx - R, cx + R, level, cy + R, time, 0.35, R);
  const s = R * 0.62;
  drawPip(ctx, cx, level - s * 0.25 + Math.sin(time * 1.3) * 2, s, look);
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(120,150,170,0.35)';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, Math.PI * 1.1, Math.PI * 1.35); ctx.stroke();

  // thinking dots
  if (convo === 'thinking') {
    for (let i = 0; i < 3; i++) {
      const a = 0.3 + 0.7 * Math.max(0, Math.sin(now / 250 - i * 0.8));
      ctx.fillStyle = `rgba(74, 90, 122, ${a})`;
      ctx.beginPath(); ctx.arc(cx + R * 0.55 + i * 12, cy - R * 0.75 - i * 8, 4 + i, 0, Math.PI * 2); ctx.fill();
    }
  }
  bubble.style.bottom = `${H - (cy - R) + 12}px`;
  drawFx(cx, cy - R * 0.4, now);
}

const mirrorFace = { sad: 0, angry: 0 };

// ---------- main loop ----------
let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  const time = now / 1000;
  signals.tick(time);
  freeReactions(now, dt);
  animate(now);

  look.wobble = time;
  look.breath = state.breath;
  look.glow = state.beatAt ? Math.max(0, 1 - (now - state.beatAt) / 350) : 0;
  const tx = state.facePresent ? (state.faceX - 0.5) * 2 : 0;
  const ty = state.facePresent ? (state.faceY - 0.5) * 2 : 0.4;
  look.gazeX = lerp(look.gazeX, Math.max(-1, Math.min(1, tx * 1.6)), 0.08);
  look.gazeY = lerp(look.gazeY, Math.max(-1, Math.min(1, ty * 1.6)), 0.08);
  look.happy = lerp(look.happy, state.happy > 0.5 ? 1 : 0.25, 0.05);
  look.surprise = lerp(look.surprise, state.surprise > 0.5 ? 1 : convo === 'listening' ? 0.35 : 0, 0.1);
  look.hop = anim.hop; look.tilt = anim.tilt; look.mouthOpen = anim.mouth;
  // Pip mirrors your face all the time, not only when something triggers
  mirrorFace.sad = lerp(mirrorFace.sad, state.sad, 0.06);
  mirrorFace.angry = lerp(mirrorFace.angry, state.angry, 0.06);
  look.sad = Math.max(anim.sad, mirrorFace.sad > 0.3 ? mirrorFace.sad : 0);
  look.cross = Math.max(anim.cross, mirrorFace.angry > 0.3 ? mirrorFace.angry : 0);
  look.stretch = anim.wave;
  if (anim.shy > 0.05) { look.happy = Math.max(look.happy, anim.shy); look.gazeX = lerp(look.gazeX, -0.9, 0.1); }
  if (blinkAnim > 0) { blinkAnim -= dt; look.blink = Math.sin(Math.min(1, Math.max(0, 1 - blinkAnim / 0.22)) * Math.PI); }
  else look.blink = 0;

  ctx.clearRect(0, 0, innerWidth, innerHeight);
  drawPool(time, now);
  updateStatus();
  requestAnimationFrame(frame);
}

// ---------- status line, mirror, controls ----------
let mirrorOn = true;
let missingKeys = [];
function updateStatus() {
  const el = $('live');
  let text = '', cls = '';
  const fix = T[lang].fix[state.hintCode];
  if (missingKeys.length) { text = t('noKeys', missingKeys.join(' / ')); cls = 'warn'; }
  else if (micStatus === 'error') { text = t('noMic'); cls = 'warn'; }
  else if (state.source === 'sdk' && state.hintCode && fix && state.hintCode !== 7) { text = fix; cls = 'warn'; }
  else if (convo === 'listening') { text = t('listening'); cls = 'ok'; }
  if (el.textContent !== text) el.textContent = text;
  el.className = cls;
  el.hidden = !text;
  $('mirror').hidden = !mirrorOn || state.source !== 'sdk';
}

$('btn-mirror').onclick = () => { mirrorOn = !mirrorOn; };

// Recording mode: bigger Pip, big captions, controls hidden (hover the bottom edge to see them).
let recMode = false;
function setRec(on) {
  recMode = on;
  document.body.classList.toggle('rec', on);
  try { localStorage.setItem('pip-rec', on ? '1' : ''); } catch {}
  if (host && host.setWinMode) host.setWinMode(on ? 'rec' : 'normal');
}
$('btn-rec').onclick = () => setRec(!recMode);
addEventListener('keydown', (e) => { if (e.target.id !== 'type' && (e.key === 'r' || e.key === 'R')) setRec(!recMode); });
try { if (localStorage.getItem('pip-rec')) setTimeout(() => setRec(true), 300); } catch {}
$('btn-lang').onclick = () => { lang = lang === 'zh' ? 'en' : 'zh'; try { localStorage.setItem('pip-lang', lang); } catch {} applyLang(); };
$('btn-close').onclick = () => host && host.quit();
$('btn-cam').onclick = async () => {
  if (state.source === 'sdk') { await signals.stopSdk(); signals.startSim(); }
  else await tryCamera();
};

function applyLang() {
  $('consent-title').textContent = t('consentTitle');
  $('consent-body').textContent = t('consentBody');
  $('consent-allow').textContent = t('allow');
  $('consent-demo').textContent = t('demo');
  $('btn-lang').textContent = lang === 'zh' ? 'EN' : '中';
  $('type').placeholder = t('typeHere');
}

async function tryCamera() {
  const key = host && await host.getApiKey();
  if (!signals.sdkAvailable() || !key) { signals.startSim(); return; }
  try { await signals.startSdk(key); }
  catch (e) { console.log('[tidepal] camera/SDK start failed:', e && e.message); signals.startSim(); }
}

async function begin(choice) {
  try { localStorage.setItem('consent', choice); } catch {}
  $('consent').hidden = true;
  if (host) {
    const k = await host.keys();
    missingKeys = (!k.chat || !k.ears) ? ['SILICONFLOW_API_KEY'] : [];
  }
  if (choice === 'camera') { await tryCamera(); await startMic(); }
  else signals.startSim();
  play('nod', 1000);
  showBubble(t('hello'), 3000);
}
$('consent-allow').onclick = () => begin('camera');
$('consent-demo').onclick = () => begin('demo');

applyLang();
let saved = null;
try { saved = localStorage.getItem('consent'); } catch {}
if (saved === 'camera' || saved === 'demo') begin(saved); else $('consent').hidden = false;

// demo panel (press D while not typing)
addEventListener('keydown', (e) => {
  if (e.target.id === 'type') return;
  if (e.key === 'd' || e.key === 'D') $('dev').hidden = !$('dev').hidden;
});
const pulse = (k, v, ms) => { state[k] = v; setTimeout(() => { state[k] = typeof v === 'boolean' ? false : 0; }, ms); };
$('d-smile').onclick = () => pulse('happy', 1, 1500);
$('d-wow').onclick = () => pulse('surprise', 1, 1200);
$('d-nod').onclick = () => { state.gesture = { kind: 'nod', at: performance.now() }; };
$('d-speak').onclick = () => { setConvo('speaking'); showBubble(lang === 'en' ? "Hi, I'm Pip! How's your day going?" : '你好呀，我是 Pip！今天过得怎么样？'); play('happy', 1100, { ch: '♥', n: 3 }); setTimeout(() => { setConvo('idle'); bubble.hidden = true; }, 3000); };
$('d-reset').onclick = () => { try { localStorage.removeItem('consent'); } catch {} location.reload(); };

requestAnimationFrame(frame);
