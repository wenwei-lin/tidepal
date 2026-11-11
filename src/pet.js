// Pip, a small octopus, drawn on a 2D canvas.
// Everything is driven by a `look` object so the scene code can animate it.

'use strict';

const C = {
  body: '#ff9a8b',
  bodyDark: '#f07c6f',
  belly: '#ffc4b8',
  eyeWhite: '#ffffff',
  pupil: '#2b2d42',
  blush: 'rgba(255, 99, 132, 0.35)',
  mouth: '#7a2e3a',
};

const lerp = (a, b, t) => a + (b - a) * t;

// look: {
//   breath 0..1        mantle swelling (0 = exhaled, 1 = inhaled)
//   gazeX, gazeY -1..1 where the pupils point
//   blink 0..1         1 = eyes closed
//   happy 0..1, surprise 0..1, sleepy 0..1
//   stretch 0..1       arms raised for a stretch
//   glow 0..1          heartbeat glow
//   wobble             time in seconds, for idle tentacle sway
// }
function drawPip(ctx, cx, cy, s, look) {
  ctx.save();
  ctx.translate(cx, cy + (look.hop || 0) * s);
  ctx.rotate(look.tilt || 0);
  ctx.translate(-cx, -cy);
  drawBody(ctx, cx, cy, s, look);
  ctx.restore();
}

