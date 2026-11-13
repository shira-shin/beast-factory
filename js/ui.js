
// ===== 工廠の進行・UI =====
'use strict';

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const store = {
  get(k, d) { try { const v = localStorage.getItem('valga_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('valga_' + k, JSON.stringify(v)); } catch (e) { } },
};
const KANJI_NUM = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const kn = n => n <= 10 ? KANJI_NUM[n] : String(n);

const G = { streak: 0, battleNo: 1, round: 1, team: [], best: store.get('best', 0), speed: 1, enemy: null, wins: 0, crits: 0, chaos: 0, ults: 0 };

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== id);
  document.body.dataset.screen=id;
  document.dispatchEvent(new CustomEvent('valga-screen',{detail:id}));
}
function updateChips() {
  $('chipStreak').innerHTML = `連勝<b>${G.streak}</b>`;
  $('chipBest').innerHTML = `最高<b>${G.best}</b>`;
}

// ---------- 表示部品 ----------
const tk = t => `<span class="tk" style="background:${TYPES[t].c};color:${['holy', 'thunder', 'ice', 'none', 'steel'].includes(t) ? '#1b1612' : '#fff'}">${TYPES[t].n}</span>`;
const catN = { p: '打撃', m: '術式', s: '布石' };
const pwText = mv => mv.c === 's' ? '—' : mv.ohko ? '一撃' : (mv.gamble || mv.chaos) ? '?' : mv.pw;
function moveLine(mv) {
  return `<div class="mv" style="border-color:${TYPES[mv.t].c}" title="${mv.d || ''}"><span>${mv.n}</span><span>${catN[mv.c]} ${pwText(mv)}</span></div>`;
}
function monCard(m, opt = {}) {
  const c = el('div', 'card'); c.tabIndex=0; c.setAttribute('role','button'); c.setAttribute('aria-label',m.name+'を選ぶ'); c._mon=m;
  c.addEventListener('keydown',e=>{if(e.target===c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();c.click()}});
  const b = m.beast;
  const spine = el('div', 'spine', `<div class="vname" style="font-size:${b.n.length > 8 ? 15 : b.n.length > 6 ? 18 : 22}px">${b.n}</div><div class="tsl">${b.types.map(tk).join('')}</div>`);
  c.appendChild(spine);
  const main = el('div', 'main');
  const win = el('div', 'win');
  win.appendChild(Assets.portrait(b, 480, 480, m.mutant));
  win.appendChild(el('div', 'ttl', b.title));
  if (m.mutant) win.appendChild(el('div', 'tag', '変異種'));
  else if (b.legend) win.appendChild(el('div', 'tag', '伝説'));
  main.appendChild(win);
  const keys = ['hp', 'atk', 'def', 'mag', 'res', 'spd'];
  const st = el('div', 'stats');
  keys.forEach(k => {
    const v = k === 'hp' ? m.maxhp : m.st[k];
    const max = k === 'hp' ? 230 : 165;
    const cls = m.nature.up === k ? 'up' : m.nature.dn === k ? 'dn' : '';
    st.innerHTML += `<span class="lab ${cls}">${STAT_N[k].length > 2 ? STAT_N[k].slice(0, 2) : STAT_N[k]}</span><span class="bar"><i style="width:${Math.min(100, v / max * 100)}%"></i></span><span class="num">${v}</span>`;
  });
  main.appendChild(st);
  main.appendChild(el('div', 'meta', `<div><b>${ABILITIES[m.ability].n}</b><span class="d">${ABILITIES[m.ability].d}</span></div><div><b>${ITEMS[m.item].n}</b><span class="d">${ITEMS[m.item].d}</span></div><div><b>${m.nature.n}</b><span class="d">${m.nature.up ? `${STAT_N[m.nature.up]}↑ ${STAT_N[m.nature.dn]}↓` : '補正なし'}</span></div>`));
  main.querySelector('.meta').children[1].querySelector('b').prepend(Assets.itemIcon(m.item,19));
  main.appendChild(el('div', 'mvs', m.moves.map(moveLine).join('')));
  main.appendChild(el('div', 'ultline', `<b>奥義</b>${m.ult.n}<span class="d" style="color:var(--ink-2)">　${TYPES[m.ult.t].n}・${m.ult.chaosUlt ? '混沌×3' : '出力' + m.ult.pw}</span>`));
  if (opt.lore) main.appendChild(el('div', 'lore-s', b.lore));
  main.appendChild(el('div','signature-line',`<b>封印刻 ${ForgeCombat.SIG[m.id][0]}</b><span>${ForgeCombat.SIG[m.id][1]}</span>`));
  c.appendChild(main);
  const info=el('button','card-info','詳細');info.type='button';info.setAttribute('aria-label',m.name+'の詳細');info.onclick=e=>{e.stopPropagation();ValgaUI.details(m)};c.appendChild(info);
  return c;
}
function setStamp(card, label) {
  const o = card.querySelector('.stamp'); if (o) o.remove();
  if (label) card.appendChild(el('div', 'stamp', label));
}

// ---------- タイトル ----------
function titleScreen() {
  show('scr-title'); updateChips();
  const art = $('heroArt'); art.innerHTML = '';
  const picks = shuffle(BEASTS).slice(0, 2).concat([LEGENDS[1]]);
  const pos = [[-40, 300, 280], [250, 260, 250], [90, 400, 360]];
  picks.forEach((b, i) => { const cv = Assets.portrait(b, pos[i][1], pos[i][2], 0, i === 0); cv.style.left = pos[i][0] + 'px'; cv.style.zIndex = i === 2 ? 2 : 1; art.appendChild(cv); });
  const ks = Object.keys(TYPES);
  let h = '<table class="chart"><caption>属性の基礎優勢（行が攻撃・列が防御）。残留反応と構えでも変わる。</caption><tr><th></th>' + ks.map(k => `<th style="color:${TYPES[k].c}">${TYPES[k].n}</th>`).join('') + '</tr>';
  ks.forEach(a => { h += `<tr><th style="color:${TYPES[a].c}">${TYPES[a].n}</th>` + ks.map(d => { const v = typeEff(a,[d]); return `<td class="${v > 1 ? 'x2' : v < 1 ? 'x05' : ''}">${v === 1 ? '' : v>1 ? '＋' : '−'}</td>`; }).join('') + '</tr>'; });
  $('chartWrap').innerHTML = h + '</table>';
}

// ---------- レンタル ----------
function rentalScreen(roundClear = false) {
  show('scr-rental'); Sound.bgm('shop');
  const pool = shuffle(BEASTS).slice(0, 6).map(b => makeMon(b, { mult: 1 }));
  const chosen = [];
  const wrap = $('rentCards'); wrap.innerHTML = '';
  $('rentTitle').textContent = roundClear ? `第${kn(G.round)}周　再貸し出し` : '封獣札の貸し出し';
  $('rentSub').textContent = roundClear ? '新しい6枚から選び直すか、今のチームを維持する。' : '6枚から3枚を選べ。押した順が出撃順になる。';
  $('btnKeep').hidden = !roundClear;
  const refresh = () => {
    [...wrap.children].forEach((c, i) => {
      const k = chosen.indexOf(i);
      c.classList.toggle('sel', k >= 0);c.setAttribute('aria-pressed',String(k>=0));
      c.classList.toggle('dim', chosen.length === 3 && k < 0);
      setStamp(c, k >= 0 ? `${['壱', '弐', '参'][k]}<small>契約</small>` : null);
    });
    $('btnRentOk').disabled = chosen.length !== 3;
    ValgaUI.draft(chosen.map(i=>pool[i]));
  };
  pool.forEach((m, i) => {
    const c = monCard(m, { lore: true });
    c.onclick = () => { const k = chosen.indexOf(i); if (k >= 0) { chosen.splice(k, 1); Sound.click(); } else if (chosen.length < 3) { chosen.push(i); Sound.select(); } refresh(); };
    wrap.appendChild(c);
  });
  refresh();
  $('btnRentOk').onclick = () => { Sound.select(); G.team = chosen.map(i => pool[i]); preScreen(); };
  $('btnKeep').onclick = () => { Sound.select(); preScreen(); };
}

// ---------- 敵生成 ----------
function genEnemy() {
  const r = G.round, n = G.battleNo;
  const totalNo = (r - 1) * 7 + n;
  const boss = n === 7 && (r === 3 || r === 6 || (r > 6 && r % 3 === 0));
  const gate = n === 7;
  // 2026-11-13: 序盤を遊びやすく、周回ごとに確実に強くなる曲線へ（自動対戦で各段の勝率を測って調整）
  const mult = Math.min(1.35, 0.86 + (r - 1) * 0.048 + (n - 1) * 0.007 + (gate ? 0.03 : 0));
  const aiLevel = Math.min(3, r + (gate ? 1 : 0));
  const owned = new Set(G.team.map(m => m.id));
  let team, name, quote;
  if (boss && r === 3) {
    name = '工廠長 グリムヴァルト'; quote = 'よくぞ此処まで来た。だが工廠の炉は、まだ燃え尽きてはおらぬ。';
    const others = shuffle(BEASTS.filter(b => !owned.has(b.id) && ['vulcanos', 'legion', 'zanba', 'arthur', 'galva'].includes(b.id))).slice(0, 2);
    team = [...others, LEGENDS[1]].map(b => makeMon(b, { mult: mult - 0.03 }));
  } else if (boss) {
    name = '混沌の観測者 ノクス'; quote = 'ようこそ、深淵へ。原初の神が、あなたを見ている。';
    const others = shuffle(BEASTS.filter(b => !owned.has(b.id))).slice(0, 2);
    team = [...others, LEGENDS[0]].map(b => makeMon(b, { mult: mult - 0.01 }));
  } else {
    name = `${pick(TRAINER_TITLES)} ${pick(TRAINER_NAMES)}`;
    quote = pick(TRAINER_QUOTES);
    if (gate) name = '番人 ' + name.split(' ')[1];
    const pool = shuffle(BEASTS.filter(b => !owned.has(b.id)));
    team = pool.slice(0, 3).map(b => makeMon(b, { mult }));
    if (r >= 4 && R() < 0.15) team[2] = makeMon(pick(LEGENDS), { mult });
  }
  const field = R() < 0.45 ? 'none' : pick(Object.keys(FIELDS).filter(k => k !== 'none'));
  return { team, name, quote, aiLevel, field, boss, gate, totalNo };
}
function scoutReport(e) {
  const tc = {}; e.team.forEach(m => m.types.forEach(t => tc[t] = (tc[t] || 0) + 1));
  const main = Object.entries(tc).sort((a, b) => b[1] - a[1])[0][0];
  let p = 0, mg = 0, s = 0; e.team.forEach(m => m.moves.forEach(mv => mv.c === 'p' ? p++ : mv.c === 'm' ? mg++ : s++));
  const style = s >= 5 ? '搦め手' : p > mg + 1 ? '物理' : mg > p + 1 ? '魔法' : '混合';
  const fast = e.team.reduce((a, m) => a + m.beast.b[5], 0) / 3 > 90 ? '速攻' : '持久';
  let h = `<dt>主力属性</dt><dd>${tk(main)}</dd><dt>戦型</dt><dd>${style}・${fast}</dd><dt>戦場</dt><dd>${FIELDS[e.field].n}${e.field !== 'none' ? `　<span style="color:var(--muted)">${FIELDS[e.field].d}</span>` : ''}</dd>`;
  if (e.team.some(m => m.mutant)) h += '<dt>警告</dt><dd class="warn">変異種の反応あり</dd>';
  if (e.team.some(m => m.beast.legend)) h += '<dt>警告</dt><dd class="warn">伝説級の魔力を検知</dd>';
  return h;
}

// ---------- 戦闘前 ----------
function preScreen() {
  show('scr-pre'); Sound.bgm('scout');
  G.enemy = genEnemy();
  const e = G.enemy;
  $('preTitle').textContent = `第${kn(e.totalNo)}戦${e.boss ? '　決戦' : e.gate ? '　番人戦' : ''}`;
  $('preSub').textContent = `第${G.round}周 ${G.battleNo}/7 ・ ${G.streak}連勝中`;
  $('preName').textContent = e.name;
  $('preQuote').textContent = `「${e.quote}」`;
  $('preReport').innerHTML = scoutReport(e);
  const sil = $('preSil'); sil.innerHTML = ''; sil.appendChild(Assets.portrait(e.team[0].beast, 230, 190));
  const renderOrder = () => {
    const o = $('preOrder'); o.innerHTML = '';
    G.team.forEach((m, i) => {
      const it = el('button', 'oitem' + (i === 0 ? ' lead' : '')); it.type = 'button';
      it.appendChild(Assets.portrait(m.beast, 56, 46, m.mutant));
      it.appendChild(el('div', '', `<div class="n">${['壱', '弐', '参'][i]}　${m.name}</div><div class="s">${m.types.map(t => TYPES[t].n).join('・')} ／ ${ITEMS[m.item].n}</div>`));
      it.onclick = () => { Sound.click(); const [x] = G.team.splice(i, 1); G.team.unshift(x); renderOrder(); };
      o.appendChild(it);
    });
    const pc = $('preCards'); pc.innerHTML = '';
    G.team.forEach(m => { const c = monCard(m); c.style.cursor = 'default'; c.tabIndex = -1; pc.appendChild(c); });
  };
  renderOrder();
  $('btnFight').onclick = () => { Sound.select(); battleScreen(); };
}

// ---------- 戦闘UI ----------
const UI = {
  logLines: [], skip: null,
  log(t) {
    const L = $('log');
    UI.logLines.push(t); if (UI.logLines.length > 3) UI.logLines.shift();
    ValgaUI.remember(t);
    L.innerHTML = UI.logLines.map((x, i) => `<div class="${i === UI.logLines.length - 1 ? 'cur' : 'old'}">${x}</div>`).join('');
    const ms = Math.min(230,75 + t.length * 3) / G.speed;
    return new Promise(res => { const tm = setTimeout(res, ms); UI.skip = () => { clearTimeout(tm); res(); }; });
  },
  waitCmd() { $('cmd').innerHTML = '<div class="waiting">・・・</div>'; },
  intel(b) {
    const f = b.act(1);
    const mvs = [...f.revealed].map(id => MOVES[id].n);
    const sp = b.speed(b.act(0)), fs = b.speed(f);
    return `<div class="intel"><div><b>${f.name}</b>　${f.types.map(t => TYPES[t].n).join('・')}　生得刻印 <b>${ABILITIES[f.ability].n}</b>：${ABILITIES[f.ability].d}</div>
      <div>契約具 <b>${f.itemRevealed ? ITEMS[f.item].n : '不明'}</b>　観測した術 <b>${mvs.length ? mvs.join('・') : 'なし'}</b>　速さ <b>${sp > fs ? 'こちらが上' : sp < fs ? '相手が上' : '互角'}</b></div></div>`;
  },
  chooseAction(b) {
    return new Promise(res => {
      const me = b.act(0), foe = b.act(1), side = b.sides[0]; Sound.warmCombat(me,foe);
      const cmd = $('cmd'); cmd.innerHTML = UI.intel(b);
      ValgaUI.battleStatus(b);
      CombatUI.stances(cmd,b);
      if(me.hp/me.maxhp<=.25)Sound.bgm('danger');
      const grid = el('div', 'moves');
      const hint = el('div', 'hint', '術の説明は上の「術の説明」から確認できます。');
      me.moves.forEach(mv => {
        const bt = el('button', 'mbtn'); bt.type = 'button'; bt.style.setProperty('--tc', TYPES[mv.t].c);
        let effH = '';
        if (mv.c !== 's' && !mv.chaos) { const e = typeEff(mv.t, foe.types); effH = e >= 4 ? '<span class="eff e4">絶大</span>' : e > 1 ? '<span class="eff e2">優勢</span>' : e < 1 ? '<span class="eff e05">半減</span>' : ''; }
        const stab = mv.t !== 'none' && me.types.includes(mv.t);
        bt.innerHTML = `<span class="mn">${tk(mv.t)}${mv.n}</span><span class="ms">${catN[mv.c]}　出力 ${pwText(mv)}　${mv.ac?'照準 '+mv.ac+'%':'必中'}${mv.pr ? `　先制+${mv.pr}` : ''}${stab ? '　同調' : ''}</span>${effH}`;
        bt.title=mv.d||'';bt.setAttribute('aria-label',mv.n+' '+(mv.d||''));
        bt.onmouseenter = bt.onfocus = () => hint.textContent = `${mv.n}：${mv.d || ''}${stab ? '（属性同調で出力上昇）' : ''}`;
        bt.appendChild(CombatUI.moveHint(b,mv));
        bt.onclick = () => { const stance=ForgeCombat.ensure(me).stance;Sound.click(); UI.waitCmd(); res({ kind: 'move', move: mv, stance }); };
        grid.appendChild(bt);
      });
      cmd.appendChild(grid);
      const row = el('div', 'actrow');
      const ready = side.gauge >= 100;
      const ub = el('button', 'ubtn' + (ready ? ' ready' : '')); ub.type = 'button'; ub.disabled = !ready;
      ub.innerHTML = `<span class="ut">奥義　${me.ult.n}</span><small>${ready ? '解放できる。結界を貫き必中する。' : `覚醒 ${Math.floor(side.gauge)}%`}　${TYPES[me.ult.t].n}・${me.ult.chaosUlt ? '混沌×3' : '出力' + me.ult.pw}</small>${ready ? '' : `<span class="gbar" style="width:${side.gauge}%"></span>`}`;
      ub.onclick = () => { Sound.select(); UI.waitCmd(); res({ kind: 'ult',stance:ForgeCombat.ensure(me).stance }); };
      const sb = el('button', 'sbtn', '交代'); sb.type = 'button';
      sb.disabled = b.alive(0).length <= 1 || (ForgeCombat.ensure(me).tetherUntil>=b.turn&&ForgeCombat.ensure(me).tetherUntil>0);if(sb.disabled&&b.alive(0).length>1)sb.textContent='拘束中';
      sb.onclick = async () => { Sound.click(); const idx = await UI.chooseSwitch(b, false, true); if (idx === null) { UI.chooseAction(b).then(res); return; } UI.waitCmd(); res({ kind: 'switch', idx }); };
      row.appendChild(ub); row.appendChild(sb);
      cmd.appendChild(row); cmd.appendChild(hint);
    });
  },
  chooseSwitch(b, forced, cancellable = false) {
    return new Promise(res => {
      const s = b.sides[0], cmd = $('cmd');
      cmd.innerHTML = `<div class="hint" style="color:var(--paper);font-weight:700">${forced ? '次に出す魔獣を選べ。' : '交代する魔獣を選べ。'}</div>`;
      const list = el('div', 'swl');
      s.team.forEach((m, i) => {
        const bt = el('button', 'swi'); bt.type = 'button';
        bt.disabled = m.hp <= 0 || i === s.active;
        bt.appendChild(Assets.portrait(m.beast, 60, 50, m.mutant));
        bt.appendChild(el('div', 'inf', `<b>${m.name}</b> ${m.status ? `<span style="color:${STATUS_C[m.status]}">${STATUS_N[m.status]}</span>` : ''}<div>${m.types.map(t => TYPES[t].n).join('・')}　${m.hp}/${m.maxhp}${i === s.active ? '　戦闘中' : ''}</div><div class="hpb"><i style="width:${m.hp / m.maxhp * 100}%"></i></div>`));
        bt.onclick = () => { Sound.click(); UI.waitCmd(); res(i); };
        list.appendChild(bt);
      });
      cmd.appendChild(list);
      if (cancellable) { const c = el('button', 'sbtn', 'やめる'); c.type = 'button'; c.onclick = () => { Sound.click(); res(null); }; cmd.appendChild(c); }
    });
  },
};
$('log').onclick = () => { if (UI.skip) UI.skip(); };

let sceneInit = null;
async function battleScreen() {
  show('scr-battle');
  document.body.classList.add('battle-arrival');
  if (!sceneInit) sceneInit = Scene.init($('cv'), $('hud'));
  await sceneInit;
  Scene.clear();
  const e = G.enemy;
  Sound.battle(e.boss || e.gate ? 'boss' : 'battle');
  UI.logLines = []; UI.waitCmd();
  G.team.forEach(resetMon);
  const b = new Battle(G.team, e.team, UI, { enemyName: e.name, aiLevel: e.aiLevel, field: e.field });
  window.__battle = b;
  let winner;
  try { winner = await b.start(); } catch(error) { console.error(error);ValgaUI.error(error);return; }
  G.crits += b.stats.crits; G.chaos += b.stats.chaos; G.ults += b.stats.ults;
  if (winner === 0) {
    Sound.stopBgm(); Sound.fanfare();
    await UI.log(`${e.name}との 勝負に 勝った！`);
    await Scene.finishBattle(true,`${e.name}を退けた`);
    G.streak++; G.wins++;
    if (G.streak > G.best) { G.best = G.streak; store.set('best', G.best); }
    updateChips();
    swapScreen();
  } else {
    Sound.stopBgm(); Sound.lose();
    await UI.log('手持ちの 魔獣が 全て 倒れた……');
    await Scene.finishBattle(false);
    overScreen();
  }
}

// ---------- 交換 ----------
function swapScreen() {
  show('scr-swap'); Sound.bgm('victory');
  const e = G.enemy;
  const roundClear = G.battleNo === 7;
  $('swapMsg').textContent = roundClear ? `第${G.round}周を突破。${G.streak}連勝。次の周では敵がさらに強くなる。` : `${G.streak}連勝。次は第${G.battleNo + 1}戦。`;
  let ti = -1, mi = -1;
  const th = $('swapTheirs'), mine = $('swapMine'); th.innerHTML = ''; mine.innerHTML = '';
  const refresh = () => {
    [...th.children].forEach((c, i) => setStamp(c, i === ti ? '得' : null));
    [...mine.children].forEach((c, i) => setStamp(c, i === mi ? '離' : null));
    $('btnSwap').disabled = ti < 0 || mi < 0;
    const headings=[th.parentElement.querySelector('h3'),mine.parentElement.querySelector('h3')];
    headings.forEach((h,i)=>{let label=h.querySelector('.trade-picked');if(!label){label=el('span','trade-picked');label.setAttribute('aria-live','polite');h.appendChild(label)}label.textContent=i===0?(ti<0?'迎える一体を選択':offers[ti].name):(mi<0?'手放す一体を選択':G.team[mi].name)});
    $('btnSwap').textContent=ti>=0&&mi>=0?'この二体を交換':'二体を選んで交換';
  };
  const offers = e.team.map(m => makeMon(m.beast, { mult: 1, nature: m.nature, item: m.item, mutant: m.mutant }));
  offers.forEach((m, i) => { const c = monCard(m); c.onclick = () => { Sound.click(); ti = ti === i ? -1 : i; refresh(); }; th.appendChild(c); });
  G.team.forEach((m, i) => { resetMon(m); const c = monCard(m); c.onclick = () => { Sound.click(); mi = mi === i ? -1 : i; refresh(); }; mine.appendChild(c); });
  refresh();
  const next = () => {
    if (roundClear) { G.round++; G.battleNo = 1; rentalScreen(true); }
    else { G.battleNo++; preScreen(); }
  };
  $('btnSwap').onclick = () => { Sound.select(); G.team[mi] = offers[ti]; next(); };
  $('btnNoSwap').onclick = () => { Sound.click(); next(); };
}

function overScreen() {
  show('scr-over');
  $('overNum').textContent = G.streak;
  $('overTitle').textContent = G.streak >= 21 ? '伝説の終焉' : '敗北';
  $('overStats').innerHTML = `最高記録 ${G.best}連勝 ／ 第${G.round}周 ${G.battleNo}戦目で敗退<br>綻び ${G.crits}回 ・ 混沌 ${G.chaos}回 ・ 奥義 ${G.ults}回`;
}

function newRun() {
  Object.assign(G, { streak: 0, battleNo: 1, round: 1, team: [], wins: 0, crits: 0, chaos: 0, ults: 0 });
  updateChips(); rentalScreen(false);
}

// ---------- 画像の取り込み ----------
let impReturn = null;
const isImgFile = f => (f.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(f.name);
function toast(t) { const e = el('div', 'toast', t); document.body.appendChild(e); setTimeout(() => e.remove(), 2600); }
function importScreen() {
  const cur = [...document.querySelectorAll('.screen')].find(s => !s.hidden);
  if (cur && cur.id !== 'scr-import') impReturn = cur.id;
  if (impReturn === 'scr-battle') { toast('戦闘中は取り込めない。戦闘の後で開いてほしい。'); return; }
  show('scr-import'); renderGallery(); $('impPending').innerHTML = '';
}
function renderGallery() {
  const g = $('impGal'); g.innerHTML = '';
  let n = 0;
  ALL_BEASTS.forEach(b => {
    const has = Assets.hasImage(b.id); if (has) n++;
    const t = el('button', 'gi' + (has ? ' has' : '')); t.type = 'button';
    t.appendChild(Assets.portrait(b, 110, 90));
    t.appendChild(el('div', '', b.n));
    t.appendChild(el('div', 'st', has ? (Assets.userIds.has(b.id) ? '登録済み（押すと外す）' : '登録済み（同梱）') : '未登録'));
    t.onclick = async () => {
      if (Assets.userIds.has(b.id)) { await Assets.removeImage(b.id); toast(`${b.n}の画像を外した`); renderGallery(); return; }
      const inp = el('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => inp.files[0] && assignFiles([[inp.files[0], b.id]]);
      inp.click();
    };
    t.ondragover = e => { e.preventDefault(); e.stopPropagation(); t.classList.add('over'); };
    t.ondragleave = () => t.classList.remove('over');
    t.ondrop = e => { e.preventDefault(); e.stopPropagation(); t.classList.remove('over'); const f = [...e.dataTransfer.files].find(isImgFile); if (f) assignFiles([[f, b.id]]); };
    g.appendChild(t);
  });
  $('impCount').textContent = `${n} / ${ALL_BEASTS.length} 体に画像あり`;
}
async function assignFiles(pairs) {
  let ok = 0, white = 0;
  for (const [f, id] of pairs) { const r = await Assets.processFile(f); if (!r) continue; await Assets.saveImage(id, r.blob); ok++; if (r.whiteBg) white++; }
  renderGallery();
  toast(`${ok}枚を登録した${white ? `（うち${white}枚は白背景を自動で透過）` : ''}`);
}
async function importFiles(files) {
  files = [...files].filter(isImgFile).filter(f => !/(^|\/)(fx|bg)\//.test(f.webkitRelativePath || ''));
  if (!files.length) return;
  if ($('scr-import').hidden) importScreen();
  const auto = [], manual = [];
  files.forEach(f => { const b = Assets.guessBeast(f.name); (b ? auto : manual).push([f, b && b.id]); });
  if (auto.length) await assignFiles(auto);
  const box = $('impPending'); box.innerHTML = '';
  if (!manual.length) return;
  box.appendChild(el('div', 'head', `<h2 style="font-size:17px">割り当てが必要な画像（${manual.length}枚）</h2><p>ファイル名から判別できなかった。どの魔獣か選ぶと即登録される。</p>`));
  const grid = el('div', 'pend'); box.appendChild(grid);
  manual.forEach(([f]) => {
    const it = el('div', 'pi');
    const img = el('img'); img.src = URL.createObjectURL(f); img.alt = f.name; it.appendChild(img);
    it.appendChild(el('div', 'fn', f.name));
    const sel = el('select');
    sel.innerHTML = '<option value="">どの魔獣？</option>' + ALL_BEASTS.map(b => `<option value="${b.id}">${Assets.hasImage(b.id) ? '✓ ' : ''}${b.n}（${b.types.map(t => TYPES[t].n).join('・')}）</option>`).join('');
    sel.onchange = async () => { if (!sel.value) return; sel.disabled = true; await assignFiles([[f, sel.value]]); it.classList.add('ok'); };
    it.appendChild(sel); grid.appendChild(it);
  });
}
$('btnImport').onclick = () => { Sound.click(); importScreen(); };
$('impPick').onclick = () => $('impFile').click();
$('impDir').onclick = () => $('impDirIn').click();
$('impDirIn').onchange = () => { importFiles($('impDirIn').files); $('impDirIn').value = ''; };
$('impFile').onchange = () => { importFiles($('impFile').files); $('impFile').value = ''; };
$('impDone').onclick = () => {
  Sound.click();
  const back = impReturn || 'scr-title';
  if (back === 'scr-title') titleScreen();
  else if (back === 'scr-pre') { show('scr-pre'); const pc = $('preCards'); if (pc) { pc.innerHTML = ''; G.team.forEach(m => { const c = monCard(m); c.style.cursor = 'default'; pc.appendChild(c); }); } }
  else show(back);
};
// 画面のどこにドロップしても取り込む
let dragDepth = 0, dropEl = null;
document.addEventListener('dragenter', e => { if (![...(e.dataTransfer.types || [])].includes('Files')) return; e.preventDefault(); dragDepth++; if (!dropEl) { dropEl = el('div', 'dropall', '離すと画像を取り込む'); document.body.appendChild(dropEl); } });
document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth && dropEl) { dropEl.remove(); dropEl = null; } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; if (dropEl) { dropEl.remove(); dropEl = null; } if (!$('scr-battle').hidden) { toast('戦闘中は取り込めない'); return; } importFiles(e.dataTransfer.files); });

// ---------- 起動 ----------
$('btnStart').onclick = () => { Sound.init(); Sound.select(); newRun(); };
$('btnRetry').onclick = () => { Sound.select(); newRun(); };
$('btnTitle').onclick = () => { Sound.click(); titleScreen(); Sound.bgm('title'); };
$('btnMute').onclick = () => { Sound.init(); const m = Sound.toggleMute(); $('btnMute').textContent = m ? '音 OFF' : '音 ON'; };
$('btnSpeed').onclick = () => { G.speed = G.speed >= 3 ? 1 : G.speed + 1; Scene.S.speed = G.speed; $('btnSpeed').textContent = `速度 ×${G.speed}`; store.set('speed', G.speed); };
G.speed = [1,2,3].includes(store.get('speed',1))?store.get('speed',1):1; Scene.S.speed = G.speed; $('btnSpeed').textContent = `速度 ×${G.speed}`;
document.addEventListener('pointerdown', () => { Sound.init(); if (!$('scr-title').hidden) Sound.bgm('title'); }, { once: true });
(async () => {
  await Promise.all([Assets.loadAll(p => $('loadBar').style.setProperty('--p', Math.round(p * 100) + '%')), document.fonts ? document.fonts.ready : null]);
  $('loading').hidden = true;
  titleScreen();
})();

