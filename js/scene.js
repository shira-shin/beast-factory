
// ===== バトルステージ（PixiJS + pixi-filters + GSAP） =====
// 世界レイヤ（背景・魔獣・エフェクト）はWebGLで描画し、カメラ・ブルーム・衝撃波・色収差をかける。
// HUD（体力板・カットイン・文字）は上に重ねた2Dキャンバスで描く。
'use strict';

const Scene = (() => {
  let W = 960, H = 540;
  const S = {
    speed: 1, field: 'none', fieldTurns: 0, fieldFlash: 0,
    mons: [null, null], spr: [mkSpr(0), mkSpr(1)], sides: [null, null],deployed:new Set(),
    hpDisp: [0, 0], hpLag: [0, 0], gaugeDisp: [0, 0], hazard: [0, 0],
    pops: [], banner: null, cut: null, flash: null, showPanels: true, ready: false,
  };
  function mkSpr(side) {
    return side === 0 ? { bx: W===720?W*.28:250, by: W===720?H*.80:452, sc: 1.08, flip: 1, ox: 0, oy: 0, alpha: 0, scale: 1, sx: 1, sy: 1, rot: 0, hurt: 0, white: 0, visible: false }
                      : { bx: W===720?W*.73:715, by: W===720?H*.45:300, sc: 0.86, flip: -1, ox: 0, oy: 0, alpha: 0, scale: 1, sx: 1, sy: 1, rot: 0, hurt: 0, white: 0, visible: false };
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickA = a => a[Math.floor(Math.random() * a.length)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const hexN = h => parseInt(h.replace('#', ''), 16);
  const TC = t => TYPES[t] || TYPES.none;

  let app, world, bgSprite, bgCanvas, bgTex, ringLayer, monLayer, darkG, fxBack, fxFront, hazardG, worldCM, glitchRGB, zoomBlur, bloom;
  let hud, hctx;
  const tex = {};
  const views = [null, null];
  const parts = [];
  window.VALGA_QUALITY=(()=>{try{return localStorage.getItem('valga_quality')||'balanced'}catch{return'balanced'}})();
  const quality=()=>window.VALGA_QUALITY==='light'?{particles:150,fps:30,dpr:1}:window.VALGA_QUALITY==='high'?{particles:480,fps:45,dpr:1.5}:{particles:300,fps:40,dpr:1.25};
  const sequenceTextures=new Map(),relicTextures=new Map();
  function framesFor(name){if(sequenceTextures.has(name))return sequenceTextures.get(name);const sheet=tex[name];if(!sheet)return[];const w=sheet.width/4,h=sheet.height/2;const frames=Array.from({length:8},(_,i)=>new PIXI.Texture({source:sheet.source,frame:new PIXI.Rectangle(i%4*w,Math.floor(i/4)*h,w,h)}));sequenceTextures.set(name,frames);return frames}
  function sequence(name,x,y,{size=1,life=.75,front=true,alpha=1}={}){const frames=framesFor('ritual-'+name);if(!frames.length)return null;const reduced=window.VALGA_MOTION==='reduced';return P({t:'ritual-'+name,frames:reduced?[frames[4]]:frames,x,y,s0:size,s1:size,life:reduced?Math.min(life,.4):life,a0:alpha,a1:reduced?0:alpha,add:false,front,fadeIn:.03})}
  function reveal(side,progress){const v=views[side];if(!v)return;const s=S.spr[side];s.reveal=progress;const mask=new PIXI.Graphics();v.cont.addChild(mask);v.body.mask=mask;v.revealMask=mask}
  function clearReveal(side){const v=views[side];if(v?.revealMask){v.body.mask=null;v.revealMask.destroy();v.revealMask=null}S.spr[side].reveal=1}
  const shocks = [];
  let activeStrike=null;
  const timingTrace=[];
  function trace(event,extra={}){timingTrace.push({event,at:performance.now(),...extra});if(timingTrace.length>100)timingTrace.shift()}
  function resolveStrike(){const strike=activeStrike;if(!strike||strike.fired||!strike.armed)return;strike.fired=true;trace('impact',{side:strike.side});strike.promise=Promise.resolve().then(strike.onImpact);strike.promise.catch(()=>{});return strike.promise}
  const cam = { x: W / 2, y: H / 2, z: 1, shake: 0 };
  let T = 0, dark = { v: 0 }, invertT = 0, rgbAmt = { v: 0 }, zoomAmt = { v: 0 };
  const circles = [null, null];

  // ---------- 時間制御（演出速度・ヒットストップ・スロー） ----------
  let slow = 1, stopUntil = 0;
  function timeScale() { return (performance.now() < stopUntil ? 0.0001 : 1) * slow * S.speed; }
  function applyTS() { gsap.globalTimeline.timeScale(timeScale()); }
  const wait = ms => new Promise(r => gsap.delayedCall(ms / 1000, r));
  function hitstop(ms) { stopUntil = Math.max(stopUntil, performance.now() + ms); applyTS(); setTimeout(applyTS, ms + 5); }
  function slowmo(f, ms) { slow = f; applyTS(); setTimeout(() => { slow = 1; applyTS(); }, ms); }
  const tw = (o, v) => new Promise(r => gsap.to(o, Object.assign({}, v, { onComplete: r })));

  function center(side) { const s = S.spr[side]; return { x: s.bx + s.ox, y: s.by + s.oy - 105 * s.sc }; }
  function foot(side) { const s = S.spr[side]; return { x: s.bx + s.ox, y: s.by + s.oy }; }
  const dirOf = side => side === 0 ? 1 : -1; // 攻撃方向

  // ---------- 粒子 ----------
  // o: {t:テクスチャ名|配列, x,y, vx,vy, life, s0,s1(拡大), a0,a1, rot, vr, tint, add, grav, drag, front, align, sx,sy, follow,home}
  function P(o) {
    if (parts.length >= quality().particles-(o.frames?0:16)) return null;
    const name = Array.isArray(o.t) ? pickA(o.t) : o.t;
    const sp = new PIXI.Sprite(o.frames?.[0]||o.texture||tex[name] || PIXI.Texture.WHITE);
    sp.anchor.set(o.ax ?? 0.5, o.ay ?? 0.5);
    sp.blendMode = o.add === false ? 'normal' : 'add';
    if (o.tint !== undefined) sp.tint = o.tint;
    const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 0.6, s0: 0.3, s1: 0.6, a0: 1, a1: 0, rot: 0, vr: 0, grav: 0, drag: 1, sx: 1, sy: 1, fadeIn: 0.05 }, o);
    p.max = p.life; p.sp = sp;
    sp.x = p.x; sp.y = p.y; sp.rotation = p.rot;
    (o.front === false ? fxBack : o.layer || fxFront).addChild(sp);
    if(o.frames?.length>1){p.blendSprite=new PIXI.Sprite(o.frames[1]);p.blendSprite.anchor.copyFrom(sp.anchor);p.blendSprite.blendMode=sp.blendMode;p.blendSprite.alpha=0;sp.parent.addChild(p.blendSprite)}
    parts.push(p);
    return p;
  }
  function updParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { p.sp.destroy();p.blendSprite?.destroy(); parts.splice(i, 1); continue; }
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
      if(p.frames?.length){const at=Math.min(p.frames.length-1,k*(p.frames.length-1)),idx=Math.floor(at),mix=at-idx;p.sp.texture=p.frames[idx];if(p.blendSprite){const alpha=p.sp.alpha;p.sp.alpha=alpha*(1-mix);p.blendSprite.texture=p.frames[Math.min(p.frames.length-1,idx+1)];p.blendSprite.position.copyFrom(p.sp.position);p.blendSprite.scale.copyFrom(p.sp.scale);p.blendSprite.rotation=p.sp.rotation;p.blendSprite.alpha=alpha*mix}}
    }
  }
  function burst(x, y, t, n, spd, o = {}) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = rnd(0.25, 1) * spd; P(Object.assign({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v }, typeof o === 'function' ? o(i) : o, { t: o.t || t })); }
  }
  function streaks(x, y, color, n = 16, spd = 900, len = 0.5) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = rnd(0.4, 1) * spd; P({ t: ['trace_01', 'trace_06', 'trace_07'], x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, align: 1, life: rnd(0.18, 0.35), s0: len, s1: len * 0.4, sx: 0.35, sy: 1.6, tint: color, drag: 0.88 }); }
  }
  function ringFx(x, y, color, s0 = 0.2, s1 = 2, life = 0.45, o = {}) { return P(Object.assign({ t: 'circle_03', x, y, s0, s1, life, tint: color, ease: 1, a0: 1, a1: 0 }, o)); }
  function inkImpact(side,type,power=1,at=null){const key='ink-'+(type==='none'?'steel':type);if(!tex[key])return;const c=at||center(side),d=side?-1:1;
   P({t:key,x:c.x,y:c.y,s0:.25*power,s1:1.65*power,life:.44,a0:.96,a1:0,add:false,rot:d*.2,vr:d*.9,ease:1,sx:d,sy:1});
   if(power>1.2)P({t:key,x:c.x+d*20,y:c.y-12,s0:.1,s1:power,life:.32,a0:.48,a1:0,add:true,rot:d*1.2,vr:-d*2,ease:1});
  }
  function flare(x, y, color = 0xffffff, s = 2, life = 0.3) { P({ t: 'flare_01', x, y, s0: s * 0.3, s1: s * 0.8, life, tint: color, ease: 1, a0: 0.9 }); P({ t: 'light_01', x, y, s0: s * 0.2, s1: s * 0.45, life: life * 1.2, tint: color, a0: 0.45 }); }
  function smoke(x, y, n, color = 0x302838, o = {}) {
    for (let i = 0; i < n; i++) P(Object.assign({ t: ['smoke_04', 'smoke_05', 'smoke_07', 'smoke_08'], x: x + rnd(-30, 30), y: y + rnd(-20, 20), vx: rnd(-60, 60), vy: rnd(-90, -20), life: rnd(0.8, 1.6), s0: 0.4, s1: 1.2, a0: 0.75, tint: color, add: false, rot: rnd(0, 6), vr: rnd(-1, 1), drag: 0.95, front: false }, o));
  }

  // ---------- 衝撃波・画面効果 ----------
  function shock(x, y, amp = 30, radius = 360, life = 0.7, wl = 120) {
    if (!PIXI.filters || window.VALGA_QUALITY==='light'||shocks.length>=2) return;
    const g = world.toGlobal({ x, y });
    const f = new PIXI.filters.ShockwaveFilter({ center: { x: g.x, y: g.y }, amplitude: amp, wavelength: wl, speed: radius / life, brightness: 1.15, radius });
    f.time = 0;
    shocks.push({ f, life, max: life });
  }
  function impactFrame(ms = 60) { if(window.VALGA_MOTION!=='reduced')S.flash={c:'#e8dfbc',a:.1}; }
  function rgbKick(v = 8, dur = 0.35) { if(window.VALGA_MOTION==='reduced')return; rgbAmt.v = v; gsap.to(rgbAmt, { v: 0, duration: dur, ease: 'power2.out' }); }
  function zoomKick(v = 0.25, dur = 0.5, cx = W / 2, cy = H / 2) { if(window.VALGA_MOTION==='reduced')return; if (zoomBlur) zoomBlur.center = world.toGlobal({ x: cx, y: cy }); zoomAmt.v = v; gsap.to(zoomAmt, { v: 0, duration: dur, ease: 'power2.out' }); }
  function shake(n) { if(window.VALGA_MOTION!=='reduced')cam.shake = Math.max(cam.shake, n*.65); }
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
    const g = c.createLinearGradient(0, 0, 0, H * 0.62);
    g.addColorStop(0, F.sky[0]); g.addColorStop(0.6, F.sky[1]); g.addColorStop(1, F.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (Assets.bgImg.arena) {
      const im = Assets.bgImg.arena, r = Math.max(W / im.width, H / im.height)*(H>W?1.45:1.08);
      c.globalAlpha = 1; c.drawImage(im, (W - im.width * r) / 2, (H - im.height * r)*.95, im.width * r, im.height * r);
      c.globalCompositeOperation = 'soft-light'; c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
    } else {
      // 星
      const rng = mulberry(7);
      for (let i = 0; i < 120; i++) { c.globalAlpha = rng() * 0.6 + 0.1; c.fillStyle = '#fff'; const s = rng() * 1.4 + 0.3; c.fillRect(rng() * W, rng() * 300, s, s); }
      c.globalAlpha = 1;
      // 天体
      const moonC = { bloodmoon: '#c81c22', sun: '#ffd27a', sanct: '#fff4d6', chaos: '#e070d0', storm: '#9aa0c0' }[S.field] || '#e8e2d2';
      const mr = S.field === 'bloodmoon' ? 80 : S.field === 'sun' ? 60 : 42;
      const MX = 470, MY = 92; const mg = c.createRadialGradient(MX, MY, mr * 0.5, MX, MY, mr * 3);
      mg.addColorStop(0, Art.rgba(moonC, 0.35)); mg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = mg; c.fillRect(0, 0, W, H * 0.7);
      c.fillStyle = moonC; c.beginPath(); c.arc(MX, MY, mr, 0, 7); c.fill();
      c.globalAlpha = 0.18; c.fillStyle = '#000';
      for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(MX + Math.cos(i * 2.1) * mr * 0.5, MY + Math.sin(i * 1.7) * mr * 0.45, mr * (0.1 + (i % 3) * 0.06), 0, 7); c.fill(); }
      c.globalAlpha = 1;
      // 山
      const ridge = (y0, amp, f, seed, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 8) c.lineTo(x, y0 - (Math.sin(x * f + seed) * amp + Math.sin(x * f * 2.7 + seed * 2) * amp * 0.45 + Math.sin(x * f * 9 + seed) * amp * 0.12)); c.lineTo(W, H); c.fill(); };
      ridge(300, 34, 0.005, 3, 'rgba(20,16,26,0.75)');
      // 工廠
      c.fillStyle = '#0c0a0f';
      const blocks = [[20, 150, 70], [95, 210, 46], [150, 120, 120], [278, 240, 40], [325, 170, 84], [416, 130, 60], [480, 90, 50]];
      blocks.forEach(([x, h, w], i) => {
        c.fillRect(x, 330 - h, w, h + 40);
        if (i % 2) { c.fillRect(x + w * 0.35, 330 - h - 46, w * 0.22, 46); c.fillRect(x + w * 0.3, 330 - h - 50, w * 0.32, 6); }
        for (let wy = 330 - h + 16; wy < 320; wy += 20) for (let wx = x + 7; wx < x + w - 9; wx += 15) if (rng() > 0.62) { c.fillStyle = `rgba(255,${150 + rng() * 60 | 0},80,${0.35 + rng() * 0.4})`; c.fillRect(wx, wy, 4, 7); c.fillStyle = '#0c0a0f'; }
      });
      ridge(345, 14, 0.012, 9, '#0e0c12');
    }
    // Procedural floor is only a fallback; preserve the generated stage painting.
    if(!Assets.bgImg.arena){
    // 床
    const fg = c.createLinearGradient(0, 330, 0, H);
    fg.addColorStop(0, '#16141a'); fg.addColorStop(1, '#25222a');
    c.fillStyle = fg; c.fillRect(0, 338, W, H - 338);
    // 石畳
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) { const y = 338 + Math.pow(i / 9, 1.7) * (H - 338); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    for (let i = -14; i <= 14; i++) { c.beginPath(); c.moveTo(W / 2 + i * 40, 338); c.lineTo(W / 2 + i * 150, H); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 9; i++) { const y = 339 + Math.pow(i / 9, 1.7) * (H - 338); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // 地平の霞
    const hz = c.createLinearGradient(0, 300, 0, 380); hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(0.5, Art.rgba(F.sky[2], 0.25)); hz.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = hz; c.fillRect(0, 300, W, 80);
    }
    // 周辺減光
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
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
    const ringG = new PIXI.Graphics(); ringG.ellipse(0, 0, 104, 19).stroke({ color: side ? 0xe0584a : 0x58b4ff, width: 3, alpha: .8 }); ringG.ellipse(0, 0, 112, 22).stroke({ color: side ? 0xe0584a : 0x58b4ff, width: 1.5, alpha: .35 }); cont.addChild(ringG);
    const img = Assets.beastImg[m.beast.id];
    let body, texr, canvas = null, mode;
    if (img) {
      mode = 'img'; texr = PIXI.Texture.from(img);
      body = new PIXI.MeshPlane({texture:texr,verticesX:7,verticesY:9});
      body.pivot.set(texr.width*.5,texr.height*.99);body.anchor=new PIXI.Point(.5,.99);
      body.motionBuffer=body.geometry.getAttribute('aPosition').buffer;
      body.restVertices=Float32Array.from(body.motionBuffer.data);
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
    monLayer.addChildAt(cont, side === 1 ? 0 : monLayer.children.length);
    views[side] = { cont, body, shadowG, ringG, cm, canvas, tex: texr, mode, face: Assets.faceSign?.(m.beast.id)||1, beast: m.beast, mutant: m.mutant, flier: ['bird', 'eye', 'blob'].includes(m.beast.art.body) && !m.beast.art.kraken };
    // 足元の魔法陣
    if (circles[side]) circles[side].tint = hexN(TC(m.types[0]).c);
  }
  function updViews(dt) {
    for (let side=0;side<S.spr.length;side++) {
      const v = views[side], s = S.spr[side];
      if (!v) continue;
      v.cont.visible = s.visible;
      if (!s.visible) continue;
      if (s.hurt > 0) s.hurt = Math.max(0, s.hurt - dt * 1.8);
      const hx = s.hurt > 0 ? Math.sin(s.hurt * 70) * 10 * s.hurt : 0;
      v.cont.x = s.bx + s.ox + hx; v.cont.y = s.by + s.oy;
      v.cont.alpha = s.alpha;
      v.shadowG.y = -s.oy * 0.9; v.shadowG.scale.set(s.sc * s.scale * (1 - Math.min(0.5, -s.oy / 300)), s.sc);if(v.ringG){v.ringG.y=v.shadowG.y;v.ringG.scale.set(s.sc*s.scale,s.sc);v.ringG.visible=!S.duo}
      const archetype=v.beast.art.body,heavy=archetype==='golem'||v.beast.art.bulky;
      const phase=T*(heavy?1.25:archetype==='bird'?2.8:2.1)+v.beast.id.length*.73;
      const breath = Math.sin(phase) * (heavy?.005:.012);
      const bob = v.flier ? Math.sin(phase) * (archetype==='eye'?10:6) : Math.sin(phase*.5)*(heavy?.4:1.2);
      v.body.y = bob - (v.flier && v.mode === 'img' ? 30 : 0) * s.sc;
      const base = v.body.baseScale * s.sc * s.scale;
      v.body.scale.set(base * s.sx * s.flip * (v.face||1) * (1 - breath * 0.5), base * s.sy * (1 + breath));
      v.body.rotation = s.rot;
      if(v.revealMask){const x=v.tex.width*v.body.baseScale*s.sc*s.scale*.5+22,h=v.tex.height*v.body.baseScale*s.sc*s.scale+65,top=20-(s.reveal||0)*h,points=[-x,20,x,20];for(let i=8;i>=0;i--)points.push(-x+i*x/4,top+Math.sin(i*2.3)*8*(1-(s.reveal||0)));v.revealMask.clear().poly(points).fill(0xffffff)}
      if(v.body.motionBuffer&&window.VALGA_MOTION!=='reduced'){
       const data=v.body.motionBuffer.data,rest=v.body.restVertices,iw=v.tex.width,ih=v.tex.height;
       for(let j=0;j<data.length;j+=2){const u=rest[j]/iw-.5,y=rest[j+1]/ih,top=Math.pow(1-y,1.5),soft=archetype==='blob'||archetype==='serpent';
        const sway=Math.sin(phase-y*4+u*2)*(soft?6:archetype==='bird'?4:heavy?.7:2.2);
        data[j]=rest[j]+sway*top+(s.wind||0)*u*top*7;
        data[j+1]=rest[j+1]+Math.sin(phase+u*5)*top*(soft?3:archetype==='bird'?5:heavy?.4:1.2);
       }v.body.motionBuffer.update();
      }
      if (v.mode === 'proc' && (Math.floor(T * 30) % 2 === side % 2 || v.first !== true)) {
        v.first = true;
        const c = v.canvas.getContext('2d'); c.clearRect(0, 0, 640, 560);
        c.save(); c.translate(320, 544); c.scale(2, 2);
        Art.drawBeast(c, v.beast, T + side * 3, { mutant: v.mutant });
        c.restore();
        c.globalCompositeOperation = 'source-atop';
        const g = c.createLinearGradient(0, 0, 0, 560); g.addColorStop(0, 'rgba(16,13,20,0.74)'); g.addColorStop(0.75, 'rgba(12,10,15,0.8)'); g.addColorStop(1, Art.rgba(TC(v.beast.types[0]).c, 0.5));
        c.fillStyle = g; c.fillRect(0, 0, 640, 560); c.globalCompositeOperation = 'source-over';
        v.tex.source.update();
      }
      // 白飛び（被弾・召喚）
      const w = s.white;
      if (w > 0.01) v.cm.matrix = [1 - w, 0, 0, 0, w, 0, 1 - w, 0, 0, w, 0, 0, 1 - w, 0, w, 0, 0, 0, 1, 0];
      else if (s.gray) v.cm.desaturate(); else v.cm.reset();
    }
  }

  // ---------- 召喚札 ----------
  // ---------- HUD（2D） ----------
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  const FONT_D = '"Shippori Mincho B1", "Yu Mincho", serif';
  const FONT_N = '"Barlow Condensed", "Zen Kaku Gothic New", sans-serif';
  const FONT_B = '"Zen Kaku Gothic New", sans-serif';
  function drawPanel(side) {
    const m = S.mons[side]; if (!m || !S.spr[side].visible) return;
    const c = hctx;
    const w=330,h=92,mini=Math.min(innerHeight<560&&innerWidth>innerHeight?.72:1,(W/2-24)/w);const px=side?W-w*mini-14:14,py=14,x=0,y=0;
    c.save();c.translate(px,py);c.scale(mini,mini);c.globalAlpha = Math.min(1, S.spr[side].alpha * 1.6);
    c.fillStyle=side?'rgba(40,12,12,.86)':'rgba(10,26,38,.86)';c.beginPath();c.roundRect(x,y,w,h,22);c.fill();
    c.strokeStyle=side?'#e0584a':'#58b4ff';c.lineWidth=2;c.stroke();
    c.font=`900 12px ${FONT_B}`;const tag=side?'相手':'あなた',tw0=c.measureText(tag).width+16;c.fillStyle=side?'#c8321f':'#2a7fd0';c.beginPath();c.roundRect(side?w-tw0-10:10,-9,tw0,19,9);c.fill();c.fillStyle='#fff';c.textAlign='center';c.fillText(tag,(side?w-tw0-10:10)+tw0/2,5);c.textAlign='left';
    c.strokeStyle=TC(m.types[0]).c;c.lineWidth=2;c.beginPath();c.arc(x+14,y+20,7,-Math.PI*.6,Math.PI*.65);c.stroke();
    // 名前
    c.textBaseline = 'alphabetic'; c.fillStyle = '#ece4cf'; c.font = `800 19px ${FONT_D}`;
    const nm = (m.mutant ? '異・' : '') + m.name;
    c.fillText(nm, x + 29, y + 28);
    let bx = x + 36 + c.measureText(nm).width;
    m.types.forEach(tp => { c.strokeStyle=TC(tp).c;c.lineWidth=.8;c.beginPath();c.arc(bx+10,y+22,9,0,Math.PI*2);c.stroke();c.fillStyle=TC(tp).g;c.font=`500 12px ${FONT_D}`;c.textAlign='center';c.fillText(TC(tp).n,bx+10,y+27);c.textAlign='left';bx+=23; });
    if(m.status){const im=Assets.fxImg['ritual-states'],cell=Assets.stateCells[m.status];if(im&&cell!==undefined)c.drawImage(im,cell%4*im.width/4,Math.floor(cell/4)*im.height/2,im.width/4,im.height/2,bx+3,y+11,22,22);c.fillStyle=STATUS_C[m.status];c.font=`600 11px ${FONT_B}`;c.fillText(STATUS_N[m.status],bx+27,y+27)}
    // 控え
    const team = S.sides[side] ? S.sides[side].team : [];
    team.forEach((tm, i) => { const cx = x + w - 16 - i * 15; c.fillStyle = tm.hp <= 0 ? '#2a2530' : tm === m ? '#c8321f' : '#ece4cf'; c.save(); c.translate(cx, y + 21); c.rotate(Math.PI / 4); c.fillRect(-4.5, -4.5, 9, 9); c.restore(); });
    // HP
    const hb = { x: x + 16, y: y + 43, w: w - 32, h: 6 };
    const r = Math.max(0, S.hpDisp[side] / m.maxhp), rl = Math.max(0, S.hpLag[side] / m.maxhp);
    c.fillStyle = '#060508'; c.fillRect(hb.x, hb.y, hb.w, hb.h);
    if (rl > r) { c.fillStyle = '#e8dcc0'; c.fillRect(hb.x, hb.y, hb.w * rl, hb.h); }
    const col = r > 0.5 ? '#a7b885' : r > 0.2 ? '#c5a66f' : '#c77d60';
    c.fillStyle = col; c.fillRect(hb.x, hb.y, hb.w * r, hb.h);
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(hb.x, hb.y, hb.w * r, 3);
    c.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 1; i < 5; i++) c.fillRect(hb.x + hb.w * i / 5, hb.y, 1, hb.h);
    c.font = `600 15px ${FONT_N}`; c.fillStyle = '#ece4cf'; c.textAlign = 'right';
    c.fillText(side ? `${Math.ceil(r * 100)}%` : `${Math.ceil(S.hpDisp[side])}/${m.maxhp}`, x + w - 16, y + 70); c.textAlign = 'left';
    // 能力変化
    let sx = x + 16; c.font = `700 12px ${FONT_B}`;
    if((side===0||m.itemRevealed)&&Assets.itemImg[m.item]){const opacity=c.globalAlpha;c.globalAlpha=opacity*(m.itemUsed?.35:1);c.drawImage(Assets.itemImg[m.item],x+14,y+55,21,21);c.globalAlpha=opacity;sx=x+40}
    for (const k of ['atk', 'def', 'mag', 'res', 'spd']) {
      const v = m.stages[k]; if (!v) continue;
      const tx = `${STAT_N[k].slice(0, 2)}${v > 0 ? '+' : ''}${v}`; const tw2 = c.measureText(tx).width + 8;
      c.fillStyle = v > 0 ? '#b8452a' : '#2f4f8a'; c.fillRect(sx, y + 58, tw2, 15);
      c.fillStyle = '#f2ead6'; c.fillText(tx, sx + 4, y + 70); sx += tw2 + 3;
    }
    // 覚醒
    const gv = Math.min(1, S.gaugeDisp[side] / 100), gy = y + 80;
    c.fillStyle = '#060508'; c.fillRect(x + 16, gy, w - 32, 5);
    c.fillStyle = gv >= 1 ? (Math.sin(T * 8) > 0 ? '#ffd36a' : '#c8321f') : '#c8321f'; c.fillRect(x + 16, gy, (w - 32) * gv, 5);
    if (gv >= 1) { c.font = `800 11px ${FONT_D}`; c.fillStyle = '#ffd36a'; c.fillText('覚醒可', x + w - 62, gy - 2); }
    c.restore();
  }
  function drawFieldLabel() {
    const F = FIELDS[S.field]; if (!F) return;
    const c = hctx; c.save();
    const txt = F.n + (S.fieldTurns > 0 ? ` ${S.fieldTurns}` : '');
    c.font = `800 15px ${FONT_D}`; const tw2 = c.measureText(txt).width;
    const x = W/2 - (tw2+54)/2 + 40, y = 16 + 92*Math.min(1,(W/2-24)/330) + 8;
    c.fillStyle='rgba(17,33,23,.8)';rr(c,x-40,y,tw2+54,28,14);c.fill();
    const fields=['none','sun','rain','storm','snow','bloodmoon','miasma','sanct','grove','chaos'],cell=fields.indexOf(S.field),im=Assets.fxImg['ritual-fields'];
    if(im&&cell>=0)c.drawImage(im,cell%5*im.width/5,Math.floor(cell/5)*im.height/2,im.width/5,im.height/2,x-38,y+1,26,26);
    c.textAlign = 'left'; c.font = `500 15px ${FONT_D}`; c.fillStyle = '#ece4cf'; c.fillText(txt, x, y + 19);
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
    for (let i = 0; i < 40; i++) { const yy = ((i * 53) % 300) - 150, xx = ((T * 2600 * (ct.side ? -1 : 1) + i * 197) % (W + 600) + W + 600) % (W + 600) - 300; c.fillStyle = i % 5 === 0 ? Art.rgba(ct.color, 0.6) : 'rgba(236,228,207,0.13)'; c.fillRect(xx, yy, 220, i % 5 === 0 ? 3 : 1.5); }
    // 肖像
    const px = ct.side ? lerp(W + 300, W - 250, e) : lerp(-300, 250, e);
    c.drawImage(ct.img, px - 210 + (ct.side ? 0 : 0) + k * 30 * (ct.side ? -1 : 1), -230, 420, 380);
    c.restore();
    c.lineWidth = 4; c.strokeStyle = '#c8321f';
    c.beginPath(); c.moveTo(0, -bh / 2 + sk); c.lineTo(W, -bh / 2 - sk); c.stroke();
    c.beginPath(); c.moveTo(0, bh / 2 + sk); c.lineTo(W, bh / 2 - sk); c.stroke();
    c.globalAlpha = e * (1 - outK);
    const tx = ct.side ? 60 : W - 60;
    c.textAlign = ct.side ? 'left' : 'right'; c.textBaseline = 'middle';
    c.font = `800 15px ${FONT_D}`; c.fillStyle = '#c8321f'; c.fillText('覚 醒 奥 義', tx, -42);
    c.font = `900 50px ${FONT_D}`; c.lineWidth = 8; c.strokeStyle = '#0a080c'; c.strokeText(ct.name, tx + (1 - e) * 80 * (ct.side ? 1 : -1), 12);
    c.fillStyle = '#f2ead6'; c.fillText(ct.name, tx + (1 - e) * 80 * (ct.side ? 1 : -1), 12);
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
    if(document.hidden||document.body.dataset.screen!=='scr-battle')return;
    const rdt = Math.min(0.1, app.ticker.deltaMS / 1000);
    applyTS();
    const dt = rdt * gsap.globalTimeline.timeScale();
    T += dt;
    for (const side of [0, 1]) {
      const m = S.mons[side]; if (!m) continue;
      S.hpDisp[side] += (m.hp - S.hpDisp[side]) * Math.min(1, dt * 7);
      if (Math.abs(m.hp - S.hpDisp[side]) < 0.5) S.hpDisp[side] = m.hp;
      if (S.hpLag[side] > S.hpDisp[side]) S.hpLag[side] -= m.maxhp * dt * 0.45; else S.hpLag[side] = S.hpDisp[side];
      const sd = S.sides[side]; if (sd) S.gaugeDisp[side] += (sd.gauge - S.gaugeDisp[side]) * Math.min(1, dt * 5);
    }
    if (S.fieldFlash > 0) S.fieldFlash = Math.max(0, S.fieldFlash - dt);
    ambient(dt); updParts(dt); updViews(dt);
    circles.forEach((cs, i) => { if (cs) cs.rotation += dt * 0.3 * (i ? -1 : 1); });
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
    if (window.VALGA_MOTION!=='reduced' && performance.now() < invertT) fl.push(worldCM);
    if (bloom && window.VALGA_QUALITY==='high'&&parts.length>0 && window.VALGA_MOTION!=='reduced') fl.push(bloom);
    world.filters = fl;
    // HUD
    hctx.setTransform(hud.width / W, 0, 0, hud.height / H, 0, 0);
    hctx.clearRect(0, 0, W, H);
    if (S.showPanels) { drawPanel(1); drawPanel(0); drawFieldLabel(); }
    drawPops(dt); drawCut(dt); drawBanner(dt);
    if (S.flash) { hctx.globalAlpha = window.VALGA_MOTION==='reduced'?0:Math.max(0, S.flash.a)*.55; hctx.fillStyle = S.flash.c; hctx.fillRect(0, 0, W, H); hctx.globalAlpha = 1; S.flash.a -= rdt * 3; if (S.flash.a <= 0) S.flash = null; }
  }

  function resizeLayout(){
    if(!app||!bgCanvas)return;
    const portrait=innerWidth<=700&&innerHeight>innerWidth;
    const stage=document.querySelector(".stage").getBoundingClientRect();
    W=portrait?720:960;H=Math.round(stage.height/stage.width*W);
    app.renderer.resize(W,H);
    const dpr=Math.min(quality().dpr,devicePixelRatio||1);hud.width=W*dpr;hud.height=H*dpr;
    bgCanvas.width=W*2;bgCanvas.height=H*2;bgTex.source.resize(W*2,H*2);bgTex.frame=new PIXI.Rectangle(0,0,W*2,H*2);bgTex.orig=bgTex.frame.clone();bgTex.updateUvs();bgSprite.width=W;bgSprite.height=H;world.filterArea=new PIXI.Rectangle(0,0,W,H);
    S.spr.forEach((s,side)=>{s.bx=portrait?(side?W*.73:W*.28):(side?715:250);s.by=portrait?(side?H*.45:H*.80):(side?300:452);s.sc=side?.86:1.08});
    fitCombat();circles.forEach((c,i)=>{if(c)c.parent.position.set(S.spr[i].bx,S.spr[i].by+4)});cam.x=W/2;cam.y=H/2;cam.z=1;drawBg();
  }
  // ---------- 初期化 ----------
  async function init(canvas, hudCanvas) {
    const portrait=innerWidth<=700&&innerHeight>innerWidth;const rect=document.querySelector(".stage").getBoundingClientRect();W=portrait?720:960;H=Math.round(rect.height/rect.width*W);
    S.spr.forEach((s,side)=>{s.bx=portrait?(side?W*.73:W*.28):(side?715:250);s.by=portrait?(side?H*.45:H*.80):(side?300:452)});cam.x=W/2;cam.y=H/2;
    app = new PIXI.Application();
    await app.init({ canvas, width: W, height: H, resolution: Math.min(quality().dpr, window.devicePixelRatio || 1), antialias: true, background: 0x0b0a0d, preference: 'webgl', autoDensity: false });
    canvas.style.width = '100%'; canvas.style.height = 'auto';
    hud = hudCanvas; hctx = hud.getContext('2d');
    const dpr = Math.min(quality().dpr, window.devicePixelRatio || 1); hud.width = W * dpr; hud.height = H * dpr;
    for (const n of Assets.FX_NAMES) if (Assets.fxImg[n]) tex[n] = PIXI.Texture.from(Assets.fxImg[n]);
    world = new PIXI.Container(); app.stage.addChild(world);
    world.filterArea = new PIXI.Rectangle(0, 0, W, H);
    bgCanvas = document.createElement('canvas'); bgCanvas.width = W * 2; bgCanvas.height = H * 2;
    bgTex = PIXI.Texture.from(bgCanvas); bgSprite = new PIXI.Sprite(bgTex); bgSprite.scale.set(0.5);
    world.addChild(bgSprite);
    fxBack = new PIXI.Container(); world.addChild(fxBack);
    ringLayer = new PIXI.Container(); world.addChild(ringLayer);
    ringLayer.visible=false;
    [0, 1].forEach(side => {
      const s = S.spr[side];
      const c = new PIXI.Sprite(tex.magic_01); c.anchor.set(0.5); c.blendMode = 'add'; c.alpha = 0.55; c.tint = 0xc8321f;
      const holder = new PIXI.Container(); holder.position.set(s.bx, s.by + 4); holder.scale.set(s.sc * 0.95, s.sc * 0.3);
      holder.addChild(c); ringLayer.addChild(holder); circles[side] = c;
    });
    hazardG = new PIXI.Graphics(); world.addChild(hazardG);
    monLayer = new PIXI.Container(); world.addChild(monLayer);
    darkG = new PIXI.Graphics(); darkG.rect(-200, -200, W + 400, H + 400).fill(0x000000); darkG.alpha = 0; world.addChild(darkG);
    fxFront = new PIXI.Container(); world.addChild(fxFront);
    worldCM = new PIXI.ColorMatrixFilter(); worldCM.negative(false);
    if (PIXI.filters) {
      bloom = new PIXI.filters.AdvancedBloomFilter({ threshold: 0.74, bloomScale: 0.6, brightness: 1, blur: 5, quality: window.innerWidth<700?2:4 });
      glitchRGB = new PIXI.filters.RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
      zoomBlur = new PIXI.filters.ZoomBlurFilter({ strength: 0, center: { x: W / 2, y: H / 2 }, innerRadius: 60 });
    }

    drawBg();
    let resizeTimer;addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resizeLayout,120)});
    app.ticker.maxFPS=quality().fps;app.ticker.add(frame);
    document.addEventListener('valga-screen',e=>{if(e.detail==='scr-battle'&&!document.hidden)app.ticker.start();else app.ticker.stop()});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)app.ticker.stop();else if(document.body.dataset.screen==='scr-battle')app.ticker.start()});
    fitCombat();
    S.ready = true;fitCombat();
  }
  function drawHazards() {
    hazardG.clear();
    [0, 1].forEach(side => {
      const s = S.spr[side];
      for (let i = 0; i < S.hazard[side]; i++) for (let k = 0; k < 5; k++) {
        const x = s.bx - 90 * s.sc + k * 45 * s.sc + i * 10, y = s.by + 10 + (k % 2) * 8 - i * 4;
        hazardG.poly([x - 5, y, x, y - 16, x + 5, y]).fill({ color: 0xb08cff, alpha: 0.9 });
      }
    });
  }

  // =========================================================
  //                      攻撃演出
  // =========================================================
  // 属性ごとの着弾演出
  function impact(x, y, t, pw = 1) {
    if(activeStrike?.armed){const target=center(1-activeStrike.side);if(Math.hypot(target.x-x,target.y-y)<155)resolveStrike()}
    inkImpact(x<W/2?0:1,t,Math.min(1.7,pw),{x,y});
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
    const s = S.spr[atk], d = dirOf(atk), a = center(atk), b = center(1 - atk);
    const C = hexN(TC(t).c);
    const body=S.mons[atk]?.beast.art.body,heavy=body==='golem'||S.mons[atk]?.beast.art.bulky;
    Sound.motion?.(heavy?'heavy':body==='bird'?'wing':'step',atk);
    Sound.swing();
    await tw(s, { ox: -d * (heavy?20:36), oy: heavy?5:9, sx:heavy?1.035:1.08, sy:heavy?.97:.92,wind:1, rot:-d*(heavy?.025:.07),duration:heavy?.24:.15,ease:'power2.out'});
    const reach = o.reach ?? 0.78;
    let gi = 0;
    const gt = gsap.ticker.add(() => { if (gi++ % 2 === 0) ghost(atk, C); });
    P({ t: 'smoke_03', x: s.bx + s.ox, y: s.by, vx: -d * 200, s0: 0.3, s1: 0.9, life: 0.5, add: false, tint: 0x6a6070, a0: 0.6, front: false });
    await tw(s, {ox:(b.x-a.x)*reach,oy:(b.y-a.y)*reach-(heavy?0:body==='bird'?35:14),sx:heavy?1.02:.95,sy:heavy?.98:1.04,wind:0,rot:d*(heavy?.04:.09),duration:o.fast?.09:heavy?.2:.14,ease:'power3.in'});
    gsap.ticker.remove(gt);
    // 着弾
    impactFrame(o.heavy ? 80 : 45);
    hitstop(o.heavy ? 110 : 70);
    const hx = b.x - d * 10, hy = b.y;
    slashMark(hx, hy, t, kind, d);
    impact(hx, hy, t, o.heavy ? 1.3 : 1);
    punch(lerp(a.x, b.x, 0.7), lerp(a.y, b.y, 0.7), o.heavy ? 1.18 : 1.1);
    Sound.cast(t, 0.5);
    if(activeStrike?.promise)await activeStrike.promise;
    trace('return',{side:atk});
    await tw(s,{ox:0,oy:-9,sx:1,sy:1,rot:0,wind:0,duration:heavy?.36:.25,delay:.06,ease:'power2.out'});
    await tw(s,{oy:0,sy:heavy?.98:.95,duration:.09,ease:'power2.in'});Sound.motion?.(heavy?'heavy':'step',atk);gsap.to(s,{sy:1,duration:.18,ease:'sine.out'});
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
    const a = center(atk), b = center(1 - atk), G = hexN(TC(t).g), C = hexN(TC(t).c);
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
  const d0 = side => side === 0 ? 1 : -1;

  const PAT = {
    async lunge(atk, t) { await melee(atk, t, 'punch'); },
    async dash(atk, t) {
      const b = center(1 - atk);
      for (let i = 0; i < 10; i++) P({ t: 'trace_07', x: b.x + rnd(-200, 200), y: b.y + rnd(-90, 90), vx: d0(atk) * 1600, align: 1, life: 0.25, s0: 0.6, s1: 0.6, sx: 0.15, sy: 2, tint: 0xffffff, a0: 0.6 });
      await melee(atk, t, 'cross', { reach: 0.92, fast: 1, heavy: 1 });
    },
    async claw(atk, t) { await melee(atk, t, 'claw'); },
    async bite(atk, t) { await melee(atk, t, 'bite'); },
    async punch(atk, t) { await melee(atk, t, 'punch'); if (t === 'thunder') { const b = center(1 - atk); bolt(b.x - 90, b.y - 90, b.x + 90, b.y + 90, 0xfff17a, 5, 0.3); } },
    async slash(atk, t) { await melee(atk, t, 'slash'); },
    async hammer(atk, t) {
      const s = S.spr[atk], b = center(1 - atk), f = foot(1 - atk), a = center(atk);
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
      const s = S.spr[atk], a = center(atk), b = center(1 - atk);
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
    async orb(atk, t) { await charge(atk, t, 300); Sound.cast(t, 0.6); await shoot(atk, t, { size: 0.45, dur: 0.35, pw: 1 }); shock(center(1 - atk).x, center(1 - atk).y, 18, 220, 0.5); },
    async pillar(atk, t) {
      await charge(atk, t, 350); Sound.cast(t, 1.2);
      const f = foot(1 - atk), C = hexN(TC(t).c), G = hexN(TC(t).g);
      ringFx(f.x, f.y, C, 0.3, 2.2, 0.5, { sy: 0.3, t: 'circle_01' });
      await wait(160);
      for (let i = 0; i < 3; i++) P({ t: 'muzzle_01', x: f.x + rnd(-15, 15), y: f.y + 10, ax: 0.5, ay: 1, s0: 0.6, s1: 1.6, sx: 0.9, sy: 1.8, life: 0.7, tint: i ? C : G });
      for (let i = 0; i < 40; i++) P({ t: t === 'fire' ? ['flame_01', 'flame_02', 'fire_01'] : ['smoke_07', 'light_01'], x: f.x + rnd(-50, 50), y: f.y, vy: rnd(-900, -300), vx: rnd(-40, 40), life: rnd(0.4, 0.9), s0: 0.2, s1: 0.8, rot: rnd(0, 6), vr: 3, tint: pickA([C, G]) });
      shock(f.x, f.y - 100, 30, 300, 0.6); shake(14); impactFrame(40);
      impact(center(1 - atk).x, center(1 - atk).y, t, 1.1);
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
      impact(center(1 - atk).x, center(1 - atk).y, t, 1.1);
    },
    async wave(atk, t) {
      await charge(atk, t, 250); Sound.cast(t, 0.8);
      const a = center(atk), b = center(1 - atk), C = hexN(TC(t).c), G = hexN(TC(t).g);
      await new Promise(res => { const pr = { k: 0 }; gsap.to(pr, { k: 1, duration: 0.45, ease: 'none', onUpdate: () => { for (let i = 0; i < 3; i++) { const k = pr.k - i * 0.03; if (k < 0) continue; P({ t: t === 'water' ? 'twirl_02' : 'light_01', x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) + Math.sin(k * 16 + i * 2) * 36, life: 0.45, s0: 0.25, s1: 0.05, rot: rnd(0, 6), vr: 8, tint: i ? C : G }); } }, onComplete: res }); });
      impact(b.x, b.y, t, 1);
    },
    async tsunami(atk, t) {
      Sound.cast('water', 1.5);
      const b = center(1 - atk), C = hexN(TC(t).c), G = hexN(TC(t).g), d = d0(atk);
      dark.v = 0.3;
      const x0 = d > 0 ? -200 : W + 200, x1 = d > 0 ? W + 200 : -200;
      await new Promise(res => { const pr = { k: 0 }; gsap.to(pr, { k: 1, duration: 0.9, ease: 'power1.in', onUpdate: () => { const x = lerp(x0, x1, pr.k); for (let i = 0; i < 6; i++) { const yy = rnd(180, H); P({ t: ['smoke_07', 'smoke_09'], x: x + rnd(-40, 40), y: yy, vx: d * 300, vy: -rnd(50, 200), life: 0.7, s0: 0.6, s1: 1.4, rot: rnd(0, 6), tint: pickA([C, G, 0xe0f4ff]), a0: 0.8 }); } if (Math.abs(x - b.x) < 60 && !pr.hit) { pr.hit = 1; impact(b.x, b.y, 'water', 1.4); shock(b.x, b.y, 35, 400, 0.7); shake(16); } }, onComplete: res }); });
      dark.v = 0;
    },
    async leaves(atk, t) {
      const b = center(1 - atk);
      for (let i = 0; i < 40; i++) { const an = rnd(0, 6.28), r = rnd(160, 240); P({ t: 'slash_03', x: b.x + Math.cos(an) * r, y: b.y + Math.sin(an) * r, follow: b, home: 3, life: 0.5, s0: 0.12, s1: 0.08, rot: an, vr: 14, tint: pickA([0x6fd060, 0xb6f27a]) }); }
      await melee(atk, t, 'slash');
    },
    async vines(atk, t) {
      await charge(atk, t, 250); Sound.cast('wood', 0.9);
      const f = foot(1 - atk), b = center(1 - atk), col = t === 'wood' ? 0x3fa04f : hexN(TC(t).c);
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
      const a = center(atk), b = center(1 - atk), col = t === 'wood' ? 0xd0ff80 : 0xc080ff;
      for (let i = 0; i < 70; i++) P({ t: ['circle_05', 'smoke_03'], x: a.x + rnd(-20, 20), y: a.y + rnd(-20, 20), vx: (b.x - a.x) * rnd(0.7, 1.3), vy: (b.y - a.y) * rnd(0.7, 1.3) + rnd(-80, 80), drag: 0.975, life: rnd(1, 1.6), s0: 0.05, s1: rnd(0.1, 0.25), tint: col, a0: 0.8 });
      await wait(800);
    },
    async forest(atk, t) {
      await charge(atk, t, 400, true); Sound.cast('wood', 1.4);
      const f = foot(1 - atk);
      for (let i = 0; i < 9; i++) { gsap.delayedCall(i * 0.04, () => { const x = f.x - 160 + i * 40; P({ t: 'muzzle_02', x, y: f.y + 20, ax: 0.5, ay: 1, s0: 0.3, s1: rnd(1.1, 1.6), sx: 0.6, sy: 1.6, life: 0.8, tint: pickA([0x3fa04f, 0x6fd060, 0x2a6a2a]), ease: 1 }); P({ t: 'dirt_02', x, y: f.y, vy: -300, grav: 1000, s0: 0.15, s1: 0.1, life: 0.6, tint: 0x5a4a30, add: false }); }); }
      await wait(250); shake(16); shock(f.x, f.y - 80, 35, 380, 0.7); impactFrame(50);
      impact(center(1 - atk).x, center(1 - atk).y, 'wood', 1.4);
    },
    async bolt(atk, t) {
      await charge(atk, 'thunder', 220); Sound.cast('thunder', 0.9);
      const a = center(atk), b = center(1 - atk);
      for (let i = 0; i < 3; i++) { bolt(a.x, a.y, b.x, b.y, 0xfff17a, 7 - i * 2, 0.3); await wait(60); }
      S.flash = { c: '#fffbe0', a: 0.35 }; impactFrame(40);
      impact(b.x, b.y, 'thunder', 1);
    },
    async thunderfall(atk, t) {
      const b = center(1 - atk);
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
      const a = center(atk), b = center(1 - atk), C = hexN(TC(t).c);
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
      const b = center(1 - atk);
      dark.v = 0.6; Sound.cast('ice', 1.6);
      for (let i = 0; i < 50; i++) { const an = rnd(0, 6.28), r = rnd(220, 340); P({ t: 'trace_02', x: b.x + Math.cos(an) * r, y: b.y + Math.sin(an) * r, follow: b, home: 3.5, align: 1, life: 0.6, s0: 0.4, s1: 0.2, sx: 0.5, tint: 0xe0ffff }); }
      await wait(550);
      S.flash = { c: '#e8ffff', a: 0.9 }; impactFrame(100); hitstop(120);
      for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; P({ t: 'trace_04', x: b.x, y: b.y, rot: an, s0: 0.5, s1: 1.8, sx: 0.5, sy: 1.4, life: 0.8, tint: 0xc0f8ff, ease: 1 }); }
      shock(b.x, b.y, 50, 500, 0.9); shake(18); dark.v = 0;
      impact(b.x, b.y, 'ice', 1.5);
    },
    async guillotine(atk, t) {
      const b = center(1 - atk);
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
      const b = center(1 - atk); impact(b.x, b.y, 'ice', 1.2); shake(10); dark.v = 0;
    },
    async judgment(atk, t) {
      const f = foot(1 - atk), b = center(1 - atk);
      dark.v = 0.45; Sound.cast('holy', 1.6);
      P({ t: 'magic_03', x: b.x, y: 40, s0: 0.3, s1: 1.4, life: 0.8, tint: 0xfff0b0, vr: 2 });
      await wait(250);
      for (let i = 0; i < 3; i++) { gsap.delayedCall(i * 0.1, () => { beamSprite(f.x + (i - 1) * 70, -40, f.x + (i - 1) * 70, f.y + 10, 0xffd890, 30, 0.6, 'trace_07'); ringFx(f.x + (i - 1) * 70, f.y, 0xffffff, 0.3, 1.6, 0.5, { sy: 0.3 }); }); }
      await wait(260);
      S.flash = { c: '#fffbe8', a: 0.4 }; impactFrame(50); shake(14); shock(b.x, b.y, 35, 380, 0.7);
      impact(b.x, b.y, 'holy', 1.4); dark.v = 0;
    },
    async souleat(atk, t) {
      const a = center(atk), b = center(1 - atk); Sound.cast('dark', 1);
      const g = new PIXI.Graphics(); g.blendMode = 'add'; fxFront.addChild(g);
      const pr = { k: 0 };
      await new Promise(res => gsap.to(pr, { k: 1, duration: 0.5, onUpdate: () => { g.clear(); for (let i = 0; i < 5; i++) { g.moveTo(a.x, a.y); const mx = (a.x + b.x) / 2 + Math.sin(T * 10 + i) * 70, my = (a.y + b.y) / 2 - 100 + i * 45; g.quadraticCurveTo(mx, my, lerp(a.x, b.x, pr.k), lerp(a.y, b.y, pr.k)); g.stroke({ width: 4, color: 0xa040ff, alpha: 0.9 }); } }, onComplete: res }));
      impact(b.x, b.y, 'dark', 0.8);
      for (let i = 0; i < 36; i++) P({ t: 'circle_05', x: b.x + rnd(-40, 40), y: b.y + rnd(-40, 40), follow: a, home: 2, life: 0.9, s0: 0.12, s1: 0.04, tint: 0xff4080 });
      gsap.to(g, { alpha: 0, duration: 0.3, onComplete: () => g.destroy() });
    },
    async nightmare(atk, t) {
      const b = center(1 - atk); dark.v = 0.6; Sound.cast('dark', 1.4);
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
    const b = center(1 - atk), C = hexN(TC(t).c);
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
  function combatBottom(){if(innerHeight<560&&innerWidth>innerHeight)return H-14;const rect=document.querySelector('#scr-battle .stage')?.getBoundingClientRect()||document.querySelector('.stage')?.getBoundingClientRect();const hud=document.querySelector('.hud');if(!rect||!hud||!rect.height)return H-14;let top=hud.getBoundingClientRect().top;for(const e of hud.querySelectorAll('#turnBar,#log,#cmd')){const r=e.getBoundingClientRect();if(r.height>0)top=Math.min(top,r.top)}return Math.min(H-14,((top-rect.top)/rect.height)*H-14)}
  function fitCombat(){if(!S.ready)return;const bottom=combatBottom(),portrait=innerWidth<=700&&innerHeight>innerWidth;S.spr.forEach((s,side)=>{const short=innerHeight<560&&innerWidth>innerHeight;
   if(S.duo){const team=side%2,lane=side<2?S.duo.indices[team]:1-S.duo.indices[team];const usable=short?W*(1-300/innerWidth):W;s.bx=usable*(lane?.73:.27);s.by=team?Math.max(175,Math.min(bottom*.48,bottom-125)):bottom-12;s.sc=Math.max(.43,Math.min(portrait?.88:.95,(bottom-105)/430));s.flip=team?-1:1}
   else{const top=14+92*Math.min(short?.72:1,(W/2-24)/330)+4;if(portrait&&!short){const span=bottom-top;s.bx=W*(side?.66:.34);s.by=side?top+span*.5:bottom-8;s.sc=Math.max(.5,Math.min(1.5,span*.47/268,W*.62/320))}else{s.bx=W*(side?.71:.29);s.by=side?bottom-Math.max(14,(bottom-top)*.08):bottom-8;s.sc=Math.max(.45,Math.min(side?1.02:1.14,(s.by-top)/268))}}
   if(circles[side]){circles[side].parent.position.set(s.bx,s.by+4);circles[side].parent.scale.set(s.sc*.95,s.sc*.3)}})}
  const api = {
    fitCombat,
    setQuality(mode){window.VALGA_QUALITY=['light','balanced','high'].includes(mode)?mode:'balanced';try{localStorage.setItem('valga_quality',window.VALGA_QUALITY)}catch{}if(app){app.ticker.maxFPS=quality().fps;app.renderer.resolution=Math.min(quality().dpr,devicePixelRatio||1);app.renderer.resize(W,H);if(hud){hud.width=W*app.renderer.resolution;hud.height=H*app.renderer.resolution}}},
    itemPulse(side,id){if(!S.ready)return;const im=Assets.itemImg[id];if(!im)return;trace('relic',{side,item:id});const key=side+':'+id,now=performance.now();if(relicTextures.get(key)?.at>now-700)return;let t=relicTextures.get(id);if(!t){t=PIXI.Texture.from(im);relicTextures.set(id,t)}relicTextures.set(key,{at:now});const c=center(side);P({texture:t,x:c.x+(side?-90:90),y:c.y-45,s0:.17,s1:.24,life:.75,vy:-25,add:false,a0:1,a1:0});api.pop(side,ITEMS[id].n,'#ddc18a',17)},
    duoFocus(teams,indices){S.duo={teams,indices};S.showPanels=false;for(let slot=0;slot<4;slot++){const si=slot%2,idx=slot<2?indices[si]:1-indices[si],m=teams[si][idx];if(!S.spr[slot])S.spr[slot]=mkSpr(si);const s=S.spr[slot];if(S.mons[slot]?.uid!==m.uid){S.mons[slot]=m;buildView(slot,m);Object.assign(s,{ox:0,oy:0,alpha:1,scale:1,sx:1,sy:1,rot:0,white:0})}s.visible=m.hp>0&&S.deployed.has(m.uid)}fitCombat()},
    async duet(side,type){const c=center(side),to=center(1-side),color=hexN(TC(type).g);ringFx(c.x,c.y,color,.1,1.8,.6);streaks(to.x,to.y,color,26,950);shock(to.x,to.y,24,380,.55);hitstop(85);shake(12);api.banner('交　響',TC(type).g,'二つの攻勢が、一つになる',1.1);Sound.gauge();await wait(350)},
    stance(side,kind){const s=S.spr[side];if(!s)return;gsap.to(s,{rot:kind==='rush'?(side?-.04:.04):0,duration:.15})},
    passive(side,name,type='holy'){if(!S.ready)return;const c=center(side);api.pop(side,name,TC(type).g,19);P({t:'magic_04',x:c.x,y:c.y+40,s0:.12,s1:.65,life:.45,tint:hexN(TC(type).c),a0:.45,vr:2});Sound.gauge()},
    async reaction(side,from,to,name){if(!S.ready)return;const c=center(side),color=hexN(TC(to).g);api.pop(side,name,TC(to).g,35);hitstop(65);shake(9);impact(c.x,c.y,to,1.1);ringFx(c.x,c.y,color,.1,2,.5);if(from==='water'||from==='ice')smoke(c.x,c.y,7,0xadc9d6,{add:true,a0:.35,vy:-100});streaks(c.x,c.y,color,18,700);Sound.reaction();await wait(330)},
    breakGuard(side){if(!S.ready)return;const c=center(side);api.pop(side,'破 勢','#e6bb86',31);hitstop(75);shake(11);streaks(c.x,c.y,0xe5c69b,24,850);ringFx(c.x,c.y,0xffe0b0,.2,2,.35);sequence('fracture',c.x,c.y,{size:1.8*S.spr[side].sc,life:.55});Sound.fracture()},
    diagnostics(){return {quality:window.VALGA_QUALITY,particles:parts.length,particleCap:quality().particles,fpsCap:app?.ticker.maxFPS,resolution:app?.renderer.resolution,rendererRunning:app?.ticker.started,W,H,screen:app?.screen,cam:{x:cam.x,y:cam.y,z:cam.z,shake:cam.shake},texture:bgTex?.frame,source:{width:bgTex?.source.width,height:bgTex?.source.height},models:views.filter(Boolean).map(v=>({id:v.beast.id,mesh:!!v.body.motionBuffer,vertices:v.body.motionBuffer?Array.from(v.body.motionBuffer.data.slice(0,12)):[]})),ritual:{deployed:S.deployed.size,activeSequences:parts.filter(p=>p.frames).map(p=>({frames:p.frames.length,life:p.life})),revealing:views.filter(v=>v?.revealMask).length,atlasCache:[...sequenceTextures.keys()],floorMarksVisible:ringLayer?.visible},timingTrace:timingTrace.slice()}},
    damageApplied(side,amount){trace('damage',{side,amount})},
    async finishBattle(won,subtitle=''){for(const p of parts)p.life=Math.min(p.life,.3);S.cut=null;await camReset(.25);api.banner(won?'勝　利':'敗　北',won?'#e4d3a6':'#b6b2a4',subtitle,1.25);await wait(1300)},
    W, H, S, wait, center, init,
    setField(f, turns = 0) { const ch = S.field !== f; S.field = f; S.fieldTurns = turns; S.fieldFlash = 1; if (ch && S.ready) drawBg(); },
    setSides(a, b) { S.sides = [a, b]; },
    setMon(side, m) { fitCombat(); S.mons[side] = m; if (m) { S.hpDisp[side] = m.hp; S.hpLag[side] = m.hp; buildView(side, m); } },
    clear() {
      S.duo=null;S.deployed.clear();S.showPanels=true;S.mons = [null, null]; S.spr = [mkSpr(0), mkSpr(1)]; S.pops = []; S.hazard = [0, 0]; S.cut = null; S.banner = null; S.flash = null;
      views.forEach((v, i) => { if (v) v.cont.destroy({ children: true }); views[i] = null; });
      parts.forEach(p => {p.sp.destroy();p.blendSprite?.destroy()}); parts.length = 0; shocks.length = 0; dark.v = 0;
      if (S.ready) { drawHazards(); gsap.killTweensOf(cam); Object.assign(cam, { x: W / 2, y: H / 2, z: 1, shake: 0 }); }
    },
    shake, flash(c = '#fff', a = 0.7) { S.flash = { c, a }; },
    banner(text, color = '#ece4cf', sub = '', life = 1.8) { S.banner = { text, color, sub, life, max: life }; gsap.to(S.banner, { life: 0, duration: life, ease: 'none' }); },
    pop(side, text, color = '#ece4cf', size = 30) { const c = center(side); const n = S.pops.filter(p => p.side === side && !p.num && p.life > 0.6).length; S.pops.push({ side, x: c.x + (side ? -70 : 70), y: c.y - 80 - n * 34, text, color, size, life: 1.1, max: 1.1 }); },
    dmgNum(side, n, color = '#f2ead6') { const c = center(side); S.pops.push({ x: c.x + rnd(-40, 40), y: c.y - 10, text: String(n), color, size: n >= 100 ? 44 : 36, life: 1.0, max: 1.0, num: 1, big: 1 }); },
    async summon(side) {
      const s=S.spr[side],f=foot(side),scale=s.sc;
      S.deployed.add(S.mons[side].uid);
      Object.assign(s,{visible:true,alpha:0,scale:1,ox:0,oy:16,white:0,sx:1,sy:1,gray:false});
      trace('summon-open',{side});
      gsap.to(cam,{x:W/2+(f.x-W/2)*.035,y:H/2,z:1.035,duration:.32,ease:'sine.out'});
      sequence('rift',f.x,f.y-132*scale,{size:1.95*scale,life:1.05,front:false,alpha:.95});
      sequence('veil',f.x,f.y-13*scale,{size:2.3*scale,life:1,alpha:.85});
      reveal(side,0);Sound.recall();await wait(170);Sound.summon();
      await tw(s,{reveal:1,alpha:1,oy:0,duration:.48,ease:'power2.out'});
      clearReveal(side);Sound.motion?.(['bird','eye','blob'].includes(S.mons[side].beast.art.body)?'wing':S.mons[side].beast.art.body==='golem'?'heavy':'step',side);
      await wait(240);trace('summon-complete',{side});
      gsap.to(cam,{x:W/2,y:H/2,z:1,duration:.38,ease:'sine.out'});
    },
    async recall(side) {
      const s=S.spr[side],f=foot(side);trace('recall-open',{side});
      gsap.to(cam,{x:W/2+(f.x-W/2)*.035,y:H/2,z:1.035,duration:.3,ease:'sine.out'});
      S.deployed.delete(S.mons[side].uid);
      sequence('rift',f.x,f.y-132*s.sc,{size:1.9*s.sc,life:.85,front:false,alpha:.85});
      sequence('veil',f.x,f.y-12*s.sc,{size:2.1*s.sc,life:.85,alpha:.7});
      reveal(side,1);Sound.recall();await wait(150);
      await tw(s,{reveal:0,alpha:0,oy:12,duration:.4,ease:'power2.in'});
      clearReveal(side);s.visible=false;s.white=0;s.oy=0;trace('recall-complete',{side});
    },
    async faint(side) {
      const s=S.spr[side],f=foot(side);trace('faint-open',{side});Sound.faint();hitstop(90);shake(9);s.gray=true;S.deployed.delete(S.mons[side].uid);sequence('fracture',f.x,f.y-100*s.sc,{size:1.65*s.sc,life:.65});
      await tw(s,{oy:6,rot:side?-.05:.05,duration:.16,ease:'power2.in'});
      sequence('veil',f.x,f.y-20*s.sc,{size:2.5*s.sc,life:.85,alpha:.7});
      reveal(side,1);for(let i=0;i<28;i++)P({t:'smoke_01',x:f.x+rnd(-55,55)*s.sc,y:f.y-rnd(20,180)*s.sc,vx:rnd(-90,90),vy:-rnd(35,130),life:rnd(.5,1.1),s0:.12,s1:.35,tint:0x8e9985,add:false});await tw(s,{reveal:0,oy:28,alpha:0,duration:.7,ease:'power2.in'});clearReveal(side);trace('faint-complete',{side});
      s.visible=false;s.oy=0;s.gray=false;s.sx=s.sy=1;s.rot=0;
    },
    async hit(side, eff = 1, crit = false, type = 'none') {
      const s = S.spr[side], c = center(side), d = side === 1 ? 1 : -1;
      s.hurt = 0.55; s.white = 1; gsap.to(s, { white: 0, duration: 0.25, delay: 0.05 });
      gsap.fromTo(s, { ox: d * (eff > 1 ? 46 : 26) }, { ox: 0, duration: 0.5, ease: 'power3.out' });
      Sound.hit(eff, crit, type,side);
      const heavy=crit||eff>1||activeStrike?.heavy;shake(heavy?13:4);if(heavy){hitstop(65);sequence('fracture',c.x,c.y,{size:1.3*s.sc,life:.34,alpha:.65});Sound.motion('heavy',side)}
      if (eff > 1) { shock(c.x, c.y, 28, 320, 0.6); impactFrame(50); }
      if (crit) { rgbKick(10, 0.4); zoomKick(0.15, 0.35, c.x, c.y); api.pop(side, '綻び', '#ffd36a', 28); }
      if (eff >= 4) api.pop(side, '絶大', '#e8442e', 38); else if (eff > 1) api.pop(side, '干渉増幅', '#e8642e', 32);
      else if (eff > 0 && eff < 1) api.pop(side, '干渉減衰', '#8a90a8', 22);
      await wait(260);
    },
    async heal(side) {
      const c = center(side); Sound.heal();
      sequence('restore',c.x,c.y,{size:1.55*S.spr[side].sc,life:.7,alpha:.9});
      await wait(470);
    },
    async stat(side, up) {
      const c = center(side); up ? Sound.buff() : Sound.debuff();
      const col = up ? 0xff8a40 : 0x4a80ff;
      for (let i = 0; i < 22; i++) gsap.delayedCall(i * 0.015, () => P({ t: 'trace_06', x: c.x + rnd(-70, 70), y: c.y + (up ? 100 : -80), vy: up ? rnd(-520, -280) : rnd(280, 520), align: 1, life: 0.5, s0: 0.3, s1: 0.1, sx: 0.3, tint: col }));
      await wait(420);
    },
    async status(side, st) {
      const c = center(side); Sound.status();
      const col = hexN(STATUS_C[st] || '#e0c050');
      const cell=Assets.stateCells[st],frames=framesFor('ritual-states');
      if(cell!==undefined&&frames[cell])P({texture:frames[cell],x:c.x,y:c.y-45,s0:.25,s1:.38,life:.65,a0:1,a1:0,vy:-35,add:false});
      api.pop(side, STATUS_N[st] || '混乱', STATUS_C[st] || '#e0c050', 26);
      await wait(420);
    },
    async miss(side) { Sound.miss(); api.pop(side, '回避', '#a8a2b0', 28); const s = S.spr[side]; await tw(s, { ox: side ? 60 : -60, rot: side ? 0.1 : -0.1, duration: 0.12, ease: 'power3.out' }); await tw(s, { ox: 0, rot: 0, duration: 0.3 }); },
    async shieldBlock(side) { const c = center(side); Sound.shield();sequence('ward',c.x,c.y,{size:1.8*S.spr[side].sc,life:.55});hitstop(45);shake(3);await wait(380); },
    async cutin(mon, side, name, type) {
      Sound.ultimate();
      const c = center(side);
      dark.v = 0.5; camTo(c.x, c.y, 1.3, 0.5);
      zoomKick(0.3, 1.2, c.x, c.y);
      charge(side, type, 1200, true);
      await wait(500);
      const f=foot(side);ringFx(f.x,f.y,hexN(TC(type).g),.15,1.7,1.5,{t:'valga-seal',sy:.32,a0:.8,vr:side?-.8:.8});
      const img = Assets.portrait(mon.beast, 420, 380, mon.mutant, side === 1);
      S.cut = { mon, side, name, color: TC(type).c, img, life: 1.6, max: 1.6 };
      await tw(S.cut, { life: 0, duration: 1.6, ease: 'none' });
      S.cut = null;
      camReset(0.3); dark.v = 0.25;
    },
    async fieldChange(f) {
      const F = FIELDS[f];
      S.flash = { c: F.sky[2], a: 0.5 }; S.fieldFlash = 1;
      api.banner(`異変「${F.n}」`, '#ece4cf', F.d, 2);
      Sound.weather(f);shock(W/2,H/2,25,700,.9);
      const color=hexN(F.sky[2]);
      if(f==='storm'){bolt(100,-15,180,H*.68,0xd9e1ff,7,.45,fxBack);bolt(W-100,-15,W-160,H*.6,0xc6d6ff,5,.4,fxBack);shake(10)}
      const weatherTextures={rain:'trace_02',snow:'star_05',grove:'smoke_01',sun:'fire_01',bloodmoon:'smoke_01',miasma:'smoke_01',sanct:'star_05',chaos:'trace_06'};
      for(let i=0;i<(f==='rain'?64:36);i++){const rain=f==='rain',snow=f==='snow';P({t:weatherTextures[f]||'circle_05',x:rnd(0,W),y:rain||snow?rnd(-200,50):rnd(H*.4,H),vx:rain?-130:rnd(-70,70),vy:rain?900:snow?130:-rnd(50,180),rot:rain?.16:rnd(0,6),vr:snow?2:.3,align:rain?1:0,life:rnd(.7,1.2),s0:rain?.3:.13,s1:rain?.3:.5,sx:rain?.12:1,tint:rain?0xabc4cc:snow?0xe1eced:color,a0:.65,front:false,add:f!=='bloodmoon'&&f!=='miasma'})}
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
    async spikes(targetSide) {
      const a = center(1 - targetSide), b = foot(targetSide);
      for (let i = 0; i < 12; i++) P({ t: 'trace_02', x: a.x, y: a.y, vx: (b.x - a.x) * rnd(0.8, 1.4) + rnd(-80, 80), vy: -rnd(300, 500), grav: 1100, align: 1, life: 0.9, s0: 0.3, s1: 0.3, sx: 0.4, tint: 0xc0a0ff });
      Sound.cast('steel', 0.5); await wait(750);
      S.hazard[targetSide] = S.sides[targetSide].hazard; drawHazards();
    },
    setHazard(side, n) { S.hazard[side] = n; if (S.ready) drawHazards(); },
    async attack(atk, move,options={}) {
      const previous=activeStrike;
      const strike=typeof options.onImpact==='function'?{side:atk,onImpact:options.onImpact,heavy:move.pw>=110||!!ULT[move.fx],armed:!ULT[move.fx],fired:false,promise:null}:null;
      activeStrike=strike;trace('start',{side:atk,move:move.id});
      try{
      const fx = move.fx || (move.c === 'p' ? 'lunge' : 'orb');
      const t = move.t;
      Sound.beginMove?.(atk,move);
      ValgaUI.announce(move.n,t);
      // Graphic signature: school, strength and category have different silhouettes.
      const a=center(atk),target=center(1-atk),col=hexN(TC(t).c);
      if(move.c==='m'&&move.pw>=80){ringFx(a.x,a.y+50,col,.2,1.4,.55,{sy:.35,vr:atk?-2:2,t:'magic_04'});}
      if(move.c==='p'&&move.pw>=100){streaks(a.x,a.y,col,9,600,.45);}
      if (ULT[fx]) {
        dark.v = 0.25;
        for (const p of ULT[fx]) { if (p === 'meteor') await meteorStorm(atk, t); else await (PAT[p] || PAT.orb)(atk, t); }
        const b = center(1 - atk);
        S.flash = { c: TC(t).c, a: 0.6 }; impactFrame(100); hitstop(140); shake(26); rgbKick(14, 0.6); shock(b.x, b.y, 60, 700, 1.1);
        if(strike)strike.armed=true;
        impact(b.x, b.y, t, 1.8);
        resolveStrike();if(strike?.promise)await strike.promise;
        dark.v = 0;
        return;
      }
      await (PAT[fx] || PAT.orb)(atk, t);
      resolveStrike();if(strike?.promise)await strike.promise;
      }finally{trace('end',{side:atk,move:move.id});activeStrike=previous}
    },
    async selfHit(side) { const c = center(side); Sound.hit(1); impact(c.x, c.y, 'none', 0.7); S.spr[side].hurt = 0.5; shake(6); await wait(300); },
  };
  return api;
})();






