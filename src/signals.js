// Live signals for Pip: either from the SmartSpectra SDK (camera) or simulated.
// Both sources fill the same `state` object, so the rest of the app does not
// care where the numbers come from.

'use strict';

const state = {
  source: 'none',        // 'sdk' | 'sim' | 'none'
  status: 'idle',        // human-readable SDK status
  hint: '',              // SDK validation hint (e.g. "face not found")
  hintCode: 0,           // SDK ValidationCode, 0 = ok
  hintSince: 0,
  stream: null,
  lastMetricsAt: 0,
  breathRate: null,      // breaths / min
  breathRateStable: false,
  pulseRate: null,       // beats / min
  pulseRateStable: false,
  breath: 0.5,           // 0..1, current chest position (normalized trace)
  pulse: 0,              // 0..1, current pulse wave (normalized trace)
  beatAt: 0,             // performance.now() of the last detected beat
  facePresent: false,
  faceX: 0.5,            // 0..1 across the camera image (mirrored, like a mirror)
  faceY: 0.5,
  lastBlinkAt: 0,        // performance.now() of the last blink
  lastFaceSeenAt: 0,
  happy: 0, surprise: 0, // 0..1 expression confidence
  sad: 0, angry: 0,
  talking: false,        // SDK talking detection (from the face, no microphone)
  pulseConf: 0,
  gesture: null,         // { kind: 'nod' | 'shake', at }
};

const listeners = new Set();
function onBlink(fn) { listeners.add(fn); }
function emitBlink() { state.lastBlinkAt = performance.now(); listeners.forEach((f) => f()); }

// ---------- trace playback ----------
// SDK traces arrive in bursts. We keep the samples with their timestamps and
// play them back a little behind real time so the animation is smooth.
function makeTrace(windowSec = 12) {
  const pts = [];          // { t: microseconds, v }
  let offset = null;       // wallclock_us - sample_us
  return {
    push(tUs, v) {
      if (pts.length && tUs <= pts[pts.length - 1].t) return;
      pts.push({ t: tUs, v });
      const now = performance.now() * 1000;
      const o = now - tUs;
      offset = offset == null ? o : offset + (o - offset) * 0.03; // a steady playback clock, not jumping with each burst
      const cutoff = tUs - windowSec * 1e6;
      while (pts.length && pts[0].t < cutoff) pts.shift();
    },
    // normalized value (0..1) at "now - delay"
    sample(delayMs = 700) {
      if (pts.length < 2 || offset == null) return null;
      const target = performance.now() * 1000 - offset - delayMs * 1000;
      let lo = 0, hi = pts.length - 1;
      if (target <= pts[0].t) return norm(pts[0].v);
      if (target >= pts[hi].t) return norm(pts[hi].v);
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].t < target) lo = m; else hi = m; }
      const a = pts[lo], b = pts[hi];
      const v = a.v + (b.v - a.v) * ((target - a.t) / (b.t - a.t));
      return norm(v);
    },
    // raw value at "now - delay" (no normalization)
    raw(delayMs = 1500) {
      if (pts.length < 2 || offset == null) return null;
      const target = performance.now() * 1000 - offset - delayMs * 1000;
      let lo = 0, hi = pts.length - 1;
      if (target <= pts[0].t) return pts[0].v;
      if (target >= pts[hi].t) return pts[hi].v;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].t < target) lo = m; else hi = m; }
      const a = pts[lo], b = pts[hi];
      return a.v + (b.v - a.v) * ((target - a.t) / (b.t - a.t));
    },
    clear() { pts.length = 0; offset = null; },
  };
  function norm(v) {
    let mn = Infinity, mx = -Infinity;
    for (const p of pts) { if (p.v < mn) mn = p.v; if (p.v > mx) mx = p.v; }
    if (mx - mn < 1e-9) return 0.5;
    return (v - mn) / (mx - mn);
  }
}

const breathTrace = makeTrace(15);
const pulseTrace = makeTrace(6);
let lastPulseV = 0, pulseRising = false;

// Breathing for the eye: remove slow drift, keep the size of the swing steady,
// then move the water with a soft spring so it glides like a breathing guide.
const br = { base: null, amp: null, x: 0.5, v: 0, last: 0 };
function smoothBreath(raw) {
  const now = performance.now();
  const dt = Math.min(0.1, br.last ? (now - br.last) / 1000 : 0.016);
  br.last = now;
  let target = 0.5;
  if (raw != null) {
    br.base = br.base == null ? raw : br.base + (raw - br.base) * (dt / 8);      // ~8 s baseline
    const dev = raw - br.base;
    const a = Math.abs(dev);
    br.amp = br.amp == null ? Math.max(a, 1e-6) : br.amp + (a - br.amp) * (dt / (a > br.amp ? 3 : 15)); // grows in 3 s, shrinks in 15 s
    target = Math.max(0.05, Math.min(0.95, 0.5 + dev / (br.amp * 3.2)));
  }
  // critically damped spring (about 0.5 s)
  const w = 2 * Math.PI / 1.6;
  const acc = w * w * (target - br.x) - 2 * w * br.v;
  br.v += acc * dt;
  br.x += br.v * dt;
  state.breath = br.x;
}

