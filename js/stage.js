// ===== バトルステージ（PixiJS + pixi-filters + GSAP） =====
// 世界レイヤ（背景・魔獣・エフェクト）はWebGLで描画し、カメラ・ブルーム・衝撃波・色収差をかける。
// HUD（体力板・カットイン・文字）は上に重ねた2Dキャンバスで描く。
'use strict';

const Scene = (() => {
  const W = 540, H = 720;
  const S = {
    speed: 1, field: 'none', fieldTurns: 0, fieldFlash: 0,
    mons: {}, spr: {}, battle: null, target: null,
    hpDisp: {}, hpLag: {}, hazard: { e: 0, p: 0 },
    pops: [], banner: null, cut: null, flash: null, showPanels: true, ready: false,
  };
  // 配置（縦画面：上に敵3体、下に味方3体）
  const SLOT = {
    e0: { bx: 112, by: 352, sc: 0.5 }, e1: { bx: 270, by: 322, sc: 0.46 }, e2: { bx: 428, by: 352, sc: 0.5 },
    p0: { bx: 108, by: 636, sc: 0.6 }, p1: { bx: 270, by: 668, sc: 0.62 }, p2: { bx: 432, by: 636, sc: 0.6 },
  };
  const isE = id => typeof id === 'string' && id[0] === 'e';
  function mkSpr(id) { const b = SLOT[id] || SLOT.p1; return { bx: b.bx, by: b.by, sc: b.sc, flip: isE(id) ? 1 : -1, ox: 0, oy: 0, alpha: 0, scale: 1, sx: 1, sy: 1, rot: 0, hurt: 0, white: 0, visible: false }; }
  Object.keys(SLOT).forEach(k => { S.spr[k] = mkSpr(k); });
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickA = a => a[Math.floor(Math.random() * a.length)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const hexN = h => parseInt(h.replace('#', ''), 16);
  const TC = t => TYPES[t] || TYPES.none;
  const STAGE_COL = { atk: 0xff6a3a, def: 0xffd36a, mag: 0xb070ff, res: 0x6ab0ff, spd: 0x60ffe0 };

  let app, world, bgSprite, bgCanvas, bgTex, ringLayer, monLayer, darkG, fxBack, fxFront, hazardG, worldCM, glitchRGB, zoomBlur, bloom;
  let hud, hctx;
  const tex = {};
  const views = {};
  const parts = [];
  const shocks = [];
  const cam = { x: W / 2, y: H / 2, z: 1, shake: 0 };
  let T = 0, dark = { v: 0 }, invertT = 0, rgbAmt = { v: 0 }, zoomAmt = { v: 0 };
  const circles = {};
  let curTgt = 'e0', lastAtk = null;
  const TG = id => curTgt || (isE(id) ? 'p1' : 'e1');

  // ---------- 時間制御（演出速度・ヒットストップ・スロー） ----------
  let slow = 1, stopUntil = 0;
  function timeScale() { return (performance.now() < stopUntil ? 0.0001 : 1) * slow * S.speed; }
  function applyTS() { gsap.globalTimeline.timeScale(timeScale()); }
  const wait = ms => new Promise(r => gsap.delayedCall(ms / 1000, r));
  function hitstop(ms) { stopUntil = Math.max(stopUntil, performance.now() + ms); applyTS(); setTimeout(applyTS, ms + 5); }
  function slowmo(f, ms) { slow = f; applyTS(); setTimeout(() => { slow = 1; applyTS(); }, ms); }
  const tw = (o, v) => new Promise(r => gsap.to(o, Object.assign({}, v, { onComplete: r })));

  function center(side) { const s = S.spr[side] || S.spr.p1; return { x: s.bx + s.ox, y: s.by + s.oy - 105 * s.sc }; }
  function foot(side) { const s = S.spr[side] || S.spr.p1; return { x: s.bx + s.ox, y: s.by + s.oy }; }
  const dirOf = id => { const a = SLOT[id], b = SLOT[TG(id)]; return (a && b && Math.sign(b.bx - a.bx)) || (isE(id) ? -1 : 1); };

  // ---------- 粒子 ----------
  // o: {t:テクスチャ名|配列, x,y, vx,vy, life, s0,s1(拡大), a0,a1, rot, vr, tint, add, grav, drag, front, align, sx,sy, follow,home}
  function P(o) {
    if (parts.length > 1400) return null;
    const name = Array.isArray(o.t) ? pickA(o.t) : o.t;
    const sp = new PIXI.Sprite(tex[name] || PIXI.Texture.WHITE);
    sp.anchor.set(o.ax ?? 0.5, o.ay ?? 0.5);
    sp.blendMode = o.add === false ? 'normal' : 'add';
    if (o.tint !== undefined) sp.tint = o.tint;
    const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 0.6, s0: 0.3, s1: 0.6, a0: 1, a1: 0, rot: 0, vr: 0, grav: 0, drag: 1, sx: 1, sy: 1, fadeIn: 0.05 }, o);
    p.max = p.life; p.sp = sp;
    sp.x = p.x; sp.y = p.y; sp.rotation = p.rot;
    (o.front === false ? fxBack : o.layer || fxFront).addChild(sp);
    parts.push(p);
    return p;
  }
  function updParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { p.sp.destroy(); parts.splice(i, 1); continue; }
      const k = 1 - p.life / p.max;
      const dr = Math.pow(p.drag, dt * 60);
      p.vx *= dr; p.vy *= dr; p.vy += p.grav * dt;
      if (p.follow) { p.vx += (p.follow.x - p.x) * p.home * dt * 4; p.vy += (p.follow.y - p.y) * p.home * dt * 4; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const s = lerp(p.s0, p.s1, p.ease ? 1 - Math.pow(1 - k, 3) : k);
      p.sp.x = p.x; p.sp.y = p.y;
      p.sp.rotation = p.align ? Math.atan2(p.vy, p.vx) + Math.PI / 2 : p.rot;
      p.sp.scale.set(s * p.sx, s * p.sy);
      const fi = Math.min(1, k / Math.max(0.001, p.fadeIn / p.max));
      p.sp.alpha = lerp(p.a0, p.a1, k) * fi * (p.flicker ? (Math.random() > 0.35 ? 1 : 0.2) : 1);
    }
  }
  function burst(x, y, t, n, spd, o = {}) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = rnd(0.25, 1) * spd; P(Object.assign({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v }, typeof o === 'function' ? o(i) : o, { t: o.t || t })); }
  }
  function streaks(x, y, color, n = 16, spd = 900, len = 0.5) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = rnd(0.4, 1) * spd; P({ t: ['trace_01', 'trace_06', 'trace_07'], x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, align: 1, life: rnd(0.18, 0.35), s0: len, s1: len * 0.4, sx: 0.35, sy: 1.6, tint: color, drag: 0.88 }); }
  }
  function ringFx(x, y, color, s0 = 0.2, s1 = 2, life = 0.45, o = {}) { return P(Object.assign({ t: 'circle_03', x, y, s0, s1, life, tint: color, ease: 1, a0: 1, a1: 0 }, o)); }
  function flare(x, y, color = 0xffffff, s = 2, life = 0.3) { P({ t: 'flare_01', x, y, s0: s * 0.3, s1: s * 0.8, life, tint: color, ease: 1, a0: 0.9 }); P({ t: 'light_01', x, y, s0: s * 0.2, s1: s * 0.45, life: life * 1.2, tint: color, a0: 0.45 }); }
  function smoke(x, y, n, color = 0x302838, o = {}) {
    for (let i = 0; i < n; i++) P(Object.assign({ t: ['smoke_04', 'smoke_05', 'smoke_07', 'smoke_08'], x: x + rnd(-30, 30), y: y + rnd(-20, 20), vx: rnd(-60, 60), vy: rnd(-90, -20), life: rnd(0.8, 1.6), s0: 0.4, s1: 1.2, a0: 0.75, tint: color, add: false, rot: rnd(0, 6), vr: rnd(-1, 1), drag: 0.95, front: false }, o));
  }

  // ---------- 衝撃波・画面効果 ----------
  function shock(x, y, amp = 30, radius = 360, life = 0.7, wl = 120) {
    if (!PIXI.filters || shocks.length > 4) return;
    const g = world.toGlobal({ x, y });
    const f = new PIXI.filters.ShockwaveFilter({ center: { x: g.x, y: g.y }, amplitude: amp, wavelength: wl, speed: radius / life, brightness: 1.15, radius });
    f.time = 0;
    shocks.push({ f, life, max: life });
  }
  function impactFrame(ms = 60) { invertT = performance.now() + ms; }
  function rgbKick(v = 8, dur = 0.35) { rgbAmt.v = v; gsap.to(rgbAmt, { v: 0, duration: dur, ease: 'power2.out' }); }
  function zoomKick(v = 0.25, dur = 0.5, cx = W / 2, cy = H / 2) { if (zoomBlur) zoomBlur.center = world.toGlobal({ x: cx, y: cy }); zoomAmt.v = v; gsap.to(zoomAmt, { v: 0, duration: dur, ease: 'power2.out' }); }
  function shake(n) { cam.shake = Math.max(cam.shake, n); }
  function punch(x, y, z = 1.12, inT = 0.08, hold = 0.06, outT = 0.45) {
    gsap.killTweensOf(cam);
    gsap.to(cam, { x, y, z, duration: inT, ease: 'power3.out' });
    gsap.to(cam, { x: W / 2, y: H / 2, z: 1, duration: outT, delay: inT + hold, ease: 'power3.inOut' });
  }
  function camTo(x, y, z, d = 0.5, ease = 'power3.inOut') { gsap.killTweensOf(cam); return tw(cam, { x, y, z, duration: d, ease }); }
  function camReset(d = 0.5) { return camTo(W / 2, H / 2, 1, d); }

  // ---------- 背景 ----------
  function drawBg() {
    const c = bgCanvas.getContext('2d');
    const F = FIELDS[S.field] || FIELDS.none;
    c.setTransform(2, 0, 0, 2, 0, 0);
    const HZ = 300; // 地平線
    const g = c.createLinearGradient(0, 0, 0, HZ);
    g.addColorStop(0, F.sky[0]); g.addColorStop(0.6, F.sky[1]); g.addColorStop(1, F.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (Assets.bgImg.arena) {
      const im = Assets.bgImg.arena, r = Math.max(W / im.width, H / im.height);
      c.drawImage(im, (W - im.width * r) / 2, (H - im.height * r) / 2, im.width * r, im.height * r);
      c.globalCompositeOperation = 'soft-light'; c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
    } else {
      const rng = mulberry(7);
      for (let i = 0; i < 110; i++) { c.globalAlpha = rng() * 0.6 + 0.1; c.fillStyle = '#fff'; const z = rng() * 1.3 + 0.3; c.fillRect(rng() * W, rng() * 230, z, z); }
      c.globalAlpha = 1;
      const moonC = { bloodmoon: '#c81c22', sun: '#ffd27a', sanct: '#fff4d6', chaos: '#e070d0', storm: '#9aa0c0' }[S.field] || '#e8e2d2';
      const MX = 400, MY = 92, mr = S.field === 'bloodmoon' ? 70 : S.field === 'sun' ? 52 : 38;
      const mg = c.createRadialGradient(MX, MY, mr * 0.5, MX, MY, mr * 3.2);
      mg.addColorStop(0, Art.rgba(moonC, 0.32)); mg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = mg; c.fillRect(0, 0, W, HZ + 40);
      c.fillStyle = moonC; c.beginPath(); c.arc(MX, MY, mr, 0, 7); c.fill();
      c.globalAlpha = 0.16; c.fillStyle = '#000';
      for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(MX + Math.cos(i * 2.1) * mr * 0.5, MY + Math.sin(i * 1.7) * mr * 0.45, mr * (0.1 + (i % 3) * 0.06), 0, 7); c.fill(); }
      c.globalAlpha = 1;
      const ridge = (y0, amp, f, seed, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 6) c.lineTo(x, y0 - (Math.sin(x * f + seed) * amp + Math.sin(x * f * 2.7 + seed * 2) * amp * 0.45 + Math.sin(x * f * 9 + seed) * amp * 0.12)); c.lineTo(W, H); c.fill(); };
      ridge(HZ - 40, 26, 0.008, 3, 'rgba(20,16,26,0.75)');
      // 工廠のシルエット
      c.fillStyle = '#0c0a0f';
      [[0, 120, 54], [58, 175, 36], [100, 96, 92], [196, 196, 30], [232, 140, 64], [300, 104, 46], [352, 70, 40], [470, 150, 70]].forEach(([x, h, w], i) => {
        c.fillRect(x, HZ - h, w, h + 40);
        if (i % 2) { c.fillRect(x + w * 0.35, HZ - h - 40, w * 0.22, 40); c.fillRect(x + w * 0.3, HZ - h - 44, w * 0.32, 5); }
        for (let wy = HZ - h + 14; wy < HZ - 8; wy += 17) for (let wx = x + 6; wx < x + w - 8; wx += 13) if (rng() > 0.62) { c.fillStyle = `rgba(255,${150 + rng() * 60 | 0},80,${0.3 + rng() * 0.4})`; c.fillRect(wx, wy, 3, 6); c.fillStyle = '#0c0a0f'; }
      });
      ridge(HZ + 6, 10, 0.014, 9, '#0e0c12');
    }
    // 闘技場の床（奥の敵陣から手前の自陣へ）
    const fg = c.createLinearGradient(0, HZ, 0, H);
    fg.addColorStop(0, '#141218'); fg.addColorStop(1, '#2a262e');
    c.fillStyle = fg; c.fillRect(0, HZ + 4, W, H - HZ);
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1.2;
    for (let i = 0; i < 12; i++) { const y = HZ + 4 + Math.pow(i / 12, 1.6) * (H - HZ); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    for (let i = -10; i <= 10; i++) { c.beginPath(); c.moveTo(W / 2 + i * 28, HZ + 4); c.lineTo(W / 2 + i * 120, H); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,0.035)';
    for (let i = 0; i < 12; i++) { const y = HZ + 5 + Math.pow(i / 12, 1.6) * (H - HZ); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // 中央の境界線（朱の注連縄のような帯）
    c.fillStyle = 'rgba(200,50,31,0.22)'; c.fillRect(0, 468, W, 3);
    const hz = c.createLinearGradient(0, HZ - 40, 0, HZ + 60); hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(0.5, Art.rgba(F.sky[2], 0.22)); hz.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = hz; c.fillRect(0, HZ - 40, W, 100);
    const vg = c.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, H * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    bgTex.source.update();
  }
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function ambient(dt) {
    const F = FIELDS[S.field]; if (!F) return;
    const n = Math.max(1, Math.round(dt * 60));
    for (let i = 0; i < n; i++) {
      switch (F.p) {
        case 'embers': if (Math.random() < 0.45) P({ t: 'flare_01', x: rnd(0, W), y: H + 10, vx: rnd(-20, 30), vy: rnd(-90, -30), life: rnd(3, 6), s0: rnd(0.05, 0.12), s1: 0.02, tint: 0xff8a3a, front: false, a0: 0.9 }); break;
        case 'rain': for (let k = 0; k < 4; k++) P({ t: 'trace_06', x: rnd(-150, W), y: rnd(-40, 0), vx: 220, vy: 1300, align: 1, life: 0.55, s0: 0.25, s1: 0.25, sx: 0.12, sy: 1.2, tint: 0x9cc8ff, a0: 0.45, a1: 0.3, front: false }); break;
        case 'storm': if (Math.random() < 0.3) P({ t: 'trace_06', x: rnd(0, W), y: -20, vx: 80, vy: 900, align: 1, life: 0.8, s0: 0.2, s1: 0.2, sx: 0.12, sy: 1, tint: 0xb0b8e0, a0: 0.4, front: false }); if (Math.random() < 0.004) { S.flash = { c: '#e8ecff', a: 0.35 }; skyBolt(); } break;
        case 'snow': if (Math.random() < 0.8) P({ t: 'circle_05', x: rnd(-200, W), y: -10, vx: rnd(80, 200), vy: rnd(60, 140), life: 6, s0: rnd(0.02, 0.05), s1: 0.03, tint: 0xffffff, a0: 0.9, a1: 0.6, front: Math.random() < 0.3 }); break;
        case 'miasma': if (Math.random() < 0.12) P({ t: ['smoke_07', 'smoke_08'], x: rnd(0, W), y: rnd(330, H), vx: rnd(-20, 20), vy: rnd(-12, -3), life: rnd(4, 7), s0: 0.8, s1: 1.8, tint: 0x5a1a7a, a0: 0.35, add: false, front: false, rot: rnd(0, 6), vr: 0.1 }); break;
        case 'feathers': if (Math.random() < 0.15) P({ t: 'star_05', x: rnd(0, W), y: rnd(0, H * 0.7), life: rnd(1.5, 3), s0: 0.02, s1: 0.1, a0: 0.8, tint: 0xfff0b0, front: false }); if (Math.random() < 0.04) P({ t: 'light_02', x: rnd(0, W), y: -40, vy: 20, life: 6, s0: 0.6, s1: 0.8, a0: 0.12, tint: 0xfff4c0, front: false }); break;
        case 'bloodmoon': if (Math.random() < 0.12) P({ t: 'slash_03', x: rnd(0, W), y: -10, vx: rnd(-20, 20), vy: rnd(40, 80), life: 7, s0: 0.05, s1: 0.05, rot: rnd(0, 6), vr: rnd(-3, 3), tint: 0xd01828, a0: 0.9, front: false }); break;
        case 'chaos': if (Math.random() < 0.3) P({ t: ['star_04', 'spark_03', 'magic_04'], x: rnd(0, W), y: rnd(0, H), vx: rnd(-30, 30), vy: rnd(-30, 30), life: rnd(1, 2), s0: 0.02, s1: rnd(0.1, 0.2), tint: [0xff40c0, 0x40e0ff, 0xffe040][Math.floor(Math.random() * 3)], front: false }); break;
        case 'pollen': if (Math.random() < 0.3) P({ t: 'circle_05', x: rnd(0, W), y: rnd(200, H), vx: rnd(-20, 20), vy: rnd(-30, -5), life: rnd(3, 5), s0: 0.03, s1: 0.015, tint: 0xd8ff90, front: false }); break;
        default: if (Math.random() < 0.06) P({ t: 'circle_05', x: rnd(0, W), y: rnd(150, H), vx: rnd(-8, 8), vy: rnd(-20, -5), life: rnd(3, 6), s0: 0.02, s1: 0.01, tint: 0xc8b8a0, a0: 0.6, front: false });
      }
    }
    // 霧
    if (Math.random() < dt * 0.6) P({ t: 'smoke_07', x: -150, y: rnd(320, 470), vx: rnd(15, 35), vy: 0, life: 30, s0: 2.2, s1: 2.6, a0: 0.07, a1: 0.07, fadeIn: 3, tint: 0xb0a8c0, add: false, front: false, rot: rnd(0, 6), vr: 0.02 });
  }
  function skyBolt() { const x = rnd(80, W - 80); bolt(x, -10, x + rnd(-80, 80), 320, 0xd8dcff, 3, 0.25, fxBack); }

  // 稲妻（Graphics）
  function bolt(x1, y1, x2, y2, color = 0xfff17a, w = 6, life = 0.3, layer) {
    const g = new PIXI.Graphics();
    const pts = [[x1, y1]]; const n = 12;
    for (let i = 1; i < n; i++) { const k = i / n; pts.push([lerp(x1, x2, k) + rnd(-30, 30), lerp(y1, y2, k) + rnd(-18, 18)]); }
    pts.push([x2, y2]);
    const draw = (width, col, a) => { g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => g.lineTo(p[0], p[1])); g.stroke({ width, color: col, alpha: a, cap: 'round', join: 'round' }); };
    draw(w * 3, color, 0.25); draw(w, color, 1); draw(w * 0.35, 0xffffff, 1);
    // 枝
    for (let b = 0; b < 3; b++) { const p = pickA(pts.slice(2, -2)); g.moveTo(p[0], p[1]); let x = p[0], y = p[1]; for (let k = 0; k < 4; k++) { x += rnd(-30, 30); y += rnd(5, 25); g.lineTo(x, y); } g.stroke({ width: w * 0.4, color, alpha: 0.8 }); }
    g.blendMode = 'add';
    (layer || fxFront).addChild(g);
    const st = { a: 1 };
    gsap.to(st, { a: 0, duration: life, ease: 'none', onUpdate: () => { g.alpha = st.a * (Math.random() > 0.25 ? 1 : 0.3); }, onComplete: () => g.destroy() });
    return pts;
  }
  // 汎用の帯（ビーム・光柱）
  function beamSprite(x1, y1, x2, y2, color, width = 60, life = 0.6, texName = 'trace_06') {
    const L = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1);
    const mk = (tint, wMul, alpha) => {
      const s = new PIXI.Sprite(tex[texName]); s.anchor.set(0.5, 1); s.blendMode = 'add'; s.tint = tint;
      s.x = x1; s.y = y1; s.rotation = a + Math.PI / 2; s.alpha = alpha;
      s.scale.set(0.01, L / 256); fxFront.addChild(s);
      const st = { w: 0 };
      gsap.to(st, { w: 1, duration: 0.08, ease: 'power2.out' });
      gsap.to(st, { w: 0, duration: life * 0.5, delay: life * 0.5, ease: 'power2.in', onComplete: () => s.destroy() });
      gsap.ticker.add(function f() { if (s.destroyed) { gsap.ticker.remove(f); return; } s.scale.x = (width * wMul / 256) * st.w * rnd(0.85, 1.15); });
    };
    mk(color, 2.4, 0.5); mk(color, 1.2, 1); mk(0xffffff, 0.45, 1);
  }

  // ---------- 魔獣ビュー ----------
  function buildView(side, m) {
    const old = views[side];
    if (old) { old.cont.destroy({ children: true }); if (old.tex && old.mode === 'proc') old.tex.destroy(true); }
    const cont = new PIXI.Container();
    const shadowG = new PIXI.Graphics(); shadowG.ellipse(0, 0, 90, 16).fill({ color: 0x000000, alpha: 0.5 });
    cont.addChild(shadowG);
    const img = Assets.beastImg[m.beast.id];
    let body, texr, canvas = null, mode;
    if (img) {
      mode = 'img'; texr = PIXI.Texture.from(img);
      body = new PIXI.Sprite(texr); body.anchor.set(0.5, 0.96);
      body.baseScale = 255 / Math.max(img.height, img.width * 0.8);
    } else {
      mode = 'proc'; canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 560;
      texr = PIXI.Texture.from(canvas);
      body = new PIXI.Sprite(texr); body.anchor.set(0.5, (560 - 16) / 560);
      body.baseScale = 0.5;
    }
    const cm = new PIXI.ColorMatrixFilter();
    const filters = [cm];
    if (mode === 'proc' && PIXI.filters) filters.push(new PIXI.filters.GlowFilter({ distance: 10, outerStrength: 1.6, innerStrength: 0, color: hexN(TC(m.types[0]).c), quality: 0.15 }));
    if (mode === 'img' && m.mutant) { const hue = new PIXI.ColorMatrixFilter(); hue.hue(m.mutant, false); filters.unshift(hue); }
    body.filters = filters;
    cont.addChild(body);
    monLayer.addChild(cont); monLayer.children.sort((a, b) => a.y - b.y);
    views[side] = { cont, body, shadowG, cm, canvas, tex: texr, mode, beast: m.beast, mutant: m.mutant, flier: ['bird', 'eye', 'blob'].includes(m.beast.art.body) && !m.beast.art.kraken };
    // 足元の魔法陣
    if (!circles[side]) {
      const sp = S.spr[side];
      const c = new PIXI.Sprite(tex.magic_01); c.anchor.set(0.5); c.blendMode = 'add'; c.alpha = 0.5;
      const holder = new PIXI.Container(); holder.position.set(sp.bx, sp.by + 4); holder.scale.set(sp.sc * 0.95, sp.sc * 0.3);
      holder.addChild(c); ringLayer.addChild(holder); circles[side] = c;
    }
    circles[side].tint = hexN(TC(m.types[0]).c); circles[side].parent.visible = true;
  }
  function updViews(dt) {
    for (const side of Object.keys(views)) {
      const v = views[side], s = S.spr[side], sn = (+side[1] || 0) + (isE(side) ? 3 : 0);
      if (!v) continue;
      v.cont.visible = s.visible;
      if (!s.visible) continue;
      if (s.hurt > 0) s.hurt = Math.max(0, s.hurt - dt * 1.8);
      const hx = s.hurt > 0 ? Math.sin(s.hurt * 70) * 10 * s.hurt : 0;
      v.cont.x = s.bx + s.ox + hx; v.cont.y = s.by + s.oy;
      v.cont.alpha = s.alpha;
      v.shadowG.y = -s.oy * 0.9; v.shadowG.scale.set(s.sc * s.scale * (1 - Math.min(0.5, -s.oy / 300)), s.sc);
      const breath = Math.sin(T * 2.2 + sn) * 0.014;
      const bob = v.flier ? Math.sin(T * 2 + sn) * 7 : 0;
      v.body.y = bob - (v.flier && v.mode === 'img' ? 30 : 0) * s.sc;
      const base = v.body.baseScale * s.sc * s.scale;
      v.body.scale.set(base * s.sx * s.flip * (1 - breath * 0.5), base * s.sy * (1 + breath));
      v.body.rotation = s.rot;
      if (v.mode === 'proc' && (Math.floor(T * 30) % 2 === sn % 2 || v.first !== true)) {
        v.first = true;
        const c = v.canvas.getContext('2d'); c.clearRect(0, 0, 640, 560);
        c.save(); c.translate(320, 544); c.scale(2, 2);
        Art.drawBeast(c, v.beast, T + sn * 3, { mutant: v.mutant });
        c.restore();
        c.globalCompositeOperation = 'source-atop';
        const g = c.createLinearGradient(0, 0, 0, 560); g.addColorStop(0, 'rgba(16,13,20,0.74)'); g.addColorStop(0.75, 'rgba(12,10,15,0.8)'); g.addColorStop(1, Art.rgba(TC(v.beast.types[0]).c, 0.5));
        c.fillStyle = g; c.fillRect(0, 0, 640, 560); c.globalCompositeOperation = 'source-over';
        v.tex.source.update();
      }
      // 白飛び（被弾・召喚）
      const w = s.white, mon = S.mons[side];
      let tc = s.tintC;
      if (!tc && mon) {
        if (mon.status === 'frz') tc = [0.7, 0.95, 1.25];
        else if (mon.status === 'psn') { const p = Math.sin(T * 4) * 0.08; tc = [0.95 + p, 0.78, 1.05 + p]; }
        else if (mon.status === 'brn') { const p = Math.sin(T * 7) * 0.08; tc = [1.12 + p, 0.9, 0.82]; }
        else if (mon.status === 'crs') tc = [0.82, 0.7, 0.92];
        else if (mon.status === 'par' && Math.random() < 0.06) tc = [1.3, 1.3, 0.8];
      }
      if (w > 0.01) v.cm.matrix = [1 - w, 0, 0, 0, w, 0, 1 - w, 0, 0, w, 0, 0, 1 - w, 0, w, 0, 0, 0, 1, 0];
      else if (s.gray) v.cm.desaturate();
      else if (tc) v.cm.matrix = [tc[0], 0, 0, 0, 0, 0, tc[1], 0, 0, 0, 0, 0, tc[2], 0, 0, 0, 0, 0, 1, 0];
      else v.cm.reset();
      // 持続エフェクト（状態異常・能力上昇のオーラ）
      if (mon && mon.hp > 0 && s.alpha > 0.5) {
        const c = center(side), r = 70 * s.sc, rate = dt * 60;
        if (mon.status === 'brn' && Math.random() < 0.25 * rate) P({ t: ['flame_05', 'flame_06'], x: c.x + rnd(-r, r), y: c.y + rnd(-20, 90), vy: rnd(-160, -60), life: 0.6, s0: 0.1, s1: 0.03, tint: pickA([0xff6a1a, 0xffa030]) });
        if (mon.status === 'psn' && Math.random() < 0.12 * rate) P({ t: 'circle_05', x: c.x + rnd(-r, r), y: c.y + rnd(0, 90), vy: rnd(-90, -30), life: 1, s0: 0.03, s1: 0.09, tint: pickA([0xb44cff, 0x60d040]), a0: 0.8 });
        if (mon.status === 'par' && Math.random() < 0.04 * rate) bolt(c.x + rnd(-r, r), c.y + rnd(-r, r), c.x + rnd(-r, r), c.y + rnd(-r, r), 0xfff17a, 2, 0.12);
        if (mon.status === 'frz' && Math.random() < 0.08 * rate) P({ t: 'star_04', x: c.x + rnd(-r, r), y: c.y + rnd(-r, r), s0: 0.02, s1: 0.18, life: 0.5, tint: 0xffffff });
        if (mon.status === 'crs' && Math.random() < 0.08 * rate) P({ t: ['smoke_07', 'smoke_08'], x: c.x + rnd(-r, r), y: c.y + rnd(0, 90), vy: -30, life: 1.4, s0: 0.2, s1: 0.6, tint: 0x2a0838, add: false, a0: 0.5 });
        if (mon.status === 'slp' && Math.random() < 0.012 * rate) api.pop(side, 'Z', '#c0d0ff', 20);
        if (mon.vol && mon.vol.cnf > 0 && Math.random() < 0.1 * rate) { const a = T * 6; P({ t: 'star_04', x: c.x + Math.cos(a) * 50, y: c.y - 100 * s.sc + Math.sin(a) * 12, life: 0.3, s0: 0.15, s1: 0.05, tint: 0xffe060 }); }
        let best = mon.charge ? 'atk' : null, bv = mon.charge || 0; if (mon.block > 0 && !best) { best = 'def'; bv = 1; }
        if (best && Math.random() < 0.05 * bv * rate) P({ t: 'trace_06', x: c.x + rnd(-r, r), y: c.y + rnd(30, 110), vy: rnd(-260, -140), align: 1, life: 0.6, s0: 0.22, s1: 0.06, sx: 0.25, tint: STAGE_COL[best], a0: 0.8 });
      }
    }
  }

  // ---------- 召喚札 ----------
  let talismanTex = null;
  function makeTalisman() {
    const c = document.createElement('canvas'); c.width = 120; c.height = 300;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 120, 0); g.addColorStop(0, '#d9cfb4'); g.addColorStop(0.5, '#efe7d2'); g.addColorStop(1, '#d4c9ad');
    x.fillStyle = g; x.fillRect(0, 0, 120, 300);
    x.strokeStyle = '#b23022'; x.lineWidth = 4; x.strokeRect(8, 8, 104, 284); x.lineWidth = 1.5; x.strokeRect(14, 14, 92, 272);
    x.fillStyle = '#1b1612'; x.font = '900 58px "Shippori Mincho B1", serif'; x.textAlign = 'center'; x.fillText('封', 60, 92); x.fillText('獣', 60, 160);
    x.fillStyle = '#b23022'; x.fillRect(32, 196, 56, 56); x.fillStyle = '#efe7d2'; x.font = '900 30px "Shippori Mincho B1", serif'; x.fillText('印', 60, 236);
    talismanTex = PIXI.Texture.from(c);
  }

  // ---------- HUD（2D） ----------
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  const FONT_D = '"Shippori Mincho B1", "Yu Mincho", serif';
  const FONT_N = '"Barlow Condensed", "Zen Kaku Gothic New", sans-serif';
  const FONT_B = '"Zen Kaku Gothic New", sans-serif';
  const SLOT_KANJI = { p0: '壱', p1: '弐', p2: '参', e0: '甲', e1: '乙', e2: '丙' };
  function intentText(it) {
    const mv = it.mv;
    if (mv.c !== 's') return { icon: '撃', txt: it.est ? String(it.est) : '?', col: '#e8442e' };
    if (mv.heal) return { icon: '癒', txt: '', col: '#5fbf6c' };
    if (mv.self) return { icon: '溜', txt: '', col: '#e0a040' };
    if (mv.protect) return { icon: '護', txt: '', col: '#80c8ff' };
    if (mv.field) return { icon: '異', txt: FIELDS[mv.field].n, col: '#c080ff' };
    if (mv.st) return { icon: '呪', txt: STATUS_N[mv.st[0]], col: STATUS_C[mv.st[0]] };
    return { icon: '技', txt: '', col: '#b8ae98' };
  }
  function drawUnitHud(id) {
    const m = S.mons[id], sp = S.spr[id];
    if (!m || !sp.visible || !m.alive) return;
    const c = hctx, e = isE(id);
    const x = sp.bx + sp.ox, y = sp.by + 10;
    const w = 118, h = 8;
    c.save(); c.globalAlpha = Math.min(1, sp.alpha * 1.6);
    // 狙われ表示
    if (S.target === id) {
      const r = 64 * sp.sc / 0.5, cy = sp.by - 100 * sp.sc, rot = T * 1.5;
      c.strokeStyle = '#e8442e'; c.lineWidth = 3;
      for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2; c.beginPath(); c.arc(x, cy, r, a, a + 0.6); c.stroke(); }
    }
    // 名前
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.font = `800 13px ${FONT_D}`; c.lineWidth = 4; c.strokeStyle = '#0a080c';
    const nm = (m.mutant ? '異・' : '') + m.name;
    c.strokeText(nm, x, y + 2); c.fillStyle = '#ece4cf'; c.fillText(nm, x, y + 2);
    // 番号札
    c.fillStyle = e ? '#3a3540' : '#c8321f'; c.fillRect(x - w / 2 - 20, y - 12, 16, 16);
    c.fillStyle = '#f2ead6'; c.font = `800 11px ${FONT_D}`; c.fillText(SLOT_KANJI[id], x - w / 2 - 12, y);
    // HP
    const r = Math.max(0, (S.hpDisp[id] ?? m.hp) / m.maxhp), rl = Math.max(0, (S.hpLag[id] ?? m.hp) / m.maxhp);
    const by = y + 8;
    c.fillStyle = '#060508'; c.fillRect(x - w / 2, by, w, h);
    if (rl > r) { c.fillStyle = '#e8dcc0'; c.fillRect(x - w / 2, by, w * rl, h); }
    c.fillStyle = r > 0.5 ? '#5fbf6c' : r > 0.25 ? '#d9a93a' : '#d04030'; c.fillRect(x - w / 2, by, w * r, h);
    c.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 1; i < 5; i++) c.fillRect(x - w / 2 + w * i / 5, by, 1, h);
    c.font = `600 13px ${FONT_N}`; c.textAlign = 'right'; c.lineWidth = 3; c.strokeText(String(Math.ceil(S.hpDisp[id] ?? m.hp)), x + w / 2 + 30, by + 8);
    c.fillStyle = '#ece4cf'; c.fillText(String(Math.ceil(S.hpDisp[id] ?? m.hp)), x + w / 2 + 30, by + 8);
    // 守り
    if (m.block > 0) { c.fillStyle = '#5a8ac8'; c.beginPath(); c.moveTo(x - w / 2 - 14, by - 2); c.lineTo(x - w / 2 - 2, by - 2); c.lineTo(x - w / 2 - 2, by + 8); c.lineTo(x - w / 2 - 8, by + 13); c.lineTo(x - w / 2 - 14, by + 8); c.fill(); c.fillStyle = '#fff'; c.font = `700 10px ${FONT_N}`; c.textAlign = 'center'; c.fillText(String(m.block), x - w / 2 - 8, by + 7); }
    // 状態・力溜め
    let tx = x - w / 2; const ty = by + 12;
    c.textAlign = 'left'; c.font = `700 11px ${FONT_B}`;
    const tag = (t, col, fg = '#111') => { const tw2 = c.measureText(t).width + 8; c.fillStyle = col; c.fillRect(tx, ty, tw2, 14); c.fillStyle = fg; c.fillText(t, tx + 4, ty + 11); tx += tw2 + 3; };
    if (m.status) tag(STATUS_N[m.status], STATUS_C[m.status]);
    if (m.confused) tag('混乱', '#e0c050');
    if (m.charge) tag(`力×${m.charge}`, '#e0a040');
    if (m.stunned) tag('怯み', '#8a90a8');
    if (e) {
      // 封印値
      const pip = 9, n = m.sealMax;
      for (let i = 0; i < n; i++) { const px = x - (n * (pip + 3)) / 2 + i * (pip + 3); c.save(); c.translate(px + pip / 2, by - 22); c.rotate(Math.PI / 4); c.fillStyle = m.broken ? '#c8321f' : i < m.seal ? '#ece4cf' : '#2a2530'; c.fillRect(-pip / 2.8, -pip / 2.8, pip / 1.4, pip / 1.4); c.restore(); }
      if (m.broken) { c.textAlign = 'center'; c.font = `900 14px ${FONT_D}`; c.lineWidth = 4; c.strokeText('崩封', x, by - 32); c.fillStyle = '#ff6a4a'; c.fillText('崩封', x, by - 32); }
      // 刻印（弱点）
      c.textAlign = 'center'; c.font = `800 11px ${FONT_D}`;
      const marks = m.weak.slice(0, 4);
      marks.forEach((wk, i) => { const mx = x + w / 2 - 6 - (marks.length - 1 - i) * 17, my = ty; const rev = m.revealed && m.revealed.has(wk); c.fillStyle = rev ? TYPES[wk].c : '#2a2530'; c.fillRect(mx - 7, my, 14, 14); c.fillStyle = rev ? '#111' : '#8f8778'; c.fillText(rev ? TYPES[wk].n : '?', mx, my + 11); });
      // 意図
      if (m.intent && !m.broken) {
        const it = intentText(m.intent);
        const iy = sp.by - 210 * sp.sc - 12;
        const tgtK = m.intent.target ? SLOT_KANJI[m.intent.target] : '';
        const label = `${it.icon}${it.txt ? ' ' + it.txt : ''}${tgtK ? ' →' + tgtK : ''}`;
        c.font = `800 13px ${FONT_D}`; const lw = c.measureText(label).width + 14;
        c.fillStyle = 'rgba(10,8,12,0.85)'; c.fillRect(x - lw / 2, iy - 14, lw, 20);
        c.fillStyle = it.col; c.fillRect(x - lw / 2, iy - 14, 3, 20);
        c.fillStyle = '#f2ead6'; c.fillText(label, x, iy + 1);
      }
    } else {
      // 狙われている印
      const aimed = Object.values(S.mons).some(o => o && o.alive && isE(o.unit) && o.intent && o.intent.target === id && !o.broken);
      if (aimed) { const ay = sp.by - 215 * sp.sc + Math.sin(T * 6) * 3; c.fillStyle = '#e8442e'; c.beginPath(); c.moveTo(x - 8, ay - 10); c.lineTo(x + 8, ay - 10); c.lineTo(x, ay); c.fill(); }
      if (S.battle && S.battle.gauge >= 100) { c.textAlign = 'center'; c.font = `900 13px ${FONT_D}`; const ay = sp.by - 215 * sp.sc - 16; c.fillStyle = Math.sin(T * 6) > 0 ? '#ffd36a' : '#c8321f'; c.fillText('奥義', x, ay); }
    }
    c.restore();
  }
  function drawFieldLabel() {
    const F = FIELDS[S.field]; if (!F) return;
    const c = hctx; c.save();
    const txt = F.n + (S.fieldTurns > 0 ? ` ${S.fieldTurns}` : '');
    c.font = `800 15px ${FONT_D}`; const tw2 = c.measureText(txt).width;
    const x = W - 34 - tw2, y = 20;
    c.fillStyle = 'rgba(16,14,18,0.85)'; c.fillRect(x - 40, y, tw2 + 54, 28);
    c.fillStyle = S.fieldFlash > 0 ? '#ffd36a' : '#c8321f'; c.fillRect(x - 40, y, 28, 28);
    c.fillStyle = '#f2ead6'; c.font = `900 14px ${FONT_D}`; c.textAlign = 'center'; c.fillText('異', x - 26, y + 19);
    c.textAlign = 'left'; c.font = `800 15px ${FONT_D}`; c.fillStyle = '#ece4cf'; c.fillText(txt, x, y + 19);
    c.restore();
  }
  function drawPops(dt) {
    const c = hctx;
    for (let i = S.pops.length - 1; i >= 0; i--) {
      const p = S.pops[i]; p.life -= dt; if (p.life <= 0) { S.pops.splice(i, 1); continue; }
      const k = 1 - p.life / p.max;
      const sc = k < 0.12 ? 1.6 - k * 5 : 1;
      c.save(); c.globalAlpha = Math.min(1, p.life * 4);
      c.translate(p.x, p.y - k * 36); c.scale(sc, sc);
      c.font = `${p.big ? 900 : 800} ${p.size}px ${p.num ? FONT_N : FONT_D}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = '#0a080c'; c.strokeText(p.text, 0, 0);
      c.fillStyle = p.color; c.fillText(p.text, 0, 0);
      c.restore();
    }
  }
  function drawCut(dt) {
    const ct = S.cut; if (!ct) return;
    if (ct.life <= 0) { S.cut = null; return; }
    const k = 1 - ct.life / ct.max, c = hctx;
    const inK = Math.min(1, k * 6), outK = k > 0.82 ? (k - 0.82) / 0.18 : 0;
    const e = 1 - Math.pow(1 - inK, 3);
    c.save();
    c.fillStyle = `rgba(0,0,0,${0.6 * (1 - outK)})`; c.fillRect(0, 0, W, H);
    const bh = 210 * e * (1 - outK), sk = 60;
    c.translate(0, H / 2);
    c.beginPath(); c.moveTo(0, -bh / 2 + sk); c.lineTo(W, -bh / 2 - sk); c.lineTo(W, bh / 2 - sk); c.lineTo(0, bh / 2 + sk); c.closePath();
    c.fillStyle = '#0d0b10'; c.fill();
    c.save(); c.clip();
    // 速度線
    for (let i = 0; i < 40; i++) { const yy = ((i * 53) % 300) - 150, xx = ((T * 2600 * (isE(ct.side) ? -1 : 1) + i * 197) % (W + 600) + W + 600) % (W + 600) - 300; c.fillStyle = i % 5 === 0 ? Art.rgba(ct.color, 0.6) : 'rgba(236,228,207,0.13)'; c.fillRect(xx, yy, 220, i % 5 === 0 ? 3 : 1.5); }
    // 肖像
    const px = isE(ct.side) ? lerp(W + 300, W - 250, e) : lerp(-300, 250, e);
    c.drawImage(ct.img, px - 210 + (isE(ct.side) ? 0 : 0) + k * 30 * (isE(ct.side) ? -1 : 1), -230, 420, 380);
    c.restore();
    c.lineWidth = 4; c.strokeStyle = '#c8321f';
    c.beginPath(); c.moveTo(0, -bh / 2 + sk); c.lineTo(W, -bh / 2 - sk); c.stroke();
    c.beginPath(); c.moveTo(0, bh / 2 + sk); c.lineTo(W, bh / 2 - sk); c.stroke();
    c.globalAlpha = e * (1 - outK);
    const tx = isE(ct.side) ? 60 : W - 60;
    c.textAlign = isE(ct.side) ? 'left' : 'right'; c.textBaseline = 'middle';
    c.font = `800 15px ${FONT_D}`; c.fillStyle = '#c8321f'; c.fillText('覚 醒 奥 義', tx, -42);
    const fz = Math.min(46, Math.floor((W - 70) / Math.max(1, ct.name.length))); c.font = `900 ${fz}px ${FONT_D}`; c.lineWidth = 8; c.strokeStyle = '#0a080c'; c.strokeText(ct.name, tx + (1 - e) * 80 * (isE(ct.side) ? 1 : -1), 12);
    c.fillStyle = '#f2ead6'; c.fillText(ct.name, tx + (1 - e) * 80 * (isE(ct.side) ? 1 : -1), 12);
    c.restore();
  }
  function drawBanner(dt) {
    const b = S.banner; if (!b) return;
    if (b.life <= 0) { S.banner = null; return; }
    const k = 1 - b.life / b.max, c = hctx;
    const a = Math.min(1, b.life * 3, k * 8);
    c.save(); c.globalAlpha = a;
    c.fillStyle = 'rgba(10,8,12,0.82)'; c.fillRect(0, H / 2 - 46, W, 92);
    c.fillStyle = b.color; c.fillRect(0, H / 2 - 46, W, 2); c.fillRect(0, H / 2 + 44, W, 2);
    const slide = (1 - Math.min(1, k * 5)) ** 3 * 120;
    c.font = `900 42px ${FONT_D}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = b.color; c.fillText(b.text, W / 2 + slide, H / 2 - (b.sub ? 8 : 0));
    if (b.sub) { c.font = `500 14px ${FONT_B}`; c.fillStyle = '#d8cfba'; c.fillText(b.sub, W / 2 - slide, H / 2 + 26); }
    c.restore();
  }

  // ---------- メインループ ----------
  function frame() {
    const rdt = Math.min(0.1, app.ticker.deltaMS / 1000);
    applyTS();
    const dt = rdt * gsap.globalTimeline.timeScale();
    T += dt;
    for (const side of Object.keys(S.mons)) {
      const m = S.mons[side]; if (!m) continue;
      if (S.hpDisp[side] === undefined) { S.hpDisp[side] = m.hp; S.hpLag[side] = m.hp; }
      S.hpDisp[side] += (m.hp - S.hpDisp[side]) * Math.min(1, dt * 7);
      if (Math.abs(m.hp - S.hpDisp[side]) < 0.5) S.hpDisp[side] = m.hp;
      if (S.hpLag[side] > S.hpDisp[side]) S.hpLag[side] -= m.maxhp * dt * 0.45; else S.hpLag[side] = S.hpDisp[side];
    }
    if (S.fieldFlash > 0) S.fieldFlash = Math.max(0, S.fieldFlash - dt);
    ambient(dt); updParts(dt); updViews(dt);
    Object.entries(circles).forEach(([k, cs]) => { cs.rotation += dt * 0.3 * (isE(k) ? -1 : 1); });
    // カメラ
    let z = cam.z; const hw = W / 2 / z, hh = H / 2 / z;
    const cx = Math.max(hw, Math.min(W - hw, cam.x)), cy = Math.max(hh, Math.min(H - hh, cam.y));
    world.pivot.set(cx, cy); world.scale.set(z);
    world.position.set(W / 2 + rnd(-cam.shake, cam.shake), H / 2 + rnd(-cam.shake, cam.shake));
    cam.shake *= Math.pow(0.85, dt * 60); if (cam.shake < 0.3) cam.shake = 0;
    darkG.alpha = dark.v;
    // フィルタ
    const fl = [];
    for (let i = shocks.length - 1; i >= 0; i--) { const s = shocks[i]; s.life -= dt; s.f.time = s.max - s.life; if (s.life <= 0) shocks.splice(i, 1); else fl.push(s.f); }
    if (glitchRGB && rgbAmt.v > 0.3) { const v = rgbAmt.v; glitchRGB.red = { x: -v, y: 0 }; glitchRGB.green = { x: 0, y: v * 0.4 }; glitchRGB.blue = { x: v, y: 0 }; fl.push(glitchRGB); }
    if (zoomBlur && zoomAmt.v > 0.01) { zoomBlur.strength = zoomAmt.v; fl.push(zoomBlur); }
    if (performance.now() < invertT) fl.push(worldCM);
    if (bloom) fl.push(bloom);
    world.filters = fl;
    // HUD
    hctx.setTransform(hud.width / W, 0, 0, hud.height / H, 0, 0);
    hctx.clearRect(0, 0, W, H);
    if (S.showPanels) { Object.keys(S.mons).forEach(drawUnitHud); drawFieldLabel(); }
    drawPops(dt); drawCut(dt); drawBanner(dt);
    if (S.flash) { hctx.globalAlpha = Math.max(0, S.flash.a); hctx.fillStyle = S.flash.c; hctx.fillRect(0, 0, W, H); hctx.globalAlpha = 1; S.flash.a -= rdt * 3; if (S.flash.a <= 0) S.flash = null; }
  }

  // ---------- 初期化 ----------
  async function init(canvas, hudCanvas) {
    app = new PIXI.Application();
    await app.init({ canvas, width: W, height: H, resolution: Math.min(2, window.devicePixelRatio || 1), antialias: true, background: 0x0b0a0d, preference: 'webgl', autoDensity: false });

    hud = hudCanvas; hctx = hud.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1); hud.width = W * dpr; hud.height = H * dpr;
    for (const n of Assets.FX_NAMES) if (Assets.fxImg[n]) tex[n] = PIXI.Texture.from(Assets.fxImg[n]);
    world = new PIXI.Container(); app.stage.addChild(world);
    world.filterArea = new PIXI.Rectangle(0, 0, W, H);
    bgCanvas = document.createElement('canvas'); bgCanvas.width = W * 2; bgCanvas.height = H * 2;
    bgTex = PIXI.Texture.from(bgCanvas); bgSprite = new PIXI.Sprite(bgTex); bgSprite.scale.set(0.5);
    world.addChild(bgSprite);
    fxBack = new PIXI.Container(); world.addChild(fxBack);
    ringLayer = new PIXI.Container(); world.addChild(ringLayer);
    hazardG = new PIXI.Graphics(); world.addChild(hazardG);
    monLayer = new PIXI.Container(); world.addChild(monLayer);
    darkG = new PIXI.Graphics(); darkG.rect(-200, -200, W + 400, H + 400).fill(0x000000); darkG.alpha = 0; world.addChild(darkG);
    fxFront = new PIXI.Container(); world.addChild(fxFront);
    worldCM = new PIXI.ColorMatrixFilter(); worldCM.negative(false);
    if (PIXI.filters) {
      bloom = new PIXI.filters.AdvancedBloomFilter({ threshold: 0.74, bloomScale: 0.6, brightness: 1, blur: 5, quality: 4 });
      glitchRGB = new PIXI.filters.RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
      zoomBlur = new PIXI.filters.ZoomBlurFilter({ strength: 0, center: { x: W / 2, y: H / 2 }, innerRadius: 60 });
    }
    makeTalisman();
    drawBg();
    app.ticker.add(frame);
    S.ready = true;
    // タップ入力（論理座標で最も近い魔獣）
    const surf = hudCanvas.parentElement;
    surf.addEventListener('pointerdown', ev => {
      const r = canvas.getBoundingClientRect();
      const lx = (ev.clientX - r.left) / r.width * W, ly = (ev.clientY - r.top) / r.height * H;
      let best = null, bd = 1e9;
      for (const id of Object.keys(S.mons)) { const m = S.mons[id], sp = S.spr[id]; if (!m || !m.alive || !sp.visible) continue; const cx = sp.bx, cy = sp.by - 90 * sp.sc; const d = Math.hypot(lx - cx, (ly - cy) * 0.8); if (d < bd) { bd = d; best = id; } }
      if (best && bd < 110 && api.onTap) api.onTap(best);
    });
  }
  function drawHazards() {
    hazardG.clear();
    ['e', 'p'].forEach(side => {
      const ids = side === 'e' ? ['e0', 'e1', 'e2'] : ['p0', 'p1', 'p2'];
      for (let i = 0; i < (S.hazard[side] || 0); i++) for (const id of ids) for (let k = 0; k < 3; k++) {
        const sp = S.spr[id]; const x = sp.bx - 40 + k * 40 + i * 8, y = sp.by + 26 + (k % 2) * 6 - i * 3;
        hazardG.poly([x - 4, y, x, y - 13, x + 4, y]).fill({ color: 0xb08cff, alpha: 0.85 });
      }
    });
  }

  // =========================================================
  //                      攻撃演出
  // =========================================================
  // 属性ごとの着弾演出
  let lastImpSnd = 0;
  function impact(x, y, t, pw = 1) {
    if (performance.now() - lastImpSnd > 70) { lastImpSnd = performance.now(); Sound.impact(t, pw >= 1.3); }
    const C = hexN(TC(t).c), G = hexN(TC(t).g);
    flare(x, y, G, 1.2 * pw, 0.22);
    ringFx(x, y, C, 0.1, 1.6 * pw, 0.4, { a0: 0.8 });
    streaks(x, y, G, 14 * pw | 0, 900 * pw);
    switch (t) {
      case 'fire':
        for (let i = 0; i < 18 * pw; i++) { const a = rnd(0, 6.28), v = rnd(60, 320) * pw; P({ t: ['fire_01', 'fire_02', 'flame_01', 'flame_03'], x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, drag: 0.9, life: rnd(0.4, 0.8), s0: 0.25, s1: rnd(0.5, 0.9) * pw, rot: rnd(0, 6), vr: rnd(-3, 3), tint: pickA([0xff6a1a, 0xffa030, 0xff3a10]) }); }
        smoke(x, y - 20, 6 * pw, 0x241a18, { vy: -120 });
        break;
      case 'water':
        P({ t: 'twirl_02', x, y, s0: 0.3, s1: 1.4 * pw, life: 0.6, vr: 6, tint: C });
        for (let i = 0; i < 3; i++) ringFx(x, y, G, 0.2, (1 + i * 0.5) * pw, 0.5 + i * 0.1, { t: 'circle_04' });
        for (let i = 0; i < 26 * pw; i++) { const a = rnd(-3.0, -0.1), v = rnd(200, 600); P({ t: 'circle_05', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, grav: 1400, life: 0.8, s0: 0.08, s1: 0.03, tint: G }); }
        smoke(x, y, 4, 0x9cc8ff, { add: true, a0: 0.4 });
        break;
      case 'wood':
        P({ t: 'magic_01', x, y, s0: 0.2, s1: 1.2 * pw, life: 0.6, tint: C, vr: 2, ease: 1 });
        for (let i = 0; i < 24 * pw; i++) { const a = rnd(0, 6.28), v = rnd(100, 450); P({ t: 'slash_03', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.93, grav: 200, life: rnd(0.6, 1.2), s0: 0.08, s1: 0.06, rot: rnd(0, 6), vr: rnd(-10, 10), tint: pickA([0x6fd060, 0xb6f27a, 0x3fa04f]) }); }
        break;
      case 'thunder':
        for (let i = 0; i < 4; i++) P({ t: ['spark_05', 'spark_06'], x: x + rnd(-30, 30), y: y + rnd(-30, 30), s0: 0.5 * pw, s1: 0.9 * pw, rot: rnd(0, 6), life: 0.25, tint: G, flicker: 1 });
        P({ t: 'spark_02', x, y, s0: 0.6, s1: 1.2 * pw, life: 0.35, tint: G, rot: rnd(0, 6), flicker: 1 });
        for (let i = 0; i < 3; i++) bolt(x + rnd(-80, 80), y + rnd(-80, 80), x + rnd(-80, 80), y + rnd(-80, 80), G, 3, 0.2);
        break;
      case 'ice':
        for (let i = 0; i < 16 * pw; i++) { const a = rnd(0, 6.28), v = rnd(200, 700); P({ t: 'trace_02', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, align: 1, drag: 0.86, life: rnd(0.4, 0.8), s0: 0.35, s1: 0.2, sx: 0.5, sy: 1, tint: G }); }
        for (let i = 0; i < 6; i++) P({ t: ['star_04', 'star_07'], x: x + rnd(-60, 60), y: y + rnd(-60, 60), s0: 0.05, s1: 0.35, life: 0.5, tint: 0xffffff, rot: rnd(0, 1) });
        ringFx(x, y, G, 0.2, 1.4, 0.6, { t: 'circle_02' });
        smoke(x, y, 5, 0xd8f4ff, { add: true, a0: 0.35, vy: -20 });
        break;
      case 'steel':
        P({ t: 'scratch_01', x, y, s0: 0.6, s1: 1.1 * pw, rot: rnd(-1, 1), life: 0.35, tint: 0xffffff });
        for (let i = 0; i < 26 * pw; i++) { const a = rnd(0, 6.28), v = rnd(300, 900); P({ t: 'trace_01', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, align: 1, grav: 900, drag: 0.92, life: rnd(0.3, 0.7), s0: 0.18, s1: 0.06, sx: 0.4, sy: 1, tint: pickA([0xffe0a0, 0xffffff, 0xffb040]) }); }
        P({ t: 'star_07', x, y, s0: 0.2, s1: 0.9, life: 0.3, tint: 0xffffff });
        break;
      case 'dark':
        P({ t: 'twirl_03', x, y, s0: 0.3, s1: 1.4 * pw, life: 0.7, vr: -7, tint: C });
        P({ t: 'magic_02', x, y, s0: 1.2 * pw, s1: 0.2, life: 0.5, vr: 4, tint: 0xff2060 });
        smoke(x, y, 10 * pw, 0x1a0824, { s1: 1.5 });
        for (let i = 0; i < 20; i++) { const a = rnd(0, 6.28), v = rnd(100, 400); P({ t: 'circle_05', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.92, life: 0.8, s0: 0.08, s1: 0, tint: G }); }
        break;
      case 'holy':
        P({ t: 'light_02', x, y, s0: 0.3, s1: 1.0 * pw, life: 0.5, tint: 0xffd890, a0: 0.55 });
        P({ t: 'magic_05', x, y, s0: 0.3, s1: 1.2 * pw, life: 0.4, tint: 0xfff0c0, rot: 0.785, a0: 0.8 });
        for (let i = 0; i < 24 * pw; i++) { const a = rnd(0, 6.28), v = rnd(100, 500); P({ t: 'star_05', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, drag: 0.92, life: rnd(0.6, 1.1), s0: 0.08, s1: 0.02, tint: 0xfff0b0 }); }
        break;
      default:
        P({ t: 'scorch_01', x, y, s0: 0.3, s1: 1.1 * pw, life: 0.35, rot: rnd(0, 6), tint: 0xffe8c8 });
        for (let i = 0; i < 14; i++) { const a = rnd(-3, 0), v = rnd(200, 500); P({ t: ['dirt_01', 'dirt_02'], x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, grav: 1200, life: 0.8, s0: 0.06, s1: 0.04, rot: rnd(0, 6), vr: 8, tint: 0x8a7a68, add: false }); }
    }
  }
  // 物理技のスラッシュ痕
  function slashMark(x, y, t, kind, dir) {
    const C = hexN(TC(t).c), G = hexN(TC(t).g);
    const mk = (name, rot, s, dly = 0, tint = G, sx = 1.6) => gsap.delayedCall(dly, () => {
      const p = P({ t: name, x, y, rot, s0: s * 0.6, s1: s, life: 0.32, tint, sx, sy: 1, ease: 1 });
      P({ t: name, x, y, rot, s0: s * 0.55, s1: s * 0.95, life: 0.22, tint: 0xffffff, sx: sx * 0.9, sy: 0.6, ease: 1 });
      return p;
    });
    switch (kind) {
      case 'claw': for (let i = 0; i < 3; i++) mk('trace_06', 0.6 * dir + (i - 1) * 0.05, 1.0, i * 0.03, G, 0.4); P({ t: 'scratch_01', x, y, rot: dir > 0 ? 0 : 1.57, s0: 0.8, s1: 1.1, life: 0.35, tint: C }); break;
      case 'bite': {
        ['slash_01', 'slash_02'].forEach((n, i) => { const p = P({ t: n, x, y: y + (i ? 60 : -60), vy: i ? -500 : 500, drag: 0.8, s0: 0.9, s1: 0.9, life: 0.3, rot: i ? 0 : Math.PI, tint: G, sx: 1.2 }); });
        break;
      }
      case 'punch': ringFx(x, y, G, 0.1, 1.2, 0.3, { t: 'circle_02' }); P({ t: 'star_08', x, y, s0: 0.3, s1: 1.2, life: 0.25, tint: 0xffffff, rot: rnd(0, 1) }); P({ t: 'muzzle_03', x, y, s0: 0.6, s1: 1, life: 0.2, rot: dir > 0 ? Math.PI / 2 : -Math.PI / 2, tint: G }); break;
      case 'slash': mk('slash_04', (dir > 0 ? -0.6 : 0.6), 1.5); mk('slash_04', (dir > 0 ? 2.2 : -2.2), 1.2, 0.07, 0xffffff); break;
      case 'cross': mk('slash_04', 0.8, 1.5); mk('slash_04', -0.8, 1.5, 0.05); break;
      default: mk('slash_01', dir > 0 ? -0.3 : 0.3, 1.0);
    }
  }
  // 残像
  function ghost(side, tint) {
    const v = views[side]; if (!v || !v.body.texture) return;
    const g = new PIXI.Sprite(v.body.texture); g.anchor.copyFrom(v.body.anchor);
    g.position.set(v.cont.x, v.cont.y + v.body.y); g.scale.copyFrom(v.body.scale); g.tint = tint; g.alpha = 0.5; g.blendMode = 'add';
    fxBack.addChild(g);
    gsap.to(g, { alpha: 0, duration: 0.3, onComplete: () => g.destroy() });
  }
  // 近接攻撃モーション：溜め→突進（残像）→着弾（ヒットストップ・インパクトフレーム）→戻り
  async function melee(atk, t, kind = 'slash', o = {}) {
    const s = S.spr[atk], d = dirOf(atk), a = center(atk), b = center(TG(atk));
    const C = hexN(TC(t).c);
    Sound.swing(o.heavy);
    if (S.mons[atk] && Math.random() < 0.4) Sound.voice(S.mons[atk].beast, 'roar');
    const L0 = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / L0, uy = (b.y - a.y) / L0;
    lastAtk = atk;
    await tw(s, { ox: -ux * 34, oy: -uy * 34, sx: 1.12, sy: 0.88, rot: -d * 0.06, duration: 0.17, ease: 'power2.out' });
    const reach = o.reach ?? 0.78;
    let gi = 0;
    const gt = gsap.ticker.add(() => { if (gi++ % 2 === 0) ghost(atk, C); });
    P({ t: 'smoke_03', x: s.bx + s.ox, y: s.by, vx: -d * 200, s0: 0.3, s1: 0.9, life: 0.5, add: false, tint: 0x6a6070, a0: 0.6, front: false });
    await tw(s, { ox: (b.x - a.x) * reach - d * 0, oy: (b.y - a.y) * reach, sx: 0.92, sy: 1.08, rot: d * 0.08, duration: o.fast ? 0.08 : 0.12, ease: 'power4.in' });
    gsap.ticker.remove(gt);
    // 着弾
    impactFrame(o.heavy ? 80 : 45);
    hitstop(o.heavy ? 110 : 70);
    const hx = b.x - ux * 14, hy = b.y - uy * 14;
    slashMark(hx, hy, t, kind, d);
    impact(hx, hy, t, o.heavy ? 1.3 : 1);
    punch(lerp(a.x, b.x, 0.7), lerp(a.y, b.y, 0.7), o.heavy ? 1.18 : 1.1);
    if (kind === 'slash' || kind === 'cross' || kind === 'claw') Sound.slash();
    gsap.to(s, { ox: 0, oy: 0, sx: 1, sy: 1, rot: 0, duration: 0.5, delay: 0.1, ease: 'power3.out' });
  }
  function charge(side, t, ms = 450, big = false) {
    const c = center(side), f = foot(side), C = hexN(TC(t).c), G = hexN(TC(t).g);
    const holder = new PIXI.Container(); holder.position.set(f.x, f.y); holder.scale.set(1, 0.32); fxBack.addChild(holder);
    const mc = new PIXI.Sprite(tex.magic_01); mc.anchor.set(0.5); mc.blendMode = 'add'; mc.tint = C; mc.alpha = 0; mc.scale.set(big ? 1.4 : 0.9); holder.addChild(mc);
    const mc2 = new PIXI.Sprite(tex.magic_02); mc2.anchor.set(0.5); mc2.blendMode = 'add'; mc2.tint = G; mc2.alpha = 0; mc2.scale.set(big ? 1.1 : 0.7); holder.addChild(mc2);
    gsap.to([mc, mc2], { alpha: 0.9, duration: 0.15 });
    gsap.to(mc, { rotation: 3, duration: ms / 1000 + 0.4, ease: 'power1.in' });
    gsap.to(mc2, { rotation: -3, duration: ms / 1000 + 0.4, ease: 'power1.in' });
    gsap.to([mc, mc2], { alpha: 0, duration: 0.3, delay: ms / 1000, onComplete: () => holder.destroy({ children: true }) });
    const n = big ? 40 : 18;
    for (let i = 0; i < n; i++) gsap.delayedCall(i * (ms / 1000) / n, () => { const an = rnd(0, 6.28), r = rnd(90, 170); P({ t: 'trace_06', x: c.x + Math.cos(an) * r, y: c.y + Math.sin(an) * r, vx: -Math.cos(an) * r * 3.2, vy: -Math.sin(an) * r * 3.2, align: 1, life: 0.3, s0: 0.25, s1: 0.1, sx: 0.25, sy: 1, tint: G }); });
    gsap.delayedCall(ms / 1000 * 0.6, () => flare(c.x, c.y, G, big ? 1.6 : 0.9, 0.35));
    const s = S.spr[side];
    gsap.to(s, { sy: 1.06, sx: 0.96, duration: ms / 2000, yoyo: true, repeat: 1 });
    return wait(ms);
  }
  // 弾
  async function shoot(atk, t, o = {}) {
    const a = center(atk), b = center(TG(atk)), G = hexN(TC(t).g), C = hexN(TC(t).c);
    const n = o.n || 1, gap = o.gap || 0.07, dur = o.dur || 0.38;
    const jobs = [];
    for (let i = 0; i < n; i++) {
      jobs.push(new Promise(res => gsap.delayedCall(i * gap, () => {
        const off = { x: rnd(-1, 1) * (o.spread || 0), y: rnd(-1, 1) * (o.spread || 0) };
        const pr = { k: 0 };
        const core = new PIXI.Sprite(tex[o.tex || 'light_01']); core.anchor.set(0.5); core.blendMode = 'add'; core.tint = o.tint ?? G; core.scale.set(o.size || 0.35); fxFront.addChild(core);
        const sx = a.x + d0(atk) * 30, sy = a.y;
        gsap.to(pr, {
          k: 1, duration: dur, ease: o.ease || 'power1.in',
          onUpdate: () => {
            const x = lerp(sx, b.x + off.x, pr.k), y = lerp(sy, b.y + off.y, pr.k) - Math.sin(pr.k * Math.PI) * (o.arc || 0);
            core.position.set(x, y); core.rotation += 0.3;
            if (o.align) core.rotation = Math.atan2(b.y - sy, b.x - sx) + Math.PI / 2;
            if (o.trail !== false) P({ t: o.trailTex || 'circle_05', x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-40, 40), vy: rnd(-40, 40), life: 0.3, s0: (o.size || 0.35) * 0.6, s1: 0, tint: o.trailTint ?? C });
          },
          onComplete: () => { core.destroy(); if (!o.noImpact) impact(b.x + off.x, b.y + off.y, t, o.pw || 0.7); res(); },
        });
      })));
    }
    await Promise.all(jobs);
  }
  const d0 = dirOf;

  const PAT = {
    async lunge(atk, t) { await melee(atk, t, 'punch'); },
    async dash(atk, t) {
      const b = center(TG(atk));
      for (let i = 0; i < 10; i++) P({ t: 'trace_07', x: b.x + rnd(-200, 200), y: b.y + rnd(-90, 90), vx: d0(atk) * 1600, align: 1, life: 0.25, s0: 0.6, s1: 0.6, sx: 0.15, sy: 2, tint: 0xffffff, a0: 0.6 });
      await melee(atk, t, 'cross', { reach: 0.92, fast: 1, heavy: 1 });
    },
    async claw(atk, t) { await melee(atk, t, 'claw'); },
    async bite(atk, t) { await melee(atk, t, 'bite'); },
    async punch(atk, t) { await melee(atk, t, 'punch'); if (t === 'thunder') { const b = center(TG(atk)); bolt(b.x - 90, b.y - 90, b.x + 90, b.y + 90, 0xfff17a, 5, 0.3); } },
    async slash(atk, t) { await melee(atk, t, 'slash'); },
    async hammer(atk, t) {
      const s = S.spr[atk], b = center(TG(atk)), f = foot(TG(atk)), a = center(atk);
      await tw(s, { oy: -110, ox: (b.x - a.x) * 0.4, sx: 0.9, sy: 1.12, rot: -d0(atk) * 0.15, duration: 0.3, ease: 'power2.out' });
      await tw(s, { oy: (b.y - a.y) * 0.8, ox: (b.x - a.x) * 0.75, sx: 1.15, sy: 0.85, rot: d0(atk) * 0.1, duration: 0.1, ease: 'power4.in' });
      impactFrame(90); hitstop(120);
      impact(b.x, b.y, t, 1.3);
      for (let i = 0; i < 3; i++) ringFx(f.x, f.y, 0xe8dcc0, 0.2, 3 + i, 0.6, { sy: 0.3, t: 'circle_04' });
      for (let i = 0; i < 24; i++) P({ t: ['dirt_01', 'dirt_03'], x: f.x + rnd(-100, 100), y: f.y, vx: rnd(-300, 300), vy: rnd(-600, -200), grav: 1600, life: 1, s0: 0.1, s1: 0.06, rot: rnd(0, 6), vr: 6, tint: 0x6a5a4a, add: false });
      smoke(f.x, f.y - 10, 10, 0x3a3238, { vy: -40, s1: 1.6 });
      shock(f.x, f.y, 40, 420, 0.8); shake(22); punch(b.x, b.y, 1.15);
      Sound.explode();
      gsap.to(s, { ox: 0, oy: 0, sx: 1, sy: 1, rot: 0, duration: 0.55, delay: 0.15, ease: 'power3.out' });
    },
    async shadow(atk, t) {
      const s = S.spr[atk], a = center(atk), b = center(TG(atk));
      smoke(a.x, a.y, 10, 0x1a0824); await tw(s, { alpha: 0, duration: 0.12 });
      for (let i = 0; i < 4; i++) {
        const an = rnd(0, 6.28);
        const x1 = b.x + Math.cos(an) * 140, y1 = b.y + Math.sin(an) * 110, x2 = b.x - Math.cos(an) * 140, y2 = b.y - Math.sin(an) * 110;
        beamSprite(x1, y1, x2, y2, 0xb050ff, 20, 0.25, 'trace_07');
        P({ t: 'slash_04', x: b.x, y: b.y, rot: an, s0: 1, s1: 1.3, life: 0.25, tint: 0xd29cff, sx: 1.5 });
        Sound.swing(); hitstop(40); shake(6);
        await wait(80);
      }
      impact(b.x, b.y, 'dark', 1); impactFrame(50);
      gsap.to(s, { alpha: 1, duration: 0.3, delay: 0.1 });
    },
    async orb(atk, t) { await charge(atk, t, 300); Sound.cast(t, 0.6); await shoot(atk, t, { size: 0.45, dur: 0.35, pw: 1 }); shock(center(TG(atk)).x, center(TG(atk)).y, 18, 220, 0.5); },
    async pillar(atk, t) {
      await charge(atk, t, 350); Sound.cast(t, 1.2);
      const f = foot(TG(atk)), C = hexN(TC(t).c), G = hexN(TC(t).g);
      ringFx(f.x, f.y, C, 0.3, 2.2, 0.5, { sy: 0.3, t: 'circle_01' });
      await wait(160);
      for (let i = 0; i < 3; i++) P({ t: 'muzzle_01', x: f.x + rnd(-15, 15), y: f.y + 10, ax: 0.5, ay: 1, s0: 0.6, s1: 1.6, sx: 0.9, sy: 1.8, life: 0.7, tint: i ? C : G });
      for (let i = 0; i < 40; i++) P({ t: t === 'fire' ? ['flame_01', 'flame_02', 'fire_01'] : ['smoke_07', 'light_01'], x: f.x + rnd(-50, 50), y: f.y, vy: rnd(-900, -300), vx: rnd(-40, 40), life: rnd(0.4, 0.9), s0: 0.2, s1: 0.8, rot: rnd(0, 6), vr: 3, tint: pickA([C, G]) });
      shock(f.x, f.y - 100, 30, 300, 0.6); shake(14); impactFrame(40);
      impact(center(TG(atk)).x, center(TG(atk)).y, t, 1.1);
      await wait(200);
    },
    async nova(atk, t) {
      const a = center(atk), C = hexN(TC(t).c), G = hexN(TC(t).g);
      await charge(atk, t, 380); Sound.cast(t, 1.2);
      flare(a.x, a.y, G, 4, 0.5);
      for (let i = 0; i < 3; i++) gsap.delayedCall(i * 0.08, () => ringFx(a.x, a.y, i ? C : G, 0.3, 7, 0.6, { t: 'circle_02' }));
      streaks(a.x, a.y, G, 40, 1600, 0.9);
      shock(a.x, a.y, 40, 700, 0.9); shake(12); zoomKick(0.18, 0.5, a.x, a.y);
      await wait(250);
      impact(center(TG(atk)).x, center(TG(atk)).y, t, 1.1);
    },
    async wave(atk, t) {
      await charge(atk, t, 250); Sound.cast(t, 0.8);
      const a = center(atk), b = center(TG(atk)), C = hexN(TC(t).c), G = hexN(TC(t).g);
      await new Promise(res => { const pr = { k: 0 }; gsap.to(pr, { k: 1, duration: 0.45, ease: 'none', onUpdate: () => { for (let i = 0; i < 3; i++) { const k = pr.k - i * 0.03; if (k < 0) continue; P({ t: t === 'water' ? 'twirl_02' : 'light_01', x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) + Math.sin(k * 16 + i * 2) * 36, life: 0.45, s0: 0.25, s1: 0.05, rot: rnd(0, 6), vr: 8, tint: i ? C : G }); } }, onComplete: res }); });
      impact(b.x, b.y, t, 1);
    },
    async tsunami(atk, t) {
      Sound.cast('water', 1.5);
      const b = center(TG(atk)), C = hexN(TC(t).c), G = hexN(TC(t).g), d = d0(atk);
      dark.v = 0.3;
      const x0 = d > 0 ? -200 : W + 200, x1 = d > 0 ? W + 200 : -200;
      await new Promise(res => { const pr = { k: 0 }; gsap.to(pr, { k: 1, duration: 0.9, ease: 'power1.in', onUpdate: () => { const x = lerp(x0, x1, pr.k); for (let i = 0; i < 6; i++) { const yy = rnd(180, H); P({ t: ['smoke_07', 'smoke_09'], x: x + rnd(-40, 40), y: yy, vx: d * 300, vy: -rnd(50, 200), life: 0.7, s0: 0.6, s1: 1.4, rot: rnd(0, 6), tint: pickA([C, G, 0xe0f4ff]), a0: 0.8 }); } if (Math.abs(x - b.x) < 60 && !pr.hit) { pr.hit = 1; impact(b.x, b.y, 'water', 1.4); shock(b.x, b.y, 35, 400, 0.7); shake(16); } }, onComplete: res }); });
      dark.v = 0;
    },
    async leaves(atk, t) {
      const b = center(TG(atk));
      for (let i = 0; i < 40; i++) { const an = rnd(0, 6.28), r = rnd(160, 240); P({ t: 'slash_03', x: b.x + Math.cos(an) * r, y: b.y + Math.sin(an) * r, follow: b, home: 3, life: 0.5, s0: 0.12, s1: 0.08, rot: an, vr: 14, tint: pickA([0x6fd060, 0xb6f27a]) }); }
      await melee(atk, t, 'slash');
    },
    async vines(atk, t) {
      await charge(atk, t, 250); Sound.cast('wood', 0.9);
      const f = foot(TG(atk)), b = center(TG(atk)), col = t === 'wood' ? 0x3fa04f : hexN(TC(t).c);
      const g = new PIXI.Graphics(); fxFront.addChild(g);
      const seeds = Array.from({ length: 6 }, (_, i) => ({ x0: f.x - 130 + i * 52, ph: rnd(0, 6) }));
      const pr = { k: 0 };
      await new Promise(res => gsap.to(pr, { k: 1, duration: 0.45, ease: 'power2.out', onUpdate: () => {
        g.clear();
        seeds.forEach((sd, i) => { g.moveTo(sd.x0, f.y + 8); const n = Math.floor(24 * pr.k); for (let s2 = 1; s2 <= n; s2++) { const u = s2 / 24; g.lineTo(sd.x0 + Math.sin(u * 9 + sd.ph) * 40 * u + (b.x - sd.x0) * u * 0.7, f.y - u * 230); } g.stroke({ width: 9 - i % 3 * 2, color: col, cap: 'round' }); });
        seeds.forEach(sd => { g.moveTo(sd.x0, f.y + 8); const n = Math.floor(24 * pr.k); for (let s2 = 1; s2 <= n; s2++) { const u = s2 / 24; g.lineTo(sd.x0 + Math.sin(u * 9 + sd.ph) * 40 * u + (b.x - sd.x0) * u * 0.7, f.y - u * 230); } g.stroke({ width: 2, color: 0xc8ff90, alpha: 0.8 }); });
      }, onComplete: res }));
      impact(b.x, b.y, t, 1); shake(8);
      gsap.to(g, { alpha: 0, duration: 0.4, delay: 0.2, onComplete: () => g.destroy() });
    },
    async spore(atk, t) {
      Sound.cast('wood', 0.5);
      const a = center(atk), b = center(TG(atk)), col = t === 'wood' ? 0xd0ff80 : 0xc080ff;
      for (let i = 0; i < 70; i++) P({ t: ['circle_05', 'smoke_03'], x: a.x + rnd(-20, 20), y: a.y + rnd(-20, 20), vx: (b.x - a.x) * rnd(0.7, 1.3), vy: (b.y - a.y) * rnd(0.7, 1.3) + rnd(-80, 80), drag: 0.975, life: rnd(1, 1.6), s0: 0.05, s1: rnd(0.1, 0.25), tint: col, a0: 0.8 });
      await wait(800);
    },
    async forest(atk, t) {
      await charge(atk, t, 400, true); Sound.cast('wood', 1.4);
      const f = foot(TG(atk));
      for (let i = 0; i < 9; i++) { gsap.delayedCall(i * 0.04, () => { const x = f.x - 160 + i * 40; P({ t: 'muzzle_02', x, y: f.y + 20, ax: 0.5, ay: 1, s0: 0.3, s1: rnd(1.1, 1.6), sx: 0.6, sy: 1.6, life: 0.8, tint: pickA([0x3fa04f, 0x6fd060, 0x2a6a2a]), ease: 1 }); P({ t: 'dirt_02', x, y: f.y, vy: -300, grav: 1000, s0: 0.15, s1: 0.1, life: 0.6, tint: 0x5a4a30, add: false }); }); }
      await wait(250); shake(16); shock(f.x, f.y - 80, 35, 380, 0.7); impactFrame(50);
      impact(center(TG(atk)).x, center(TG(atk)).y, 'wood', 1.4);
    },
    async bolt(atk, t) {
      await charge(atk, 'thunder', 220); Sound.cast('thunder', 0.9);
      const a = center(atk), b = center(TG(atk));
      for (let i = 0; i < 3; i++) { bolt(a.x, a.y, b.x, b.y, 0xfff17a, 7 - i * 2, 0.3); await wait(60); }
      S.flash = { c: '#fffbe0', a: 0.35 }; impactFrame(40);
      impact(b.x, b.y, 'thunder', 1);
    },
    async thunderfall(atk, t) {
      const b = center(TG(atk));
      dark.v = 0.55; await wait(220);
      Sound.cast('thunder', 1.6);
      for (let i = 0; i < 2; i++) { bolt(b.x + rnd(-40, 40), -40, b.x, b.y + 70, 0xfff17a, 14, 0.5); await wait(70); }
      P({ t: 'spark_06', x: b.x, y: b.y - 120, s0: 1.4, s1: 1.8, sx: 0.7, sy: 2.2, life: 0.35, tint: 0xfff6a0, flicker: 1 });
      S.flash = { c: '#ffffff', a: 0.8 }; impactFrame(70); hitstop(90);
      shock(b.x, b.y + 60, 45, 450, 0.8); shake(20);
      impact(b.x, b.y, 'thunder', 1.4);
      dark.v = 0;
    },
    async shards(atk, t) { Sound.cast('ice', 0.9); await shoot(atk, 'ice', { n: 7, gap: 0.05, dur: 0.22, tex: 'trace_02', size: 0.5, align: 1, spread: 40, tint: 0xe6ffff, trailTex: 'circle_05', pw: 0.5, ease: 'none' }); },
    async gatling(atk, t) {
      const a = center(atk);
      for (let i = 0; i < 8; i++) gsap.delayedCall(i * 0.045, () => { Sound.cast('steel', 0.15); P({ t: 'muzzle_04', x: a.x + d0(atk) * 50, y: a.y, rot: d0(atk) * Math.PI / 2, s0: 0.3, s1: 0.4, life: 0.06, tint: 0xffd080 }); });
      await shoot(atk, 'steel', { n: 10, gap: 0.04, dur: 0.15, tex: 'trace_01', size: 0.3, align: 1, spread: 30, tint: 0xffe8a0, trail: false, pw: 0.4, ease: 'none' });
    },
    async beam(atk, t) {
      await charge(atk, t, 420); Sound.cast(t, 1.2);
      const a = center(atk), b = center(TG(atk)), C = hexN(TC(t).c);
      const sx = a.x + d0(atk) * 30;
      beamSprite(sx, a.y, b.x + d0(atk) * 140, b.y, C, 70, 0.7);
      flare(sx, a.y, 0xffffff, 1.6, 0.6);
      zoomKick(0.12, 0.4, sx, a.y);
      await wait(90); impactFrame(50);
      for (let i = 0; i < 5; i++) gsap.delayedCall(i * 0.08, () => impact(b.x + rnd(-20, 20), b.y + rnd(-20, 20), t, 0.6));
      shock(b.x, b.y, 30, 300, 0.6); shake(10);
      await wait(300);
    },
    async zero(atk, t) {
      const b = center(TG(atk));
      dark.v = 0.6; Sound.cast('ice', 1.6);
      for (let i = 0; i < 50; i++) { const an = rnd(0, 6.28), r = rnd(220, 340); P({ t: 'trace_02', x: b.x + Math.cos(an) * r, y: b.y + Math.sin(an) * r, follow: b, home: 3.5, align: 1, life: 0.6, s0: 0.4, s1: 0.2, sx: 0.5, tint: 0xe0ffff }); }
      await wait(550);
      S.flash = { c: '#e8ffff', a: 0.9 }; impactFrame(100); hitstop(120);
      for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; P({ t: 'trace_04', x: b.x, y: b.y, rot: an, s0: 0.5, s1: 1.8, sx: 0.5, sy: 1.4, life: 0.8, tint: 0xc0f8ff, ease: 1 }); }
      shock(b.x, b.y, 50, 500, 0.9); shake(18); dark.v = 0;
      impact(b.x, b.y, 'ice', 1.5);
    },
    async guillotine(atk, t) {
      const b = center(TG(atk));
      dark.v = 0.6; Sound.swing();
      const s = new PIXI.Sprite(tex.slash_03); s.anchor.set(0.5); s.blendMode = 'add'; s.rotation = Math.PI / 2; s.scale.set(3, 1.4); s.position.set(b.x, b.y - 420); fxFront.addChild(s);
      await tw(s, { y: b.y, duration: 0.3, ease: 'power4.in' });
      Sound.cast('steel', 1.6); impactFrame(110); hitstop(140); S.flash = { c: '#ffffff', a: 0.8 };
      shake(26); shock(b.x, b.y, 50, 500, 0.8); rgbKick(12);
      impact(b.x, b.y, 'steel', 1.5);
      gsap.to(s, { alpha: 0, duration: 0.3, onComplete: () => s.destroy() }); dark.v = 0;
    },
    async blizzard(atk, t) {
      Sound.cast('ice', 1.5); dark.v = 0.25;
      const d = d0(atk);
      await new Promise(res => { let n = 0; const tk = () => { n++; for (let i = 0; i < 10; i++) P({ t: pickA(['trace_06', 'circle_05', 'star_05']), x: d > 0 ? rnd(-100, 100) : W + rnd(-100, 100), y: rnd(0, H), vx: d * rnd(900, 1500), vy: rnd(-60, 120), align: 1, life: 1.0, s0: 0.25, s1: 0.15, sx: 0.25, tint: pickA([0xffffff, 0xd0f4ff, 0xa0e8ff]) }); smoke(d > 0 ? 0 : W, rnd(100, 500), 1, 0xe0f4ff, { vx: d * 900, add: true, a0: 0.3, s1: 2 }); if (n > 40) { gsap.ticker.remove(tk); res(); } }; gsap.ticker.add(tk); });
      const b = center(TG(atk)); impact(b.x, b.y, 'ice', 1.2); shake(10); dark.v = 0;
    },
    async judgment(atk, t) {
      const f = foot(TG(atk)), b = center(TG(atk));
      dark.v = 0.45; Sound.cast('holy', 1.6);
      P({ t: 'magic_03', x: b.x, y: 40, s0: 0.3, s1: 1.4, life: 0.8, tint: 0xfff0b0, vr: 2 });
      await wait(250);
      for (let i = 0; i < 3; i++) { gsap.delayedCall(i * 0.1, () => { beamSprite(f.x + (i - 1) * 70, -40, f.x + (i - 1) * 70, f.y + 10, 0xffd890, 30, 0.6, 'trace_07'); ringFx(f.x + (i - 1) * 70, f.y, 0xffffff, 0.3, 1.6, 0.5, { sy: 0.3 }); }); }
      await wait(260);
      S.flash = { c: '#fffbe8', a: 0.4 }; impactFrame(50); shake(14); shock(b.x, b.y, 35, 380, 0.7);
      impact(b.x, b.y, 'holy', 1.4); dark.v = 0;
    },
    async souleat(atk, t) {
      const a = center(atk), b = center(TG(atk)); Sound.cast('dark', 1);
      const g = new PIXI.Graphics(); g.blendMode = 'add'; fxFront.addChild(g);
      const pr = { k: 0 };
      await new Promise(res => gsap.to(pr, { k: 1, duration: 0.5, onUpdate: () => { g.clear(); for (let i = 0; i < 5; i++) { g.moveTo(a.x, a.y); const mx = (a.x + b.x) / 2 + Math.sin(T * 10 + i) * 70, my = (a.y + b.y) / 2 - 100 + i * 45; g.quadraticCurveTo(mx, my, lerp(a.x, b.x, pr.k), lerp(a.y, b.y, pr.k)); g.stroke({ width: 4, color: 0xa040ff, alpha: 0.9 }); } }, onComplete: res }));
      impact(b.x, b.y, 'dark', 0.8);
      for (let i = 0; i < 36; i++) P({ t: 'circle_05', x: b.x + rnd(-40, 40), y: b.y + rnd(-40, 40), follow: a, home: 2, life: 0.9, s0: 0.12, s1: 0.04, tint: 0xff4080 });
      gsap.to(g, { alpha: 0, duration: 0.3, onComplete: () => g.destroy() });
    },
    async nightmare(atk, t) {
      const b = center(TG(atk)); dark.v = 0.6; Sound.cast('dark', 1.4);
      for (let i = 0; i < 8; i++) { P({ t: 'magic_04', x: b.x + rnd(-150, 150), y: b.y + rnd(-110, 70), s0: 0.1, s1: 0.5, life: 0.5, tint: 0xff2050, flicker: 1 }); P({ t: 'twirl_01', x: b.x, y: b.y, s0: 0.4 + i * 0.1, s1: 1.4, life: 0.6, vr: -6, tint: 0x6020a0 }); rgbKick(6, 0.2); await wait(60); }
      impact(b.x, b.y, 'dark', 1.2); impactFrame(60); dark.v = 0;
    },
    async explode(atk, t) {
      const a = center(atk); Sound.explode();
      await charge(atk, 'fire', 300);
      impactFrame(120); hitstop(150); S.flash = { c: '#ffffff', a: 1 };
      flare(a.x, a.y, 0xffe0a0, 6, 0.7);
      for (let i = 0; i < 4; i++) ringFx(a.x, a.y, [0xffffff, 0xffd040, 0xff6020, 0x802010][i], 0.3, 6 + i * 2, 0.8, { t: 'circle_02' });
      for (let i = 0; i < 60; i++) { const an = rnd(0, 6.28), v = rnd(100, 700); P({ t: ['fire_01', 'flame_02', 'flame_04'], x: a.x, y: a.y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, drag: 0.92, life: rnd(0.6, 1.2), s0: 0.4, s1: 1.4, rot: rnd(0, 6), vr: 2, tint: pickA([0xff6a1a, 0xffa030, 0xffe060]) }); }
      smoke(a.x, a.y, 30, 0x201818, { s1: 2.4, life: 2 });
      shock(a.x, a.y, 60, 800, 1.1); shake(30); zoomKick(0.3, 0.8, a.x, a.y);
      await wait(400);
    },
    async chaos(atk, t) {
      const a = center(atk); Sound.chaos();
      for (let i = 0; i < 6; i++) { gsap.delayedCall(i * 0.08, () => { P({ t: pickA(['magic_01', 'magic_02', 'magic_04']), x: a.x + rnd(-80, 80), y: a.y + rnd(-80, 40), s0: 0.1, s1: 0.8, life: 0.5, vr: rnd(-6, 6), tint: pickA([0xff40c0, 0x40e0ff, 0xffe040, 0x80ff80]) }); rgbKick(8, 0.2); }); }
      for (let i = 0; i < 40; i++) P({ t: 'star_04', x: a.x, y: a.y, vx: rnd(-400, 400), vy: rnd(-400, 300), drag: 0.93, life: 1, s0: 0.15, s1: 0.02, tint: pickA([0xff40c0, 0x40e0ff, 0xffe040]) });
      await wait(700);
    },
    async gamble(atk, t) { const a = center(atk); Sound.chaos(); P({ t: 'magic_03', x: a.x, y: a.y - 80, s0: 0.2, s1: 0.8, life: 0.7, vr: 12, tint: 0xffd36a }); await wait(450); await melee(atk, t, 'punch', { heavy: 1 }); },
    // 変化技
    async buff(atk) { await charge(atk, 'none', 300); const a = center(atk); for (let i = 0; i < 20; i++) P({ t: 'trace_06', x: a.x + rnd(-70, 70), y: a.y + 110, vy: rnd(-500, -250), align: 1, life: 0.5, s0: 0.3, s1: 0.1, sx: 0.3, tint: 0xffa060 }); },
    async status(atk, t) { Sound.cast(t, 0.4); await shoot(atk, t, { size: 0.3, dur: 0.4, arc: 50, pw: 0.4 }); },
    async heal(atk) { await wait(30); },
    async shield(atk) { const a = center(atk); Sound.shield(); ringFx(a.x, a.y + 10, 0x80ffd0, 1.8, 1.2, 0.5, { t: 'circle_03' }); await wait(300); },
    async spikes(atk) { await wait(10); },
    async haze(atk) { Sound.cast('water', 0.5); for (let i = 0; i < 30; i++) smoke(rnd(0, W), rnd(200, H), 1, 0xc0c8e0, { add: true, a0: 0.25, s1: 2.4, vx: rnd(-60, 60) }); await wait(600); },
    async roar(atk) { const a = center(atk); Sound.explode(); for (let i = 0; i < 4; i++) { ringFx(a.x, a.y, 0xffffff, 0.3, 6, 0.6, { t: 'circle_04', a0: 0.5 }); shock(a.x, a.y, 20, 600, 0.6); await wait(90); } shake(16); },
    async field(atk) { await charge(atk, 'none', 400, true); },
  };
  const ULT = {
    u_fire: ['dash', 'pillar', 'nova'], u_meteor: ['meteor'], u_sun: ['nova', 'pillar', 'judgment'], u_vortex: ['tsunami', 'wave'],
    u_spear: ['dash', 'beam'], u_moon: ['spore', 'judgment'], u_forest: ['vines', 'forest'], u_scream: ['nightmare', 'nova'],
    u_leafstorm: ['leaves', 'leaves', 'dash'], u_thunder: ['thunderfall', 'bolt', 'thunderfall'], u_laser: ['beam', 'nova'], u_ninetail: ['bolt', 'nightmare', 'bolt'],
    u_glacier: ['blizzard', 'zero'], u_iceslash: ['slash', 'shards', 'dash'], u_hammer: ['dash', 'hammer'], u_darkslash: ['shadow', 'shadow', 'slash'],
    u_gaze: ['nightmare', 'beam'], u_hellfire: ['pillar', 'souleat', 'nova'], u_chaos: ['chaos', 'nova', 'bolt'], u_judgment: ['judgment', 'thunderfall', 'judgment'],
    u_holysword: ['judgment', 'dash'], u_quake: ['hammer', 'hammer'], u_phoenix: ['nova', 'pillar', 'nova'],
  };
  async function meteorStorm(atk, t) {
    const b = center(TG(atk)), C = hexN(TC(t).c);
    dark.v = 0.5;
    for (let i = 0; i < 5; i++) {
      const tx = b.x + rnd(-90, 90), ty = b.y + rnd(-30, 50);
      const m = new PIXI.Sprite(tex.light_01); m.anchor.set(0.5); m.blendMode = 'add'; m.tint = C; m.scale.set(0.5); m.position.set(tx - 300, ty - 520); fxFront.addChild(m);
      const pr = { k: 0 };
      gsap.to(pr, { k: 1, duration: 0.45, ease: 'power2.in', onUpdate: () => { m.position.set(lerp(tx - 300, tx, pr.k), lerp(ty - 520, ty, pr.k)); P({ t: ['fire_01', 'flame_02'], x: m.x, y: m.y, vx: rnd(-40, 40), vy: rnd(-60, 0), life: 0.4, s0: 0.4, s1: 0.1, rot: rnd(0, 6), tint: pickA([C, 0xffe060]) }); },
        onComplete: () => { m.destroy(); Sound.explode(); impact(tx, ty, t, 1.2); shock(tx, ty, 30, 300, 0.6); shake(16); impactFrame(40); } });
      await wait(150);
    }
    await wait(500); dark.v = 0;
  }

  // =========================================================
  //                      公開API
  // =========================================================
  const api = {
    W, H, S, wait, center, init,
    setField(f, turns = 0) { const ch = S.field !== f; S.field = f; S.fieldTurns = turns; S.fieldFlash = 1; if (ch && S.ready) drawBg(); Sound.fieldAmbience(f); },
    setMon(side, m) { S.mons[side] = m; if (m) { S.hpDisp[side] = m.hp; S.hpLag[side] = m.hp; S.spr[side] = mkSpr(side); buildView(side, m); } },
    clear() {
      S.mons = {}; S.pops = []; S.hazard = { e: 0, p: 0 }; S.cut = null; S.banner = null; S.flash = null; S.target = null;
      Object.keys(SLOT).forEach(k => { S.spr[k] = mkSpr(k); });
      Object.keys(views).forEach(k => { views[k].cont.destroy({ children: true }); delete views[k]; });
      Object.values(circles).forEach(c => { c.parent.visible = false; });
      parts.forEach(p => p.sp.destroy()); parts.length = 0; shocks.length = 0; dark.v = 0;
      if (S.ready) { drawHazards(); gsap.killTweensOf(cam); Object.assign(cam, { x: W / 2, y: H / 2, z: 1, shake: 0 }); }
    },
    shake, flash(c = '#fff', a = 0.7) { S.flash = { c, a }; },
    banner(text, color = '#ece4cf', sub = '', life = 1.8) { S.banner = { text, color, sub, life, max: life }; gsap.to(S.banner, { life: 0, duration: life, ease: 'none' }); },
    pop(side, text, color = '#ece4cf', size = 30) { const c = center(side); const n = S.pops.filter(p => p.side === side && !p.num && p.life > 0.6).length; S.pops.push({ side, x: c.x + (isE(side) ? -70 : 70), y: c.y - 80 - n * 34, text, color, size, life: 1.1, max: 1.1 }); },
    dmgNum(side, n, crit, tag, label) { const c = center(side); const col = label ? '#c8b8e8' : crit ? '#ffd36a' : tag >= 2 ? '#ff7a4a' : tag < 1 ? '#a8b0c8' : '#f2ead6'; S.pops.push({ x: c.x + rnd(-30, 30), y: c.y - 10, text: String(n), color: col, size: label ? 26 : n >= 150 ? 50 : n >= 80 ? 42 : 34, life: 1.0, max: 1.0, num: 1, big: 1 }); if (label) S.pops.push({ x: c.x, y: c.y + 22, text: label, color: '#c8b8e8', size: 15, life: 1.0, max: 1.0 }); },
    async summon(side) {
      const s = S.spr[side], m = S.mons[side], f = foot(side), t = m.types[0], C = hexN(TC(t).c), G = hexN(TC(t).g);
      const big = ['golem'].includes(m.beast.art.body) || m.beast.art.bulky || m.beast.id === 'kraken' || m.beast.legend;
      s.visible = true; s.alpha = 0; s.scale = 1; s.ox = 0; s.oy = 0; s.white = 1; s.sx = 1; s.sy = 1;
      // 1) 札が回転しながら飛来し、空中で止まって燃え上がる
      const tl = new PIXI.Sprite(talismanTex); tl.anchor.set(0.5); tl.scale.set(0.42); tl.position.set(isE(side) ? W + 80 : -80, f.y - 220); tl.rotation = isE(side) ? 3 : -3; fxFront.addChild(tl);
      Sound.swing();
      await tw(tl, { x: f.x, y: f.y - 130, rotation: 0, duration: 0.38, ease: 'power3.out' });
      Sound.summon(m.beast);
      gsap.to(tl, { y: f.y - 145, duration: 0.25, ease: 'sine.out' });
      for (let i = 0; i < 26; i++) gsap.delayedCall(i * 0.01, () => P({ t: ['flame_05', 'flame_06'], x: f.x + rnd(-25, 25), y: f.y - 140 + rnd(-60, 60), vy: rnd(-260, -80), vx: rnd(-40, 40), life: rnd(0.3, 0.7), s0: 0.16, s1: 0.04, tint: pickA([0xff7a2a, 0xffc060, C]) }));
      gsap.to(tl, { alpha: 0, duration: 0.3, delay: 0.1, onComplete: () => tl.destroy() });
      gsap.to(tl.scale, { x: 0.6, y: 0.6, duration: 0.35 });
      // 2) 足元の封印陣が開く
      const holder = new PIXI.Container(); holder.position.set(f.x, f.y + 4); holder.scale.set(1, 0.3); fxBack.addChild(holder);
      [['magic_01', 2.0, 1], ['magic_02', 1.5, -1], ['circle_01', 2.4, 0]].forEach(([n, sc, dir]) => { const sp = new PIXI.Sprite(tex[n]); sp.anchor.set(0.5); sp.blendMode = 'add'; sp.tint = n === 'magic_02' ? G : C; sp.scale.set(0.2); holder.addChild(sp); gsap.to(sp.scale, { x: sc, y: sc, duration: 0.4, ease: 'back.out(1.6)' }); gsap.to(sp, { rotation: dir * 4, duration: 1.6 }); });
      gsap.to(holder, { alpha: 0, duration: 0.5, delay: 1.1, onComplete: () => holder.destroy({ children: true }) });
      await wait(260);
      // 3) 属性ごとの顕現
      const appear = async (from) => {
        Object.assign(s, from);
        gsap.to(s, { alpha: 1, duration: 0.18 });
        await tw(s, { scale: 1, oy: 0, ox: 0, sx: 1, sy: 1, rot: 0, duration: from.d || 0.45, ease: from.ease || 'back.out(2)' });
        gsap.to(s, { white: 0, duration: 0.4 });
      };
      switch (t) {
        case 'fire':
          for (let i = 0; i < 3; i++) P({ t: 'muzzle_01', x: f.x + rnd(-20, 20), y: f.y + 12, ax: 0.5, ay: 1, s0: 0.6, s1: 1.7, sx: 0.9, sy: 1.9, life: 0.8, tint: i ? C : G });
          for (let i = 0; i < 40; i++) P({ t: ['flame_01', 'flame_02', 'fire_01'], x: f.x + rnd(-60, 60), y: f.y, vy: rnd(-700, -200), life: rnd(0.4, 0.9), s0: 0.2, s1: 0.7, rot: rnd(0, 6), vr: 3, tint: pickA([C, G, 0xffe060]) });
          await appear({ scale: 0.3, d: 0.5 }); break;
        case 'water':
          for (let i = 0; i < 30; i++) P({ t: ['smoke_07', 'smoke_09'], x: f.x + rnd(-40, 40), y: f.y, vy: rnd(-900, -400), grav: 900, life: 1.0, s0: 0.3, s1: 0.9, rot: rnd(0, 6), tint: pickA([C, G, 0xe0f8ff]), a0: 0.8 });
          for (let i = 0; i < 40; i++) P({ t: 'circle_05', x: f.x + rnd(-30, 30), y: f.y - rnd(0, 200), vx: rnd(-300, 300), vy: rnd(-500, -100), grav: 1400, life: 1.1, s0: 0.07, s1: 0.03, tint: G });
          await appear({ sy: 0.2, sx: 1.4, d: 0.55, ease: 'elastic.out(1, 0.5)' }); break;
        case 'wood': {
          const g = new PIXI.Graphics(); fxBack.addChild(g); const pr = { k: 0 };
          const seeds = Array.from({ length: 8 }, (_, i) => ({ a: -Math.PI / 2 + (i - 3.5) * 0.28, ph: rnd(0, 6), len: rnd(150, 260) }));
          gsap.to(pr, { k: 1, duration: 0.5, ease: 'power2.out', onUpdate: () => { g.clear(); seeds.forEach((sd, i) => { g.moveTo(f.x, f.y); for (let u = 0.05; u <= pr.k; u += 0.05) g.lineTo(f.x + Math.cos(sd.a) * sd.len * u + Math.sin(u * 8 + sd.ph) * 18, f.y + Math.sin(sd.a) * sd.len * u); g.stroke({ width: 7 - i % 3 * 2, color: i % 2 ? 0x3fa04f : 0x2a6a2a, cap: 'round' }); }); } });
          gsap.to(g, { alpha: 0, duration: 0.5, delay: 0.9, onComplete: () => g.destroy() });
          for (let i = 0; i < 36; i++) gsap.delayedCall(0.2 + i * 0.01, () => { const an = rnd(0, 6.28); P({ t: 'slash_03', x: f.x + Math.cos(an) * 60, y: f.y - 100 + Math.sin(an) * 80, vx: Math.cos(an) * 200, vy: -rnd(50, 250), grav: 200, life: 1.2, s0: 0.1, s1: 0.06, rot: an, vr: 8, tint: pickA([0x6fd060, 0xb6f27a, 0xfff0d0]) }); });
          await wait(200); await appear({ scale: 0.6, oy: 30, d: 0.55 }); break;
        }
        case 'thunder':
          dark.v = 0.45;
          bolt(f.x + rnd(-30, 30), -40, f.x, f.y - 20, 0xfff17a, 14, 0.45); S.flash = { c: '#fffbe0', a: 0.7 }; impactFrame(60);
          streaks(f.x, f.y - 80, 0xfff17a, 30, 1200); shock(f.x, f.y - 60, 35, 380, 0.7);
          await appear({ scale: 1.15, d: 0.3, ease: 'power3.out' }); dark.v = 0; break;
        case 'ice': {
          const shards = [];
          for (let i = 0; i < 9; i++) { const sp = new PIXI.Sprite(tex.trace_02); sp.anchor.set(0.5, 1); sp.blendMode = 'add'; sp.tint = i % 2 ? 0xe6ffff : G; sp.position.set(f.x - 100 * s.sc + i * 25 * s.sc, f.y + 10); sp.rotation = (i - 4) * 0.12; sp.scale.set(0.6, 0); fxFront.addChild(sp); shards.push(sp); gsap.to(sp.scale, { y: rnd(1.1, 1.8), duration: 0.35, delay: i * 0.02, ease: 'power3.out' }); }
          await wait(420);
          Sound.S('glass', { vol: 0.8 }); S.flash = { c: '#e8ffff', a: 0.5 };
          shards.forEach(sp => { gsap.to(sp, { alpha: 0, duration: 0.25, onComplete: () => sp.destroy() }); });
          for (let i = 0; i < 40; i++) { const an = rnd(-Math.PI, 0), v = rnd(200, 700); P({ t: 'trace_02', x: f.x + rnd(-60, 60), y: f.y - rnd(20, 160), vx: Math.cos(an) * v, vy: Math.sin(an) * v, grav: 1200, align: 1, life: 0.9, s0: 0.3, s1: 0.15, sx: 0.4, tint: 0xe6ffff }); }
          await appear({ scale: 1, d: 0.2, ease: 'power2.out' }); break;
        }
        case 'steel':
          // 工廠のクレーンで吊り下ろされ、着地で火花
          s.alpha = 1; s.oy = -420; s.white = 0.3;
          Sound.S('mech', { vol: 0.6 });
          await tw(s, { oy: 0, duration: 0.42, ease: 'power3.in' });
          Sound.footstep(true); Sound.S('clash', { vol: 0.6, rate: 0.7 });
          shake(18); shock(f.x, f.y, 30, 350, 0.6); impactFrame(40);
          for (let i = 0; i < 30; i++) P({ t: 'trace_01', x: f.x + rnd(-80, 80), y: f.y, vx: rnd(-500, 500), vy: rnd(-600, -150), grav: 1400, align: 1, life: rnd(0.4, 0.8), s0: 0.2, s1: 0.05, sx: 0.4, tint: pickA([0xffd080, 0xffffff]) });
          smoke(f.x, f.y, 10, 0x3a3238, { vy: -40, s1: 1.4 });
          await tw(s, { sy: 0.88, sx: 1.08, duration: 0.08 }); await tw(s, { sy: 1, sx: 1, duration: 0.25, ease: 'back.out(3)' });
          gsap.to(s, { white: 0, duration: 0.3 }); break;
        case 'dark': {
          const v = new PIXI.Container(); v.position.set(f.x, f.y); v.scale.set(1, 0.32); fxBack.addChild(v);
          const p1 = new PIXI.Sprite(tex.twirl_03); p1.anchor.set(0.5); p1.tint = 0x000000; p1.scale.set(0); v.addChild(p1);
          const p2 = new PIXI.Sprite(tex.twirl_01); p2.anchor.set(0.5); p2.blendMode = 'add'; p2.tint = C; p2.scale.set(0); v.addChild(p2);
          gsap.to([p1.scale, p2.scale], { x: 2.4, y: 2.4, duration: 0.35, ease: 'back.out(1.5)' }); gsap.to(p1, { rotation: -8, duration: 2 }); gsap.to(p2, { rotation: 8, duration: 2 });
          gsap.to(v, { alpha: 0, duration: 0.5, delay: 1.2, onComplete: () => v.destroy({ children: true }) });
          Sound.S('whisper', { vol: 0.6, dur: 1.2 });
          await wait(250);
          smoke(f.x, f.y - 10, 14, 0x12061c, { vy: -60, s1: 1.6 });
          await appear({ oy: 150, alpha: 0, d: 0.7, ease: 'power3.out' }); break;
        }
        case 'holy':
          beamSprite(f.x, -60, f.x, f.y + 10, 0xfff0c0, 110, 1.0, 'trace_07');
          for (let i = 0; i < 30; i++) P({ t: 'star_05', x: f.x + rnd(-90, 90), y: rnd(0, f.y - 60), vy: rnd(40, 140), life: rnd(0.8, 1.5), s0: 0.12, s1: 0.03, tint: 0xfff0b0 });
          await appear({ oy: -260, d: 0.8, ease: 'power2.out' }); break;
        default:
          for (let i = 0; i < 24; i++) P({ t: ['dirt_01', 'dirt_02'], x: f.x + rnd(-80, 80), y: f.y, vx: rnd(-300, 300), vy: rnd(-500, -200), grav: 1400, life: 0.9, s0: 0.1, s1: 0.06, rot: rnd(0, 6), vr: 8, tint: 0x7a6a5a, add: false });
          smoke(f.x, f.y, 12, 0x4a4040, { vy: -50, s1: 1.6 });
          await appear({ scale: 0.4, d: 0.45 });
      }
      // 4) 咆哮
      if (big) { shake(14); shock(center(side).x, center(side).y, 22, 420, 0.8); ringFx(center(side).x, center(side).y, 0xffffff, 0.4, 5, 0.6, { t: 'circle_04', a0: 0.35 }); }
      else shake(5);
      await tw(s, { sy: 1.06, sx: 0.96, duration: 0.12, yoyo: true, repeat: 1 });
    },
    async recall(side) {
      const s = S.spr[side], c = center(side), f = foot(side);
      Sound.recall();
      gsap.to(s, { white: 1, duration: 0.15 });
      await tw(s, { sx: 0.2, sy: 1.25, alpha: 0.8, duration: 0.18, ease: 'power2.in' });
      // 光の糸になって札へ戻る
      const tl = new PIXI.Sprite(talismanTex); tl.anchor.set(0.5); tl.scale.set(0.4); tl.alpha = 0; tl.position.set(c.x, c.y - 20); fxFront.addChild(tl);
      for (let i = 0; i < 24; i++) P({ t: 'trace_06', x: c.x + rnd(-40, 40), y: c.y + rnd(-90, 90), follow: { x: c.x, y: c.y - 20 }, home: 3, align: 1, life: 0.45, s0: 0.25, s1: 0.05, sx: 0.3, tint: 0xece4cf });
      gsap.to(tl, { alpha: 1, duration: 0.15 });
      await tw(s, { sx: 0.02, sy: 0.02, alpha: 0, duration: 0.18 });
      s.visible = false; s.white = 0; s.sx = 1; s.sy = 1; s.scale = 1;
      await tw(tl, { x: isE(side) ? W + 80 : -80, y: tl.y - 120, rotation: isE(side) ? 2 : -2, duration: 0.3, ease: 'power2.in' });
      tl.destroy();
    },
    async faint(side) {
      const s = S.spr[side], c = center(side), f = foot(side), m = S.mons[side], t = m.types[0], C = hexN(TC(t).c), G = hexN(TC(t).g);
      Sound.faint(m.beast);
      slowmo(0.3, 900); punch(c.x, c.y, 1.2, 0.25, 0.7, 0.7);
      S.flash = { c: '#000000', a: 0.35 };
      // 共通：膝をつくように沈む
      await tw(s, { sy: 0.88, sx: 1.06, oy: 8, duration: 0.18, ease: 'power2.out' });
      const end = () => { s.visible = false; s.oy = 0; s.ox = 0; s.gray = false; s.tintC = null; s.sx = 1; s.sy = 1; s.rot = 0; s.alpha = 0; s.white = 0; };
      switch (t) {
        case 'fire':
          s.tintC = [0.25, 0.12, 0.08];
          for (let i = 0; i < 60; i++) gsap.delayedCall(i * 0.015, () => P({ t: ['flare_01', 'flame_06'], x: c.x + rnd(-70, 70), y: c.y + rnd(-60, 100), vy: rnd(-220, -60), vx: rnd(-40, 40), life: rnd(0.8, 1.6), s0: rnd(0.05, 0.14), s1: 0.01, tint: pickA([0xff6a1a, 0xffa030, 0x402018]) }));
          smoke(c.x, c.y + 40, 14, 0x1a1412, { vy: -80, s1: 1.8 });
          await tw(s, { alpha: 0, sy: 0.6, oy: 30, duration: 1.0, ease: 'power2.in' }); break;
        case 'ice':
          s.tintC = [0.75, 0.95, 1.1];
          await wait(350); S.flash = { c: '#e8ffff', a: 0.6 }; Sound.S('glass', { vol: 0.9, rate: 0.85 }); impactFrame(60);
          for (let i = 0; i < 60; i++) { const an = rnd(0, 6.28), v = rnd(150, 800); P({ t: ['trace_02', 'star_04'], x: c.x + rnd(-50, 50), y: c.y + rnd(-80, 80), vx: Math.cos(an) * v, vy: Math.sin(an) * v - 100, grav: 1300, align: 1, life: rnd(0.6, 1.2), s0: 0.3, s1: 0.1, sx: 0.4, tint: pickA([0xe6ffff, G, 0xffffff]) }); }
          s.alpha = 0; await wait(300); break;
        case 'dark': {
          const v = new PIXI.Container(); v.position.set(f.x, f.y); v.scale.set(1, 0.32); fxBack.addChild(v);
          const p1 = new PIXI.Sprite(tex.twirl_03); p1.anchor.set(0.5); p1.tint = 0x000000; p1.scale.set(0); v.addChild(p1);
          const p2 = new PIXI.Sprite(tex.twirl_01); p2.anchor.set(0.5); p2.blendMode = 'add'; p2.tint = C; p2.scale.set(0); v.addChild(p2);
          gsap.to([p1.scale, p2.scale], { x: 2.6, y: 2.6, duration: 0.3 }); gsap.to([p1, p2], { rotation: 10, duration: 1.6 });
          Sound.S('whisper', { vol: 0.6, dur: 1.2, rate: 0.8 });
          await tw(s, { oy: 120, sx: 0.4, sy: 1.4, rot: 0.3, alpha: 0, duration: 1.0, ease: 'power3.in' });
          gsap.to(v, { alpha: 0, duration: 0.4, onComplete: () => v.destroy({ children: true }) }); break;
        }
        case 'holy':
          s.white = 0.6;
          beamSprite(f.x, -60, f.x, f.y, 0xfff0c0, 80, 1.3, 'trace_07');
          for (let i = 0; i < 40; i++) gsap.delayedCall(i * 0.02, () => P({ t: 'star_05', x: c.x + rnd(-60, 60), y: c.y + rnd(-40, 100), vy: rnd(-300, -120), life: 1.2, s0: 0.12, s1: 0.02, tint: 0xfff0b0 }));
          await tw(s, { oy: -220, alpha: 0, duration: 1.2, ease: 'power2.in' }); break;
        case 'steel':
          Sound.S('mech', { vol: 0.6 });
          await tw(s, { rot: (isE(side) ? 1 : -1) * 0.25, duration: 0.25, ease: 'power1.in' });
          await tw(s, { rot: (isE(side) ? 1 : -1) * 1.45, oy: 20, duration: 0.35, ease: 'power3.in' });
          Sound.footstep(true); Sound.S('clash', { vol: 0.7, rate: 0.6 }); shake(16); shock(f.x, f.y, 25, 300, 0.5);
          for (let i = 0; i < 26; i++) P({ t: ['trace_01', 'dirt_03'], x: f.x + rnd(-100, 100), y: f.y, vx: rnd(-400, 400), vy: rnd(-500, -100), grav: 1400, align: 1, life: 0.8, s0: 0.15, s1: 0.05, sx: 0.5, tint: pickA([0xffd080, 0x888888]) });
          smoke(f.x, f.y, 12, 0x3a3238, { vy: -30, s1: 1.6 });
          await tw(s, { alpha: 0, duration: 0.6, delay: 0.2 }); break;
        case 'water':
          await tw(s, { sy: 0.1, sx: 1.6, oy: 0, duration: 0.35, ease: 'power3.in' });
          Sound.S('WaterBubbles_loop', { vol: 0.6, dur: 0.8 });
          for (let i = 0; i < 50; i++) P({ t: 'circle_05', x: f.x + rnd(-60, 60), y: f.y - 10, vx: rnd(-400, 400), vy: rnd(-600, -150), grav: 1500, life: 1, s0: 0.08, s1: 0.03, tint: G });
          ringFx(f.x, f.y, C, 0.3, 3, 0.8, { sy: 0.3, t: 'circle_04' });
          await tw(s, { alpha: 0, duration: 0.3 }); break;
        case 'wood':
          s.tintC = [0.6, 0.45, 0.3];
          for (let i = 0; i < 40; i++) gsap.delayedCall(i * 0.025, () => P({ t: 'slash_03', x: c.x + rnd(-70, 70), y: c.y + rnd(-80, 40), vx: rnd(-40, 40), vy: rnd(30, 90), life: 1.6, s0: 0.08, s1: 0.05, rot: rnd(0, 6), vr: rnd(-4, 4), tint: pickA([0x8a6a30, 0x6a5020, 0xa08040]), add: false }));
          await tw(s, { sy: 0.4, oy: 20, alpha: 0, duration: 1.2, ease: 'power2.in' }); break;
        case 'thunder':
          for (let k = 0; k < 6; k++) { s.alpha = k % 2 ? 0.2 : 1; bolt(c.x + rnd(-80, 80), c.y + rnd(-90, 90), c.x + rnd(-80, 80), c.y + rnd(-90, 90), 0xfff17a, 3, 0.15); Sound.S('static', { vol: 0.3, dur: 0.1 }); await wait(70); }
          streaks(c.x, c.y, 0xfff17a, 30, 1100); s.alpha = 0; break;
        default:
          await tw(s, { rot: (isE(side) ? 1 : -1) * 1.3, oy: 30, duration: 0.6, ease: 'bounce.out' });
          Sound.footstep(true); shake(10);
          smoke(f.x, f.y, 12, 0x4a4040, { vy: -40, s1: 1.6 });
          await tw(s, { alpha: 0, duration: 0.5 });
      }
      end();
    },
    async hit(side, eff = 1, crit = false, type = 'none') {
      const s = S.spr[side], c = center(side), d = isE(side) ? 1 : -1;
      const ac = center(lastAtk && lastAtk !== side ? lastAtk : (isE(side) ? 'p1' : 'e1')); const L1 = Math.hypot(c.x - ac.x, c.y - ac.y) || 1, kx = (c.x - ac.x) / L1, ky = (c.y - ac.y) / L1;
      s.hurt = 0.55; s.white = 1; gsap.to(s, { white: 0, duration: 0.25, delay: 0.05 });
      // 大きく効いたときはのけぞる（回転＋つぶれ）
      const kb = eff > 1 ? 44 : 22; gsap.fromTo(s, { ox: kx * kb, oy: ky * kb * 0.6, rot: (kx >= 0 ? 1 : -1) * (eff > 1 ? 0.14 : 0.06), sx: 0.92, sy: 1.06 }, { ox: 0, oy: 0, rot: 0, sx: 1, sy: 1, duration: 0.55, ease: 'elastic.out(1, 0.55)' });
      Sound.hit(eff, crit, type);
      if (eff > 1 || crit || Math.random() < 0.35) gsap.delayedCall(0.08, () => Sound.voice(S.mons[side] && S.mons[side].beast, 'hurt'));
      shake(eff > 1 ? 14 : crit ? 12 : 6);
      if (eff > 1) { shock(c.x, c.y, 28, 320, 0.6); impactFrame(50); }
      if (crit) { rgbKick(10, 0.4); zoomKick(0.15, 0.35, c.x, c.y); api.pop(side, '急所', '#ffd36a', 28); }
      if (eff >= 4) api.pop(side, '絶大', '#e8442e', 38); else if (eff > 1) api.pop(side, '抜群', '#e8642e', 32);
      else if (eff > 0 && eff < 1) api.pop(side, '半減', '#8a90a8', 22);
      await wait(260);
    },
    async heal(side) {
      const c = center(side), f = foot(side); Sound.heal();
      // 足元から光の螺旋
      for (let i = 0; i < 48; i++) gsap.delayedCall(i * 0.012, () => { const a = i * 0.5; P({ t: ['star_05', 'circle_05'], x: c.x + Math.cos(a) * 70, y: f.y - i * 4, vx: -Math.sin(a) * 60, vy: -120, life: 0.9, s0: 0.12, s1: 0.02, tint: pickA([0x90ffb0, 0xe0ffd0, 0xffffff]) }); });
      ringFx(f.x, f.y, 0x90ffb0, 0.3, 2, 0.8, { sy: 0.3, t: 'magic_01' });
      P({ t: 'light_02', x: c.x, y: c.y, s0: 0.4, s1: 1.2, life: 0.6, tint: 0x90ffb0, a0: 0.5 });
      const s = S.spr[side]; s.white = 0.4; gsap.to(s, { white: 0, duration: 0.5 });
      await wait(480);
    },
    async stat(side, up, keys = []) {
      const c = center(side), f = foot(side), s = S.spr[side];
      const k = keys[0] || (up ? 'atk' : 'def');
      if (!up) {
        Sound.debuff(k);
        // 鎖が絡みつき、色が抜ける
        const g = new PIXI.Graphics(); fxFront.addChild(g);
        for (let i = 0; i < 3; i++) { const y = c.y - 50 + i * 45; g.moveTo(c.x - 110, y - 20); for (let x = -110; x <= 110; x += 14) g.lineTo(c.x + x, y + Math.sin(x * 0.05 + i) * 10 + (x % 28 ? 5 : -5)); g.stroke({ width: 4, color: 0x6a6a80, alpha: 0.9 }); }
        g.scale.set(1.4, 1); g.pivot.set(c.x, c.y); g.position.set(c.x, c.y); g.alpha = 0;
        gsap.to(g, { alpha: 1, duration: 0.12 }); gsap.to(g.scale, { x: 0.9, duration: 0.25, ease: 'power3.in' });
        gsap.to(g, { alpha: 0, duration: 0.3, delay: 0.45, onComplete: () => g.destroy() });
        for (let i = 0; i < 20; i++) gsap.delayedCall(i * 0.015, () => P({ t: 'trace_06', x: c.x + rnd(-70, 70), y: c.y - 90, vy: rnd(280, 520), align: 1, life: 0.5, s0: 0.3, s1: 0.1, sx: 0.3, tint: 0x4a80ff }));
        s.gray = true; gsap.delayedCall(0.5, () => { s.gray = false; });
        await wait(520); return;
      }
      Sound.buff(k);
      switch (k) {
        case 'atk':
          for (let i = 0; i < 26; i++) gsap.delayedCall(i * 0.012, () => P({ t: ['flame_05', 'flame_06'], x: c.x + rnd(-80, 80), y: f.y, vy: rnd(-500, -250), life: 0.6, s0: 0.2, s1: 0.06, tint: pickA([0xff4020, 0xff8a40]) }));
          gsap.delayedCall(0.15, () => { P({ t: 'slash_04', x: c.x, y: c.y, rot: 0.8, s0: 1, s1: 1.4, life: 0.3, tint: 0xff6a3a, sx: 1.6 }); P({ t: 'slash_04', x: c.x, y: c.y, rot: -0.8, s0: 1, s1: 1.4, life: 0.3, tint: 0xff6a3a, sx: 1.6 }); });
          break;
        case 'def': {
          const g = new PIXI.Graphics(); g.blendMode = 'add'; fxFront.addChild(g);
          const r = 110 * s.sc; const pts = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; pts.push(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 1.15); }
          g.poly(pts).fill({ color: 0xffd36a, alpha: 0.15 }).stroke({ width: 4, color: 0xffd36a });
          g.alpha = 0; gsap.to(g, { alpha: 1, duration: 0.1 }); gsap.to(g, { alpha: 0, duration: 0.4, delay: 0.4, onComplete: () => g.destroy() });
          Sound.S('clash', { vol: 0.3, rate: 1.3 });
          break;
        }
        case 'mag':
          P({ t: 'magic_02', x: c.x, y: c.y - 20, s0: 0.3, s1: 1.5, life: 0.7, vr: 3, tint: 0xb070ff, ease: 1 });
          P({ t: 'magic_04', x: c.x, y: c.y - 20, s0: 0.2, s1: 0.9, life: 0.6, vr: -4, tint: 0xe0c0ff });
          for (let i = 0; i < 24; i++) { const an = rnd(0, 6.28); P({ t: 'circle_05', x: c.x + Math.cos(an) * 140, y: c.y + Math.sin(an) * 140, follow: c, home: 2.5, life: 0.6, s0: 0.08, s1: 0.03, tint: 0xd0a0ff }); }
          break;
        case 'res':
          ringFx(c.x, c.y, 0x6ab0ff, 2.2, 1.6, 0.6, { t: 'circle_03', a0: 0.9 });
          P({ t: 'light_03', x: c.x, y: c.y, s0: 1.2, s1: 1.5, life: 0.6, tint: 0x6ab0ff, a0: 0.4 });
          break;
        case 'spd':
          for (let i = 0; i < 20; i++) P({ t: 'trace_07', x: c.x + rnd(-150, 150), y: c.y + rnd(-90, 90), vx: (isE(side) ? -1 : 1) * rnd(1200, 2000), align: 1, life: 0.3, s0: 0.5, s1: 0.5, sx: 0.12, sy: 1.6, tint: 0xa0fff0 });
          gsap.fromTo(s, { ox: (isE(side) ? 1 : -1) * 30 }, { ox: 0, duration: 0.3, ease: 'power3.out' });
          break;
      }
      for (let i = 0; i < 16; i++) gsap.delayedCall(i * 0.015, () => P({ t: 'trace_06', x: c.x + rnd(-70, 70), y: c.y + 100, vy: rnd(-520, -280), align: 1, life: 0.5, s0: 0.3, s1: 0.1, sx: 0.3, tint: STAGE_COL[k] }));
      s.white = 0.35; gsap.to(s, { white: 0, duration: 0.4 });
      await wait(480);
    },
    async status(side, st) {
      const c = center(side), f = foot(side), s = S.spr[side]; Sound.status(st);
      const col = hexN(STATUS_C[st] || '#e0c050');
      switch (st) {
        case 'brn': for (let i = 0; i < 30; i++) P({ t: ['flame_01', 'flame_02', 'fire_01'], x: c.x + rnd(-70, 70), y: c.y + rnd(-40, 90), vy: rnd(-300, -100), life: 0.7, s0: 0.15, s1: 0.5, rot: rnd(0, 6), tint: pickA([0xff6a1a, 0xffa030]) }); break;
        case 'frz': for (let i = 0; i < 12; i++) { const an = i / 12 * 6.28; P({ t: 'trace_02', x: c.x + Math.cos(an) * 90, y: c.y + Math.sin(an) * 110, rot: an + Math.PI / 2, s0: 0.1, s1: 0.6, sx: 0.6, life: 0.7, tint: 0xe6ffff, ease: 1 }); } S.flash = { c: '#e8ffff', a: 0.35 }; break;
        case 'par': for (let i = 0; i < 4; i++) bolt(c.x + rnd(-90, 90), c.y - 100, c.x + rnd(-90, 90), c.y + 100, 0xfff17a, 3, 0.3); break;
        case 'psn': for (let i = 0; i < 26; i++) P({ t: 'circle_05', x: c.x + rnd(-70, 70), y: c.y + rnd(0, 100), vy: rnd(-200, -60), life: 1, s0: 0.05, s1: rnd(0.1, 0.18), tint: pickA([0xb44cff, 0x60d040]) }); break;
        case 'crs': P({ t: 'magic_02', x: c.x, y: c.y - 110 * s.sc, s0: 0.2, s1: 0.8, life: 0.9, vr: 2, tint: 0x8a1f8f }); smoke(c.x, c.y, 8, 0x1a0624, { vy: -30 }); break;
        case 'slp': for (let i = 0; i < 4; i++) gsap.delayedCall(i * 0.15, () => api.pop(side, 'Z', '#c0d0ff', 22 + i * 4)); break;
        default: for (let i = 0; i < 5; i++) { const ph = i / 5 * 6.28; const o = { k: 0 }; const sp = P({ t: 'star_04', x: c.x, y: c.y - 100 * s.sc, s0: 0.25, s1: 0.25, life: 0.9, tint: 0xffe060 }); gsap.to(o, { k: 1, duration: 0.9, onUpdate: () => { if (sp) { sp.x = c.x + Math.cos(ph + o.k * 12) * 60; sp.y = c.y - 100 * s.sc + Math.sin(ph + o.k * 12) * 16; } } }); }
      }
      P({ t: 'magic_02', x: c.x, y: c.y, s0: 1.6, s1: 0.4, life: 0.5, vr: 5, tint: col, ease: 1 });
      api.pop(side, STATUS_N[st] || '混乱', STATUS_C[st] || '#e0c050', 26);
      await wait(450);
    },
    async miss(side) { Sound.miss(); api.pop(side, '回避', '#a8a2b0', 28); const s = S.spr[side]; await tw(s, { ox: isE(side) ? 60 : -60, rot: isE(side) ? 0.1 : -0.1, duration: 0.12, ease: 'power3.out' }); await tw(s, { ox: 0, rot: 0, duration: 0.3 }); },
    async shieldBlock(side) { const c = center(side); Sound.shield(); ringFx(c.x, c.y + 10, 0x80ffd0, 0.6, 2.2, 0.5, { t: 'circle_03' }); P({ t: 'magic_03', x: c.x, y: c.y, s0: 1, s1: 1.4, life: 0.4, tint: 0x80ffd0 }); streaks(c.x, c.y, 0x80ffd0, 20, 700); shake(6); await wait(350); },
    async cutin(side, mv) {
      const mon = S.mons[side], name = mv.n, type = mv.t;
      Sound.ultimate();
      const c = center(side);
      dark.v = 0.5; camTo(c.x, c.y, 1.3, 0.5);
      zoomKick(0.3, 1.2, c.x, c.y);
      charge(side, type, 1200, true);
      await wait(500);
      const img = Assets.portrait(mon.beast, 420, 380, mon.mutant, !isE(side));
      S.cut = { mon, side, name, color: TC(type).c, img, life: 1.6, max: 1.6 };
      await tw(S.cut, { life: 0, duration: 1.6, ease: 'none' });
      S.cut = null;
      camReset(0.3); dark.v = 0.25;
    },
    async fieldChange(f) {
      const F = FIELDS[f];
      S.flash = { c: F.sky[2], a: 0.5 }; S.fieldFlash = 1;
      api.banner(`異変「${F.n}」`, '#ece4cf', F.d, 2);
      Sound.fieldShift(f); shock(W / 2, H / 2, 25, 700, 0.9);
      await wait(800);
    },
    async meteorOn(side) {
      const c = center(side);
      const m = new PIXI.Sprite(tex.light_01); m.anchor.set(0.5); m.blendMode = 'add'; m.tint = 0xff8030; m.scale.set(0.6); fxFront.addChild(m);
      const pr = { k: 0 };
      await new Promise(res => gsap.to(pr, { k: 1, duration: 0.6, ease: 'power2.in', onUpdate: () => { m.position.set(lerp(c.x - 320, c.x, pr.k), lerp(c.y - 560, c.y, pr.k)); P({ t: ['fire_01', 'flame_02'], x: m.x, y: m.y, vy: -40, life: 0.5, s0: 0.5, s1: 0.1, rot: rnd(0, 6), tint: pickA([0xff6020, 0xffc060]) }); }, onComplete: res }));
      m.destroy(); Sound.explode(); impact(c.x, c.y, 'fire', 1.5); shock(c.x, c.y, 45, 450, 0.8); shake(20); impactFrame(70); S.flash = { c: '#ffb070', a: 0.5 };
      await wait(200);
    },
    async lightningOn(side) {
      const c = center(side);
      bolt(c.x + rnd(-30, 30), -40, c.x, c.y + 50, 0xfff17a, 10, 0.4);
      Sound.cast('thunder', 0.9); S.flash = { c: '#fffbe0', a: 0.5 }; shake(10); impact(c.x, c.y, 'thunder', 0.8); await wait(320);
    },
    async generic(side, color, txt) { const c = center(side); const col = hexN(color); ringFx(c.x, c.y, col, 0.2, 2, 0.6, { t: 'circle_02' }); burst(c.x, c.y, 'circle_05', 30, 300, { t: 'circle_05', life: 0.6, s0: 0.1, s1: 0, tint: col }); if (txt) api.pop(side, txt, color, 24); await wait(380); },
    async spikes(targetSide, n) {
      const tid = targetSide === 'e' ? 'e1' : 'p1', a = center(targetSide === 'e' ? 'p1' : 'e1'), b = foot(tid);
      for (let i = 0; i < 12; i++) P({ t: 'trace_02', x: a.x, y: a.y, vx: (b.x - a.x) * rnd(0.8, 1.4) + rnd(-80, 80), vy: -rnd(300, 500), grav: 1100, align: 1, life: 0.9, s0: 0.3, s1: 0.3, sx: 0.4, tint: 0xc0a0ff });
      Sound.cast('steel', 0.5); await wait(750);
      S.hazard[targetSide] = n; drawHazards();
    },
    setHazard(side, n) { S.hazard[side] = n; if (S.ready) drawHazards(); },
    async attack(atk, move, tgt, repeat) {
      if (tgt) curTgt = tgt; lastAtk = atk;
      const fx = repeat ? (move.c === 'p' ? 'lunge' : 'orb') : (move.fx || (move.c === 'p' ? 'lunge' : 'orb'));
      const t = move.t;
      if (ULT[fx]) {
        dark.v = 0.25;
        for (const p of ULT[fx]) { if (p === 'meteor') await meteorStorm(atk, t); else await (PAT[p] || PAT.orb)(atk, t); }
        const b = center(TG(atk));
        Sound.ultImpact();         S.flash = { c: TC(t).c, a: 0.6 }; impactFrame(100); hitstop(140); shake(26); rgbKick(14, 0.6); shock(b.x, b.y, 60, 700, 1.1);
        impact(b.x, b.y, t, 1.8);
        dark.v = 0;
        return;
      }
      await (PAT[fx] || PAT.orb)(atk, t);
    },

    // ===== 封札連鎖用 =====
    setupBattle(b) { api.clear(); S.battle = b; S.target = b.E[0].unit; },
    setUnit(id, m) { api.setMon(id, m); },
    refresh() { },
    caption(t) { if (api.onCaption) api.onCaption(t); },
    turnBanner(text, sub) { api.banner(text, '#ece4cf', sub, 1.1); Sound.S('uiOpen', { vol: 0.35 }); },
    chainPop(n, t) {
      const col = TC(t).c;
      S.pops.push({ x: W / 2, y: 470, text: `連鎖 ${n}`, color: n >= 6 ? '#ffd36a' : col, size: 30 + Math.min(n, 9) * 3, life: 0.9, max: 0.9, big: 1 });
      Sound.chain(n);
      if (n >= 4) { shake(4 + n); rgbKick(n, 0.3); }
      if (n >= 6) { S.flash = { c: col, a: 0.25 }; }
    },
    chainEnd(n) { if (n >= 4) api.banner(`${n}連鎖`, '#ffd36a', `ダメージ×${(1 + 0.25 * (n - 1)).toFixed(2)}`, 1.0); },
    energyPop() { S.pops.push({ x: W / 2 + 120, y: 500, text: '魂火+1', color: '#ff9a5a', size: 22, life: 0.9, max: 0.9 }); Sound.S('powerUp', { vol: 0.35, rate: 1.3 }); },
    gaugeFull() { api.banner('覚醒', '#ffd36a', '味方を押すと奥義を放てる', 1.4); Sound.gauge(); },
    async cast(id, mv, tgt) { curTgt = tgt || (isE(id) ? 'p1' : 'e1'); const fx = mv.fx || 'buff'; if (fx === 'status') return PAT.status(id, mv.t); return (PAT[fx] || PAT.buff)(id, mv.t); },
    async blockFx(ids) { Sound.shield(); for (const id of ids) { const c = center(id); ringFx(c.x, c.y + 10, 0x80c8ff, 0.4, 1.5, 0.5, { t: 'circle_03' }); } await wait(300); },
    blockHit(id, b) { const c = center(id); ringFx(c.x, c.y, 0x80c8ff, 0.3, 1.2, 0.3, { t: 'circle_02' }); S.pops.push({ x: c.x - 40, y: c.y - 40, text: `防${b}`, color: '#80c8ff', size: 18, life: 0.8, max: 0.8 }); Sound.S('clash', { vol: 0.35, rate: 1.4 }); },
    async buffFx(id, k) { return api.stat(id, true, [k]); },
    async statusFx(id, st) { if (st === 'stun') { api.pop(id, '怯み', '#a8a2b0', 24); await wait(300); return; } return api.status(id, st); },
    async hazeFx() { await PAT.haze('p1'); },
    async hitFx(id, eff, crit, type, ult) { return api.hit(id, eff, crit, type); },
    async healFx(id, v) { S.pops.push({ x: center(id).x, y: center(id).y - 20, text: `+${v}`, color: '#90ffb0', size: 30, life: 1, max: 1, num: 1 }); return api.heal(id); },
    async breakFx(id) {
      const c = center(id), sp = S.spr[id];
      Sound.S('glass', { vol: 0.8, rate: 0.8 }); Sound.S('boom', { vol: 0.6 });
      impactFrame(70); hitstop(120); shake(16); rgbKick(10, 0.4);
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; P({ t: 'trace_04', x: c.x, y: c.y, rot: a, s0: 0.3, s1: 1.4, sx: 0.4, sy: 1.2, life: 0.6, tint: 0xff6a4a, ease: 1 }); }
      P({ t: 'magic_03', x: c.x, y: c.y, s0: 1.4, s1: 0.2, life: 0.5, tint: 0xff6a4a, vr: 6 });
      api.pop(id, '崩封', '#ff6a4a', 40);
      sp.white = 0.8; gsap.to(sp, { white: 0, duration: 0.5 });
      await wait(500);
    },
    revealWeak(id, t) { const c = center(id); S.pops.push({ x: c.x + 60, y: c.y + 40, text: `刻印「${TYPES[t].n}」`, color: TYPES[t].c, size: 18, life: 1.2, max: 1.2 }); Sound.S('uiMagic', { vol: 0.4 }); },
    async throwSeal(id) {
      const c = center(id);
      const tl = new PIXI.Sprite(talismanTex); tl.anchor.set(0.5); tl.scale.set(0.3); tl.position.set(W / 2, H - 40); fxFront.addChild(tl);
      Sound.swing();
      await tw(tl, { x: c.x, y: c.y, rotation: 6.28 * 2, duration: 0.4, ease: 'power2.in' });
      Sound.S('paper', { vol: 0.7 });
      gsap.to(tl, { alpha: 0, duration: 0.3, delay: 0.3, onComplete: () => tl.destroy() });
      await wait(150);
    },
    async sealUnit(id) {
      const c = center(id), sp = S.spr[id];
      Sound.S('chains', { vol: 0.7 }); Sound.S('riserS', { vol: 0.4 });
      // 封の文字の結界が締まる
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; P({ t: 'trace_07', x: c.x + Math.cos(a) * 160, y: c.y + Math.sin(a) * 160, follow: c, home: 4, align: 1, life: 0.5, s0: 0.5, s1: 0.2, sx: 0.3, tint: 0xc8321f }); }
      P({ t: 'magic_02', x: c.x, y: c.y, s0: 2.2, s1: 0.3, life: 0.7, vr: 8, tint: 0xc8321f, ease: 1 });
      sp.white = 1;
      await tw(sp, { sx: 0.05, sy: 1.3, alpha: 0.9, duration: 0.45, ease: 'power3.in' });
      Sound.S('boomDrop', { vol: 0.7 }); impactFrame(60); shake(12); shock(c.x, c.y, 30, 300, 0.6);
      flare(c.x, c.y, 0xff6a4a, 2.5, 0.4);
      api.pop(id, '封印', '#c8321f', 44);
      // 札になって画面下へ
      const tl = new PIXI.Sprite(talismanTex); tl.anchor.set(0.5); tl.scale.set(0.5); tl.position.set(c.x, c.y); fxFront.addChild(tl);
      sp.visible = false; sp.alpha = 0; sp.white = 0; sp.sx = 1; sp.sy = 1;
      if (circles[id]) circles[id].parent.visible = false;
      await tw(tl, { y: c.y - 30, duration: 0.25, ease: 'power2.out' });
      await tw(tl, { x: W / 2, y: H + 80, rotation: 0.6, duration: 0.45, ease: 'power2.in' });
      tl.destroy();
    },
    async sealFail(id) { const c = center(id); Sound.S('uiErr', { vol: 0.5 }); Sound.S('paper', { vol: 0.5, rate: 1.4 }); smoke(c.x, c.y, 6, 0x6a6070); api.pop(id, '抵抗', '#a8a2b0', 26); await tw(S.spr[id], { rot: 0.12, duration: 0.08, yoyo: true, repeat: 3 }); S.spr[id].rot = 0; },
    async ultAttack(id, mv, targets) {
      curTgt = targets[0] || 'e1';
      const fx = mv.fx || 'u_fire';
      // 全体攻撃：中央の敵を狙って演出し、全員に着弾
      curTgt = targets.includes('e1') ? 'e1' : targets[0];
      await api.attack(id, mv, curTgt);
      for (const t of targets) { const c = center(t); impact(c.x, c.y, mv.t, 1.2); }
    },
    async chaosFx(id) { curTgt = isE(id) ? 'p1' : 'e1'; await PAT.chaos(id, 'none'); },
    chaosBanner(name) { api.banner(`混沌事件：${name}`, '#e070d0', '', 1.3); Sound.alarm(); },
    async meteor(id) { return api.meteorOn(id); },
    async lightning(id) { return api.lightningOn(id); },
    async selfHit(side) { const c = center(side); Sound.hit(1); impact(c.x, c.y, 'none', 0.7); S.spr[side].hurt = 0.5; shake(6); await wait(300); },
  };
  return api;
})();
