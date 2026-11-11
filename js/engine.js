// ===== 封札連鎖バトルエンジン =====
'use strict';

const R = Math.random;
const rint = (a, b) => a + Math.floor(R() * (b - a + 1));
const pick = arr => arr[Math.floor(R() * arr.length)];
const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeMon(beast, opt = {}) {
  const nat = opt.nature || pick(NATURES);
  const mutant = opt.mutant !== undefined ? opt.mutant : (R() < 0.06 ? rint(60, 300) : 0);
  const mult = (opt.mult || 1) * (mutant ? 1.08 : 1);
  const st = {};
  ['hp', 'atk', 'def', 'mag', 'res', 'spd'].forEach((k, i) => {
    let v = k === 'hp' ? (beast.b[0] + 75) : (beast.b[i] + 20);
    if (nat.up === k) v *= 1.1; if (nat.dn === k) v *= 0.9;
    st[k] = Math.floor(v * mult);
  });
  return {
    uid: Math.random().toString(36).slice(2), beast, id: beast.id, name: beast.n, types: beast.types.slice(), ability: beast.ab,
    nature: nat, mutant, mult, st, maxhp: st.hp, hp: st.hp,
    moves: beast.moves.map(id => MOVES[id]), plus: {}, // 札ごとの強化段階
    ult: Object.assign({ id: 'ult', ac: 0, isUlt: true }, beast.ult),
  };
}

// 戦闘中のユニット状態を付与
function prepUnit(m, id, side, boss) {
  Object.assign(m, {
    unit: id, side, alive: m.hp > 0, sealed: false, block: 0, charge: 0, status: null, statusTurns: 0, curseN: 0,
    weak: [], resist: [], revealed: new Set(), sealMax: side === 'e' ? (boss ? 5 : 3) : 0, seal: 0, broken: 0, intent: null, stunned: 0, taunt: 0,
  });
  m.seal = m.sealMax;
  if (side === 'e') {
    for (const t of Object.keys(TYPES)) { const e = typeEff(t, m.types); if (e >= 2) m.weak.push(t); else if (e <= 0.5) m.resist.push(t); }
    if (!m.weak.length) m.weak.push(pick(RING));
  }
  return m;
}

class Battle {
  constructor(team, enemies, ui, opt = {}) {
    this.ui = ui;
    this.relics = opt.relics || {};
    this.P = team.map((m, i) => prepUnit(m, 'p' + i, 'p'));
    this.E = enemies.map((m, i) => prepUnit(m, 'e' + i, 'e', opt.boss && i === enemies.length - 1));
    if (this.relics.eye) this.E.forEach(e => e.weak.forEach(w => e.revealed.add(w)));
    this.aiLevel = opt.aiLevel || 1;
    this.enemyMul = opt.enemyMul || 0.62;
    this.field = opt.field || 'none'; this.fieldTurns = 0;
    this.turn = 0; this.over = false; this.result = null;
    this.energy = 0; this.maxEnergy = 3;
    this.chain = 0; this.lastEl = null; this.chainBest = 0;
    this.gauge = this.relics.stone ? 40 : 0;
    this.hazard = 0;
    this.stats = { breaks: 0, seals: 0, chaos: 0, ults: 0, lost: 0, maxHit: 0, gambleKill: false, wipe: false };
    // 山札
    this.deck = []; this.hand = []; this.discard = [];
    for (const m of this.P) m.moves.forEach(mv => this.deck.push({ uid: Math.random().toString(36).slice(2), move: mv, owner: m.unit }));
    this.deck.push({ uid: 's1', move: SEAL_CARD, owner: null }, { uid: 's2', move: SEAL_CARD, owner: null });
    this.deck = shuffle(this.deck);
    this.busy = false;
  }
  unit(id) { return this.P.concat(this.E).find(u => u.unit === id); }
  liveP() { return this.P.filter(u => u.alive); }
  liveE() { return this.E.filter(u => u.alive); }
  say(t, ms) { return this.ui.caption(t, ms); }
  ownerOf(card) { return card.owner ? this.unit(card.owner) : null; }
  cost(card) { return cardCost(card.move); }
  playable(card) {
    if (this.busy || this.over || this.cost(card) > this.energy) return false;
    const o = this.ownerOf(card);
    if (card.move.seal) return true;
    if (!o || !o.alive) return false;
    if (o.status === 'frz' || o.status === 'slp') return false;
    return true;
  }
  // 連鎖の見込み
  chainPreview(card) {
    const t = card.move.t;
    if (card.move.seal) return { step: 0, keep: true };
    if (!this.lastEl) return { step: 1, start: true };
    if (this.lastEl === 'bridge') return { step: t === 'dark' ? 2 : 1, dark: t === 'dark', wild: t === 'holy' };
    if (t === 'holy') return { step: 1, wild: true };
    if (t === 'dark') return { step: 2, dark: true };
    if (t === this.lastEl) return { step: 0, keep: true };
    if (RING.includes(this.lastEl) && t === ringNext(this.lastEl)) return { step: 1 };
    return { step: 1, reset: true };
  }
  chainMult() { return 1 + 0.25 * Math.max(0, this.chain - 1); }

