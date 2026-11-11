// Draws the Dev.to cover (2000×840) with Pip.
const { drawPip } = require('../src/pet');

const W = 2000, H = 840;
const c = document.getElementById('c');
c.width = W; c.height = H;
const ctx = c.getContext('2d');

// sky → sea
const g = ctx.createLinearGradient(0, 0, 0, H);
g.addColorStop(0, '#fdf3e4'); g.addColorStop(0.55, '#f6efe4'); g.addColorStop(1, '#e3f3ef');
ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

// soft dots
ctx.fillStyle = 'rgba(255, 154, 139, 0.10)';
for (let i = 0; i < 28; i++) {
  const x = (i * 337) % W, y = (i * 191) % H, r = 10 + (i * 7) % 26;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

// fake desktop window behind the pool (Pip lives on a desktop)
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
ctx.save();
ctx.shadowColor = 'rgba(43,45,66,0.12)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
ctx.fillStyle = '#ffffff'; roundRect(1060, 90, 820, 560, 28); ctx.fill();
ctx.restore();
ctx.fillStyle = '#f1ece4'; roundRect(1060, 90, 820, 64, [28, 28, 0, 0]); ctx.fill();
for (const [i, col] of ['#ff6b5e', '#ffbd2e', '#28c840'].entries()) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(1110 + i * 34, 122, 11, 0, Math.PI * 2); ctx.fill(); }
ctx.fillStyle = '#e9e4dc';
for (let i = 0; i < 6; i++) { roundRect(1110, 200 + i * 52, 420 - (i % 3) * 90, 18, 9); ctx.fill(); }

// webcam mirror with a simple face
ctx.save();
roundRect(1560, 186, 260, 160, 22); ctx.fillStyle = '#cfd8dc'; ctx.fill();
ctx.clip();
ctx.fillStyle = '#b0bec5'; ctx.fillRect(1560, 186, 260, 160);
ctx.fillStyle = '#ffe0c7'; ctx.beginPath(); ctx.ellipse(1690, 262, 46, 54, 0, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = '#3a3a4a'; ctx.beginPath(); ctx.ellipse(1690, 222, 50, 26, 0, Math.PI, 0); ctx.fill();
ctx.fillStyle = '#2b2d42'; ctx.beginPath(); ctx.arc(1673, 262, 5, 0, Math.PI * 2); ctx.arc(1707, 262, 5, 0, Math.PI * 2); ctx.fill();
ctx.strokeStyle = '#7a2e3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(1690, 278, 16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
ctx.fillStyle = '#f5f5f5'; ctx.beginPath(); ctx.ellipse(1690, 352, 90, 40, 0, Math.PI, 0); ctx.fill();
ctx.restore();
ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; roundRect(1560, 186, 260, 160, 22); ctx.stroke();

// tide pool with Pip
const cx = 1400, cy = 560, R = 230;
ctx.save();
ctx.shadowColor = 'rgba(43,45,66,0.18)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 16;
ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = '#fdf6ec'; ctx.fill();
ctx.restore();
ctx.save();
ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
const sky = ctx.createLinearGradient(0, cy - R, 0, cy + R); sky.addColorStop(0, '#fdf6ec'); sky.addColorStop(1, '#e6f4f1');
ctx.fillStyle = sky; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
const level = cy + R * 0.18;
for (const [col, off, amp] of [['rgba(110,196,205,0.6)', 0, 14], ['rgba(64,160,185,0.8)', 26, 9]]) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx - R, cy + R);
  for (let x = cx - R; x <= cx + R; x += 6) ctx.lineTo(x, level + off + Math.sin((x - cx) / 38) * amp);
  ctx.lineTo(cx + R, cy + R); ctx.closePath(); ctx.fill();
}
const s = R * 0.66;
drawPip(ctx, cx, level - s * 0.28, s, { breath: 0.7, gazeX: 0.55, gazeY: -0.5, blink: 0, happy: 1, surprise: 0, sleepy: 0, stretch: 0.55, glow: 0.6, wobble: 1.2, tilt: -0.06 });
ctx.restore();
ctx.strokeStyle = 'rgba(127, 209, 185, 0.95)'; ctx.lineWidth = 10;
ctx.beginPath(); ctx.arc(cx, cy, R + 14, 0, Math.PI * 2); ctx.stroke();
ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 9;
ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, Math.PI * 1.1, Math.PI * 1.35); ctx.stroke();

// hearts
ctx.fillStyle = '#ff5d7a'; ctx.font = '700 64px "SF Pro Rounded", ui-rounded, system-ui';
ctx.fillText('♥', 1220, 330); ctx.font = '700 44px "SF Pro Rounded", ui-rounded, system-ui'; ctx.fillText('♥', 1290, 268);

// speech bubble
ctx.save();
ctx.shadowColor = 'rgba(43,45,66,0.16)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
ctx.fillStyle = '#fffdf8'; roundRect(1500, 390, 450, 120, 30); ctx.fill();
ctx.beginPath(); ctx.moveTo(1560, 505); ctx.lineTo(1540, 545); ctx.lineTo(1600, 507); ctx.fill();
ctx.restore();
ctx.fillStyle = '#2b2d42'; ctx.font = '600 34px "SF Pro Rounded", ui-rounded, system-ui';
ctx.fillText("You're smiling a little", 1534, 442);
ctx.fillText('while you say that.', 1534, 486);

// title
ctx.fillStyle = '#2b2d42';
ctx.font = '800 220px "SF Pro Rounded", ui-rounded, system-ui';
ctx.fillText('Pip', 120, 360);
ctx.font = '700 64px "SF Pro Rounded", ui-rounded, system-ui';
ctx.fillText('a desktop pet that', 128, 470);
ctx.fillText('notices your face', 128, 548);
ctx.fillStyle = '#e8705f';
ctx.fillRect(128, 572, 520, 10);
ctx.fillStyle = '#5a6078'; ctx.font = '500 38px "SF Pro Rounded", ui-rounded, system-ui';
ctx.fillText('smiles · blinks · heartbeat · breath', 128, 660);
ctx.fillStyle = '#8a8fa3'; ctx.font = '500 30px "SF Pro Rounded", ui-rounded, system-ui';
ctx.fillText('Presage SmartSpectra SDK Challenge', 128, 740);

window.coverReady = true;
