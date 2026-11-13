
// ===== 魔獣の手続き型描画 =====
'use strict';

const Art = (() => {
  function hexToRgb(h) {
    h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(h, amt) { // amt -1..1
    const [r, g, b] = hexToRgb(h);
    const f = (c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
  const OUT = 'rgba(10,6,20,0.75)';

  function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2); }
  function rgrad(ctx, x, y, r, c1, c2, c3) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.1);
    g.addColorStop(0, c1); g.addColorStop(0.6, c2); g.addColorStop(1, c3 || c2); return g;
  }
  function lgrad(ctx, x1, y1, x2, y2, stops) { const g = ctx.createLinearGradient(x1, y1, x2, y2); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; }
  function fillStroke(ctx, fill, lw = 3) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke(); }
  function glow(ctx, color, blur, fn) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(); ctx.restore(); }

  function eye(ctx, x, y, r, color, t, slit = false) {
    const blink = (Math.sin(t * 0.9 + x) > 0.985) ? 0.15 : 1;
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, blink);
    glow(ctx, color, 14, () => {
      ell(ctx, 0, 0, r * 1.25, r); ctx.fillStyle = color; ctx.fill();
    });
    ell(ctx, -r * 0.25, 0, slit ? r * 0.25 : r * 0.55, r * 0.8); ctx.fillStyle = '#120818'; ctx.fill();
    ell(ctx, -r * 0.45, -r * 0.35, r * 0.25, r * 0.22); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    ctx.restore();
  }

  function flame(ctx, x, y, w, h, t, c1, c2, seed = 0) {
    const f = Math.sin(t * 12 + seed) * 0.15 + 1;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x - w * 0.6, y - h * 0.5 * f, x + Math.sin(t * 7 + seed) * w * 0.3, y - h * f);
    ctx.quadraticCurveTo(x + w * 0.6, y - h * 0.5 * f, x + w / 2, y);
    ctx.closePath();
    const g = ctx.createLinearGradient(x, y, x, y - h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fill();
  }

  // ---------- 四足獣 ----------
  function quad(ctx, a, t) {
    const [m, s, ac] = a.col;
    const br = Math.sin(t * 2.2) * 2.5;
    const bulk = a.bulky ? 1.25 : 1;
    // 尻尾
    ctx.save(); ctx.translate(68 * bulk, -95 + br * 0.5);
    const sw = Math.sin(t * 3) * 0.25;
    if (a.tail === 'nine') {
      for (let i = 0; i < 9; i++) {
        ctx.save(); ctx.rotate(-1.4 + i * 0.22 + Math.sin(t * 2.5 + i) * 0.08);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(40, -20, 75, 0); ctx.quadraticCurveTo(40, 18, 0, 6); ctx.closePath();
        fillStroke(ctx, lgrad(ctx, 0, 0, 75, 0, [s, m, ac]), 2);
        glow(ctx, ac, 10, () => { ell(ctx, 70, 1, 7, 5); ctx.fillStyle = ac; ctx.fill(); });
        ctx.restore();
      }
    } else if (a.tail === 'flame') {
      ctx.rotate(-0.6 + sw);
      glow(ctx, ac, 25, () => { for (let i = 0; i < 3; i++) flame(ctx, 10 + i * 6, 0, 30 - i * 6, 70 - i * 15, t, i ? ac : m, i ? '#fff4a0' : ac, i * 2); });
    } else if (a.tail === 'leaf' || a.tail === 'cloud') {
      ctx.rotate(-0.5 + sw);
      for (let i = 0; i < 4; i++) { ell(ctx, 15 + i * 12, -i * 10, 18 - i * 2, 9, -0.6); fillStroke(ctx, a.tail === 'leaf' ? ac : rgba('#ffffff', 0.9), 2); }
    } else if (a.tail === 'club') {
      ctx.rotate(-0.2 + sw * 0.5);
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(40, -10, 60, 10); ctx.lineTo(55, 20); ctx.quadraticCurveTo(35, 5, 0, 8); fillStroke(ctx, m);
      ell(ctx, 62, 14, 16, 14); fillStroke(ctx, s);
      for (let i = 0; i < 4; i++) { ctx.beginPath(); const an = i * 1.5; ctx.moveTo(62 + Math.cos(an) * 14, 14 + Math.sin(an) * 14); ctx.lineTo(62 + Math.cos(an) * 26, 14 + Math.sin(an) * 26); ctx.lineWidth = 5; ctx.strokeStyle = ac; ctx.stroke(); }
    } else {
      ctx.rotate(-0.4 + sw); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(30, -30, 60, -20); ctx.lineWidth = 8; ctx.strokeStyle = m; ctx.stroke();
    }
    ctx.restore();
    // 脚（奥）
    const legW = 16 * bulk;
    const leg = (x, ph, dark) => {
      const lift = Math.max(0, Math.sin(t * 2.2 + ph)) * 2;
      ctx.beginPath(); ctx.moveTo(x - legW / 2, -70); ctx.lineTo(x - legW / 2 + 2, -8 - lift); ctx.quadraticCurveTo(x, 2 - lift, x + legW / 2 + 4, -4 - lift); ctx.lineTo(x + legW / 2, -70); ctx.closePath();
      fillStroke(ctx, dark ? shade(m, -0.35) : lgrad(ctx, x, -70, x, 0, [m, shade(m, -0.2)]));
      ctx.beginPath(); ctx.moveTo(x - legW / 2 + 2, -6 - lift); for (let k = 0; k < 3; k++) { ctx.lineTo(x - legW / 2 + k * 6 - 3, 2 - lift); ctx.lineTo(x - legW / 2 + k * 6 + 2, -6 - lift); } ctx.fillStyle = '#f5f0e0'; ctx.fill();
    };
    leg(-28 * bulk, 0, true); leg(52 * bulk, 1.5, true);
    // 胴体
    ell(ctx, 10, -88 + br, 78 * bulk, 42 * bulk);
    fillStroke(ctx, rgrad(ctx, 0, -100, 80 * bulk, shade(m, 0.3), m, shade(m, -0.4)));
    ell(ctx, 0, -66 + br, 50 * bulk, 14 * bulk); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
    // 模様
    ctx.save(); ell(ctx, 10, -88 + br, 78 * bulk, 42 * bulk); ctx.clip();
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-10 + i * 25, -135); ctx.quadraticCurveTo(0 + i * 25, -100, -15 + i * 25, -80); ctx.lineWidth = 6; ctx.strokeStyle = rgba(s.startsWith('#') ? s : '#000000', 0.55); ctx.stroke(); }
    ctx.restore();
    leg(-48 * bulk, 3, false); leg(36 * bulk, 4.5, false);
    // 首と頭
    const hx = -82 * bulk, hy = -132 + br * 1.3;
    ctx.beginPath(); ctx.moveTo(-40 * bulk, -110 + br); ctx.quadraticCurveTo(hx + 10, hy + 10, hx + 15, hy + 30); ctx.lineTo(-30 * bulk, -60 + br); ctx.closePath(); fillStroke(ctx, m);
    // たてがみ
    if (a.mane) {
      for (let i = 0; i < 6; i++) {
        const mx = -45 * bulk - i * 7, my = -118 + br - i * 4;
        if (a.mane === 'flame') glow(ctx, ac, 18, () => flame(ctx, mx, my + 8, 22, 40 + Math.sin(t * 9 + i) * 8, t, m, ac, i));
        else if (a.mane === 'leaf') { ell(ctx, mx, my, 9, 18, -0.8 + i * 0.1); fillStroke(ctx, ac, 2); }
        else { ell(ctx, mx, my, 14, 10, 0); ctx.fillStyle = rgba('#ffffff', 0.85); ctx.fill(); }
      }
    }
    // 頭
    ell(ctx, hx, hy, 30 * bulk, 26 * bulk); fillStroke(ctx, rgrad(ctx, hx, hy, 30, shade(m, 0.35), m, shade(m, -0.3)));
    // 鼻面
    ctx.beginPath(); ctx.moveTo(hx - 12, hy - 12); ctx.quadraticCurveTo(hx - 52 * bulk, hy - 6, hx - 50 * bulk, hy + 8); ctx.quadraticCurveTo(hx - 30, hy + 22, hx - 5, hy + 18); ctx.closePath(); fillStroke(ctx, shade(m, 0.1));
    ell(ctx, hx - 48 * bulk, hy + 2, 5, 4); ctx.fillStyle = '#1a0a10'; ctx.fill();
    // 牙
    ctx.beginPath(); ctx.moveTo(hx - 36, hy + 14); ctx.lineTo(hx - 32, hy + 24); ctx.lineTo(hx - 28, hy + 15); ctx.fillStyle = '#fff'; ctx.fill();
    // 耳
    const ear = (ex, rot) => { ctx.save(); ctx.translate(ex, hy - 22); ctx.rotate(rot + Math.sin(t * 3) * 0.05); ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(0, a.ears ? -38 : -26); ctx.lineTo(10, 4); ctx.closePath(); fillStroke(ctx, m); ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(0, a.ears ? -28 : -18); ctx.lineTo(5, 2); ctx.fillStyle = ac; ctx.fill(); ctx.restore(); };
    ear(hx + 6, 0.3); ear(hx + 20, 0.5);
    // 角
    if (a.horns) {
      for (let i = 0; i < a.horns; i++) {
        ctx.save(); ctx.translate(hx - 8 + i * 14, hy - 20); ctx.rotate(-0.3 + i * 0.4);
        ctx.beginPath(); ctx.moveTo(-5, 0); ctx.quadraticCurveTo(-8, -30, a.horns === 1 ? -4 : 12, -45); ctx.quadraticCurveTo(2, -25, 6, 0); ctx.closePath();
        fillStroke(ctx, lgrad(ctx, 0, 0, 0, -45, ['#f0e8d0', ac]), 2); ctx.restore();
      }
    }
    if (a.antlers) {
      ctx.save(); ctx.lineCap = 'round';
      glow(ctx, ac, 15, () => {
        ctx.strokeStyle = ac; ctx.lineWidth = 5;
        const br2 = (x, y, ang, len, d) => { if (d > 3) return; const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.lineWidth = 5 - d; ctx.stroke(); br2(x2, y2, ang - 0.5, len * 0.7, d + 1); br2(x2, y2, ang + 0.4, len * 0.6, d + 1); };
        br2(hx + 5, hy - 20, -1.9, 28, 0); br2(hx + 18, hy - 20, -1.3, 28, 0);
      });
      ctx.restore();
    }
    eye(ctx, hx - 14, hy - 4, 7, a.eye, t, true);
  }

  // ---------- 竜蛇 ----------
  function serpent(ctx, a, t) {
    const [m, s, ac] = a.col;
    const N = 26;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = 90 - u * 130 + Math.sin(u * 7 + t * 2) * 22 * (1 - u * 0.6);
      const y = -12 - u * 165 + Math.cos(u * 4.5 + t * 1.5) * 10 + (u > 0.85 ? Math.sin(t * 2) * 4 : 0);
      const r = 10 + 24 * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.85) + (u < 0.2 ? -u * 10 : 0);
      pts.push({ x, y, r });
    }
    const head = pts[N];
    // 翼
    if (a.wings) {
      const wb = pts[Math.floor(N * 0.65)];
      const fl = Math.sin(t * 3) * 0.25;
      [1, 0].forEach(k => {
        ctx.save(); ctx.translate(wb.x + 10, wb.y); ctx.rotate(-0.4 - fl + k * 0.3); ctx.scale(k ? 0.8 : 1, 1);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(70, -90); ctx.lineTo(110, -60);
        for (let j = 0; j < 4; j++) ctx.quadraticCurveTo(100 - j * 25, -20 + j * 5, 90 - j * 28, -30 + j * 18 + 10);
        ctx.closePath();
        fillStroke(ctx, lgrad(ctx, 0, 0, 110, -80, [rgba(a.bone ? '#203020' : s.startsWith('#') ? s : '#202040', k ? 0.75 : 0.9), rgba(ac, 0.6)]), 2.5);
        ctx.strokeStyle = shade(m, -0.2); ctx.lineWidth = 3;
        for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.moveTo(70, -90); ctx.lineTo(90 - j * 28, -20 + j * 18); ctx.stroke(); }
        ctx.restore();
      });
    }
    // 頭巾（コブラ）
    if (a.hood) {
      ell(ctx, head.x + 18, head.y + 20, 42, 55, 0.1); fillStroke(ctx, lgrad(ctx, head.x, head.y - 30, head.x, head.y + 70, [m, s]));
      for (let i = 0; i < 3; i++) { ell(ctx, head.x + 18, head.y + i * 20, 8, 6); ctx.fillStyle = ac; ctx.fill(); }
    }
    // 胴
    for (let i = 0; i < N; i++) {
      const p = pts[i];
      ell(ctx, p.x, p.y, p.r, p.r * 0.92);
      ctx.fillStyle = rgrad(ctx, p.x, p.y, p.r, shade(m, 0.35), m, shade(m, -0.45)); ctx.fill();
      if (i % 2 === 0) { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.stroke(); }
      if (a.bone && i % 3 === 0) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.7, 0.3, 2.8); ctx.strokeStyle = 'rgba(30,20,30,0.7)'; ctx.lineWidth = 3; ctx.stroke(); }
      // 背びれ
      if ((a.fins || a.crystals) && i % 3 === 1 && i > 3 && i < N - 2) {
        ctx.beginPath(); ctx.moveTo(p.x - 6, p.y - p.r * 0.8); ctx.lineTo(p.x + 6, p.y - p.r * 0.8 - (a.crystals ? 26 : 18)); ctx.lineTo(p.x + 10, p.y - p.r * 0.6); ctx.closePath();
        glow(ctx, ac, a.crystals ? 12 : 0, () => fillStroke(ctx, a.crystals ? rgba('#e0ffff', 0.9) : ac, 2));
      }
      // 腹
      ell(ctx, p.x - p.r * 0.2, p.y + p.r * 0.35, p.r * 0.55, p.r * 0.35); ctx.fillStyle = rgba('#ffffff', 0.13); ctx.fill();
    }
    // 頭
    ctx.save(); ctx.translate(head.x, head.y); ctx.rotate(-0.15 + Math.sin(t * 2) * 0.05);
    const jaw = Math.max(0, Math.sin(t * 1.3)) * 0.18;
    ctx.save(); ctx.rotate(jaw);
    ctx.beginPath(); ctx.moveTo(10, 8); ctx.quadraticCurveTo(-30, 26, -62, 14); ctx.lineTo(-55, 6); ctx.lineTo(10, 0); ctx.closePath(); fillStroke(ctx, shade(m, -0.15));
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-52 + k * 12, 8); ctx.lineTo(-48 + k * 12, 0); ctx.lineTo(-44 + k * 12, 8); ctx.fillStyle = '#fff'; ctx.fill(); }
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(22, -8); ctx.quadraticCurveTo(10, -36, -24, -26); ctx.quadraticCurveTo(-58, -18, -70, 2); ctx.quadraticCurveTo(-40, 8, 22, 10); ctx.closePath();
    fillStroke(ctx, rgrad(ctx, -10, -15, 45, shade(m, 0.4), m, shade(m, -0.3)));
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-62 + k * 12, 3); ctx.lineTo(-58 + k * 12, 12); ctx.lineTo(-54 + k * 12, 3); ctx.fillStyle = '#fff'; ctx.fill(); }
    ell(ctx, -64, -6, 3, 2); ctx.fillStyle = '#000'; ctx.fill();
    // 角
    for (let i = 0; i < (a.horns || 0); i++) {
      ctx.save(); ctx.translate(4 + i * 9, -22); ctx.rotate(0.6 + i * 0.25);
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(10, -30, 40 - i * 6, -38); ctx.quadraticCurveTo(14, -18, 6, 4); ctx.closePath();
      fillStroke(ctx, lgrad(ctx, 0, 0, 40, -38, [a.crystals ? '#e0ffff' : '#f0e8d0', ac]), 2); ctx.restore();
    }
    eye(ctx, -22, -14, 7, a.eye, t, true);
    ctx.restore();
    if (a.bone) glow(ctx, ac, 20, () => { for (let i = 0; i < 5; i++) { const p = pts[6 + i * 4]; flame(ctx, p.x, p.y - p.r * 0.5, 14, 26 + Math.sin(t * 8 + i) * 6, t, rgba(ac, 0.8), 'rgba(220,255,220,0.6)', i); } });
  }

  // ---------- 人型（戦士） ----------
  function humanoid(ctx, a, t) {
    const [m, s, ac] = a.col;
    const br = Math.sin(t * 2) * 2;
    const bk = a.bulky ? 1.18 : 1;
    // オーラ
    glow(ctx, a.aura, 30, () => {
      ctx.globalAlpha = 0.25 + Math.sin(t * 3) * 0.08;
      ell(ctx, 0, -100, 70 * bk, 110); ctx.fillStyle = rgba(a.aura, 0.25); ctx.fill();
      ctx.globalAlpha = 1;
    });
    // マント
    if (a.cape) {
      const w = Math.sin(t * 2.5) * 10;
      ctx.beginPath(); ctx.moveTo(-18 * bk, -150 + br); ctx.quadraticCurveTo(30 + w, -100, 55 + w * 1.5, -8); ctx.lineTo(20, -2); ctx.quadraticCurveTo(10 + w * 0.5, -60, 18 * bk, -150 + br); ctx.closePath();
      fillStroke(ctx, lgrad(ctx, 0, -150, 40, 0, [a.cape, shade(a.cape, -0.5)]));
    }
    // 脚
    const legs = (x, ph) => {
      ctx.beginPath(); ctx.moveTo(x - 10 * bk, -78); ctx.lineTo(x - 8, -6); ctx.lineTo(x - 18, 0); ctx.lineTo(x + 8, 0); ctx.lineTo(x + 9 * bk, -78); ctx.closePath();
      fillStroke(ctx, lgrad(ctx, x, -78, x, 0, [s, shade(s, -0.3)]));
      if (a.helm || a.mech) { ell(ctx, x, -40, 9, 8); fillStroke(ctx, m, 2); }
    };
    legs(14, 0); legs(-14, 1);
    // 胴
    ctx.beginPath(); ctx.moveTo(-26 * bk, -150 + br); ctx.lineTo(26 * bk, -150 + br); ctx.lineTo(18 * bk, -80); ctx.lineTo(-18 * bk, -80); ctx.closePath();
    fillStroke(ctx, lgrad(ctx, -26, -150, 26, -80, [shade(m, 0.3), m, shade(m, -0.35)]));
    ctx.beginPath(); ctx.moveTo(-18 * bk, -92); ctx.lineTo(18 * bk, -92); ctx.lineTo(20 * bk, -78); ctx.lineTo(-20 * bk, -78); ctx.closePath(); fillStroke(ctx, ac, 2);
    if (a.mech) { glow(ctx, ac, 20, () => { ell(ctx, 0, -125 + br, 9, 9); ctx.fillStyle = ac; ctx.fill(); }); }
    else { ctx.beginPath(); ctx.moveTo(0, -148 + br); ctx.lineTo(-8, -120); ctx.lineTo(0, -100); ctx.lineTo(8, -120); ctx.closePath(); ctx.fillStyle = rgba(ac, 0.8); ctx.fill(); }
    // 奥の腕
    ctx.beginPath(); ctx.moveTo(22 * bk, -146 + br); ctx.lineTo(34 * bk, -100); ctx.lineTo(26, -92); ctx.lineTo(14, -140); ctx.closePath(); fillStroke(ctx, shade(m, -0.3));
    // 肩当て
    if (a.bulky || a.helm) { [-1, 1].forEach(k => { ell(ctx, k * 26 * bk, -148 + br, 15 * bk, 11 * bk, k * 0.3); fillStroke(ctx, lgrad(ctx, 0, -160, 0, -135, [shade(m, 0.4), shade(m, -0.2)])); }); }
    // 頭
    const hy = -170 + br;
    ell(ctx, -2, hy, 15, 17); fillStroke(ctx, a.mech ? m : '#f2d6c0');
    if (a.hair && !a.helm) {
      ctx.beginPath(); ctx.moveTo(14, hy - 4); ctx.quadraticCurveTo(10, hy - 24, -6, hy - 22); ctx.quadraticCurveTo(-20, hy - 20, -18, hy - 4);
      ctx.lineTo(-10, hy - 10); ctx.lineTo(4, hy - 14); ctx.quadraticCurveTo(26 + Math.sin(t * 3) * 4, hy + 10, 30 + Math.sin(t * 2.5) * 6, hy + 40); ctx.quadraticCurveTo(18, hy + 18, 14, hy - 4); ctx.closePath();
      fillStroke(ctx, lgrad(ctx, 0, hy - 24, 0, hy + 40, [shade(a.hair, 0.3), a.hair]));
    }
    if (a.helm) {
      ctx.beginPath(); ctx.arc(-2, hy - 2, 18, Math.PI * 0.95, Math.PI * 2.05); ctx.lineTo(16, hy + 10); ctx.lineTo(-20, hy + 10); ctx.closePath();
      fillStroke(ctx, lgrad(ctx, 0, hy - 20, 0, hy + 10, [shade(m, 0.5), m]));
      ctx.fillStyle = '#0a0a14'; ctx.fillRect(-20, hy - 2, 20, 5);
      glow(ctx, a.eye, 12, () => { ctx.fillStyle = a.eye; ctx.fillRect(-18, hy - 1, a.helm === 2 ? 16 : 6, 3); });
      if (a.helm === 1) { ctx.beginPath(); ctx.moveTo(4, hy - 18); ctx.quadraticCurveTo(24, hy - 40, 40 + Math.sin(t * 4) * 3, hy - 30); ctx.quadraticCurveTo(24, hy - 26, 10, hy - 14); fillStroke(ctx, ac, 2); }
      if (a.helm === 3) { [-1, 1].forEach(k => { ctx.beginPath(); ctx.moveTo(-2 + k * 10, hy - 14); ctx.quadraticCurveTo(k * 26 - 2, hy - 30, k * 18 - 2, hy - 46); ctx.lineTo(k * 6 - 2, hy - 16); fillStroke(ctx, '#ddd', 2); }); }
    } else if (!a.mech) {
      glow(ctx, a.eye, 10, () => { ell(ctx, -11, hy - 2, 3, 2.4); ctx.fillStyle = a.eye; ctx.fill(); });
    }
    if (a.hat) { ell(ctx, -2, hy - 10, 34, 8, -0.1); fillStroke(ctx, '#c8a868'); ctx.beginPath(); ctx.moveTo(-14, hy - 12); ctx.lineTo(-2, hy - 28); ctx.lineTo(10, hy - 12); fillStroke(ctx, '#b89858', 2); }
    if (a.jester) {
      [[-24, -40, '#ff30a0'], [-2, -50, '#30c0ff'], [20, -38, '#ffe040']].forEach(([dx, dy, c], i) => {
        ctx.beginPath(); ctx.moveTo(-14, hy - 10); ctx.quadraticCurveTo(dx, hy + dy + 10, dx + Math.sin(t * 3 + i) * 5, hy + dy); ctx.lineTo(10, hy - 10); fillStroke(ctx, c, 2);
        glow(ctx, c, 8, () => { ell(ctx, dx + Math.sin(t * 3 + i) * 5, hy + dy, 4, 4); ctx.fillStyle = '#fff'; ctx.fill(); });
      });
      ctx.fillStyle = '#fff'; ell(ctx, -6, hy + 2, 12, 10); ctx.fill();
      ctx.beginPath(); ctx.arc(-8, hy + 4, 6, 0.2, Math.PI - 0.2); ctx.strokeStyle = '#ff30a0'; ctx.lineWidth = 2; ctx.stroke();
      glow(ctx, a.eye, 10, () => { ctx.fillStyle = a.eye; ell(ctx, -12, hy - 2, 2.5, 3); ctx.fill(); });
    }
    if (a.mech) {
      ctx.fillStyle = '#101018'; ctx.fillRect(-18, hy - 6, 22, 8);
      glow(ctx, a.eye, 16, () => { ctx.fillStyle = a.eye; ctx.fillRect(-16, hy - 4, 16, 4); });
      ctx.beginPath(); ctx.moveTo(6, hy - 16); ctx.lineTo(14, hy - 34); ctx.lineWidth = 3; ctx.strokeStyle = '#aaa'; ctx.stroke();
      glow(ctx, ac, 10, () => { ell(ctx, 14, hy - 36, 4, 4); ctx.fillStyle = ac; ctx.fill(); });
    }
    // 前の腕と武器
    const sw = Math.sin(t * 2) * 0.06;
    ctx.save(); ctx.translate(-24 * bk, -144 + br); ctx.rotate(0.5 + sw);
    ctx.beginPath(); ctx.moveTo(-7 * bk, 0); ctx.lineTo(-6, 52); ctx.lineTo(7, 52); ctx.lineTo(8 * bk, 0); ctx.closePath(); fillStroke(ctx, lgrad(ctx, -8, 0, 8, 0, [shade(m, 0.3), m]));
    ell(ctx, 0, 56, 8 * bk, 8 * bk); fillStroke(ctx, a.mech || a.helm ? shade(m, 0.2) : '#f2d6c0', 2);
    ctx.translate(0, 56); ctx.rotate(-1.9);
    const wpn = a.weapon;
    if (wpn === 'katana' || wpn === 'twin' || wpn === 'greatsword') {
      const L = wpn === 'greatsword' ? 120 : 95, W = wpn === 'greatsword' ? 9 : 4;
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(-4, -4, 22, 8);
      ctx.fillStyle = ac; ctx.fillRect(16, -10, 5, 20);
      glow(ctx, a.aura, 18, () => {
        ctx.beginPath(); ctx.moveTo(20, -W); ctx.lineTo(20 + L, -W * 0.3 - (wpn === 'katana' ? 6 : 0)); ctx.lineTo(24 + L, 0); ctx.lineTo(20, W); ctx.closePath();
        ctx.fillStyle = lgrad(ctx, 20, -W, 20, W, ['#ffffff', '#c8d8e8', '#8090a8']); ctx.fill(); ctx.strokeStyle = rgba(a.aura, 0.9); ctx.lineWidth = 1.5; ctx.stroke();
      });
      if (wpn === 'twin') { ctx.save(); ctx.rotate(0.5); ctx.fillStyle = '#ddeeff'; glow(ctx, a.aura, 14, () => { ctx.beginPath(); ctx.moveTo(14, -3); ctx.lineTo(80, -1); ctx.lineTo(84, 0); ctx.lineTo(14, 3); ctx.fill(); }); ctx.restore(); }
    } else if (wpn === 'trident') {
      ctx.fillStyle = '#c0a060'; ctx.fillRect(-50, -3, 160, 6);
      glow(ctx, a.aura, 16, () => { ctx.fillStyle = '#c0f0ff'; [-12, 0, 12].forEach(o => { ctx.beginPath(); ctx.moveTo(108, o - 3); ctx.lineTo(140 - Math.abs(o), o); ctx.lineTo(108, o + 3); ctx.fill(); }); ctx.fillRect(104, -14, 6, 28); });
    } else if (wpn === 'gauntlet') {
      glow(ctx, ac, 20, () => { ell(ctx, 6, 0, 18, 16); ctx.fillStyle = lgrad(ctx, 0, -16, 0, 16, ['#888', '#333']); ctx.fill(); ctx.strokeStyle = ac; ctx.lineWidth = 3; ctx.stroke(); });
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(22, -8 + i * 8); ctx.lineTo(34 + Math.random() * 10, -10 + i * 8 + Math.random() * 6); ctx.strokeStyle = ac; ctx.lineWidth = 2; ctx.stroke(); }
    } else if (wpn === 'cards') {
      for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate(-0.4 + i * 0.25); ctx.fillStyle = '#fff'; ctx.fillRect(10, -7, 22, 14); ctx.strokeStyle = '#ff30a0'; ctx.lineWidth = 1.5; ctx.strokeRect(10, -7, 22, 14); ctx.fillStyle = i % 2 ? '#ff30a0' : '#200a30'; ctx.font = 'bold 10px sans-serif'; ctx.fillText(['♠', '♥', '♦', '♣'][i], 16, 4); ctx.restore(); }
    }
    ctx.restore();
  }

  // ---------- 鳥・翼 ----------
  function bird(ctx, a, t) {
    const [m, s, ac] = a.col;
    const bob = Math.sin(t * 2.5) * 8;
    const fl = Math.sin(t * 5) * 0.35;
    ctx.save(); ctx.translate(0, -130 + bob);
    if (a.halo) glow(ctx, '#fff6a0', 20, () => { ell(ctx, -30, -70, 26, 7, -0.15); ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 4; ctx.stroke(); });
    const wing = (side, scale, ang, alpha) => {
      ctx.save(); ctx.translate(8, -12); ctx.rotate(ang); ctx.scale(scale, scale * side);
      if (a.moth) {
        ell(ctx, 50, -40, 70, 48, -0.4); fillStroke(ctx, lgrad(ctx, 0, 0, 110, -80, [m, shade(m, -0.4)]));
        ell(ctx, 68, -50, 20, 16, -0.4); ctx.fillStyle = s; ctx.fill(); ell(ctx, 68, -50, 11, 9); ctx.fillStyle = ac; ctx.fill();
        ell(ctx, 30, 25, 40, 26, 0.5); fillStroke(ctx, shade(m, -0.2));
      } else {
        const n = 7;
        for (let i = n - 1; i >= 0; i--) {
          const an = -1.2 + i * 0.22, len = 70 + i * 10 - (i > 4 ? (i - 4) * 18 : 0);
          ctx.save(); ctx.rotate(an + 1.2);
          ell(ctx, len * 0.55, 0, len * 0.6, 11, 0);
          const c1 = a.flamewing ? (i % 2 ? '#ffe060' : '#ff6020') : i % 2 ? m : shade(m, -0.15);
          ctx.globalAlpha = alpha;
          if (a.flamewing) glow(ctx, '#ff8020', 15, () => fillStroke(ctx, lgrad(ctx, 0, 0, len, 0, [c1, rgba('#ffe060', 0.4)]), 1.5));
          else fillStroke(ctx, lgrad(ctx, 0, 0, len, 0, [c1, shade(m, 0.3), ac]), 2);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };
    const pairs = a.sixwing ? 3 : 1;
    for (let p = pairs - 1; p >= 0; p--) wing(1, 0.95 - p * 0.15, -1.9 - fl + p * 0.5, 0.75);
    // 尾羽
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.translate(35, 18); ctx.rotate(0.3 + i * 0.18 + Math.sin(t * 3 + i) * 0.05);
      ell(ctx, 40, 0, 42, 7); a.flamewing ? glow(ctx, '#ff8020', 12, () => fillStroke(ctx, lgrad(ctx, 0, 0, 80, 0, [m, '#ffe060']), 1.5)) : fillStroke(ctx, lgrad(ctx, 0, 0, 80, 0, [m, ac]), 2);
      ctx.restore();
    }
    // 胴
    ell(ctx, 0, 0, a.moth ? 22 : 34, a.moth ? 44 : 30, a.moth ? 0.3 : -0.2); fillStroke(ctx, rgrad(ctx, 0, 0, 36, shade(m, 0.4), m, shade(m, -0.3)));
    ell(ctx, -10, 8, 18, 14, -0.2); ctx.fillStyle = rgba('#ffffff', 0.2); ctx.fill();
    // 頭
    ctx.save(); ctx.translate(-34, -28);
    if (a.crest) {
      for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate(-0.5 + i * 0.35 + Math.sin(t * 4 + i) * 0.06); ell(ctx, 18, -14, 22, 5, -0.6); fillStroke(ctx, a.crest === 2 ? '#fff6c0' : ac, 1.5); ctx.restore(); }
    }
    if (a.moth) { [-1, 1].forEach(k => { ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(-10 + k * 12, -40, -24 + k * 10, -46); ctx.strokeStyle = ac; ctx.lineWidth = 2; ctx.stroke(); }); }
    ell(ctx, 0, 0, 18, 16); fillStroke(ctx, rgrad(ctx, 0, 0, 18, shade(m, 0.4), m));
    if (!a.moth) { ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(-38, 2); ctx.lineTo(-14, 6); ctx.closePath(); fillStroke(ctx, '#ffd040', 2); }
    eye(ctx, -6, -3, 5, a.eye, t, false);
    ctx.restore();
    // 前の翼
    for (let p = pairs - 1; p >= 0; p--) wing(-1, 0.9 - p * 0.15, 1.9 + fl - p * 0.5 + Math.PI, 0.95);
    // 雷
    if (a.spark) {
      glow(ctx, '#fff17a', 15, () => {
        ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); let x = (Math.random() - .5) * 140, y = (Math.random() - .5) * 120; ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - .5) * 30; y += (Math.random() - .5) * 30; ctx.lineTo(x, y); } ctx.stroke(); }
      });
    }
    // 足
    ctx.strokeStyle = '#d0a030'; ctx.lineWidth = 3;
    [-6, 8].forEach(x => { ctx.beginPath(); ctx.moveTo(x, 26); ctx.lineTo(x - 2, 46); ctx.lineTo(x - 10, 52); ctx.moveTo(x - 2, 46); ctx.lineTo(x + 4, 52); ctx.stroke(); });
    ctx.restore();
  }

  // ---------- ゴーレム ----------
  function golem(ctx, a, t) {
    const [m, s, ac] = a.col;
    const br = Math.sin(t * 1.6) * 2.5;
    const pulse = 0.6 + Math.sin(t * 4) * 0.4;
    const rock = (x, y, w, h, r = 0.1, fill) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(r);
      ctx.beginPath(); ctx.moveTo(-w / 2 + 6, -h / 2); ctx.lineTo(w / 2 - 4, -h / 2 + 3); ctx.lineTo(w / 2, h / 2 - 6); ctx.lineTo(w / 2 - 8, h / 2); ctx.lineTo(-w / 2 + 3, h / 2 - 2); ctx.lineTo(-w / 2, -h / 2 + 8); ctx.closePath();
      fillStroke(ctx, fill || lgrad(ctx, -w / 2, -h / 2, w / 2, h / 2, [shade(m, 0.3), m, shade(m, -0.4)]));
      ctx.restore();
    };
    // 脚
    rock(-26, -26, 34, 52, -0.05); rock(28, -26, 34, 52, 0.05);
    // 奥の腕
    rock(64, -110 + br, 34, 60, -0.2, shade(m, -0.3)); rock(70, -60 + br, 44, 40, -0.1, shade(m, -0.35));
    // 胴
    rock(0, -110 + br, 130, 100, 0.02);
    // 亀裂と核
    const coreC = a.core === 'lava' ? '#ff6a1a' : a.core === 'leaf' ? '#80ff60' : '#80e8ff';
    glow(ctx, coreC, 25 * pulse, () => {
      ctx.strokeStyle = coreC; ctx.lineWidth = 3; ctx.lineCap = 'round';
      [[[-50, -140], [-30, -120], [-35, -100]], [[40, -150], [20, -125], [30, -95]], [[-10, -70], [5, -85], [-5, -100]]].forEach(seg => { ctx.beginPath(); ctx.moveTo(seg[0][0], seg[0][1] + br); seg.slice(1).forEach(p => ctx.lineTo(p[0], p[1] + br)); ctx.stroke(); });
      ell(ctx, 0, -112 + br, 18 + pulse * 3, 18 + pulse * 3); ctx.fillStyle = rgrad(ctx, 0, -112 + br, 20, '#ffffff', coreC, rgba(coreC, 0.2)); ctx.fill();
    });
    if (a.moss) { for (let i = 0; i < 6; i++) { ell(ctx, -50 + i * 20, -155 + br + (i % 2) * 6, 14, 7); ctx.fillStyle = rgba('#50a040', 0.9); ctx.fill(); } for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-40 + i * 25, -152 + br); ctx.quadraticCurveTo(-44 + i * 25, -130, -38 + i * 25 + Math.sin(t * 2 + i) * 3, -118 + br); ctx.strokeStyle = '#60b040'; ctx.lineWidth = 2; ctx.stroke(); } }
    if (a.crystals) { [[-55, -160], [-30, -172], [45, -165], [60, -150]].forEach(([x, y], i) => { glow(ctx, '#c0ffff', 14, () => { ctx.beginPath(); ctx.moveTo(x - 8, y + 12 + br); ctx.lineTo(x, y - 22 - i * 3 + br); ctx.lineTo(x + 8, y + 12 + br); ctx.closePath(); fillStroke(ctx, lgrad(ctx, x, y - 20, x, y + 12, ['#ffffff', '#80d8f0']), 2); }); }); }
    // 頭
    rock(-14, -178 + br * 1.2, 46, 38, -0.05);
    if (a.crown) { glow(ctx, '#ffd040', 12, () => { ctx.beginPath(); ctx.moveTo(-36, -194 + br); [-28, -20, -12, -4, 4].forEach((x, i) => { ctx.lineTo(x, -214 - (i % 2 ? 0 : 8) + br); ctx.lineTo(x + 4, -196 + br); }); ctx.lineTo(8, -194 + br); ctx.closePath(); fillStroke(ctx, '#ffd040', 2); }); }
    glow(ctx, a.eye, 18, () => { ctx.fillStyle = a.eye; ctx.fillRect(-30, -182 + br * 1.2, 12, 5); ctx.fillRect(-12, -182 + br * 1.2, 10, 5); });
    // 前の腕
    rock(-64, -112 + br, 38, 64, 0.2); rock(-74, -56 + br, 50, 44, 0.1);
    glow(ctx, coreC, 10 * pulse, () => { ctx.strokeStyle = coreC; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-90, -62 + br); ctx.lineTo(-70, -50 + br); ctx.lineTo(-60, -66 + br); ctx.stroke(); });
  }

  // ---------- 不定形（水母・海魔） ----------
  function blob(ctx, a, t) {
    const [m, s, ac] = a.col;
    const bob = Math.sin(t * 1.8) * 7;
    const cy = (a.kraken ? -120 : -140) + bob;
    // 触手
    const n = a.tentacles || 6;
    for (let i = 0; i < n; i++) {
      const x0 = -50 + (i / (n - 1)) * 100;
      const len = a.kraken ? 110 + (i % 3) * 20 : 90 + (i % 2) * 30;
      ctx.beginPath(); ctx.moveTo(x0 - 8, cy + 20);
      const pts = [];
      for (let k = 1; k <= 8; k++) { const u = k / 8; pts.push([x0 + Math.sin(t * 2.4 + i + u * 5) * 18 * u + (a.kraken ? (x0 * 0.8) * u : 0), cy + 20 + u * len]); }
      pts.forEach(p => ctx.lineTo(p[0] - 8 * (1 - 0.8), p[1]));
      for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k][0] + 8 * (1 - k / 8) + 2, pts[k][1]);
      ctx.closePath();
      ctx.fillStyle = a.kraken ? lgrad(ctx, 0, cy, 0, cy + len, [m, shade(m, -0.4)]) : lgrad(ctx, 0, cy, 0, cy + len, [rgba(m, 0.85), rgba(ac, 0.1)]);
      ctx.fill(); if (a.kraken) { ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke(); for (let k = 2; k < 7; k += 2) { ell(ctx, pts[k][0], pts[k][1], 3, 3); ctx.fillStyle = ac; ctx.fill(); } }
    }
    // 傘
    glow(ctx, a.kraken ? 'transparent' : ac, 30, () => {
      ctx.beginPath(); ctx.moveTo(-75, cy + 25);
      ctx.bezierCurveTo(-85, cy - 90, 85, cy - 90, 75, cy + 25);
      for (let i = 0; i < 6; i++) ctx.quadraticCurveTo(75 - i * 25 - 12, cy + 38 + Math.sin(t * 3 + i) * 4, 75 - (i + 1) * 25, cy + 25);
      ctx.closePath();
      ctx.fillStyle = a.kraken ? rgrad(ctx, -10, cy - 30, 90, shade(m, 0.3), m, shade(m, -0.4)) : rgrad(ctx, -10, cy - 30, 90, rgba('#ffffff', 0.9), rgba(m, 0.75), rgba(s, 0.85));
      ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    });
    if (!a.kraken) { glow(ctx, ac, 25, () => { ell(ctx, 0, cy - 15, 26 + Math.sin(t * 3) * 3, 18); ctx.fillStyle = rgba(ac, 0.55); ctx.fill(); }); }
    else { for (let i = 0; i < 6; i++) { ell(ctx, -40 + i * 16, cy - 40 + Math.abs(i - 2.5) * 6, 5, 5); ctx.fillStyle = rgba(ac, 0.6); ctx.fill(); } }
    eye(ctx, -32, cy + 2, a.kraken ? 10 : 7, a.eye, t, a.kraken);
    eye(ctx, 14, cy + 2, a.kraken ? 10 : 7, a.eye, t + 1, a.kraken);
    if (a.kraken) { ctx.strokeStyle = '#200'; ctx.lineWidth = 4; [[-46, cy - 14, -20, cy - 6], [26, cy - 6, 2, cy - 14]].forEach(l => { ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke(); }); }
  }

  // ---------- 浮遊眼 ----------
  function eyeBeast(ctx, a, t) {
    const [m, s, ac] = a.col;
    const bob = Math.sin(t * 1.5) * 8;
    const cy = -135 + bob, R = 58;
    // 触手
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); const x0 = -30 + i * 12; ctx.moveTo(x0, cy + R * 0.7);
      for (let k = 1; k <= 6; k++) ctx.lineTo(x0 + Math.sin(t * 2 + i + k * 0.7) * 12, cy + R * 0.7 + k * 14);
      ctx.strokeStyle = shade(m, 0.2); ctx.lineWidth = 7 - i % 3; ctx.lineCap = 'round'; ctx.stroke();
    }
    // 輪
    const rings = a.rings || 2;
    const drawRing = (front) => {
      for (let i = 0; i < rings; i++) {
        const rot = t * (0.5 + i * 0.2) * (i % 2 ? -1 : 1) + i;
        ctx.save(); ctx.translate(0, cy); ctx.rotate(0.4 + i * 0.6);
        ctx.beginPath(); ctx.ellipse(0, 0, R + 22 + i * 12, (R + 22 + i * 12) * 0.28, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
        glow(ctx, ac, 12, () => { ctx.strokeStyle = rgba(ac, 0.8); ctx.lineWidth = 2.5; ctx.stroke(); });
        for (let k = 0; k < 6; k++) {
          const an = rot + k * Math.PI / 3; const sn = Math.sin(an);
          if ((sn > 0) !== front) continue;
          const rx = (R + 22 + i * 12);
          glow(ctx, ac, 10, () => { ell(ctx, Math.cos(an) * rx, sn * rx * 0.28, 4, 4); ctx.fillStyle = '#fff'; ctx.fill(); });
        }
        ctx.restore();
      }
    };
    drawRing(false);
    if (a.halo) glow(ctx, '#fff6a0', 20, () => { ell(ctx, 0, cy - R - 22, 40, 10); ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 4; ctx.stroke(); });
    // 球体
    ell(ctx, 0, cy, R, R); fillStroke(ctx, rgrad(ctx, 0, cy, R, shade(m, 0.4), m, shade(s, -0.2)), 4);
    // 白目
    const lid = Math.sin(t * 0.7) > 0.97 ? 0.1 : 1;
    ctx.save(); ctx.translate(-8, cy); ctx.scale(1, lid);
    ell(ctx, 0, 0, R * 0.78, R * 0.62); ctx.fillStyle = rgrad(ctx, 0, 0, R * 0.7, '#ffffff', '#f0e0e8', '#c0a0b0'); ctx.fill();
    ctx.strokeStyle = 'rgba(200,30,60,0.5)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) { const an = i * 0.9; ctx.beginPath(); ctx.moveTo(Math.cos(an) * R * 0.75, Math.sin(an) * R * 0.58); ctx.quadraticCurveTo(Math.cos(an + 0.3) * R * 0.5, Math.sin(an + 0.2) * R * 0.4, Math.cos(an) * R * 0.35, Math.sin(an) * R * 0.3); ctx.stroke(); }
    const lx = -10 + Math.sin(t * 0.8) * 6, ly = Math.cos(t * 1.1) * 4;
    glow(ctx, a.eye, 20, () => { ell(ctx, lx, ly, R * 0.36, R * 0.36); ctx.fillStyle = rgrad(ctx, lx, ly, R * 0.36, shade(a.eye, 0.5), a.eye, shade(a.eye, -0.5)); ctx.fill(); });
    ell(ctx, lx, ly, R * 0.08, R * 0.28); ctx.fillStyle = '#080008'; ctx.fill();
    ell(ctx, lx - 8, ly - 10, 6, 5); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    ctx.restore();
    drawRing(true);
  }

  // ---------- 植物 ----------
  function plant(ctx, a, t) {
    const [m, s, ac] = a.col;
    const sw = Math.sin(t * 1.8) * 6;
    // 根
    ctx.strokeStyle = shade(s, -0.3); ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(-40 + i * 20, -5, -60 + i * 30, 2); ctx.stroke(); }
    // 茎
    ctx.beginPath(); ctx.moveTo(-8, -6); ctx.bezierCurveTo(-20, -60, 30 + sw, -90, -10 + sw, -140); ctx.lineTo(6 + sw, -140); ctx.bezierCurveTo(44 + sw, -90, -2, -60, 10, -6); ctx.closePath();
    fillStroke(ctx, lgrad(ctx, 0, 0, 0, -140, [shade(s, -0.3), s]));
    // 葉
    [[-10, -50, -1], [14, -80, 1], [-6, -110, -1]].forEach(([x, y, k], i) => {
      ctx.save(); ctx.translate(x + sw * 0.5, y); ctx.rotate(k * (0.6 + Math.sin(t * 2 + i) * 0.1));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(k * 30, -26, k * 62, -6); ctx.quadraticCurveTo(k * 30, 12, 0, 0); fillStroke(ctx, lgrad(ctx, 0, 0, k * 60, 0, [s, shade(s, 0.4)]), 2);
      ctx.restore();
    });
    // 花
    const fx = -12 + sw, fy = -165;
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(Math.sin(t * 1.4) * 0.08);
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 4 + t * 0.2);
      ell(ctx, 0, -42, 18, 34); fillStroke(ctx, lgrad(ctx, 0, -10, 0, -76, [shade(m, -0.3), m, ac]), 2);
      ctx.restore();
    }
    ell(ctx, 0, 0, 34, 34); fillStroke(ctx, rgrad(ctx, 0, 0, 34, shade(m, 0.2), shade(m, -0.4), '#200010'));
    // 口
    const open = 8 + Math.abs(Math.sin(t * 2)) * 10;
    ctx.beginPath(); ctx.ellipse(-4, 6, 22, open, 0, 0, Math.PI * 2); ctx.fillStyle = '#1a0008'; ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-22 + i * 7, 6 - open + 2); ctx.lineTo(-19 + i * 7, 6 - open + 10); ctx.lineTo(-16 + i * 7, 6 - open + 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-22 + i * 7, 6 + open - 2); ctx.lineTo(-19 + i * 7, 6 + open - 10); ctx.lineTo(-16 + i * 7, 6 + open - 2); ctx.fill(); }
    eye(ctx, -16, -18, 5, a.eye, t); eye(ctx, 8, -18, 5, a.eye, t + 2);
    ctx.restore();
    // 胞子
    for (let i = 0; i < 6; i++) { const ph = (t * 0.4 + i / 6) % 1; ell(ctx, fx + Math.sin(i * 9 + t) * 50, fy - ph * 80, 3, 3); ctx.fillStyle = rgba(ac, 1 - ph); ctx.fill(); }
  }

  const BODIES = { quad, serpent, humanoid, bird, golem, blob, eye: eyeBeast, plant };

  function drawBeast(ctx, beast, t, opt = {}) {
    const a = beast.art;
    ctx.save();
    if (opt.mutant) ctx.filter = `hue-rotate(${opt.mutant}deg) saturate(1.3)`;
    (BODIES[a.body] || quad)(ctx, a, t);
    ctx.restore();
  }

  // ポートレート（カード用）
  function portrait(beast, w = 160, h = 140, mutant = 0) {
    const c = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    const tc = TYPES[beast.types[0]].c;
    const g = ctx.createRadialGradient(w / 2, h * 0.6, 5, w / 2, h * 0.6, w * 0.7);
    g.addColorStop(0, rgba(tc, 0.45)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2 + 8, h - 10); ctx.scale(h / 250, h / 250);
    drawBeast(ctx, beast, 1.3, { mutant });
    return c;
  }

  return { drawBeast, portrait, shade, rgba, ell, glow, flame, lgrad, rgrad };
})();