  // ---------- 開始 ----------
  async start() {
    Scene.setupBattle(this);
    Scene.setField(this.field, 0);
    for (const e of this.E) { Scene.setUnit(e.unit, e); }
    for (const p of this.P) { Scene.setUnit(p.unit, p); }
    await Promise.all(this.E.map((e, i) => Scene.wait(i * 160).then(() => Scene.summon(e.unit, true))));
    await Promise.all(this.P.filter(p => p.alive).map((p, i) => Scene.wait(i * 160).then(() => Scene.summon(p.unit, true))));
    if (this.field !== 'none') await this.say(`異変「${FIELDS[this.field].n}」── ${FIELDS[this.field].d}`, 1200);
    const fast = this.liveP().reduce((a, u) => a + u.st.spd, 0) >= this.liveE().reduce((a, u) => a + u.st.spd, 0);
    this.planIntents();
    let first = true;
    while (!this.over) {
      await this.playerTurn(first && fast, first);
      first = false;
      if (this.over) break;
      await this.enemyTurn();
      if (this.over) break;
      await this.endRound();
    }
    return this.result;
  }
  checkOver() {
    if (this.over) return true;
    if (!this.liveE().length) { this.over = true; this.result = 'win'; }
    else if (!this.liveP().length) { this.over = true; this.result = 'lose'; }
    return this.over;
  }

  // ---------- プレイヤーのターン ----------
  draw(n) {
    for (let i = 0; i < n; i++) {
      if (!this.deck.length) { this.deck = shuffle(this.discard); this.discard = []; }
      // 倒れた獣の札は捨てる
      while (this.deck.length) { const c = this.deck.pop(); const o = this.ownerOf(c); if (c.move.seal || (o && o.alive)) { this.hand.push(c); break; } }
      if (!this.deck.length && !this.discard.length) break;
    }
  }
  async playerTurn(fastBonus, first) {
    this.turn++;
    this.energy = this.maxEnergy + (first && this.relics.ember ? 1 : 0) + (fastBonus ? 1 : 0);
    this.chain = 0; this.lastEl = null;
    if (this.relics.belt) this.liveP().forEach(u => { u.block += 8; });
    this.draw((this.relics.finger ? 6 : 5) - this.hand.length);
    Scene.turnBanner(`第${this.turn}巡`, fastBonus ? '先手：魂火+1' : '');
    this.ui.refresh(this);
    await this.ui.waitEndTurn(this);
    // 手札を捨てる
    this.discard.push(...this.hand); this.hand = [];
    if (this.chain >= 2) Scene.chainEnd(this.chain);
    this.ui.refresh(this);
    // 魔針
    if (this.hazard) for (const e of this.liveE()) { await this.hurt(e, Math.ceil(e.maxhp * 0.05 * this.hazard), { indirect: 1, label: '魔針' }); }
    this.checkOver();
  }