function drawBody(ctx, cx, cy, s, look) {
  const t = look.wobble || 0;
  const breath = look.breath ?? 0.5;
  const sx = 1 + 0.07 * (breath - 0.5) * 2;
  const sy = 1 + 0.1 * (breath - 0.5) * 2;

  // heartbeat glow
  if (look.glow > 0.01) {
    const g = ctx.createRadialGradient(cx, cy, s * 0.2, cx, cy, s * 1.15);
    g.addColorStop(0, `rgba(255, 210, 200, ${0.45 * look.glow})`);
    g.addColorStop(1, 'rgba(255, 210, 200, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 1.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // tentacles
  const baseY = cy + s * 0.32 * sy;
  const n = 6;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1) - 0.5; // -0.5..0.5
    const x0 = cx + k * s * 0.85 * sx;
    const sway = Math.sin(t * 1.6 + i * 0.9) * s * 0.06;
    // relaxed: hang down and curl outward; stretched: reach up and out
    const st = look.stretch || 0;
    const side = Math.sign(k) || (i % 2 ? 1 : -1);
    const relaxEnd = { x: x0 + k * s * 0.5 + sway, y: baseY + s * 0.55 };
    const upEnd = { x: x0 + side * s * (0.75 + Math.abs(k) * 0.4), y: cy - s * (0.15 + Math.abs(k) * 0.5) };
    const ex = lerp(relaxEnd.x, upEnd.x, st);
    const ey = lerp(relaxEnd.y, upEnd.y, st);
    const c1x = lerp(x0 + sway * 0.5, x0 + side * s * 0.45, st);
    const c1y = lerp(baseY + s * 0.3, baseY + s * 0.05, st);
    const curl = side * s * 0.12 * (1 - st);

    ctx.strokeStyle = C.bodyDark;
    ctx.lineWidth = s * 0.17;
    ctx.beginPath();
    ctx.moveTo(x0, baseY - s * 0.05);
    ctx.quadraticCurveTo(c1x, c1y, ex, ey);
    ctx.quadraticCurveTo(ex + curl, ey + s * 0.08 * (1 - st), ex + curl * 1.4, ey - s * 0.02);
    ctx.stroke();
    ctx.strokeStyle = C.body;
    ctx.lineWidth = s * 0.12;
    ctx.stroke();
  }

  // mantle (head)
  const w = s * 0.62 * sx;
  const h = s * 0.62 * sy;
  const hy = cy - s * 0.05;
  ctx.fillStyle = C.body;
  ctx.beginPath();
  ctx.moveTo(cx - w, baseY);
  ctx.bezierCurveTo(cx - w * 1.12, hy - h * 0.2, cx - w * 0.8, hy - h * 1.15, cx, hy - h * 1.1);
  ctx.bezierCurveTo(cx + w * 0.8, hy - h * 1.15, cx + w * 1.12, hy - h * 0.2, cx + w, baseY);
  ctx.quadraticCurveTo(cx, baseY + s * 0.12, cx - w, baseY);
  ctx.fill();

  // shine on the head
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.45, hy - h * 0.7, w * 0.16, h * 0.1, -0.6, 0, Math.PI * 2);
  ctx.fill();

  // spots
  ctx.fillStyle = C.bodyDark;
  for (const [dx, dy, r] of [[0.35, -0.85, 0.06], [0.55, -0.55, 0.04], [-0.1, -0.95, 0.035]]) {
    ctx.beginPath();
    ctx.arc(cx + w * dx, hy + h * dy, s * r, 0, Math.PI * 2);
    ctx.fill();
  }

  // eyes
  const eyeY = hy - h * 0.15;
  const eyeDX = w * 0.42;
  const surprise = look.surprise || 0;
  const er = s * (0.15 + 0.04 * surprise);
  const closed = Math.max(look.blink || 0, (look.sleepy || 0) * 0.85);
  for (const side of [-1, 1]) {
    const ex = cx + side * eyeDX;
    if (closed > 0.92) {
      ctx.strokeStyle = C.pupil;
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.arc(ex, eyeY, er * 0.7, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      continue;
    }
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, er, er * 1.12 * (1 - closed), 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = C.eyeWhite;
    ctx.fillRect(ex - er, eyeY - er * 1.2, er * 2, er * 2.4);
    const px = ex + (look.gazeX || 0) * er * 0.38;
    const py = eyeY + (look.gazeY || 0) * er * 0.32;
    ctx.fillStyle = C.pupil;
    ctx.beginPath();
    ctx.arc(px, py, er * (0.62 - 0.12 * surprise), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px - er * 0.2, py - er * 0.25, er * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + er * 0.18, py + er * 0.18, er * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // brows for sad / cross
  const sad = look.sad || 0, cross = look.cross || 0;
  if (sad > 0.2 || cross > 0.2) {
    ctx.strokeStyle = C.mouth;
    ctx.lineWidth = s * 0.03;
    for (const side of [-1, 1]) {
      const bx = cx + side * eyeDX, by = eyeY - er * 1.35;
      const slant = (cross > sad ? 1 : -1) * side * s * 0.05 * Math.max(sad, cross);
      ctx.beginPath();
      ctx.moveTo(bx - er * 0.8, by + slant);
      ctx.lineTo(bx + er * 0.8, by - slant);
      ctx.stroke();
    }
  }

  // blush
  const happy = look.happy || 0;
  ctx.fillStyle = `rgba(255, 99, 132, ${0.22 + 0.3 * happy})`;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * w * 0.68, eyeY + s * 0.17, s * 0.09, s * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // mouth
  const my = eyeY + s * 0.2;
  ctx.strokeStyle = C.mouth;
  ctx.fillStyle = C.mouth;
  ctx.lineWidth = s * 0.03;
  if ((look.mouthOpen || 0) > 0.15) {
    ctx.beginPath();
    ctx.ellipse(cx, my + s * 0.02, s * 0.05, s * 0.07 * look.mouthOpen, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (surprise > 0.5) {
    ctx.beginPath();
    ctx.ellipse(cx, my + s * 0.02, s * 0.045, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (happy > 0.5) {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.09, my);
    ctx.quadraticCurveTo(cx, my + s * 0.15, cx + s * 0.09, my);
    ctx.closePath();
    ctx.fill();
  } else if (sad > 0.4) {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.06, my + s * 0.03);
    ctx.quadraticCurveTo(cx, my - s * 0.03, cx + s * 0.06, my + s * 0.03);
    ctx.stroke();
  } else {
    const smile = 0.04 + 0.04 * happy;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.06, my);
    ctx.quadraticCurveTo(cx, my + s * smile, cx + s * 0.06, my);
    ctx.stroke();
  }

  // sleepy z's
  if ((look.sleepy || 0) > 0.6) {
    ctx.fillStyle = 'rgba(80, 110, 140, 0.8)';
    ctx.font = `600 ${Math.round(s * 0.16)}px ui-rounded, system-ui, sans-serif`;
    const zt = (t * 0.6) % 1;
    ctx.globalAlpha = 1 - zt;
    ctx.fillText('z', cx + w * 0.9, hy - h * (0.9 + zt * 0.6));
    ctx.globalAlpha = 1;
  }
}

module.exports = { drawPip };
