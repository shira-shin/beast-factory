// ===== 工廠の進行・UI（スマホ縦1画面） =====
'use strict';

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const store = {
  get(k, d) { try { const v = localStorage.getItem('valga_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('valga_' + k, JSON.stringify(v)); } catch (e) { } },
};
const SLOTK = ['壱', '弐', '参'];
const tk = t => `<span class="tk" style="background:${TYPES[t].c};color:${['holy', 'thunder', 'ice', 'none', 'steel'].includes(t) ? '#1b1612' : '#fff'}">${TYPES[t].n}</span>`;
const tkFg = t => ['holy', 'thunder', 'ice', 'none', 'steel'].includes(t) ? '#1b1612' : '#fff';

const G = {
  streak: 0, battleNo: 1, round: 1, team: [], relics: {}, pool: [], runTitles: [],
  best: store.get('best', 0), titles: new Set(store.get('titles', [])), equip: store.get('title', null),
  life: store.get('life', { seals: 0, chaos: 0, ults: 0 }), speed: store.get('speed', 1),
};

function show(id) { document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== id); }
function toast(t, sub = '') { const e = el('div', 'toast', t + (sub ? `<small>${sub}</small>` : '')); $('app').appendChild(e); setTimeout(() => e.remove(), 2600); }
function updateBar() {
  $('barStreak').innerHTML = `連勝<b>${G.streak}</b>`;
  const eq = TITLES.find(t => t.id === G.equip);
  $('barTitle').textContent = eq ? `〈${eq.n}〉` : (G.team.length ? `第${G.round}周 ${G.battleNo}/7戦` : '封獣工廠ヴァルガ');
}
function unlock(id) {
  if (G.titles.has(id)) return;
  G.titles.add(id); store.set('titles', [...G.titles]);
  const t = TITLES.find(x => x.id === id); if (!t) return;
  G.runTitles.push(id);
  if (!G.equip) { G.equip = id; store.set('title', id); updateBar(); }
  toast(`称号「${t.n}」を得た`, t.d); Sound.levelup();
}

// ---------- タイトル ----------
function titleScreen() {
  show('scr-title'); updateBar();
  const art = $('heroArt'); art.querySelectorAll('canvas').forEach(c => c.remove());
  const withImg = ALL_BEASTS.filter(b => Assets.hasImage(b.id));
  const picks = shuffle(withImg.length >= 3 ? withImg : withImg.concat(shuffle(BEASTS))).slice(0, 3);
  const w = art.clientWidth || 360, h = art.clientHeight || 400;
  [[w * 0.36, h * 0.62, -0.05], [w * 0.5, h * 0.82, 0.38], [w * 0.4, h * 0.6, 0.62]].forEach(([cw, ch, x], i) => {
    const cv = Assets.portrait(picks[i], Math.round(cw), Math.round(ch), 0, i === 0);
    cv.style.left = Math.round(x * w) + 'px'; cv.style.zIndex = i === 1 ? 1 : 0; art.appendChild(cv);
  });
  Sound.bgm('title');
}
function helpScreen() {
  show('scr-help');
  $('helpRing').innerHTML = RING.map(t => tk(t)).join('<span style="color:var(--muted)">→</span>') + '<span style="color:var(--muted)">→（最初へ）</span>';
}
function titlesScreen() {
  show('scr-titles');
  $('tCount').textContent = `${G.titles.size} / ${TITLES.length}　押すと装備する`;
  const L = $('tList'); L.innerHTML = '';
  TITLES.forEach(t => {
    const has = G.titles.has(t.id);
    const b = el('button', 'tl' + (has ? '' : ' lock') + (G.equip === t.id ? ' eq' : ''), `<b>${has ? t.n : '？？？'}</b><span>${t.d}</span>`); b.type = 'button';
    b.onclick = () => { if (!has) return; G.equip = t.id; store.set('title', t.id); Sound.click(); titlesScreen(); updateBar(); };
    L.appendChild(b);
  });
}

// ---------- 詳細シート ----------
function openSheet(m) {
  const bg = el('div', 'sheet-bg'); const sh = el('div', 'sheet');
  const b = m.beast;
  sh.innerHTML = `<div class="ttl2">${b.title}</div><h3>${m.mutant ? '異・' : ''}${b.n}</h3><div style="display:flex;gap:4px;margin-top:4px">${b.types.map(tk).join('')}</div>`;
  const st = el('div', 'stats');
  ['hp', 'atk', 'def', 'mag', 'res', 'spd'].forEach(k => { const v = k === 'hp' ? m.maxhp : m.st[k]; st.innerHTML += `<span>${STAT_N[k].slice(0, 2)}</span><span class="bar2"><i style="width:${Math.min(100, v / (k === 'hp' ? 230 : 165) * 100)}%"></i></span><span>${v}</span>`; });
  sh.appendChild(st);
  sh.appendChild(el('div', '', '<b style="font-family:var(--f-display)">札</b>'));
  m.moves.forEach(mv => sh.appendChild(el('div', 'mv', `<span class="cost">${cardCost(mv)}</span><div>${tk(mv.t)} <b>${mv.n}</b>${(m.plus && m.plus[mv.id]) ? ` <span style="color:var(--shu)">+${m.plus[mv.id]}</span>` : ''}<br><span style="color:var(--ink-2)">${cardText(mv, m.plus ? m.plus[mv.id] || 0 : 0)}</span></div>`)));
  sh.appendChild(el('div', 'mv', `<span class="cost" style="background:#b8955a">奥</span><div><b>${m.ult.n}</b><br><span style="color:var(--ink-2)">覚醒ゲージ満タンで敵全体に${TYPES[m.ult.t].n}属性・威力${m.ult.pw || '混沌'}。</span></div>`));
  sh.appendChild(el('div', 'lore', b.lore));
  bg.appendChild(sh); $('app').appendChild(bg);
  bg.onclick = e => { if (e.target === bg) bg.remove(); };
}

// ---------- 貸し出し ----------
function pcard(m) {
  const c = el('button', 'pcard'); c.type = 'button';
  const w = el('div', 'win'); w.appendChild(Assets.portrait(m.beast, 150, 130, m.mutant)); c.appendChild(w);
  if (m.mutant) c.appendChild(el('span', 'tag', '変異'));
  else if (m.beast.legend) c.appendChild(el('span', 'tag', '伝説'));
  c.appendChild(el('div', 'nm', m.name));
  c.appendChild(el('div', 'tps', m.types.map(tk).join('')));
  c.appendChild(el('div', 'mini', m.moves.map(mv => TYPES[mv.t].n).join('・') + `　HP${m.maxhp}`));
  const inf = el('span', 'info', 'i'); inf.onclick = e => { e.stopPropagation(); Sound.click(); openSheet(m); }; c.appendChild(inf);
  return c;
}
function rentalScreen() {
  show('scr-rental'); Sound.bgm('shop'); updateBar();
  const pool = shuffle(BEASTS).slice(0, 6).map(b => makeMon(b, { mult: 1 }));
  const chosen = [];
  const wrap = $('rentCards'); wrap.innerHTML = '';
  const refresh = () => {
    [...wrap.children].forEach((c, i) => {
      const k = chosen.indexOf(i);
      c.classList.toggle('dim', chosen.length === 3 && k < 0);
      const o = c.querySelector('.stamp'); if (o) o.remove();
      if (k >= 0) c.appendChild(el('div', 'stamp', SLOTK[k]));
    });
    $('btnRentOk').disabled = chosen.length !== 3;
  };
  pool.forEach((m, i) => { const c = pcard(m); c.onclick = () => { const k = chosen.indexOf(i); if (k >= 0) { chosen.splice(k, 1); Sound.click(); } else if (chosen.length < 3) { chosen.push(i); Sound.stamp(); } refresh(); }; wrap.appendChild(c); });
  refresh();
  $('btnRentOk').onclick = () => { Sound.select(); G.team = chosen.map(i => pool[i]); startBattle(); };
}

// ---------- 敵生成 ----------
function genEnemy() {
  const r = G.round, n = G.battleNo;
  const totalNo = (r - 1) * 7 + n;
  const boss = n === 7 && r % 3 === 0;
  const gate = n === 7;
  const mult = Math.min(1.45, 0.92 + (r - 1) * 0.09 + (n - 1) * 0.012 + (gate ? 0.04 : 0));
  const aiLevel = Math.min(3, r + (gate ? 1 : 0));
  const owned = new Set(G.team.map(m => m.id));
  const count = totalNo <= 2 ? 2 : 3;
  let team, name, quote;
  if (boss && r === 3) {
    name = '工廠長 グリムヴァルト'; quote = 'よくぞ此処まで来た。だが工廠の炉は、まだ燃え尽きてはおらぬ。';
    team = [...shuffle(BEASTS.filter(b => !owned.has(b.id) && ['vulcanos', 'legion', 'zanba', 'arthur', 'galva'].includes(b.id))).slice(0, 2), LEGENDS[1]].map(b => makeMon(b, { mult: mult + 0.05 }));
  } else if (boss) {
    name = '混沌の観測者 ノクス'; quote = 'ようこそ、深淵へ。原初の神が、あなたを見ている。';
    team = [...shuffle(BEASTS.filter(b => !owned.has(b.id))).slice(0, 2), LEGENDS[0]].map(b => makeMon(b, { mult: mult + 0.06 }));
  } else {
    name = `${pick(TRAINER_TITLES)} ${pick(TRAINER_NAMES)}`; quote = pick(TRAINER_QUOTES);
    if (gate) name = '番人 ' + name.split(' ')[1];
    team = shuffle(BEASTS.filter(b => !owned.has(b.id))).slice(0, count).map(b => makeMon(b, { mult }));
    if (r >= 4 && R() < 0.15) team[team.length - 1] = makeMon(pick(LEGENDS), { mult });
  }
  const field = R() < 0.5 ? 'none' : pick(Object.keys(FIELDS).filter(k => k !== 'none'));
  return { team, name, quote, aiLevel, field, boss, gate, totalNo };
}

// ---------- ステージの大きさ合わせ ----------
function fitStage() {
  const st = $('stage'); const r = st.getBoundingClientRect();
  const sc = Math.min(Math.max(r.width / 540, r.height / 720), r.width / 470, r.height / 640);
  const w = Math.floor(540 * sc), h = Math.floor(720 * sc);
  for (const c of [$('cv'), $('hud')]) { c.style.width = w + 'px'; c.style.height = h + 'px'; c.style.left = Math.floor((r.width - w) / 2) + 'px'; c.style.top = Math.floor((r.height - h) / 2) + 'px'; }
}
window.addEventListener('resize', () => { if (!$('scr-battle').hidden) fitStage(); });

// ---------- 戦闘UI ----------
const UI = {
  b: null, sel: null, endRes: null, capT: null, ultArm: null,
  caption(t, ms = 650) {
    const c = $('caption'); c.textContent = t; c.hidden = false;
    clearTimeout(UI.capT); UI.capT = setTimeout(() => { c.hidden = true; }, Math.max(900, ms + 600));
    return new Promise(r => setTimeout(r, ms / Scene.S.speed));
  },
  waitEndTurn(b) { return new Promise(res => { UI.endRes = res; UI.refresh(b); }); },
  refresh(b) {
    b = b || UI.b; if (!b) return;
    // 魂火
    const en = $('energy'); en.innerHTML = '';
    const maxShow = Math.max(b.energy, 3);
    for (let i = 0; i < maxShow; i++) en.appendChild(el('span', 'orb' + (i < b.energy ? '' : ' off')));
    // 連鎖
    const cb = $('chainbox');
    const last = b.lastEl && b.lastEl !== 'bridge' ? b.lastEl : null;
    const nxt = last && RING.includes(last) ? ringNext(last) : null;
    cb.innerHTML = (b.chain ? (last ? `<span class="el" style="background:${TYPES[last].c};color:${tkFg(last)}">${TYPES[last].n}</span>` : '<span class="el" style="background:#8a3cff;color:#fff">冥</span>') + `<span class="ar">→</span>` + (nxt ? `<span class="el" style="background:${TYPES[nxt].c};color:${tkFg(nxt)}">${TYPES[nxt].n}</span>` : b.lastEl === 'bridge' ? '<span class="ar">何でも繋がる</span>' : '<span class="ar">次で途切れる</span>') : '<span class="ar" style="font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">樹→炎→雷→鋼→氷→水</span>') + `<span class="mul"><small>連鎖${b.chain}</small>×${b.chainMult().toFixed(2)}</span>`;
    // 覚醒
    const g = $('gauge'); g.querySelector('i').style.width = b.gauge + '%'; g.classList.toggle('full', b.gauge >= 100);
    // 手札
    const H = $('hand'); H.innerHTML = '';
    let anyPlayable = false;
    b.hand.forEach(card => {
      const mv = card.move, o = b.ownerOf(card);
      const ok = UI.endRes && b.playable(card); if (ok) anyPlayable = true;
      const cp = b.chainPreview(card);
      const link = ok && b.chain > 0 && !cp.reset && !cp.start && cp.step > 0;
      const plus = o && o.plus ? (o.plus[mv.id] || 0) : 0;
      const c = el('button', 'card' + (ok ? '' : ' off') + (link ? ' link' : '') + (UI.sel === card.uid ? ' sel' : '') + (mv.seal ? ' sealc' : '')); c.type = 'button';
      const pw = mv.seal ? '封' : mv.c === 's' ? '<small>補助</small>' : mv.ohko ? '一撃' : (mv.gamble || mv.chaos) ? '?' : Math.round(mv.pw * (1 + plus * 0.25)) + (mv.hits ? '<small>×n</small>' : '');
      c.innerHTML = `<span class="cost">${cardCost(mv)}</span><span class="own">${o ? SLOTK[+o.unit[1]] : ''}</span><span class="el" style="background:${TYPES[mv.t].c};color:${tkFg(mv.t)}">${mv.seal ? '封' : TYPES[mv.t].n}</span><span class="cn">${mv.n}</span><span class="pw">${pw}</span><span class="lk"></span>${plus ? `<span class="upm">+${plus}</span>` : ''}`;
      c.onclick = () => UI.cardTap(card);
      H.appendChild(c);
    });
    const eb = $('btnEnd'); eb.disabled = !UI.endRes || b.busy;
    eb.style.boxShadow = UI.endRes && !anyPlayable && !b.busy ? '0 0 0 2px #ffd36a' : '';
  },
  cardTap(card) {
    const b = UI.b; if (!b || !UI.endRes || b.busy) return;
    const mv = card.move, o = b.ownerOf(card);
    if (!b.playable(card)) {
      Sound.S('uiErr', { vol: 0.4 });
      $('hint').innerHTML = b.cost(card) > b.energy ? '魂火が足りない。' : o && !o.alive ? 'この札の獣は倒れている。' : 'この獣は動けない（凍結・眠り）。';
      return;
    }
    if (UI.sel === card.uid) { UI.play(card, Scene.S.target); return; }
    UI.sel = card.uid; Sound.S('card', { vol: 0.45 });
    const cp = b.chainPreview(card);
    const chainTxt = mv.seal ? '' : cp.reset ? '（連鎖が途切れる）' : cp.start ? '' : cp.dark ? '（冥：2段連鎖・HP8%消費）' : cp.wild ? '（聖：どこにでも繋がる）' : cp.step ? '（相生：連鎖+1）' : '（同属性：連鎖維持）';
    $('hint').innerHTML = `<b>${mv.n}</b>　${cardText(mv, o && o.plus ? o.plus[mv.id] || 0 : 0)}${chainTxt}`;
    UI.refresh(b);
  },
  async play(card, target) {
    const b = UI.b; UI.sel = null;
    $('hint').textContent = '';
    await b.playCard(card.uid, target);
    if (b.chainBest >= 4) unlock('chain4');
    if (b.chainBest >= 6) unlock('chain6');
    if (b.chainBest >= 9) unlock('chain9');
    if (b.stats.maxHit >= 300) unlock('onehit');
    if (b.stats.seals) unlock('seal1');
    if (!b.liveE().length || !b.liveP().length) { const r = UI.endRes; UI.endRes = null; r && r(); }
    UI.refresh(b);
  },
  async tapUnit(id) {
    const b = UI.b; if (!b || !UI.endRes || b.busy) return;
    const u = b.unit(id); if (!u || !u.alive) return;
    if (u.side === 'e') {
      Scene.S.target = id; Sound.S('uiOk', { vol: 0.3 });
      const card = b.hand.find(c => c.uid === UI.sel);
      if (card && b.playable(card)) { await UI.play(card, id); return; }
      const weak = [...u.revealed].map(t => TYPES[t].n).join('・') || '不明';
      $('hint').innerHTML = `<b>${u.name}</b>　HP${u.hp}/${u.maxhp}　封印値${u.seal}/${u.sealMax}　刻印：${weak}`;
      return;
    }
    // 味方：覚醒奥義
    if (b.gauge >= 100) {
      if (UI.ultArm === id) { UI.ultArm = null; await b.useUlt(id); if (b.stats.wipe) unlock('wipe'); if (!b.liveE().length) { const r = UI.endRes; UI.endRes = null; r && r(); } UI.refresh(b); return; }
      UI.ultArm = id; $('hint').innerHTML = `もう一度押すと <b>${u.name}</b> の奥義「${u.ult.n}」`; Sound.S('uiMagic', { vol: 0.4 });
      setTimeout(() => { if (UI.ultArm === id) UI.ultArm = null; }, 2500);
      return;
    }
    $('hint').innerHTML = `<b>${u.name}</b>　HP${u.hp}/${u.maxhp}${u.status ? '　' + STATUS_N[u.status] : ''}${u.block ? '　守り' + u.block : ''}`;
  },
};
Scene.onTap = id => UI.tapUnit(id);
Scene.onCaption = t => { const c = $('caption'); c.textContent = t; c.hidden = false; clearTimeout(UI.capT); UI.capT = setTimeout(() => { c.hidden = true; }, 1300); };
$('btnEnd').onclick = () => { if (!UI.endRes || (UI.b && UI.b.busy)) return; Sound.S('uiOk', { vol: 0.5 }); UI.sel = null; const r = UI.endRes; UI.endRes = null; UI.refresh(UI.b); r(); };

let sceneInit = null;
async function startBattle() {
  show('scr-battle'); updateBar();
  fitStage();
  if (!sceneInit) sceneInit = Scene.init($('cv'), $('hud'));
  await sceneInit; fitStage();
  const e = genEnemy(); G.enemy = e;
  Sound.bgm(e.boss || e.gate ? 'boss' : 'battle');
  // 対戦相手の紹介（押すと飛ばせる）
  const foe = el('div', 'foe', `<div class="box"><div class="no">BATTLE ${String(e.totalNo).padStart(2, '0')}${e.boss ? '　決戦' : e.gate ? '　番人戦' : ''}</div><div class="nm">${e.name}</div><div class="q">「${e.quote}」</div><div class="fd">戦場：${FIELDS[e.field].n}${e.field !== 'none' ? '　' + FIELDS[e.field].d : ''}</div><div class="fd">敵 ${e.team.length}体　${e.team.some(m => m.beast.legend) ? '<span style="color:#ff7a5a">伝説級の反応あり</span>' : ''}</div></div>`);
  $('stage').appendChild(foe);
  await new Promise(r => { const t = setTimeout(r, 1800); foe.onclick = () => { clearTimeout(t); r(); }; });
  foe.remove();
  const b = new Battle(G.team, e.team, UI, { aiLevel: e.aiLevel, field: e.field, relics: G.relics, boss: e.boss, enemyMul: Math.min(1.05, 0.55 + (G.round - 1) * 0.1 + (G.battleNo - 1) * 0.015 + (e.gate ? 0.05 : 0)) });
  UI.b = b; UI.sel = null; window.__battle = b;
  $('hint').textContent = '札を押して選び、敵を押すと放つ。同じ札をもう一度押してもよい。';
  const result = await b.start();
  UI.endRes = null; UI.refresh(b);
  G.life.chaos += b.stats.chaos; G.life.ults += b.stats.ults; G.life.seals += b.stats.seals; store.set('life', G.life);
  if (G.life.seals >= 30) unlock('seal30');
  if (G.life.chaos >= 10) unlock('chaos10');
  if (G.life.ults >= 10) unlock('ult10');
  if (result === 'win') {
    Sound.stopBgm(); Sound.fanfare();
    Scene.banner('勝　利', '#ece4cf', `${e.name}を退けた`, 2);
    unlock('first');
    if (b.stats.breaks >= 3) unlock('break3');
    if (b.field === 'bloodmoon') unlock('moon');
    if (b.stats.lost === 0) unlock('flawless');
    const live = b.liveP(); if (live.length === 1 && live[0].hp / live[0].maxhp <= 0.1) unlock('clutch');
    if (b.stats.gambleKill) unlock('gambler');
    G.pool = e.team.map(m => ({ beast: m.beast, sealed: m.sealed, nature: m.nature, mutant: m.mutant }));
    await Scene.wait(1500);
    G.streak++; if (G.streak > G.best) { G.best = G.streak; store.set('best', G.best); }
    if (G.streak >= 14) unlock('streak14');
    rewardScreen();
  } else {
    Sound.stopBgm(); Sound.lose();
    Scene.banner('敗　北', '#c8321f', '', 2);
    await Scene.wait(1600);
    overScreen();
  }
}

// ---------- 報酬 ----------
function teamHp() {
  const t = $('rwTeam'); t.innerHTML = '';
  G.team.forEach((m, i) => {
    const d = el('div', 'thp' + (m.hp <= 0 ? ' dead' : ''));
    d.appendChild(Assets.portrait(m.beast, 90, 60, m.mutant));
    d.appendChild(el('div', '', `${SLOTK[i]} ${m.name}`));
    d.appendChild(el('div', 'hb', `<i style="width:${m.hp / m.maxhp * 100}%"></i>`));
    t.appendChild(d);
  });
  $('rwRelics').innerHTML = Object.keys(G.relics).map(k => `<span class="relic">${RELICS[k].n}</span>`).join('') || '<span class="sub">護符なし</span>';
}
function rewardScreen() {
  show('scr-reward'); Sound.bgm('shop'); updateBar();
  const roundClear = G.battleNo === 7;
  // 回復：倒れた獣は30%で復帰
  const healR = roundClear ? 1 : G.relics.herb ? 0.45 : 0.2;
  G.team.forEach(m => { if (m.hp <= 0) m.hp = Math.round(m.maxhp * 0.3); else m.hp = Math.min(m.maxhp, m.hp + Math.round(m.maxhp * healR)); });
  if (roundClear) { unlock('round1'); if (G.round === 3) unlock('round3'); if (G.round === 6) unlock('round6'); }
  $('rwMsg').textContent = roundClear ? `第${G.round}周を突破。全員の体力が戻った。次の周から敵が強くなる。` : `${G.streak}連勝。体力が${Math.round(healR * 100)}%回復した。`;
  teamHp();
  $('rwHead').textContent = '報酬をひとつ選ぶ';
  const list = $('rwList'); list.innerHTML = '';
  const opts = [];
  const free = Object.keys(RELICS).filter(k => !G.relics[k]);
  if (free.length) { const k = pick(free); opts.push({ ic: '護', n: RELICS[k].n, d: RELICS[k].d, go: () => { G.relics[k] = 1; if (Object.keys(G.relics).length >= 5) unlock('relic5'); next(); } }); }
  opts.push({ ic: '研', n: '札の強化', d: '好きな札を1枚選び、威力を25%上げる（変化札は効果が増す）。', go: upgradeScreen });
  if (G.pool.length) opts.push({ ic: '換', n: '魔獣の交代', d: G.pool.some(p => p.sealed) ? '封印した魔獣を仲間にできる。' : '倒した魔獣を仲間にできる。', go: swapScreen });
  else opts.push({ ic: '癒', n: '湯治', d: '味方全員の体力を40%回復する。', go: () => { G.team.forEach(m => { m.hp = Math.min(m.maxhp, m.hp + Math.round(m.maxhp * 0.4)); }); next(); } });
  opts.forEach(o => { const b = el('button', 'rw', `<span class="ic">${o.ic}</span><div><b>${o.n}</b><span>${o.d}</span></div>`); b.type = 'button'; b.onclick = () => { Sound.select(); o.go(); }; list.appendChild(b); });
  const skip = el('button', 'btn ghost wide', '何も取らずに進む'); skip.type = 'button'; skip.onclick = () => { Sound.click(); next(); }; list.appendChild(skip);
  function next() { if (roundClear) { G.round++; G.battleNo = 1; Sound.levelup(); } else G.battleNo++; startBattle(); }
  rewardScreen.next = next;
}
function upgradeScreen() {
  $('rwHead').textContent = '強化する札を選ぶ';
  const list = $('rwList'); list.innerHTML = '';
  const grid = el('div', 'cgrid');
  G.team.forEach((m, i) => m.moves.forEach(mv => {
    const plus = m.plus[mv.id] || 0;
    const c = el('button', 'card', `<span class="cost">${cardCost(mv)}</span><span class="own">${SLOTK[i]}</span><span class="el" style="background:${TYPES[mv.t].c};color:${tkFg(mv.t)}">${TYPES[mv.t].n}</span><span class="cn">${mv.n}</span><span class="pw">${mv.c === 's' ? '<small>補助</small>' : Math.round(mv.pw * (1 + plus * 0.25)) || '?'}</span>${plus ? `<span class="upm">+${plus}</span>` : ''}`); c.type = 'button';
    c.onclick = () => { m.plus[mv.id] = plus + 1; Sound.buff('atk'); toast(`${mv.n} を強化した（+${plus + 1}）`); rewardScreen.next(); };
    grid.appendChild(c);
  }));
  list.appendChild(grid);
}
function swapScreen() {
  $('rwHead').textContent = '仲間にする魔獣を選ぶ';
  const list = $('rwList'); list.innerHTML = '';
  G.pool.forEach(p => {
    const b = el('button', 'rw', `<span class="ic" style="background:${TYPES[p.beast.types[0]].c};color:${tkFg(p.beast.types[0])}">${TYPES[p.beast.types[0]].n}</span><div><b>${p.beast.n}${p.sealed ? '　<span style="color:var(--shu)">封印済み</span>' : ''}</b><span>${p.beast.title}・${p.beast.types.map(t => TYPES[t].n).join('/')}</span></div>`); b.type = 'button';
    b.onclick = () => {
      Sound.click(); $('rwHead').textContent = '代わりに手放す魔獣を選ぶ'; list.innerHTML = '';
      G.team.forEach((m, i) => { const c = el('button', 'rw', `<span class="ic">${SLOTK[i]}</span><div><b>${m.name}</b><span>HP ${m.hp}/${m.maxhp}</span></div>`); c.type = 'button'; c.onclick = () => { const nm = makeMon(p.beast, { mult: 1, nature: p.nature, mutant: p.mutant }); G.team[i] = nm; Sound.summon(p.beast); toast(`${p.beast.n} が仲間になった`); rewardScreen.next(); }; list.appendChild(c); });
    };
    list.appendChild(b);
  });
}

function overScreen() {
  show('scr-over'); Sound.bgm('title');
  $('overNum').textContent = G.streak;
  $('overTitle').textContent = G.streak >= 21 ? '伝説の終焉' : '敗北';
  $('overStats').textContent = `最高 ${G.best}連勝 ／ 第${G.round}周 ${G.battleNo}戦目で敗退`;
  $('overTitles').innerHTML = G.runTitles.map(id => `<span class="relic">${TITLES.find(t => t.id === id).n}</span>`).join('') || '<span class="sub">今回得た称号はない</span>';
}

function newRun() {
  Object.assign(G, { streak: 0, battleNo: 1, round: 1, team: [], relics: {}, pool: [], runTitles: [] });
  updateBar(); rentalScreen();
}

// ---------- 画像の取り込み ----------
const isImgFile = f => (f.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(f.name);
function importScreen() { show('scr-import'); renderGallery(); $('impPending').innerHTML = ''; }
function renderGallery() {
  const g = $('impGal'); g.innerHTML = ''; let n = 0;
  ALL_BEASTS.forEach(b => {
    const has = Assets.hasImage(b.id); if (has) n++;
    const t = el('button', 'gi' + (has ? ' has' : '')); t.type = 'button';
    t.appendChild(Assets.portrait(b, 80, 64));
    t.appendChild(el('div', '', b.n)); t.appendChild(el('div', 'stt', has ? (Assets.userIds.has(b.id) ? '登録（押すと外す）' : '同梱') : '未登録'));
    t.onclick = async () => {
      if (Assets.userIds.has(b.id)) { await Assets.removeImage(b.id); toast(`${b.n}の画像を外した`); renderGallery(); return; }
      const inp = el('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => inp.files[0] && assignFiles([[inp.files[0], b.id]]); inp.click();
    };
    g.appendChild(t);
  });
  $('impCount').textContent = `${n} / ${ALL_BEASTS.length} 体に画像あり`;
}
async function assignFiles(pairs) {
  let ok = 0, white = 0;
  for (const [f, id] of pairs) { const r = await Assets.processFile(f); if (!r) continue; await Assets.saveImage(id, r.blob); ok++; if (r.whiteBg) white++; }
  renderGallery(); toast(`${ok}枚を登録した`, white ? `うち${white}枚は白背景を透過` : '');
}
async function importFiles(files) {
  files = [...files].filter(isImgFile).filter(f => !/(^|\/)(fx|bg|sfx)\//.test(f.webkitRelativePath || ''));
  if (!files.length) return;
  if ($('scr-import').hidden) importScreen();
  const auto = [], manual = [];
  files.forEach(f => { const b = Assets.guessBeast(f.name); (b ? auto : manual).push([f, b && b.id]); });
  if (auto.length) await assignFiles(auto);
  const box = $('impPending'); box.innerHTML = '';
  manual.forEach(([f]) => {
    const it = el('div', 'pi'); const img = el('img'); img.src = URL.createObjectURL(f); img.alt = f.name; it.appendChild(img);
    const sel = el('select'); sel.innerHTML = '<option value="">どの魔獣？</option>' + ALL_BEASTS.map(b => `<option value="${b.id}">${b.n}</option>`).join('');
    sel.onchange = async () => { if (!sel.value) return; sel.disabled = true; await assignFiles([[f, sel.value]]); it.classList.add('ok'); };
    it.appendChild(sel); box.appendChild(it);
  });
}
$('btnImport').onclick = () => { Sound.init(); Sound.click(); importScreen(); };
$('impPick').onclick = () => $('impFile').click();
$('impDir').onclick = () => $('impDirIn').click();
$('impFile').onchange = () => { importFiles($('impFile').files); $('impFile').value = ''; };
$('impDirIn').onchange = () => { importFiles($('impDirIn').files); $('impDirIn').value = ''; };
$('impDone').onclick = () => { Sound.click(); titleScreen(); };
let dragDepth = 0, dropEl = null;
document.addEventListener('dragenter', e => { if (![...(e.dataTransfer.types || [])].includes('Files')) return; e.preventDefault(); dragDepth++; if (!dropEl) { dropEl = el('div', 'dropall', '離すと画像を取り込む'); $('app').appendChild(dropEl); } });
document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth && dropEl) { dropEl.remove(); dropEl = null; } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; if (dropEl) { dropEl.remove(); dropEl = null; } if (!$('scr-battle').hidden) return; importFiles(e.dataTransfer.files); });

// ---------- 起動 ----------
$('btnStart').onclick = () => { Sound.init(); Sound.select(); newRun(); };
$('btnRetry').onclick = () => { Sound.select(); newRun(); };
$('btnToTitle').onclick = () => { Sound.click(); G.team = []; titleScreen(); };
$('btnTitles').onclick = () => { Sound.init(); Sound.click(); titlesScreen(); };
$('btnHelp').onclick = () => { Sound.init(); Sound.click(); helpScreen(); };
$('btnTBack').onclick = () => { Sound.click(); titleScreen(); };
$('btnHBack').onclick = () => { Sound.click(); titleScreen(); };
$('btnMute').onclick = () => { Sound.init(); const m = Sound.toggleMute(); $('btnMute').textContent = m ? '消' : '音'; };
const SPEEDS = [1, 1.5, 2];
$('btnSpeed').onclick = () => { G.speed = SPEEDS[(SPEEDS.indexOf(G.speed) + 1) % SPEEDS.length]; Scene.S.speed = G.speed; $('btnSpeed').textContent = '×' + G.speed; store.set('speed', G.speed); };
if (!SPEEDS.includes(G.speed)) G.speed = 1;
Scene.S.speed = G.speed; $('btnSpeed').textContent = '×' + G.speed;
document.addEventListener('pointerdown', () => { Sound.init(); if (!$('scr-title').hidden) Sound.bgm('title'); }, { once: true });
(async () => {
  await Promise.all([Sound.preload(Sound.SFX_NAMES), Assets.loadAll(p => $('loadBar').style.setProperty('--p', Math.round(p * 100) + '%')), document.fonts ? document.fonts.ready : null]);
  $('loading').hidden = true;
  titleScreen();
})();
