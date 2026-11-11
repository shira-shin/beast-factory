// ===== サウンドエンジン（全てWebAudioでリアルタイム合成） =====
'use strict';

const Sound = (() => {
  let ctx = null, master, sfxBus, bgmBus, reverb, revSend, noiseBuf;
  let muted = false, bgmVol = 0.32, sfxVol = 0.7;
  let bgmTimer = null, bgmTrack = null, bgmStep = 0, nextTime = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
    bgmBus = ctx.createGain(); bgmBus.gain.value = bgmVol; bgmBus.connect(master);
    // 簡易リバーブ
    reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    reverb.buffer = ir;
    revSend = ctx.createGain(); revSend.gain.value = 0.35;
    revSend.connect(reverb); reverb.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  const now = () => ctx.currentTime;
  function env(g, t, a, peak, dcy, sus = 0.0001) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dcy);
  }
  function out(node, rev = 0.3, bus) {
    node.connect(bus || sfxBus);
    if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; node.connect(s); s.connect(revSend); }
  }
  function tone({ type = 'sine', f = 440, f2 = null, t = 0, dur = 0.3, a = 0.005, vol = 0.3, rev = 0.3, bus = null, detune = 0, filt = null, q = 1 }) {
    if (!ctx) return;
    const st = now() + t;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, st); o.detune.value = detune;
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), st + dur);
    const g = ctx.createGain(); env(g, st, a, vol, dur);
    let n = o;
    if (filt) { const fl = ctx.createBiquadFilter(); fl.type = filt.type || 'lowpass'; fl.frequency.value = filt.f; fl.Q.value = q; o.connect(fl); n = fl; }
    n.connect(g); out(g, rev, bus);
    o.start(st); o.stop(st + a + dur + 0.05);
  }
  function noise({ t = 0, dur = 0.3, a = 0.005, vol = 0.3, type = 'lowpass', f = 2000, f2 = null, q = 1, rev = 0.3, bus = null }) {
    if (!ctx) return;
    const st = now() + t;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, st); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(f2, 20), st + dur);
    const g = ctx.createGain(); env(g, st, a, vol, dur);
    s.connect(fl); fl.connect(g); out(g, rev, bus);
    s.start(st, Math.random()); s.stop(st + a + dur + 0.05);
  }

  // 属性別の詠唱音・着弾音
  const SFX = {
    fire(p = 1) {
      noise({ dur: 0.6 * p, type: 'lowpass', f: 400, f2: 3000, vol: 0.5, q: 2 });
      noise({ t: 0.1, dur: 0.5 * p, type: 'bandpass', f: 1200, f2: 300, vol: 0.35 });
      tone({ type: 'sawtooth', f: 90, f2: 40, dur: 0.5 * p, vol: 0.25, filt: { f: 400 } });
    },
    water(p = 1) {
      for (let i = 0; i < 6; i++) tone({ type: 'sine', f: 300 + Math.random() * 600, f2: 900 + Math.random() * 800, t: i * 0.05, dur: 0.12, vol: 0.12 });
      noise({ dur: 0.7 * p, type: 'bandpass', f: 800, f2: 400, q: 0.8, vol: 0.4 });
    },
    wood(p = 1) {
      [392, 523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f, t: i * 0.04, dur: 0.25, vol: 0.15 }));
      noise({ dur: 0.35 * p, type: 'highpass', f: 3000, vol: 0.18 });
      tone({ type: 'square', f: 120, f2: 60, t: 0.1, dur: 0.2, vol: 0.12, filt: { f: 600 } });
    },
    thunder(p = 1) {
      for (let i = 0; i < 5; i++) noise({ t: i * 0.035, dur: 0.06, type: 'highpass', f: 2500, vol: 0.5, rev: 0.2 });
      tone({ type: 'sawtooth', f: 1800, f2: 60, dur: 0.35 * p, vol: 0.22 });
      noise({ t: 0.12, dur: 1.0 * p, type: 'lowpass', f: 300, f2: 60, vol: 0.6, rev: 0.5 });
    },
    ice(p = 1) {
      for (let i = 0; i < 8; i++) tone({ type: 'sine', f: 1800 + Math.random() * 2400, t: i * 0.04 + Math.random() * 0.03, dur: 0.3, vol: 0.09, rev: 0.6 });
      noise({ dur: 0.4 * p, type: 'highpass', f: 5000, vol: 0.2 });
    },
    steel(p = 1) {
      [1, 2.76, 5.4, 8.93].forEach((r, i) => tone({ type: 'square', f: 280 * r, dur: 0.4 * p, vol: 0.07 / (i + 1), rev: 0.5 }));
      noise({ dur: 0.08, type: 'highpass', f: 4000, vol: 0.4 });
      tone({ type: 'triangle', f: 160, f2: 80, dur: 0.25, vol: 0.3 });
    },
    dark(p = 1) {
      tone({ type: 'sawtooth', f: 220, f2: 55, dur: 0.8 * p, vol: 0.2, filt: { f: 800 }, detune: -15 });
      tone({ type: 'sawtooth', f: 233, f2: 58, dur: 0.8 * p, vol: 0.2, filt: { f: 800 }, detune: 15 });
      noise({ dur: 0.7 * p, type: 'bandpass', f: 200, f2: 90, q: 5, vol: 0.4 });
    },
    holy(p = 1) {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone({ type: 'sine', f, t: i * 0.03, a: 0.05, dur: 0.9 * p, vol: 0.1, rev: 0.8 }));
      noise({ dur: 0.6, a: 0.1, type: 'highpass', f: 6000, vol: 0.12, rev: 0.8 });
    },
    none(p = 1) {
      tone({ type: 'sine', f: 140, f2: 50, dur: 0.25, vol: 0.5 });
      noise({ dur: 0.15, type: 'lowpass', f: 1500, vol: 0.35 });
    },
  };

  const api = {
    init,
    get muted() { return muted; },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.9; return muted; },
    cast(type, power = 1) { if (!ctx) return; (SFX[type] || SFX.none)(power); },
    hit(eff = 1, crit = false) {
      if (!ctx) return;
      tone({ type: 'sine', f: 180, f2: 40, dur: 0.22, vol: 0.6, rev: 0.1 });
      noise({ dur: 0.12, type: 'lowpass', f: 3000, f2: 400, vol: 0.5, rev: 0.1 });
      if (eff > 1) { tone({ type: 'square', f: 880, f2: 1760, t: 0.02, dur: 0.12, vol: 0.12 }); noise({ t: 0.03, dur: 0.25, type: 'bandpass', f: 2500, vol: 0.3 }); }
      if (eff < 1 && eff > 0) tone({ type: 'triangle', f: 300, f2: 150, dur: 0.15, vol: 0.2 });
      if (crit) { tone({ type: 'sawtooth', f: 1200, f2: 2400, dur: 0.18, vol: 0.18 }); tone({ type: 'sawtooth', f: 1205, f2: 2410, t: 0.06, dur: 0.18, vol: 0.12 }); }
    },
    swing() { if (!ctx) return; noise({ dur: 0.18, type: 'bandpass', f: 600, f2: 3500, q: 2, vol: 0.35, rev: 0.1 }); },
    miss() { if (!ctx) return; noise({ dur: 0.3, type: 'bandpass', f: 3000, f2: 500, q: 3, vol: 0.25 }); },
    buff() { if (!ctx) return; [0, 4, 7, 12].forEach((s, i) => tone({ type: 'triangle', f: 440 * Math.pow(2, s / 12), t: i * 0.06, dur: 0.18, vol: 0.15 })); },
    debuff() { if (!ctx) return; [12, 7, 4, 0].forEach((s, i) => tone({ type: 'triangle', f: 330 * Math.pow(2, s / 12), t: i * 0.06, dur: 0.18, vol: 0.15 })); },
    heal() { if (!ctx) return; [0, 4, 7, 11, 14, 19].forEach((s, i) => tone({ type: 'sine', f: 523 * Math.pow(2, s / 12), t: i * 0.07, a: 0.02, dur: 0.4, vol: 0.12, rev: 0.7 })); },
    status() { if (!ctx) return; tone({ type: 'square', f: 200, f2: 120, dur: 0.15, vol: 0.12 }); tone({ type: 'square', f: 180, f2: 100, t: 0.15, dur: 0.25, vol: 0.12 }); },
    faint() { if (!ctx) return; tone({ type: 'sawtooth', f: 400, f2: 40, dur: 1.2, vol: 0.25, filt: { f: 1200 } }); noise({ t: 0.2, dur: 1, type: 'lowpass', f: 600, f2: 80, vol: 0.3 }); },
    summon() { if (!ctx) return; tone({ type: 'sawtooth', f: 110, f2: 880, dur: 0.5, vol: 0.12, filt: { f: 2000 } }); noise({ dur: 0.5, type: 'bandpass', f: 400, f2: 4000, vol: 0.25 }); tone({ type: 'sine', f: 60, f2: 30, t: 0.45, dur: 0.4, vol: 0.5 }); },
    recall() { if (!ctx) return; tone({ type: 'sine', f: 880, f2: 220, dur: 0.35, vol: 0.15 }); },
    click() { if (!ctx) return; tone({ type: 'square', f: 1200, f2: 900, dur: 0.04, vol: 0.06, rev: 0 }); },
    select() { if (!ctx) return; tone({ type: 'triangle', f: 660, dur: 0.06, vol: 0.12, rev: 0 }); tone({ type: 'triangle', f: 990, t: 0.05, dur: 0.08, vol: 0.12, rev: 0 }); },
    shield() { if (!ctx) return; [0, 7, 12].forEach((s, i) => tone({ type: 'sine', f: 600 * Math.pow(2, s / 12), t: i * 0.02, a: 0.03, dur: 0.6, vol: 0.12, rev: 0.6 })); },
    explode() { if (!ctx) return; noise({ dur: 1.4, type: 'lowpass', f: 2000, f2: 60, vol: 0.9, rev: 0.6 }); tone({ type: 'sine', f: 90, f2: 25, dur: 1.0, vol: 0.7 }); },
    chaos() { if (!ctx) return; for (let i = 0; i < 10; i++) tone({ type: ['sine', 'square', 'sawtooth', 'triangle'][i % 4], f: 200 + Math.random() * 1600, t: i * 0.05, dur: 0.1, vol: 0.08 }); },
    ultimate() {
      if (!ctx) return;
      tone({ type: 'sawtooth', f: 55, f2: 880, dur: 1.2, vol: 0.18, filt: { f: 3000 } });
      tone({ type: 'sawtooth', f: 82, f2: 1320, dur: 1.2, vol: 0.12, filt: { f: 3000 } });
      noise({ dur: 1.2, a: 0.6, type: 'bandpass', f: 300, f2: 6000, vol: 0.3, rev: 0.6 });
    },
    gauge() { if (!ctx) return; tone({ type: 'sine', f: 1320, dur: 0.1, vol: 0.1 }); tone({ type: 'sine', f: 1760, t: 0.08, dur: 0.2, vol: 0.1 }); },
    alarm() { if (!ctx) return; for (let i = 0; i < 3; i++) tone({ type: 'square', f: 880, t: i * 0.18, dur: 0.1, vol: 0.08, rev: 0 }); },
    fanfare() {
      if (!ctx) return;
      const seq = [[0, 0], [4, .15], [7, .3], [12, .45], [7, .7], [12, .85]];
      seq.forEach(([s, t]) => { tone({ type: 'square', f: 392 * Math.pow(2, s / 12), t, dur: 0.25, vol: 0.1, filt: { f: 3000 } }); tone({ type: 'triangle', f: 196 * Math.pow(2, s / 12), t, dur: 0.3, vol: 0.15 }); });
      [0, 4, 7, 12].forEach(s => tone({ type: 'sawtooth', f: 392 * Math.pow(2, s / 12), t: 1.05, a: 0.02, dur: 1.2, vol: 0.06, filt: { f: 2500 } }));
    },
    lose() { if (!ctx) return; [7, 6, 5, 4, 3, 0].forEach((s, i) => tone({ type: 'triangle', f: 220 * Math.pow(2, s / 12), t: i * 0.22, dur: 0.4, vol: 0.18 })); },
  };

  // ---- BGM シーケンサ（ピアノ実音サンプル＋和太鼓＋弦のドローン） ----
  const PF = { 33: 'pf_A1', 36: 'pf_C2', 39: 'pf_Ds2', 42: 'pf_Fs2', 45: 'pf_A2', 48: 'pf_C3', 51: 'pf_Ds3', 54: 'pf_Fs3', 57: 'pf_A3', 60: 'pf_C4', 63: 'pf_Ds4', 66: 'pf_Fs4', 69: 'pf_A4', 72: 'pf_C5', 75: 'pf_Ds5', 78: 'pf_Fs5', 81: 'pf_A5' };
  const PFK = Object.keys(PF).map(Number);
  function piano(midi, t, vol = 0.3, bus = null, len = 2.2) {
    if (!ctx) return;
    let base = PFK[0]; for (const k of PFK) if (Math.abs(k - midi) < Math.abs(base - midi)) base = k;
    const b = buf[PF[base]];
    if (!b) { tone({ type: 'triangle', f: 440 * Math.pow(2, (midi - 69) / 12), t, dur: 0.8, vol: vol * 0.3, bus }); return; }
    const st = now() + t;
    const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = Math.pow(2, (midi - base) / 12);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, st); g.gain.setTargetAtTime(0.0001, st + len * 0.6, len * 0.25);
    src.connect(g); out(g, 0.35, bus || bgmBus); src.start(st); src.stop(st + len + 0.5);
  }
  api.piano = piano;
  const TRACKS = {
    // root: MIDI, prog: 小節ごとの和音（根音からの半音, minor=短調）
    title:  { bpm: 64, root: 50, prog: [0, -4, -7, -5], minor: 1, style: 'title' },
    shop:   { bpm: 80, root: 52, prog: [0, -3, 5, -5], minor: 0, style: 'shop' },
    battle: { bpm: 128, root: 45, prog: [0, 0, -4, -2, 0, 0, -5, -1], minor: 1, style: 'battle' },
    boss:   { bpm: 146, root: 43, prog: [0, 1, 0, -1, 0, 1, 3, 6], minor: 1, style: 'boss' },
  };
  function chordTones(root, minor) { return [0, minor ? 3 : 4, 7, 12, minor ? 15 : 16, 19].map(x => root + x); }
  function scheduleStep(tr, step, t) {
    const six = 60 / tr.bpm / 4;
    const bar = Math.floor(step / 16) % tr.prog.length, s16 = step % 16;
    const root = tr.root + tr.prog[bar];
    const ch = chordTones(root, tr.minor);
    const rel = t - now();
    if (tr.style === 'title') {
      // まばらなアルペジオ＋低い持続音
      if (s16 === 0) { piano(root - 12, rel, 0.32, null, 5); if (bar % 2 === 0) S('strings', { t: rel, vol: 0.16, rev: 0.7, bus: bgmBus, j: 0, dur: six * 60 }); }
      if ([0, 3, 6, 10, 13].includes(s16) && Math.random() < 0.85) piano(ch[[2, 3, 4, 3, 5][[0, 3, 6, 10, 13].indexOf(s16)]] + 12, rel, 0.16 + Math.random() * 0.06, null, 3);
      if (s16 === 8 && bar % 4 === 3) piano(ch[5] + 12, rel, 0.12, null, 4);
      return;
    }
    if (tr.style === 'shop') {
      if (s16 % 4 === 0) piano(ch[[0, 2, 3, 2][s16 / 4]] + 12, rel, 0.17, null, 2.5);
      if (s16 === 0) piano(root - 12, rel, 0.25, null, 4);
      if (s16 === 10 && Math.random() < 0.6) piano(ch[4] + 12, rel, 0.11, null, 2);
      return;
    }
    // 戦闘：低音ピアノのオスティナート＋和太鼓＋和音の打撃
    const boss = tr.style === 'boss';
    const ost = boss ? [0, 12, 1, 12, 0, 12, 7, 6] : [0, 7, 12, 7, 0, 7, 10, 7];
    if (s16 % 2 === 0) piano(root - 12 + ost[(s16 / 2) % 8], rel, s16 % 4 === 0 ? 0.26 : 0.17, null, 0.6);
    if (s16 === 0) { [ch[0], ch[1], ch[2]].forEach(n => piano(n + 12, rel, 0.12, null, 1.6)); }
    if (s16 === 0 && bar % 4 === 0) S(boss ? 'organ' : 'strings', { t: rel, vol: boss ? 0.15 : 0.12, rev: 0.6, bus: bgmBus, j: 0, dur: six * 64 });
    const kick = boss ? [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0] : [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0];
    if (kick[s16]) S('impact_deep_hard', { t: rel, vol: boss ? 0.42 : 0.36, rate: 0.6, lp: 900, rev: 0.25, bus: bgmBus, j: 0.03 });
    if (s16 === 12) S('impact_heavy_hard', { t: rel, vol: 0.2, rate: 0.85, lp: 1800, rev: 0.35, bus: bgmBus, j: 0.03 });
    if (s16 === 14 && bar % 2 === 1) S('impact_medium_hard', { t: rel, vol: 0.18, rate: 0.9, rev: 0.3, bus: bgmBus, j: 0.03 });
    if (s16 % 4 === 2) noise({ t: rel, dur: 0.035, type: 'highpass', f: 8000, vol: 0.025, rev: 0.1, bus: bgmBus });
    if (s16 === 0) tone({ type: 'sine', f: 440 * Math.pow(2, (root - 24 - 69) / 12), t: rel, a: 0.05, dur: six * 14, vol: 0.12, rev: 0, bus: bgmBus });
  }

  api.bgm = function (name) {
    if (!ctx) return;
    if (name === 'title' || name === 'shop') api.ambience && api.ambience('RoomToneMachineRoom_loop', 0.1);
    if (bgmTrack === name) return;
    api.stopBgm();
    bgmTrack = name;
    const tr = TRACKS[name]; if (!tr) return;
    bgmStep = 0; nextTime = now() + 0.1;
    bgmTimer = setInterval(() => {
      const sixteenth = 60 / tr.bpm / 4;
      while (nextTime < now() + 0.25) { scheduleStep(tr, bgmStep, nextTime); nextTime += sixteenth; bgmStep++; }
    }, 50);
  };
  api.stopBgm = function () { if (bgmTimer) clearInterval(bgmTimer); bgmTimer = null; bgmTrack = null; };

  // =====================================================================
  //  録音素材レイヤー（Meta Oculus Audio Pack CC BY 4.0 / Kenney CC0 / sfx-kit CC0）
  //  合成音と重ねて「アタック＋ボディ＋余韻＋装飾」の4層で鳴らす。毎回ピッチと音量を揺らす。
  // =====================================================================
  const raw = {}, buf = {}, lastPick = {};
  let ambSrc = null, ambGain = null, ambName = null;
  function b64ToArr(d) { const s = atob(d.split(',')[1]); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a.buffer; }
  api.preload = async function (names) {
    await Promise.all(names.map(async n => {
      try {
        if (window.SFX_DATA && window.SFX_DATA[n]) raw[n] = b64ToArr(window.SFX_DATA[n]);
        else { const r = await fetch(`assets/sfx/${n}.mp3`); if (r.ok) raw[n] = await r.arrayBuffer(); }
      } catch (e) { /* 読めない素材は合成音だけで鳴らす */ }
    }));
    if (ctx) decodeAll();
  };
  async function decodeAll() {
    for (const n in raw) { if (buf[n]) continue; try { buf[n] = await ctx.decodeAudioData(raw[n].slice(0)); } catch (e) { } }
  }
  const baseInit = init;
  api.init = function () { const first = !ctx; baseInit(); if (first && ctx) decodeAll(); };

  // グループ名 → 素材（順繰りに選び、同じものを続けて鳴らさない）
  const G = {
    punch: ['PunchHarder1', 'PunchHarder2', 'PunchHarder3', 'Kick1', 'Kick2'], punchBig: ['PunchHardest1', 'impact_heavy_hard'],
    swoosh: ['Swoosh1', 'Swoosh2', 'Swoosh3', 'Swoosh4', 'WhooshMedium1', 'WhooshMedium2'], whooshS: ['WhooshSmall1', 'cloth1'],
    sword: ['Sword1', 'Sword2', 'knifeSlice', 'knifeSlice2'], clash: ['SwordClash1', 'HammerAnvil1', 'MetalHitSurface1', 'MetalHitSurface2', 'metalPot1'],
    scrape: ['SwordScrape1', 'drawKnife1', 'drawKnife2'], magic: ['MagicSpell1', 'MagicSpell2'],
    glass: ['WindowPaneSmallBreak1', 'GlassBottleBreak1'], wood: ['LargeWoodDrop1', 'chop'], leaf: ['MovementThroughBushes1'],
    bone: ['BonesBreaking1', 'SkullCracking1'], squish: ['BloodSquishSlimy1', 'BloodSquishSlimy2'], creepyHit: ['ImpactCreepyReverb1', 'ImpactCreepyReverb2'],
    boom: ['boom_hit_strong', 'impact_deep_hard'], boomDrop: ['boom_drop_strong'], sub: ['bass_sub_drop_medium', 'bass_rumble_medium'],
    impact: ['impact_heavy_hard', 'impact_medium_hard', 'impact_deep_hard'], impactL: ['impact_light_firm', 'impact_medium_hard'],
    riser: ['riser_2s_strong'], riserS: ['riser_1s_strong'], faller: ['faller_1s_strong', 'faller_2s_soft'],
    glitch: ['digital_glitch_clear', 'digital_corrupt'], static: ['digital_static', 'ElectricBoxOpen1'], powerUp: ['digital_power_up'], powerDown: ['digital_power_down'],
    buff: ['Powerup1', 'Powerup2', 'BelltreeUp1'], debuff: ['BelltreeDown1', 'ChainsCreepy1'], chains: ['ChainsCreepy1'],
    whisper: ['WhispersCreepyReverb1'], groan: ['GroanCreepy1'], laugh: ['EvilLaugh1'], scream: ['FemaleScream1'],
    paper: ['PaperTear1', 'PaperCrumple1', 'foley_paper_slide'], card: ['foley_card_slide', 'bookFlip1'], coins: ['handleCoins'],
    mech: ['mechanical_lock_heavy', 'mechanical_shutter_heavy', 'mechanical_ratchet_heavy', 'Hydraulic1', 'Servo1', 'metalLatch'],
    victory: ['VictoryOrchestral1', 'VictoryOrchestral2'], loss: ['LossOrchestral1'], levelup: ['LevelUpOrchestral1'],
    uiOk: ['MetalConfirm1'], uiOpen: ['MetalOpen1', 'MagicalOpen1'], uiBack: ['MetalBack1'], uiErr: ['MagicalError1'], uiMagic: ['MagicalConfirm1'],
    organ: ['PipeOrganCreepy1'], strings: ['StringsCreepy1'], drone: ['DroneCreepy1'],
    vGiantHurt: ['GiantHurt1', 'GiantHurt2'], vGiantDie: ['GiantDeath1', 'GiantDeath2'], vGiantRoar: ['GiantEffort1'],
    vOgreHurt: ['OgreHurt1', 'OgreHurt2'], vOgreDie: ['OgreDeath1', 'OgreDeath2'], vOgreRoar: ['OgreEffort1'],
    vTrollHurt: ['TrollHurt1', 'TrollHurt2'], vTrollDie: ['TrollDeath1'], vTrollRoar: ['TrollEffort1'],
    vCreepHurt: ['CreatureCreepy1', 'CreatureCreepy2'], vCreepDie: ['CreatureCreepyReverb1', 'CreatureCreepyReverb2'], vCreepRoar: ['CreatureCreepyReverb1', 'CreatureCreepy2'],
  };
  api.SFX_NAMES = [...new Set(Object.values(G).flat().concat(['pf_A1', 'pf_C2', 'pf_Ds2', 'pf_Fs2', 'pf_A2', 'pf_C3', 'pf_Ds3', 'pf_Fs3', 'pf_A3', 'pf_C4', 'pf_Ds4', 'pf_Fs4', 'pf_A4', 'pf_C5', 'pf_Ds5', 'pf_Fs5', 'pf_A5', 'RoomToneMachineRoom_loop', 'ForestRain_loop', 'WindTreesBirdsFlies_loop', 'Night_loop', 'WaterBubbles_loop']))];
  function pickName(g) {
    const arr = G[g] || [g]; const ok = arr.filter(n => buf[n]); if (!ok.length) return null;
    let n = ok[Math.floor(Math.random() * ok.length)];
    if (ok.length > 1 && n === lastPick[g]) n = ok[(ok.indexOf(n) + 1) % ok.length];
    lastPick[g] = n; return n;
  }
  // 素材を鳴らす。rate=再生速度（ピッチ）, j=ゆらぎ, lp=ローパス, rev=残響, off=開始位置, dur=長さ
  function S(g, o = {}) {
    if (!ctx || muted) return false;
    const n = pickName(g); if (!n) return false;
    const st = now() + (o.t || 0);
    const src = ctx.createBufferSource(); src.buffer = buf[n];
    const j = o.j ?? 0.06; src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * j);
    const gn = ctx.createGain(); const vol = (o.vol ?? 0.8) * (1 - Math.random() * 0.15);
    gn.gain.setValueAtTime(vol, st);
    if (o.dur) { gn.gain.setValueAtTime(vol, st + o.dur * 0.7); gn.gain.linearRampToValueAtTime(0.0001, st + o.dur); }
    let node = src;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    if (o.hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; node.connect(f); node = f; }
    if (o.pan !== undefined && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; node.connect(p); node = p; }
    node.connect(gn); out(gn, o.rev ?? 0.25, o.bus);
    src.start(st, o.off || 0, o.dur ? o.dur + 0.05 : undefined);
    return true;
  }
  api.S = S;

  // ---- 属性ごとの詠唱（放つ瞬間） ----
  const CAST = {
    fire(p) { S('swoosh', { rate: 0.7, vol: 0.7, lp: 2500 }); noise({ dur: 0.7 * p, a: 0.08, type: 'lowpass', f: 300, f2: 2600, vol: 0.45, q: 1.5 }); for (let i = 0; i < 8; i++) noise({ t: 0.05 + Math.random() * 0.5, dur: 0.02, type: 'highpass', f: 3500, vol: 0.25, rev: 0.1 }); },
    water(p) { S('WaterBubbles_loop', { vol: 0.5, dur: 0.7, off: Math.random() * 8, j: 0.1 }); S('swoosh', { rate: 0.85, vol: 0.5, lp: 1800 }); for (let i = 0; i < 6; i++) tone({ type: 'sine', f: 400 + Math.random() * 500, f2: 1200 + Math.random() * 600, t: i * 0.05, dur: 0.08, vol: 0.08 }); },
    wood(p) { S('leaf', { vol: 0.8, dur: 0.8 }); [0, 2.76, 5.4].forEach((r, i) => tone({ type: 'triangle', f: 196 * r, dur: 0.35 / (i + 1), vol: 0.14 / (i + 1) })); tone({ type: 'triangle', f: 294, t: 0.08, dur: 0.3, vol: 0.1 }); },
    thunder(p) { S('static', { vol: 0.6, dur: 0.45, rate: 1.2 }); tone({ type: 'sawtooth', f: 60, f2: 2400, dur: 0.35, vol: 0.12, filt: { f: 3000 } }); for (let i = 0; i < 6; i++) noise({ t: i * 0.04, dur: 0.025, type: 'highpass', f: 3000, vol: 0.35, rev: 0.1 }); },
    ice(p) { [2093, 2637, 3136, 4186].forEach((f, i) => tone({ type: 'sine', f: f * (1 + Math.random() * 0.02), t: i * 0.05, dur: 0.6, vol: 0.06, rev: 0.7 })); noise({ dur: 0.5, a: 0.15, type: 'highpass', f: 6000, vol: 0.18, rev: 0.6 }); S('whooshS', { rate: 1.3, vol: 0.4, hp: 1500 }); },
    steel(p) { S('scrape', { vol: 0.7 }); [1, 2.76, 5.4].forEach((r, i) => tone({ type: 'sine', f: 520 * r, t: 0.05, dur: 0.6 / (i + 1), vol: 0.07 / (i + 1), rev: 0.5 })); S('mech', { vol: 0.35, t: 0.05 }); },
    dark(p) { S('whisper', { vol: 0.7, dur: 1.1, rate: 0.9 }); tone({ type: 'sawtooth', f: 110, f2: 40, dur: 0.9, vol: 0.14, filt: { f: 700 }, detune: -12 }); tone({ type: 'sawtooth', f: 116, f2: 42, dur: 0.9, vol: 0.14, filt: { f: 700 }, detune: 12 }); },
    holy(p) { [261.6, 329.6, 392, 523.3, 659.3].forEach((f, i) => tone({ type: 'triangle', f, t: i * 0.04, a: 0.15, dur: 1.0, vol: 0.06, rev: 0.9 })); S('magic', { vol: 0.5, rate: 1.15 }); noise({ dur: 0.9, a: 0.3, type: 'highpass', f: 7000, vol: 0.12, rev: 0.9 }); },
    none(p) { S('swoosh', { vol: 0.7 }); },
  };
  // ---- 属性ごとの着弾 ----
  const HIT = {
    fire() { S('impact', { vol: 0.75 }); noise({ dur: 0.6, type: 'bandpass', f: 900, f2: 180, q: 0.8, vol: 0.5, rev: 0.4 }); for (let i = 0; i < 10; i++) noise({ t: 0.05 + Math.random() * 0.6, dur: 0.015, type: 'highpass', f: 4000, vol: 0.22, rev: 0.05 }); },
    water() { S('impactL', { vol: 0.6 }); S('WaterBubbles_loop', { vol: 0.55, dur: 0.6, off: Math.random() * 8 }); noise({ dur: 0.5, type: 'lowpass', f: 2500, f2: 400, vol: 0.4 }); },
    wood() { S('wood', { vol: 0.8 }); S('leaf', { vol: 0.5, dur: 0.6, t: 0.03 }); },
    thunder() { noise({ dur: 0.06, type: 'highpass', f: 1500, vol: 0.8, rev: 0.2 }); S('boom', { vol: 0.8, t: 0.02 }); S('sub', { vol: 0.5, t: 0.05, dur: 1.2 }); for (let i = 0; i < 5; i++) noise({ t: 0.05 + i * 0.05, dur: 0.03, type: 'highpass', f: 2500, vol: 0.3 }); },
    ice() { S('glass', { vol: 0.75 }); S('impactL', { vol: 0.5 }); [3136, 3951, 4699].forEach((f, i) => tone({ type: 'sine', f, t: 0.02 + i * 0.03, dur: 0.5, vol: 0.05, rev: 0.7 })); },
    steel() { S('clash', { vol: 0.85 }); S('impactL', { vol: 0.45 }); [1, 3.5, 5.6].forEach((r, i) => tone({ type: 'sine', f: 330 * r, dur: 0.9 / (i + 1), vol: 0.06, rev: 0.5 })); },
    dark() { S('creepyHit', { vol: 0.8 }); S('sub', { vol: 0.45, dur: 1.0 }); },
    holy() { S('impactL', { vol: 0.6 }); [523.3, 784, 1046.5, 1568].forEach((f, i) => tone({ type: 'sine', f, t: i * 0.02, dur: 0.9, vol: 0.06, rev: 0.9 })); noise({ dur: 0.5, type: 'highpass', f: 6000, vol: 0.15, rev: 0.8 }); },
    none() { S('punch', { vol: 0.85 }); },
  };
  api.cast = function (type, power = 1) { if (!ctx) return; (CAST[type] || CAST.none)(power); };
  api.impact = function (type, big = false) { if (!ctx) return; (HIT[type] || HIT.none)(); if (big) S('boom', { vol: 0.6, t: 0.01 }); };
  const baseHit = api.hit;
  api.hit = function (eff = 1, crit = false, type = 'none') {
    if (!ctx) return;
    S(eff > 1 || crit ? 'punchBig' : 'punch', { vol: 0.7, rate: eff < 1 ? 1.2 : 0.95 });
    if (eff > 1) { S('boom', { vol: 0.55, t: 0.01 }); tone({ type: 'square', f: 880, f2: 1760, t: 0.02, dur: 0.1, vol: 0.06 }); }
    if (eff >= 4) S('bone', { vol: 0.6, t: 0.03 });
    if (eff > 0 && eff < 1) tone({ type: 'triangle', f: 300, f2: 150, dur: 0.15, vol: 0.12 });
    if (crit) { S('clash', { vol: 0.5, rate: 1.4 }); tone({ type: 'sawtooth', f: 1200, f2: 2400, dur: 0.15, vol: 0.08 }); }
  };
  api.swing = function (big) { S(big ? 'swoosh' : 'whooshS', { vol: 0.7, rate: big ? 0.85 : 1.1 }) || noise({ dur: 0.18, type: 'bandpass', f: 600, f2: 3500, q: 2, vol: 0.35 }); };
  api.slash = function () { S('sword', { vol: 0.75 }); };
  api.miss = function () { S('whooshS', { vol: 0.6, rate: 1.4 }); S('uiErr', { vol: 0.25, t: 0.08 }); };
  api.footstep = function (heavy) { S(heavy ? 'impact' : 'impactL', { vol: heavy ? 0.6 : 0.35, rate: heavy ? 0.7 : 1, lp: 1500 }); };

  // ---- 魔獣の声（体型・属性で割り当て） ----
  function voiceOf(beast) {
    const a = beast.art, b = a.body;
    if (beast.id === 'jester') return 'laugh';
    if (beast.id === 'mandra' || beast.id === 'moth') return 'scream';
    if (b === 'golem' || a.bulky || beast.id === 'kraken') return 'Giant';
    if (b === 'eye' || b === 'blob' || b === 'plant' || beast.types.includes('dark')) return 'Creep';
    if (b === 'serpent') return 'Troll';
    if (b === 'humanoid' || b === 'bird') return 'synth';
    return 'Ogre';
  }
  api.voice = function (beast, kind = 'roar') {
    if (!ctx || !beast) return;
    const v = voiceOf(beast), small = (beast.b[0] < 85) ? 1.15 : 1;
    if (v === 'laugh') { S('laugh', { vol: 0.6, rate: kind === 'die' ? 0.8 : 1.05 }); return; }
    if (v === 'scream') { S('scream', { vol: 0.35, rate: kind === 'die' ? 0.7 : 1.1, lp: 3500, dur: kind === 'hurt' ? 0.5 : undefined }); return; }
    if (v === 'synth') {
      const bird = beast.art.body === 'bird';
      if (bird) { tone({ type: 'sawtooth', f: 900, f2: kind === 'die' ? 200 : 1800, dur: kind === 'die' ? 0.9 : 0.35, vol: 0.09, filt: { f: 3000 } }); tone({ type: 'square', f: 1350, f2: kind === 'die' ? 300 : 2400, t: 0.04, dur: 0.3, vol: 0.04, filt: { f: 3500 } }); }
      else { S(kind === 'die' ? 'faller' : 'scrape', { vol: 0.5 }); if (kind === 'roar') S('mech', { vol: 0.4 }); }
      return;
    }
    const key = 'v' + v + (kind === 'die' ? 'Die' : kind === 'hurt' ? 'Hurt' : 'Roar');
    S(key, { vol: kind === 'hurt' ? 0.5 : 0.65, rate: small * (v === 'Giant' ? 0.85 : 1), lp: 5000 });
  };

  // ---- 召喚・帰還・戦闘不能 ----
  api.summon = function (beast) {
    if (!ctx) return;
    S('paper', { vol: 0.7 });
    S('riserS', { vol: 0.35, t: 0.05 });
    const t0 = 0.3, ty = beast ? beast.types[0] : 'none';
    setTimeout(() => { (CAST[ty] || CAST.none)(1); S('boom', { vol: 0.55 }); }, t0 * 1000);
    setTimeout(() => api.voice(beast, 'roar'), (t0 + 0.35) * 1000);
  };
  api.recall = function () { S('whooshS', { vol: 0.5, rate: 1.3 }); tone({ type: 'sine', f: 880, f2: 220, dur: 0.35, vol: 0.1, rev: 0.6 }); S('paper', { vol: 0.35, t: 0.15, rate: 1.3 }); };
  api.faint = function (beast) {
    if (!ctx) return;
    api.voice(beast, 'die');
    S('faller', { vol: 0.5, t: 0.1 });
    const ty = beast ? beast.types[0] : 'none';
    if (ty === 'ice') S('glass', { vol: 0.7, t: 0.6 });
    else if (ty === 'steel') S('mech', { vol: 0.6, t: 0.5 });
    else if (beast && beast.art.bone) S('bone', { vol: 0.7, t: 0.5 });
    else S('impact', { vol: 0.6, t: 0.7, rate: 0.7, lp: 1200 });
  };
  // ---- バフ・デバフ・状態 ----
  api.buff = function (stat) {
    S('buff', { vol: 0.55 });
    const base = { atk: 220, def: 165, mag: 330, res: 262, spd: 440 }[stat] || 262;
    [0, 4, 7, 12].forEach((sx, i) => tone({ type: 'triangle', f: base * Math.pow(2, sx / 12), t: i * 0.06, dur: 0.2, vol: 0.08 }));
    if (stat === 'atk') S('scrape', { vol: 0.45, t: 0.05 });
    if (stat === 'def') S('clash', { vol: 0.35, t: 0.05, rate: 0.8 });
    if (stat === 'spd') S('swoosh', { vol: 0.5, t: 0.02, rate: 1.3 });
    if (stat === 'mag' || stat === 'res') S('magic', { vol: 0.35, t: 0.03 });
  };
  api.debuff = function (stat) { S('debuff', { vol: 0.55 }); [12, 7, 4, 0].forEach((sx, i) => tone({ type: 'triangle', f: 330 * Math.pow(2, sx / 12), t: i * 0.06, dur: 0.18, vol: 0.07 })); S('chains', { vol: 0.35, t: 0.1 }); };
  api.status = function (st) {
    switch (st) {
      case 'brn': CAST.fire(0.6); break;
      case 'frz': S('glass', { vol: 0.6 }); CAST.ice(); break;
      case 'par': S('static', { vol: 0.6, dur: 0.5 }); break;
      case 'psn': S('squish', { vol: 0.7 }); S('WaterBubbles_loop', { vol: 0.4, dur: 0.6, rate: 0.6, off: 2 }); break;
      case 'crs': S('whisper', { vol: 0.7, dur: 1.2 }); S('chains', { vol: 0.4 }); break;
      case 'slp': [784, 659, 523, 392].forEach((f, i) => tone({ type: 'sine', f, t: i * 0.18, dur: 0.4, vol: 0.08, rev: 0.7 })); break;
      default: tone({ type: 'sine', f: 600, f2: 300, dur: 0.6, vol: 0.08 }); tone({ type: 'sine', f: 610, f2: 900, dur: 0.6, vol: 0.06 }); S('groan', { vol: 0.3 });
    }
  };
  api.heal = function () { S('magic', { vol: 0.4, rate: 1.2 }); [0, 4, 7, 11, 14, 19].forEach((sx, i) => tone({ type: 'sine', f: 523 * Math.pow(2, sx / 12), t: i * 0.07, a: 0.02, dur: 0.4, vol: 0.08, rev: 0.7 })); };
  api.shield = function () { S('clash', { vol: 0.4, rate: 1.5 }); [0, 7, 12].forEach((sx, i) => tone({ type: 'sine', f: 600 * Math.pow(2, sx / 12), t: i * 0.02, a: 0.03, dur: 0.6, vol: 0.08, rev: 0.6 })); };
  api.explode = function () { S('boom', { vol: 0.9 }); S('sub', { vol: 0.7, t: 0.03, dur: 1.4 }); noise({ dur: 1.3, type: 'lowpass', f: 2000, f2: 60, vol: 0.6, rev: 0.6 }); };
  api.chaos = function () { S('glitch', { vol: 0.6 }); for (let i = 0; i < 8; i++) tone({ type: ['sine', 'square', 'sawtooth', 'triangle'][i % 4], f: 200 + Math.random() * 1600, t: i * 0.05, dur: 0.08, vol: 0.05 }); };
  api.ultimate = function () { S('riser', { vol: 0.7 }); S('organ', { vol: 0.35, t: 0.1, dur: 1.8 }); tone({ type: 'sawtooth', f: 55, f2: 440, dur: 1.4, vol: 0.1, filt: { f: 2000 } }); };
  api.ultImpact = function () { S('boomDrop', { vol: 0.9 }); S('sub', { vol: 0.7, dur: 1.5 }); };
  api.fieldShift = function (f) { S('riserS', { vol: 0.45 }); if (f === 'chaos' || f === 'bloodmoon') S('glitch', { vol: 0.5, t: 0.4 }); if (f === 'storm') HIT.thunder(); if (f === 'miasma') S('whisper', { vol: 0.5, t: 0.3 }); if (f === 'sanct') CAST.holy(); };
  api.chain = function (n) {
    const sc = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
    piano(69 + sc[Math.min(n, sc.length - 1)], 0, 0.45, sfxBus, 1.5);
    if (n >= 3) piano(57 + sc[Math.min(n, sc.length - 1)], 0.02, 0.3, sfxBus, 1.5);
    if (n >= 5) S('magic', { vol: 0.3, rate: 1.3 });
  };
  api.click = function () { S('uiOk', { vol: 0.35, j: 0.03 }) || tone({ type: 'square', f: 1200, f2: 900, dur: 0.04, vol: 0.06, rev: 0 }); };
  api.select = function () { S('card', { vol: 0.6 }); S('uiMagic', { vol: 0.25 }); };
  api.stamp = function () { S('impactL', { vol: 0.6, rate: 1.2 }); S('paper', { vol: 0.3, rate: 1.4 }); };
  api.gauge = function () { S('powerUp', { vol: 0.4 }); tone({ type: 'sine', f: 1320, dur: 0.1, vol: 0.08 }); tone({ type: 'sine', f: 1760, t: 0.08, dur: 0.2, vol: 0.08 }); };
  const baseFanfare = api.fanfare;
  api.fanfare = function () { S('victory', { vol: 0.8, j: 0 }) || baseFanfare(); };
  api.lose = function () { S('loss', { vol: 0.8, j: 0 }); };
  api.levelup = function () { S('levelup', { vol: 0.8, j: 0 }); };

  // ---- 環境音（場ごと） ----
  api.ambience = function (name, vol = 0.18) {
    if (!ctx || name === ambName) return;
    if (ambSrc) { const g = ambGain, s = ambSrc; g.gain.setTargetAtTime(0.0001, now(), 0.4); setTimeout(() => { try { s.stop(); } catch (e) { } }, 1500); }
    ambSrc = null; ambName = name;
    if (!name || !buf[name]) return;
    ambSrc = ctx.createBufferSource(); ambSrc.buffer = buf[name]; ambSrc.loop = true; ambSrc.loopStart = 0.5; ambSrc.loopEnd = buf[name].duration - 0.7;
    ambGain = ctx.createGain(); ambGain.gain.value = 0.0001; ambGain.gain.setTargetAtTime(vol, now(), 0.8);
    ambSrc.connect(ambGain); ambGain.connect(master); ambSrc.start(now(), 0.5);
  };
  api.fieldAmbience = function (f) {
    const m = { rain: 'ForestRain_loop', storm: 'ForestRain_loop', snow: 'WindTreesBirdsFlies_loop', grove: 'Night_loop', none: 'Night_loop', sanct: 'Night_loop', miasma: 'RoomToneMachineRoom_loop', bloodmoon: 'RoomToneMachineRoom_loop', chaos: 'RoomToneMachineRoom_loop', sun: 'RoomToneMachineRoom_loop' };
    api.ambience(m[f] || null, f === 'rain' || f === 'storm' ? 0.22 : 0.12);
  };
  return api;
})();