// Called every animation frame.
function tick(simTime) {
  if (state.source === 'sim') sim.tick(simTime);
  else if (state.source === 'sdk') {
    smoothBreath(breathTrace.raw(1500));
    const p = pulseTrace.sample(800);
    if (p != null) {
      // beat = the wave turning from rising to falling near its top
      if (p < lastPulseV && pulseRising && lastPulseV > 0.7) state.beatAt = performance.now();
      pulseRising = p > lastPulseV;
      lastPulseV = p;
      state.pulse = p;
    }
    if (performance.now() - state.lastFaceSeenAt > 2500) state.facePresent = false;
  }
}

// ---------- simulated signals ----------
const sim = {
  breathRate: 15, pulseRate: 76, face: true, phase: 0, beatPhase: 0, last: null,
  calmTowards: null, // when set, breathing/pulse ease towards these numbers
  tick() {
    const now = performance.now();
    const dt = this.last == null ? 0 : (now - this.last) / 1000;
    this.last = now;
    if (this.calmTowards) {
      this.breathRate += (this.calmTowards.breath - this.breathRate) * dt * 0.03;
      this.pulseRate += (this.calmTowards.pulse - this.pulseRate) * dt * 0.02;
    }
    this.phase += dt * (this.breathRate / 60) * Math.PI * 2;
    const prevBeat = this.beatPhase;
    this.beatPhase = (this.beatPhase + dt * (this.pulseRate / 60)) % 1;
    if (this.beatPhase < prevBeat) state.beatAt = now;
    // inhale a bit quicker than exhale
    const s = Math.sin(this.phase);
    state.breath = 0.5 + 0.5 * Math.sign(s) * Math.pow(Math.abs(s), 0.8);
    state.pulse = Math.exp(-this.beatPhase * 7);
    state.breathRate = this.breathRate;
    state.pulseRate = this.pulseRate;
    state.breathRateStable = state.pulseRateStable = true;
    state.facePresent = this.face;
    if (this.face) {
      state.lastFaceSeenAt = now;
      state.faceX = 0.5 + 0.12 * Math.sin(now / 3100);
      state.faceY = 0.45 + 0.05 * Math.sin(now / 4300);
      if (Math.random() < dt / 4) emitBlink(); // ~ one blink every 4 s
    }
  },
};

function startSim() {
  state.source = 'sim';
  state.status = 'simulated';
  state.hint = '';
}

// ---------- SmartSpectra SDK ----------
let sdk = null;

function sdkAvailable() {
  return typeof window !== 'undefined' && !!window.__smartspectraBridge;
}

const tsNum = (ts) => (ts == null ? 0 : typeof ts === 'number' ? ts : typeof ts.toNumber === 'function' ? ts.toNumber() : Number(ts));
const last = (arr) => (arr && arr.length ? arr[arr.length - 1] : null);

async function startSdk(apiKey) {
  const { SmartSpectraSDK, ProcessingStatus, ValidationCode, breathingMetrics, cardioMetrics, faceMetrics } =
    require('@smartspectra/node-sdk/renderer');
  const { decodeMetrics } = require('@smartspectra/node-sdk/messages');
  const STATUS = Object.fromEntries(Object.entries(ProcessingStatus).map(([k, v]) => [v, k.replace(/^k/, '')]));
  const VALID = Object.fromEntries(Object.entries(ValidationCode).map(([k, v]) => [v, k.replace(/^k/, '')]));

  sdk = new SmartSpectraSDK({
    apiKey,
    requestedMetrics: [...breathingMetrics, ...cardioMetrics, ...faceMetrics],
    enableTelemetry: false,
  });
  sdk.on('processingStatus', (s) => { state.status = STATUS[s] || String(s); console.log('[tidepal] status', state.status); });
  sdk.on('validationStatus', (code, _ts, hint) => {
    state.hint = code === ValidationCode.kOk ? '' : (VALID[code] || '') + (hint ? ` — ${hint}` : '');
    if (code !== state.hintCode) { state.hintCode = code; state.hintSince = performance.now(); }
  });
  sdk.on('error', (code, message) => { state.status = 'Error'; state.hint = `${code}: ${message}`; console.error('[tidepal] error', code, message); });
  let n = 0;
  sdk.on('metrics', (buf) => {
    let m;
    try { m = decodeMetrics(buf); } catch (e) { console.error('[tidepal] decode', e); return; }
    handleMetrics(m);
    if (false && ++n % 30 === 1) {
      console.log('[tidepal] metrics', JSON.stringify({
        br: state.breathRate, hr: state.pulseRate, face: state.facePresent,
        bTrace: m.breathing?.upperTrace?.length || 0, pTrace: m.cardio?.arterialPressureTrace?.length || 0,
        lm: m.face?.landmarks?.length || 0, blink: m.face?.blinking?.length || 0, expr: m.face?.expression?.length || 0,
        hrConf: state.pulseConf, hrStable: state.pulseRateStable, talk: state.talking,
        happy: +state.happy.toFixed(2), sad: +state.sad.toFixed(2), surprise: +state.surprise.toFixed(2), angry: +state.angry.toFixed(2),
      }));
    }
  });
  state.source = 'sdk';
  state.status = 'Starting';
  // We open the camera ourselves so a permission problem shows up clearly.
  // The video is never shown on screen.
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 1280, height: 720, frameRate: 30, facingMode: 'user' }, audio: false,
  });
  const track = stream.getVideoTracks()[0];
  console.log('[tidepal] camera', track && track.label, JSON.stringify(track && track.getSettings()));
  // Show yourself in Pip's little mirror so you can see how you sit.
  // The video stays on screen only; nothing is recorded.
  const v = document.getElementById('mirror-video');
  if (v) { v.srcObject = stream; v.play().catch(() => {}); }
  state.stream = stream;
  sdk.useMediaStream(stream);
  await sdk.start();
}

