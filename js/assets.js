
// ===== アセット読み込み（エフェクトテクスチャ／魔獣画像） =====
'use strict';

const Assets = (() => {
  const FX_NAMES = ['ritual-fields','ritual-rift','ritual-veil','ritual-ward','ritual-restore','ritual-fracture','ritual-states','ink-fire','ink-water','ink-ice','ink-thunder','ink-wood','ink-dark','ink-holy','ink-steel',"valga-seal", 'circle_01', 'circle_02', 'circle_03', 'circle_04', 'circle_05', 'dirt_01', 'dirt_02', 'dirt_03', 'fire_01', 'fire_02',
    'flame_01', 'flame_02', 'flame_03', 'flame_04', 'flame_05', 'flame_06', 'flare_01', 'light_01', 'light_02', 'light_03',
    'magic_01', 'magic_02', 'magic_03', 'magic_04', 'magic_05', 'muzzle_01', 'muzzle_02', 'muzzle_03', 'muzzle_04', 'muzzle_05',
    'scorch_01', 'scorch_02', 'scorch_03', 'scratch_01', 'slash_01', 'slash_02', 'slash_03', 'slash_04',
    'smoke_01', 'smoke_02', 'smoke_03', 'smoke_04', 'smoke_05', 'smoke_06', 'smoke_07', 'smoke_08', 'smoke_09', 'smoke_10',
    'spark_01', 'spark_02', 'spark_03', 'spark_04', 'spark_05', 'spark_06', 'spark_07',
    'star_01', 'star_02', 'star_03', 'star_04', 'star_05', 'star_06', 'star_07', 'star_08', 'star_09',
    'trace_01', 'trace_02', 'trace_03', 'trace_04', 'trace_05', 'trace_06', 'trace_07', 'twirl_01', 'twirl_02', 'twirl_03'];
  const fxImg = {};      // name -> HTMLImageElement
  const beastImg = {};   // id -> HTMLImageElement（生成画像が置かれていれば）
  const bgImg = {};      // name -> HTMLImageElement
  const itemImg={};
  const stateCells={brn:0,psn:1,par:2,slp:3,frz:4,crs:5,cnf:6,protect:7};
  function itemIcon(id,size=24){const im=document.createElement('img');im.className='relic-icon';im.width=im.height=size;im.alt=ITEMS[id]?.n||'';im.src=itemImg[id]?.src||window.VALGA_FILES?.['assets/items/'+id+'.webp']||'assets/items/'+id+'.webp';im.draggable=false;return im}
  function stateIcon(state,size=16){const cell=stateCells[state];if(cell===undefined)return document.createTextNode('');const span=document.createElement('span');span.className='state-art';span.style.width=span.style.height=size+'px';const im=fxImg['ritual-states'];if(im)span.style.backgroundImage='url("'+im.src+'")';span.style.backgroundPosition=(cell%4)*100/3+'% '+Math.floor(cell/4)*100+'%';span.setAttribute('role','img');span.setAttribute('aria-label',STATUS_N[state]||'防護');return span}

  function loadImg(src) {
    return new Promise(res => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = window.VALGA_FILES?.[src] || src;
    });
  }
  async function loadAll(onProgress) {
    const jobs = [];
    let done = 0; const total = FX_NAMES.length + IMAGE_MANIFEST.beasts.length + IMAGE_MANIFEST.bg.length + Object.keys(ITEMS).length + Object.keys(window.BEAST_DATA || {}).length;
    const tick = () => { done++; onProgress && onProgress(done / total); };
    FX_NAMES.forEach(n => jobs.push(loadImg((window.FX_DATA && window.FX_DATA[n]) || `assets/fx/${n}.png`).then(im => { if (im) fxImg[n] = im; tick(); })));
    const BD = {};
    if (window.BEAST_DATA) for (const k in window.BEAST_DATA) { const b = BEAST_BY_ID[k] || guessBeast(k); if (b) BD[b.id] = window.BEAST_DATA[k]; }
    ALL_BEASTS.filter(b => IMAGE_MANIFEST.beasts.includes(b.id) || BD[b.id]).forEach(b => jobs.push(loadImg(BD[b.id] || `assets/beasts/${b.id}.webp`).then(im => { if (im) beastImg[b.id] = im; tick(); })));
    IMAGE_MANIFEST.bg.forEach(n => jobs.push(loadImg(`assets/bg/${n}.jpg`).then(im => { if (im) bgImg[n] = im; tick(); })));
    Object.keys(ITEMS).forEach(id=>jobs.push(loadImg('assets/items/'+id+'.webp').then(im=>{if(im)itemImg[id]=im;tick()})));
    await Promise.all(jobs);
    await loadUserImages();
  }

  // ---------- 取り込んだ画像（ブラウザ内に保存） ----------
  const DB = { name: 'valga', store: 'beasts' };
  function db() {
    return new Promise((res, rej) => {
      try {
        const r = indexedDB.open(DB.name, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(DB.store);
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
  }
  async function dbAll() {
    const d = await db();
    return new Promise(res => {
      const out = {}; const tx = d.transaction(DB.store, 'readonly'); const st = tx.objectStore(DB.store);
      const rq = st.openCursor();
      rq.onsuccess = () => { const c = rq.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); };
      rq.onerror = () => res(out);
    });
  }
  async function dbPut(id, blob) { const d = await db(); return new Promise(res => { const tx = d.transaction(DB.store, 'readwrite'); tx.objectStore(DB.store).put(blob, id); tx.oncomplete = res; tx.onerror = res; }); }
  async function dbDel(id) { const d = await db(); return new Promise(res => { const tx = d.transaction(DB.store, 'readwrite'); tx.objectStore(DB.store).delete(id); tx.oncomplete = res; tx.onerror = res; }); }
  async function loadUserImages() {
    try {
      if (localStorage.getItem('valga_useImported') === 'false') { const all = await dbAll(); importedIds = Object.keys(all); return; }
      const all = await dbAll(); importedIds = Object.keys(all);
      for (const id in all) { const im = await loadImg(URL.createObjectURL(all[id])); if (im) { beastImg[id] = im; userIds.add(id); } }
    } catch (e) { /* 保存領域が使えない環境では何もしない */ }
  }
  const userIds = new Set(); let importedIds = [];
  // 標準の絵は右向き。取り込んだ絵は既定で左向き（旧版の生成指示が左向き）として扱い、味方・敵とも相手の方を向かせる
  function faceSign(id) { if (!userIds.has(id)) return 1; return localStorage.getItem('valga_importFacing') === 'right' ? 1 : -1; }

  // 英語名・別名（生成ツールが付けがちな名前）
  const ALIASES = {
    ignivolg: ['ignivolg', 'ignivolgr', 'flamewolf', 'firewolf', 'scorchedwolf'], vulcanos: ['vulcanos', 'vulkanos', 'lavagolem', 'magmagolem'],
    homura: ['homura', 'flameprincess', 'shrinemaiden'], leviaru: ['leviaru', 'leviathan', 'seaserpent', 'abyssalserpent'],
    mare: ['mare', 'tideknight', 'drownedknight'], aquamira: ['aquamira', 'moonjelly', 'jellyfish'], druida: ['druida', 'druid', 'treant'],
    mandra: ['mandra', 'mandragora', 'mandrake'], silva: ['silva', 'silvadia', 'spiritstag', 'stag'], voltis: ['voltis', 'thunderbird'],
    galva: ['galva', 'mkiii', 'mk3', 'automaton'], raika: ['raika', 'ninetail', 'thunderfox', 'kitsune'], frostheim: ['frostheim', 'icedragon', 'frostdragon'],
    setsuna: ['setsuna', 'snowprincess'], crystalos: ['crystalos', 'crystalgolem'], legion: ['legion', 'ironlegion'], zanba: ['zanba', 'ronin'],
    abyss: ['abyss', 'abysseye', 'abyssaleye'], necros: ['necros', 'bonedragon', 'skeletondragon'], jester: ['jester', 'shadowjester'],
    seraph: ['seraph', 'seraphiel', 'seraphim'], arthur: ['arthur', 'artorius', 'paladin'], kirin: ['kirin', 'qilin', 'whitekirin'],
    gorgo: ['gorgo', 'gorgonia', 'gorgon', 'medusa'], brute: ['brute', 'behemoth'], phoenix: ['phoenix', 'phoenixia', 'fenixia'],
    kraken: ['kraken'], moth: ['moth', 'lunamoth', 'bloodmoth'], chaostia: ['chaostia', 'chaosgod'], grimwald: ['grimwald', 'grimvald'],
  };
  // ファイル名から魔獣を推定（ID・日本語名・二つ名のどれでも可）
  const norm = s => s.toLowerCase().normalize('NFKC').replace(/\.[a-z0-9]+$/, '').replace(/[\s・_\-（）()「」【】]/g, '');
  function guessBeast(fileName) {
    const f = norm(fileName);
    let best = null, bestLen = 0;
    for (const b of ALL_BEASTS) {
      for (const key of [b.id, b.n, b.title, b.n.replace(/^.*?(?=[ァ-ヴー]{3,})/, ''), ...(ALIASES[b.id] || [])]) {
        const k = norm(key);
        if (k.length >= 2 && f.includes(k) && k.length > bestLen) { best = b; bestLen = k.length; }
      }
    }
    return best;
  }
  // 余白を切り落とし、最大768pxに縮める。白背景なら白を透過にする
  async function processFile(file) {
    const url = URL.createObjectURL(file);
    const im = await loadImg(url); URL.revokeObjectURL(url);
    if (!im) return null;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height); const px = d.data;
    const corner = i => px[i + 3] > 250 && px[i] > 240 && px[i + 1] > 240 && px[i + 2] > 240;
    const W = c.width, H = c.height;
    const whiteBg = [0, (W - 1) * 4, (H - 1) * W * 4, ((H - 1) * W + W - 1) * 4].every(corner);
    if (whiteBg) {
      // 四隅から塗りつぶして白い背景だけを透過にする
      const seen = new Uint8Array(W * H); const stack = [0, W - 1, (H - 1) * W, H * W - 1];
      while (stack.length) {
        const p = stack.pop(); if (seen[p]) continue; seen[p] = 1;
        const i = p * 4; if (!(px[i] > 232 && px[i + 1] > 232 && px[i + 2] > 232)) continue;
        px[i + 3] = 0;
        const xx = p % W, yy = (p / W) | 0;
        if (xx > 0) stack.push(p - 1); if (xx < W - 1) stack.push(p + 1); if (yy > 0) stack.push(p - W); if (yy < H - 1) stack.push(p + W);
      }
      x.putImageData(d, 0, 0);
    }
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let yy = 0; yy < H; yy += 2) for (let xx = 0; xx < W; xx += 2) if (px[(yy * W + xx) * 4 + 3] > 12) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    if (x1 <= x0) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, m = Math.round(Math.max(cw, ch) * 0.03);
    const s = Math.min(1, 768 / (Math.max(cw, ch) + m * 2));
    const o = document.createElement('canvas'); o.width = Math.round((cw + m * 2) * s); o.height = Math.round((ch + m) * s);
    o.getContext('2d').drawImage(c, x0, y0, cw, ch, m * s, m * s, cw * s, ch * s);
    const blob = await new Promise(r => o.toBlob(r, 'image/webp', 0.9));
    return { blob, preview: o.toDataURL('image/webp', 0.6), whiteBg };
  }
  async function saveImage(id, blob) {
    await dbPut(id, blob);
    const im = await loadImg(URL.createObjectURL(blob));
    if (im) { beastImg[id] = im; userIds.add(id); }
  }
  async function removeImage(id) { await dbDel(id); userIds.delete(id); delete beastImg[id]; }

  // 生成画像が無い魔獣は「影体（シャドウ）」として描く：手続き描画を暗く沈め、属性色の縁光を与える
  function drawShadowForm(ctx, beast, t, w, h, opt = {}) {
    const tc = TYPES[beast.types[0]];
    const tmp = drawShadowForm.tmp || (drawShadowForm.tmp = document.createElement('canvas'));
    tmp.width = w; tmp.height = h;
    const c = tmp.getContext('2d');
    c.clearRect(0, 0, w, h);
    c.save(); c.translate(w / 2, h - 8); const s = (h - 20) / 230; c.scale(s * (opt.flip ? -1 : 1), s);
    Art.drawBeast(c, beast, t, { mutant: opt.mutant });
    c.restore();
    // 暗く沈める
    c.globalCompositeOperation = 'source-atop';
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(14,12,18,0.80)'); g.addColorStop(0.7, 'rgba(10,9,13,0.86)'); g.addColorStop(1, Art.rgba(tc.c, 0.55));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
    // 縁光
    ctx.save();
    ctx.shadowColor = Art.rgba(tc.c, 0.9); ctx.shadowBlur = 14;
    ctx.drawImage(tmp, 0, 0);
    ctx.shadowBlur = 4; ctx.shadowColor = Art.rgba(tc.g, 0.9);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
  }

  // カード・カットイン用の肖像
  function portrait(beast, w, h, mutant = 0, flip = false) {
    const cv = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const im = beastImg[beast.id];
    if (im) {
      const r = Math.min(w / im.width, (h - 4) / im.height);
      const dw = im.width * r, dh = im.height * r;
      ctx.save();
      if (mutant) ctx.filter = `hue-rotate(${mutant}deg) saturate(1.2)`;
      if (flip !== (faceSign(beast.id) < 0)) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(im, (w - dw) / 2, h - dh, dw, dh);
      ctx.restore();
    } else {
      const off = document.createElement('canvas'); off.width = w * dpr; off.height = h * dpr;
      drawShadowForm(off.getContext('2d'), beast, 1.3, w * dpr, h * dpr, { mutant, flip });
      ctx.drawImage(off, 0, 0, w, h);
    }
    return cv;
  }

  return { FX_NAMES, fxImg, beastImg, bgImg,itemImg,itemIcon,stateIcon,stateCells, loadAll, drawShadowForm, portrait, hasImage: id => !!beastImg[id], guessBeast, processFile, saveImage, removeImage, userIds, faceSign, get importedIds() { return importedIds; } };
})();