  // 札を使う（UIから呼ばれる）
  async playCard(cardUid, targetId) {
    const ci = this.hand.findIndex(c => c.uid === cardUid);
    if (ci < 0) return false;
    const card = this.hand[ci];
    if (!this.playable(card)) return false;
    let target = this.unit(targetId);
    if (!target || !target.alive || target.side !== 'e') target = this.liveE()[0];
    this.busy = true;
    this.hand.splice(ci, 1); this.discard.push(card);
    this.energy -= this.cost(card);
    const mv = card.move, user = this.ownerOf(card);
    // 連鎖
    const cp = this.chainPreview(card);
    if (!mv.seal) {
      if (cp.reset || cp.start) this.chain = 1; else this.chain += cp.step;
      const prev = this.lastEl;
      if (mv.t === 'holy') this.lastEl = prev && RING.includes(prev) && !cp.reset && !cp.start ? ringNext(prev) : 'bridge';
      else if (mv.t === 'dark') this.lastEl = 'bridge';
      else this.lastEl = mv.t;
      if (cp.dark && !this.relics.blood) await this.hurt(user, Math.ceil(user.maxhp * 0.08), { indirect: 1, label: '冥の代償' });
      this.chainBest = Math.max(this.chainBest, this.chain);
      if (this.chain >= 2) { Scene.chainPop(this.chain, mv.t); this.gainGauge(6 * Math.min(this.chain, 6)); }
      const refundAt = this.relics.bell ? 2 : 3;
      if (this.chain >= refundAt && (cp.step > 0) && (this.chain - refundAt) % 2 === 0) { this.energy++; Scene.energyPop(); }
      if (this.chain === 5 || this.chain === 8) { this.draw(1); }
    }
    this.ui.refresh(this);
    if (mv.seal) await this.trySeal(target);
    else await this.useMove(user, mv, target, card);
    this.busy = false;
    this.checkOver();
    this.ui.refresh(this);
    return true;
  }

  async trySeal(t) {
    const th = (t.broken ? 0.6 : 0.35) + (this.relics.brush ? 0.15 : 0);
    await Scene.throwSeal(t.unit);
    if (t.hp / t.maxhp <= th) {
      t.alive = false; t.sealed = true; t.hp = 0;
      await Scene.sealUnit(t.unit);
      this.stats.seals++;
      this.energy++; this.gainGauge(25);
      await this.say(`${t.name}を 封印した！ 魂火+1`, 900);
    } else {
      await Scene.sealFail(t.unit);
      await this.say(`${t.name}は まだ抗っている…（HP${Math.round(th * 100)}%以下で封印できる）`, 1100);
    }
  }

  gainGauge(v) {
    const before = this.gauge; this.gauge = clamp(this.gauge + v, 0, 100);
    if (before < 100 && this.gauge >= 100) Scene.gaugeFull();
  }

