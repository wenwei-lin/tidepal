// 16:10 illustration for the blog's project card (no big title text).
const { drawPip } = require('../src/pet');
const W = 1600, H = 1000;
const c = document.getElementById('c'); c.width = W; c.height = H;
const ctx = c.getContext('2d');
const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

const g = ctx.createLinearGradient(0, 0, 0, H);
g.addColorStop(0, '#fdf3e4'); g.addColorStop(1, '#e3f3ef');
ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
ctx.fillStyle = 'rgba(255,154,139,0.10)';
for (let i = 0; i < 22; i++) { ctx.beginPath(); ctx.arc((i * 337) % W, (i * 191) % H, 10 + (i * 7) % 26, 0, Math.PI * 2); ctx.fill(); }

// desktop window
ctx.save(); ctx.shadowColor = 'rgba(43,45,66,0.12)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
ctx.fillStyle = '#fff'; rr(170, 110, 1260, 700, 30); ctx.fill(); ctx.restore();
ctx.fillStyle = '#f1ece4'; rr(170, 110, 1260, 70, [30, 30, 0, 0]); ctx.fill();
['#ff6b5e', '#ffbd2e', '#28c840'].forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(222 + i * 36, 145, 12, 0, Math.PI * 2); ctx.fill(); });
ctx.fillStyle = '#e9e4dc';
for (let i = 0; i < 8; i++) { rr(240, 230 + i * 60, 560 - (i % 3) * 120, 20, 10); ctx.fill(); }

// webcam mirror
ctx.save(); rr(1080, 220, 290, 180, 24); ctx.clip();
ctx.fillStyle = '#b0bec5'; ctx.fillRect(1080, 220, 290, 180);
ctx.fillStyle = '#ffe0c7'; ctx.beginPath(); ctx.ellipse(1225, 305, 52, 60, 0, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = '#3a3a4a'; ctx.beginPath(); ctx.ellipse(1225, 260, 56, 28, 0, Math.PI, 0); ctx.fill();
ctx.fillStyle = '#2b2d42'; ctx.beginPath(); ctx.arc(1206, 305, 6, 0, Math.PI * 2); ctx.arc(1244, 305, 6, 0, Math.PI * 2); ctx.fill();
ctx.strokeStyle = '#7a2e3a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(1225, 322, 18, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
ctx.fillStyle = '#f5f5f5'; ctx.beginPath(); ctx.ellipse(1225, 400, 100, 44, 0, Math.PI, 0); ctx.fill();
ctx.restore();
ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; rr(1080, 220, 290, 180, 24); ctx.stroke();

// pool with Pip
const cx = 900, cy = 640, R = 270;
ctx.save(); ctx.shadowColor = 'rgba(43,45,66,0.18)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 16;
ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = '#fdf6ec'; ctx.fill(); ctx.restore();
ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
const sky = ctx.createLinearGradient(0, cy - R, 0, cy + R); sky.addColorStop(0, '#fdf6ec'); sky.addColorStop(1, '#e6f4f1');
ctx.fillStyle = sky; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
const level = cy + R * 0.18;
for (const [col, off, amp] of [['rgba(110,196,205,0.6)', 0, 16], ['rgba(64,160,185,0.8)', 30, 10]]) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx - R, cy + R);
  for (let x = cx - R; x <= cx + R; x += 6) ctx.lineTo(x, level + off + Math.sin((x - cx) / 44) * amp);
  ctx.lineTo(cx + R, cy + R); ctx.closePath(); ctx.fill();
}
const s = R * 0.66;
drawPip(ctx, cx, level - s * 0.28, s, { breath: 0.7, gazeX: 0.6, gazeY: -0.5, happy: 1, stretch: 0.55, glow: 0.6, wobble: 1.2, tilt: -0.06 });
ctx.restore();
ctx.strokeStyle = 'rgba(127,209,185,0.95)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx, cy, R + 16, 0, Math.PI * 2); ctx.stroke();
ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, Math.PI * 1.1, Math.PI * 1.35); ctx.stroke();

// hearts and bubble
ctx.fillStyle = '#ff5d7a'; ctx.font = '700 72px "SF Pro Rounded", ui-rounded, system-ui'; ctx.fillText('♥', 660, 420);
ctx.font = '700 50px "SF Pro Rounded", ui-rounded, system-ui'; ctx.fillText('♥', 740, 350);
ctx.save(); ctx.shadowColor = 'rgba(43,45,66,0.16)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
ctx.fillStyle = '#fffdf8'; rr(1050, 470, 470, 130, 32); ctx.fill();
ctx.beginPath(); ctx.moveTo(1100, 595); ctx.lineTo(1070, 640); ctx.lineTo(1145, 598); ctx.fill(); ctx.restore();
ctx.fillStyle = '#2b2d42'; ctx.font = '600 38px "SF Pro Rounded", ui-rounded, system-ui';
ctx.fillText("You're smiling a little", 1086, 524); ctx.fillText('while you say that.', 1086, 572);
window.coverReady = true;