let lastBlinkTs = 0;
function handleMetrics(m) {
  state.lastMetricsAt = performance.now();
  const br = last(m.breathing?.rate);
  if (br) { state.breathRate = br.value; state.breathRateStable = !!br.stable; }
  for (const p of m.breathing?.upperTrace || []) breathTrace.push(tsNum(p.timestamp), p.value);

  const pr = last(m.cardio?.pulseRate);
  if (pr) { state.pulseRate = pr.value; state.pulseRateStable = !!pr.stable; state.pulseConf = pr.confidence || 0; }
  for (const p of m.cardio?.arterialPressureTrace || []) pulseTrace.push(tsNum(p.timestamp), p.value);

  const face = m.face;
  if (!face) return;
  const lm = last(face.landmarks);
  if (lm && lm.value && lm.value.length) {
    let sx = 0, sy = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of lm.value) {
      sx += p.x; sy += p.y;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const n = lm.value.length;
    // landmarks may be pixels or normalized; guess the frame size from the values
    const W = maxX > 2 ? 1280 : 1, H = maxY > 2 ? 720 : 1;
    state.faceX = 1 - (sx / n) / W; // mirrored
    state.faceY = (sy / n) / H;
    trackHead(state.faceX, state.faceY, (maxX - minX) / W);
    state.facePresent = true;
    state.lastFaceSeenAt = performance.now();
  }
  for (const b of face.blinking || []) {
    const t = tsNum(b.timestamp);
    if (b.detected && t > lastBlinkTs + 250000) { lastBlinkTs = t; emitBlink(); }
  }
  const ex = last(face.expression);
  if (ex && ex.scores && ex.scores.length) {
    // expressions only come when a face is found, so they count as "face present" too
    state.facePresent = true;
    state.lastFaceSeenAt = performance.now();
    const score = (type) => (ex.scores.find((s) => s.type === type)?.confidence || 0) / 100;
    state.happy = state.happy * 0.6 + score(5) * 0.4;     // HAPPY
    state.surprise = state.surprise * 0.6 + score(8) * 0.4; // SURPRISE
    state.sad = state.sad * 0.6 + score(7) * 0.4;
    state.angry = state.angry * 0.6 + score(1) * 0.4;
  }
  const tk = last(face.talking);
  if (tk) state.talking = !!tk.detected;
}

// Nod / shake from the face's movement over the last ~1.2 s.
const headPts = [];
function trackHead(x, y, faceW) {
  const now = performance.now();
  headPts.push({ x, y, t: now });
  while (headPts.length && now - headPts[0].t > 1200) headPts.shift();
  if (headPts.length < 8 || (state.gesture && now - state.gesture.at < 1500)) return;
  const xs = headPts.map((p) => p.x), ys = headPts.map((p) => p.y);
  const rx = Math.max(...xs) - Math.min(...xs), ry = Math.max(...ys) - Math.min(...ys);
  const turns = (arr) => { let n = 0, d0 = 0; for (let i = 1; i < arr.length; i++) { const d = Math.sign(arr[i] - arr[i - 1]); if (d && d0 && d !== d0) n++; if (d) d0 = d; } return n; };
  const k = faceW || 0.2; // movement relative to face size
  if (ry > k * 0.12 && ry > rx * 1.6 && turns(ys) >= 2) { state.gesture = { kind: 'nod', at: now }; headPts.length = 0; }
  else if (rx > k * 0.15 && rx > ry * 1.6 && turns(xs) >= 2) { state.gesture = { kind: 'shake', at: now }; headPts.length = 0; }
}

async function stopSdk() {
  if (!sdk) return;
  try { await sdk.stop(); } catch { /* ignore */ }
  try { sdk.destroy(); } catch { /* ignore */ }
  sdk = null;
  if (state.stream) { state.stream.getTracks().forEach((t) => t.stop()); state.stream = null; }
  const mv = document.getElementById('mirror-video'); if (mv) mv.srcObject = null;
  breathTrace.clear(); pulseTrace.clear();
  br.base = br.amp = null;
  state.source = 'none';
  state.status = 'idle';
}

module.exports = { state, sim, tick, onBlink, startSim, startSdk, stopSdk, sdkAvailable };