  // ---------- 技の実行（敵味方共通） ----------
  async useMove(user, mv, target, card) {
    if (!user || !user.alive) return;
    const plus = card && user.plus ? (user.plus[mv.id] || 0) : 0;
    const foes = user.side === 'p' ? this.liveE() : this.liveP();
    const allies = user.side === 'p' ? this.liveP() : this.liveE();
    if (!target || !target.alive) target = foes[0];
    Scene.caption(`${user.name}の ${mv.n}`);
    // 変化技
    if (mv.c === 's') {
      await Scene.cast(user.unit, mv, target ? target.unit : null);
      if (mv.protect) { for (const a of allies) a.block += 25 + plus * 10; await Scene.blockFx(allies.map(a => a.unit)); }
      if (mv.heal) {
        const low = allies.slice().sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp)[0];
        await this.healUnit(low, mv.heal * 0.8 + plus * 0.1);
        if (mv.cure && low.status) { low.status = null; Scene.refresh(); }
      }
      if (mv.self) { user.charge = Math.min(3, user.charge + 1); await Scene.buffFx(user.unit, Object.keys(mv.self)[0]); }
      if (mv.field) { await this.setField(mv.field, 4); if (user.side === 'p') { this.draw(1); this.ui.refresh(this); } }
      if (mv.hazard) {
        if (user.side === 'p') { this.hazard = Math.min(3, this.hazard + 1); await Scene.spikes('e', this.hazard); }
        else { for (const a of this.liveP()) a.block = Math.max(0, a.block - 15); await Scene.spikes('p', 1); }
      }
      if (mv.haze) {
        for (const a of allies) a.status = null;
        for (const f of foes) f.charge = 0;
        await Scene.hazeFx();
      }
      if (mv.roar && target) { target.stunned = 1; await Scene.statusFx(target.unit, 'stun'); await this.say(`${target.name}は 怯んで動けない！`, 700); }
      if (mv.st && target) {
        if (R() * 100 < (mv.ac || 100)) await this.inflict(target, mv.st[0]);
        else await Scene.miss(target.unit);
      }
      return;
    }
    // 攻撃技
    const isP = user.side === 'p';
    let hits = mv.hits ? rint(2, 5) : 1;
    let pw = mv.pw * (1 + plus * 0.25);
    if (mv.gamble) { pw = rint(1, 20) * 10; await this.say(`運命の天秤…… 威力${pw}！`, 700); }
    if (mv.chaos) return this.chaosCard(user, target);
    await Scene.attack(user.unit, mv, target.unit);
    // 命中
    if (mv.ac && !mv.ohko && R() * 100 >= mv.ac) { await Scene.miss(target.unit); return; }
    if (mv.ohko) {
      if (R() < 0.3 && !target.beast.legend) { await Scene.hitFx(target.unit, 2, true, mv.t); await this.hurt(target, target.hp, { attacker: user, label: '一撃必殺' }); }
      else await Scene.miss(target.unit);
      return;
    }
    let total = 0;
    for (let h = 0; h < hits; h++) {
      if (!target.alive) break;
      const r = this.calc(user, target, mv, pw);
      if (h > 0) await Scene.attack(user.unit, mv, target.unit, true);
      await Scene.hitFx(target.unit, r.effTag, r.crit, mv.t);
      const dealt = await this.hurt(target, r.dmg, { attacker: user, crit: r.crit, tag: r.effTag });
      total += dealt;
      // 刻印
      if (target.side === 'e' && r.weak) {
        const first = !target.revealed.has(mv.t);
        target.revealed.add(mv.t);
        if (first) Scene.revealWeak(target.unit, mv.t);
        await this.breakHit(target, 1 + (mv.pr ? 1 : 0));
      }
      if (target.status === 'slp') { target.status = null; }
      if (target.status === 'frz' && mv.t === 'fire') { target.status = null; }
    }
    if (isP && total) { this.gainGauge(Math.min(12, total / 20)); this.stats.maxHit = Math.max(this.stats.maxHit, total); }
    if (!isP && total) this.gainGauge(Math.min(10, total / 15));
    user.charge = 0;
    // 追加効果
    if (target.alive && mv.st && R() * 100 < mv.st[1]) await this.inflict(target, mv.st[0], true);
    if (target.alive && mv.cnf && R() * 100 < mv.cnf) await this.inflict(target, 'cnf', true);
    if (mv.drain && total) await this.healUnit(user, total * mv.drain / user.maxhp, true);
    if (mv.recoil && total) await this.hurt(user, Math.ceil(total * mv.recoil), { indirect: 1, label: '反動' });
    if (mv.selfko) await this.hurt(user, user.hp, { indirect: 1 });
    if (mv.pivot && isP) { this.draw(1); this.ui.refresh(this); }
    if (mv.self && user.alive && mv.self.spd === undefined && Object.values(mv.self).some(v => v < 0)) { /* 反動系の能力低下は札では無視 */ }
  }

  calc(user, target, mv, pw) {
    const phys = mv.c === 'p';
    let A = user.st[phys ? 'atk' : 'mag'], D = target.st[phys ? 'def' : 'res'];
    if (phys && user.status === 'brn') A *= 0.7;
    let dmg = pw * (A / D) * 0.5;
    if (user.types.includes(mv.t)) dmg *= 1.25;
    const e = typeEff(mv.t, target.types);
    let effTag = 1, weak = false;
    if (e >= 2) { dmg *= e >= 4 ? 1.9 : 1.5; effTag = e >= 4 ? 4 : 2; weak = true; }
    else if (e <= 0.5) { dmg *= 0.6; effTag = 0.5; }
    const fb = FIELD_BOOST[this.field];
    if (fb) { if (fb[0] === mv.t) dmg *= fb[1]; if (fb[2] === mv.t) dmg *= fb[3]; }
    if (this.field === 'bloodmoon') dmg *= 1.1;
    if (user.side === 'p') dmg *= this.chainMult();
    else dmg *= this.enemyMul;
    if (user.charge) dmg *= Math.pow(1.6, user.charge);
    if (target.broken) dmg *= 1.5;
    let critRate = 0.06 + (mv.crit ? 0.12 * mv.crit : 0) + (this.field === 'bloodmoon' ? 0.25 : 0) + (user.side === 'p' && this.relics.hawk ? 0.12 : 0);
    const crit = R() < critRate;
    if (crit) dmg *= (user.side === 'p' && this.relics.moon) ? 2 : 1.5;
    const [lo, hi] = this.field === 'chaos' ? [0.5, 1.5] : [0.86, 1.14];
    dmg *= lo + R() * (hi - lo);
    if (mv.isUlt) dmg *= 1.0;
    return { dmg: Math.max(1, Math.round(dmg)), crit, effTag, weak };
  }

  async breakHit(t, n) {
    if (!t.alive || t.broken) return;
    t.seal = Math.max(0, t.seal - n);
    Scene.refresh();
    if (t.seal === 0) {
      t.broken = 2; t.intent = null; this.stats.breaks++;
      await Scene.breakFx(t.unit);
      this.gainGauge(15);
      await this.say(`崩封！ ${t.name}の封が解けた。次の行動を止め、被ダメージ1.5倍`, 900);
    }
  }

  async hurt(u, dmg, o = {}) {
    if (!u.alive || dmg <= 0) return 0;
    let d = Math.round(dmg);
    if (u.block > 0 && !o.indirect) { const b = Math.min(u.block, d); u.block -= b; d -= b; if (b) Scene.blockHit(u.unit, b); }
    d = Math.min(d, u.hp);
    u.hp -= d;
    if (d > 0) Scene.dmgNum(u.unit, d, o.crit, o.tag, o.label);
    if (u.side === 'p' && d > 0) this.gainGauge(Math.min(8, d / 12));
    Scene.refresh();
    if (u.hp <= 0) await this.ko(u, o.attacker);
    return d;
  }
  async healUnit(u, frac, quiet) {
    if (!u || !u.alive) return;
    const v = Math.min(u.maxhp - u.hp, Math.max(1, Math.round(u.maxhp * frac)));
    u.hp += v; await Scene.healFx(u.unit, v); Scene.refresh();
  }
  async ko(u, attacker) {
    u.alive = false; u.hp = 0; u.intent = null;
    await Scene.faint(u.unit);
    if (u.side === 'p') { this.stats.lost++; this.hand = this.hand.filter(c => c.owner !== u.unit); this.ui.refresh(this); }
    if (u.side === 'e' && attacker && attacker.side === 'p' && this._gambleNow) this.stats.gambleKill = true;
    this.checkOver();
  }
  async inflict(u, st, quiet) {
    if (!u.alive) return false;
    if (st === 'cnf') { u.confused = 2; await Scene.statusFx(u.unit, 'cnf'); return true; }
    if (u.status) return false;
    if (st === 'brn' && u.types.includes('fire')) return false;
    if (st === 'frz' && (u.types.includes('ice') || this.field === 'sun')) return false;
    if (st === 'par' && u.types.includes('thunder')) return false;
    if (st === 'psn' && u.types.includes('steel')) return false;
    if (st === 'crs' && u.types.includes('holy')) return false;
    u.status = st; u.curseN = 0;
    u.statusTurns = st === 'slp' ? rint(1, 2) : st === 'frz' ? 2 : 0;
    await Scene.statusFx(u.unit, st);
    if (u.side === 'p' && (st === 'frz' || st === 'slp')) this.ui.refresh(this);
    return true;
  }
  async setField(f, turns = 4) {
    if (this.field === f) return;
    this.field = f; this.fieldTurns = turns;
    Scene.setField(f, turns);
    await Scene.fieldChange(f);
  }

  // ---------- 奥義 ----------
  canUlt(id) { const u = this.unit(id); return !this.busy && !this.over && this.gauge >= 100 && u && u.alive && u.side === 'p'; }
  async useUlt(id) {
    if (!this.canUlt(id)) return;
    this.busy = true; this.gauge = 0; this.stats.ults++;
    const u = this.unit(id), mv = u.ult;
    this.ui.refresh(this);
    await Scene.cutin(u.unit, mv);
    const before = this.liveE().length;
    await Scene.ultAttack(u.unit, mv, this.liveE().map(e => e.unit));
    for (const e of this.liveE()) {
      if (mv.chaosUlt) { await this.chaosCard(u, e, 1.6); continue; }
      const r = this.calc(u, e, mv, mv.pw);
      await Scene.hitFx(e.unit, r.effTag, true, mv.t, true);
      await this.hurt(e, Math.round(r.dmg * 1.15), { attacker: u, crit: true, tag: r.effTag });
      if (e.alive) await this.breakHit(e, 2);
      if (e.alive && mv.st && R() * 100 < mv.st[1]) await this.inflict(e, mv.st[0], true);
    }
    if (mv.healUser) await this.healUnit(u, mv.healUser);
    if (mv.healTeam) for (const a of this.liveP()) await this.healUnit(a, mv.healTeam, true);
    if (before - this.liveE().length >= 2) this.stats.wipe = true;
    this.busy = false; this.checkOver(); this.ui.refresh(this);
  }

  // ---------- 混沌の賽 ----------
  async chaosCard(user, target, power = 1) {
    this._gambleNow = true;
    await Scene.chaosFx(user.unit);
    const roll = rint(1, 8);
    const foes = user.side === 'p' ? this.liveE() : this.liveP();
    switch (roll) {
      case 1: case 2: { const t = pick(Object.keys(TYPES)); await this.say(`賽の目「${TYPES[t].n}」大当たり！`, 700); const mv = { t, c: user.st.mag >= user.st.atk ? 'm' : 'p', pw: 150 * power, fx: 'nova' }; await Scene.attack(user.unit, mv, target.unit); const r = this.calc(user, target, mv, mv.pw); await Scene.hitFx(target.unit, r.effTag, r.crit, t); await this.hurt(target, r.dmg, { attacker: user, crit: r.crit, tag: r.effTag }); break; }
      case 3: await this.say('賽の目「癒」', 600); for (const a of (user.side === 'p' ? this.liveP() : this.liveE())) await this.healUnit(a, 0.25 * power, true); break;
      case 4: await this.say('賽の目「災」…… 裏目に出た', 700); await this.hurt(user, Math.ceil(user.maxhp * 0.2), { indirect: 1 }); break;
      case 5: { const st = pick(['brn', 'par', 'psn', 'crs', 'slp', 'frz']); await this.say(`賽の目「${STATUS_N[st]}」`, 600); for (const f of foes) await this.inflict(f, st, true); break; }
      case 6: await this.say('賽の目「崩」！ 敵全員の封が揺らぐ', 700); for (const f of foes) if (f.side === 'e') await this.breakHit(f, 2); break;
      case 7: { await this.say('賽の目「変」── 世界が揺らぐ', 700); await this.setField(pick(Object.keys(FIELDS).filter(k => k !== this.field)), 4); break; }
      default: {
        await this.say('賽の目「逆」── 体力の割合が入れ替わる！', 900);
        const r1 = user.hp / user.maxhp, r2 = target.hp / target.maxhp;
        user.hp = Math.max(1, Math.round(r2 * user.maxhp)); target.hp = Math.max(1, Math.round(r1 * target.maxhp));
        Scene.flash('#ff40c0', 0.5); Scene.refresh();
      }
    }
    this._gambleNow = false;
  }

  // ---------- 敵のターン ----------
  planIntents() {
    for (const e of this.liveE()) {
      if (e.broken || e.stunned) { e.intent = null; continue; }
      const allies = this.liveE(), players = this.liveP();
      const opts = e.moves.map(mv => {
        let sc;
        if (mv.c !== 's') sc = (mv.ohko ? 30 : mv.pw || 70) * (mv.ac ? mv.ac / 100 : 1);
        else if (mv.heal) sc = allies.some(a => a.hp / a.maxhp < 0.5) ? 120 : 0;
        else if (mv.self) sc = e.charge < 2 ? 55 : 0;
        else if (mv.protect) sc = 35;
        else if (mv.st) sc = players.some(p => !p.status) ? 60 : 0;
        else if (mv.field) sc = this.field === mv.field ? 0 : 35;
        else if (mv.hazard) sc = 30; else sc = 20;
        return { mv, sc: sc * (0.6 + R() * 0.8) };
      }).sort((a, b) => b.sc - a.sc);
      const mv = opts[0].mv;
      let target = null;
      const taunt = players.find(p => p.taunt);
      if (mv.c !== 's' || mv.st || mv.roar) {
        target = taunt || (this.aiLevel >= 2 ? players.slice().sort((a, b) => a.hp - b.hp)[0] : pick(players));
        if (mv.st && target.status) target = players.find(p => !p.status) || target;
      }
      let est = 0;
      if (target && mv.c !== 's' && !mv.chaos && !mv.ohko) { const r = this.calc(e, target, mv, mv.gamble ? 100 : mv.pw); est = Math.round(r.dmg * (mv.hits ? 3 : 1) / (r.crit ? 1.5 : 1)); }
      e.intent = { mv, target: target ? target.unit : null, est };
    }
    Scene.refresh();
  }
  async enemyTurn() {
    // 守りは敵の行動の間だけ有効
    for (const e of this.liveE()) {
      if (this.over) return;
      if (!e.alive) continue;
      if (e.broken) { continue; }
      if (e.stunned) { e.stunned = 0; await this.say(`${e.name}は 動けない`, 500); continue; }
      if (e.status === 'frz') { if (--e.statusTurns <= 0 || R() < 0.3) { e.status = null; await this.say(`${e.name}の 氷が解けた`, 500); } else { await Scene.statusFx(e.unit, 'frz'); continue; } }
      if (e.status === 'slp') { if (--e.statusTurns < 0) { e.status = null; } else { await this.say(`${e.name}は 眠っている`, 500); continue; } }
      if (e.status === 'par' && R() < 0.4) { await Scene.statusFx(e.unit, 'par'); await this.say(`${e.name}は 痺れて動けない`, 500); continue; }
      const it = e.intent; if (!it) continue;
      let target = it.target ? this.unit(it.target) : null;
      if (target && !target.alive) target = this.liveP()[0];
      if (e.confused && R() < 0.4) { e.confused--; const ally = pick(this.liveE()); await this.say(`${e.name}は 混乱して味方を襲った！`, 600); target = ally; }
      else if (e.confused) e.confused--;
      await this.useMove(e, it.mv, target);
      if (this.checkOver()) return;
    }
  }
  async endRound() {
    // 崩封の回復
    for (const e of this.liveE()) if (e.broken) { e.broken--; if (!e.broken) { e.seal = e.sealMax; Scene.refresh(); } }
    for (const p of this.liveP()) { p.block = 0; p.taunt = 0; }
    // 状態異常・異変
    const F = this.field;
    for (const u of this.liveP().concat(this.liveE())) {
      if (!u.alive) continue;
      if (u.status === 'brn') await this.hurt(u, Math.ceil(u.maxhp * 0.06), { indirect: 1, label: '火傷' });
      if (u.status === 'psn') await this.hurt(u, Math.ceil(u.maxhp * 0.09), { indirect: 1, label: '毒' });
      if (u.status === 'crs') { u.curseN++; await this.hurt(u, Math.ceil(u.maxhp * 0.04 * u.curseN), { indirect: 1, label: `呪詛${u.curseN}` }); }
      if (u.side === 'p' && u.status === 'frz' && --u.statusTurns <= 0) { u.status = null; }
      if (u.side === 'p' && u.status === 'slp' && --u.statusTurns < 0) { u.status = null; }
      if (u.side === 'p' && u.status === 'par' && R() < 0.3) u.status = null;
      if (!u.alive) continue;
      if (F === 'snow' && !u.types.includes('ice') && !u.types.includes('steel')) await this.hurt(u, Math.ceil(u.maxhp * 0.05), { indirect: 1, label: '吹雪' });
      if (F === 'storm' && R() < 0.2) { await Scene.lightning(u.unit); await this.hurt(u, Math.ceil(u.maxhp * 0.1), { indirect: 1, label: '落雷' }); }
      if (F === 'miasma' && !u.types.includes('dark') && R() < 0.12) await this.inflict(u, 'psn', true);
      if (F === 'sanct' && u.status && R() < 0.3) { u.status = null; Scene.refresh(); }
      if (F === 'grove' && u.alive) await this.healUnit(u, 0.06, true);
      if (this.checkOver()) return;
    }
    if (this.fieldTurns > 0 && --this.fieldTurns === 0) { this.field = 'none'; Scene.setField('none', 0); }
    else Scene.S.fieldTurns = this.fieldTurns;
    if (R() < 0.07) { await this.say('…… 空気が変わった', 600); await this.setField(pick(Object.keys(FIELDS).filter(k => k !== this.field && k !== 'none')), 4); }
    const rate = (this.field === 'chaos' ? 0.2 : 0.08) * (this.relics.dice ? 2 : 1);
    if (R() < rate) await this.chaosEvent();
    if (!this.checkOver()) this.planIntents();
  }
  async chaosEvent() {
    this.stats.chaos++;
    const favor = this.relics.dice ? R() < 0.7 : R() < 0.5;
    const pool = favor ? this.liveE() : this.liveP();
    const u = pick(pool.length ? pool : this.liveP().concat(this.liveE())); if (!u) return;
    const ev = rint(1, 5);
    Scene.chaosBanner(['', '隕石落下', '魔力の奔流', '精霊の気まぐれ', '観客の熱狂', '狂気の囁き'][ev]);
    switch (ev) {
      case 1: await Scene.meteor(u.unit); await this.hurt(u, Math.ceil(u.maxhp * 0.15), { indirect: 1, label: '隕石' }); break;
      case 2: { const t = favor ? pick(this.liveP()) : pick(this.liveE()); if (t) { t.charge = Math.min(3, t.charge + 1); await Scene.buffFx(t.unit, 'atk'); } break; }
      case 3: { const t = favor ? pick(this.liveP()) : pick(this.liveE()); if (t) await this.healUnit(t, 0.25); break; }
      case 4: this.gainGauge(favor ? 35 : 10); break;
      case 5: await this.inflict(u, 'cnf'); break;
    }
  }
}
