
// ===== バトルエンジン =====
'use strict';

const R = Math.random;
const rint = (a, b) => a + Math.floor(R() * (b - a + 1));
const pick = arr => arr[Math.floor(R() * arr.length)];
const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const STAGE_KEYS = ['atk', 'def', 'mag', 'res', 'spd'];

function makeMon(beast, opt = {}) {
  const nat = opt.nature || pick(NATURES);
  const mutant = opt.mutant !== undefined ? opt.mutant : (R() < 0.06 ? rint(60, 300) : 0);
  const mult = (opt.mult || 1) * (mutant ? 1.08 : 1);
  const b = beast.b;
  const st = {};
  ['hp', 'atk', 'def', 'mag', 'res', 'spd'].forEach((k, i) => {
    if (k === 'hp') st.hp = Math.floor((b[0] + 75) * mult);
    else { let v = (b[i] + 20) * mult; if (nat.up === k) v *= 1.1; if (nat.dn === k) v *= 0.9; st[k] = Math.floor(v); }
  });
  const m = {
    uid: Math.random().toString(36).slice(2), beast, id: beast.id, name: beast.n, types: beast.types.slice(), ability: beast.ab,
    item: opt.item || pick(Object.keys(ITEMS)), itemUsed: false, nature: nat, mutant,
    moves: beast.moves.map(id => MOVES[id]),
    ult: Object.assign({ id: 'ult', ac: 0, isUlt: true }, beast.ult),
    maxhp: st.hp, hp: st.hp, st, stages: { atk: 0, def: 0, mag: 0, res: 0, spd: 0 },
    status: null, statusTurns: 0, curseN: 0, vol: { cnf: 0, flinch: false, protect: false, protectChain: 0 },
    revealed: new Set(), abRevealed: false, itemRevealed: false, fainted: false, mult,
  };
  return m;
}
function resetMon(m) { m.hp = m.maxhp; m.status = null; m.statusTurns = 0; m.curseN = 0; m.fainted = false; m.itemUsed = false; m.stages = { atk: 0, def: 0, mag: 0, res: 0, spd: 0 }; m.vol = { cnf: 0, flinch: false, protect: false, protectChain: 0 }; }
const stageMul = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);

class Battle {
  constructor(playerTeam, enemyTeam, ui, opt = {}) {
    this.ui = ui;
    this.sides = [
      { idx: 0, name: opt.playerName || 'あなた', team: playerTeam, active: 0, gauge: 0, hazard: 0, isPlayer: true },
      { idx: 1, name: opt.enemyName || '敵', team: enemyTeam, active: 0, gauge: 0, hazard: 0, isPlayer: false },
    ];
    this.aiLevel = opt.aiLevel || 1;
    this.field = opt.field || 'none'; this.fieldTurns = 0;
    this.turn = 0; this.over = false; this.winner = -1;
    this.stats = { crits: 0, chaos: 0, ults: 0 };
  }
  act(si) { const s = this.sides[si]; return s.team[s.active]; }
  alive(si) { return this.sides[si].team.filter(m => m.hp > 0); }
  say(t) { return this.ui.log(t); }
  sideName(si) { return si === 0 ? '' : `${this.sides[1].name}の `; }
  mn(m) { return (this.sides[0].team.includes(m) ? '' : '相手の ') + m.name; }
  sideOf(m) { return this.sides[0].team.includes(m) ? 0 : 1; }

  // ---------- 能力値 ----------
  speed(m) {
    let s = m.st.spd * stageMul(m.stages.spd);
    if (m.status === 'par') s *= 0.5;
    if (m.item === 'feather' && !m.itemUsed) s *= 1.3;
    return s;
  }
  hasAb(m, ab) { return m.ability === ab; }
  async changeStage(m, changes, src = null) {
    const side = this.sideOf(m);
    let anyUp = false, anyDown = false, msgs = [];
    for (const k in changes) {
      let d = changes[k];
      if (this.hasAb(m, 'contrary')) d = -d;
      const before = m.stages[k];
      m.stages[k] = Math.max(-6, Math.min(6, before + d));
      const real = m.stages[k] - before;
      if (real > 0) { anyUp = true; msgs.push(`${this.mn(m)}の ${STAT_N[k]}が ${real >= 2 ? 'ぐーんと' : ''}上がった！`); }
      else if (real < 0) { anyDown = true; msgs.push(`${this.mn(m)}の ${STAT_N[k]}が ${real <= -2 ? 'がくっと' : ''}下がった！`); }
      else msgs.push(`${this.mn(m)}の ${STAT_N[k]}はもう変わらない！`);
    }
    if (this.hasAb(m, 'contrary') && (anyUp || anyDown)) { m.abRevealed = true; }
    if (anyUp) await Scene.stat(side, true);
    if (anyDown) await Scene.stat(side, false);
    for (const t of msgs) await this.say(t);
  }

  // ---------- 状態異常 ----------
  canStatus(m, st) {
    if (m.hp <= 0 || m.status) return false;
    if (st === 'brn' && m.types.includes('fire')) return false;
    if (st === 'frz' && m.types.includes('ice')) return false;
    if (st === 'par' && m.types.includes('thunder')) return false;
    if (st === 'psn' && m.types.includes('steel')) return false;
    if (st === 'crs' && m.types.includes('holy')) return false;
    if (st === 'frz' && this.field === 'sun') return false;
    return true;
  }
  async inflict(m, st, quiet = false) {
    if (!this.canStatus(m, st)) { if (!quiet) await this.say(`しかし ${this.mn(m)}には 効かなかった！`); return false; }
    m.status = st;
    if (st === 'slp') m.statusTurns = rint(1, 3);
    if (st === 'crs') m.curseN = 0;
    await Scene.status(this.sideOf(m), st);
    const msg = { brn: 'は 火傷を負った！', frz: 'は 凍りついた！', par: 'は 麻痺して 技が出にくくなった！', psn: 'は 毒に侵された！', crs: 'は 呪詛に蝕まれた！', slp: 'は 眠ってしまった！' }[st];
    await this.say(this.mn(m) + msg);
    if (this.hasAb(m, 'guts')) { m.abRevealed = true; await this.say(`${this.mn(m)}の 不屈の闘志が燃え上がる！`); }
    return true;
  }
  async confuse(m) {
    if (m.hp <= 0 || m.vol.cnf > 0) return;
    m.vol.cnf = rint(2, 4);
    await Scene.status(this.sideOf(m), 'cnf');
    await this.say(`${this.mn(m)}は 混乱した！`);
  }

  // ---------- 場 ----------
  async setField(f, turns = 5, quiet = false) {
    if (this.field === f) { if (!quiet) await this.say('しかし 場は既にその状態だ！'); return; }
    this.field = f; this.fieldTurns = turns;
    Scene.setField(f, turns);
    await Scene.fieldChange(f);
    await this.say(`場に異変「${FIELDS[f].n}」が起きた！ ${FIELDS[f].d}`);
  }

  // ---------- ダメージ計算 ----------
  calc(user, target, move, o = {}) {
    const factors=o.explain?[]:null;
    const note=(label,value,group='損傷')=>factors?.push({label,value,group});
    let pw = o.pw ?? move.pw;
    if (move.grudge && user.status) {pw *= 2;note('状態異常による術の増幅',2,'出力')}
    if (this.hasAb(user, 'technician') && pw <= 60) {pw *= 1.5;note(ABILITIES.technician.n,1.5,'出力')}
    if (this.hasAb(user, 'blaze') && user.hp <= user.maxhp / 3) {pw *= 1.5;note(ABILITIES.blaze.n,1.5,'出力')}
    const phys = move.c === 'p';
    let aS = phys ? 'atk' : 'mag', dS = phys ? 'def' : 'res';
    let as = user.stages[aS], ds = target.stages[dS];
    if (o.crit) { as = Math.max(0, as); ds = Math.min(0, ds); }
    let A = user.st[aS] * stageMul(as), D = target.st[dS] * stageMul(ds);
    if (phys && user.status === 'brn' && !this.hasAb(user, 'guts')) {A *= 0.5;note('火傷',.5,'攻撃能力')}
    if (phys && user.status && this.hasAb(user, 'guts')) {A *= 1.5;note(ABILITIES.guts.n,1.5,'攻撃能力')}
    let dmg = Math.floor(Math.floor(22 * pw * A / D) / 50) + 2;
    const base=dmg;
    const t = move.t;
    let mod = 1;
    if (t !== 'none' && user.types.includes(t)) {const v=this.hasAb(user, 'adapt') ? 1.35 : 1.15;mod *= v;note('自身と同じ刻印',v)}
    if (t === 'none' && user.types.includes('none')) {mod *= 1.15;note('自身と同じ刻印',1.15)}
    const eff = typeEff(t, target.types);
    mod *= eff;
    note('属性干渉',eff);
    const fb = FIELD_BOOST[this.field];
    if (fb) { if (fb[0] === t) {mod *= fb[1];note('異変「'+FIELDS[this.field].n+'」',fb[1])} if (fb[2] === t) {mod *= fb[3];note('異変「'+FIELDS[this.field].n+'」',fb[3])} }
    if (this.field === 'bloodmoon') {mod *= 1.1;note('異変「紅月」',1.1)}
    if (o.crit) {mod *= 1.5;note('綻び',1.5)}
    if (o.ult) mod *= 1.0;
    if (user.item === 'lifeorb') {mod *= 1.3;note('契約具「'+ITEMS.lifeorb.n+'」',1.3)}
    if (user.item === 'expert' && eff > 1) {mod *= 1.25;note('契約具「'+ITEMS.expert.n+'」',1.25)}
    if (this.hasAb(target, 'multiscale') && target.hp === target.maxhp) {mod *= 0.5;note('相手の'+ABILITIES.multiscale.n,.5)}
    if (this.hasAb(target, 'thickfat') && (t === 'fire' || t === 'ice')) {mod *= 0.5;note('相手の'+ABILITIES.thickfat.n,.5)}
    let rmin = 0.82, rmax = 1.12;
    if (this.field === 'chaos') { rmin = 0.5; rmax = 1.5; }
    if (this.hasAb(user, 'gambler') || this.hasAb(target, 'gambler')) { rmin = 0.4; rmax = 1.8; }
    const rr = o.est ? (o.roll ?? (rmin + rmax) / 2) : rmin + R() * (rmax - rmin);
    dmg = Math.max(1, Math.floor(dmg * mod * rr));
    if (eff === 0) dmg = 0;
    return { dmg, eff,...(factors?{explanation:{power:pw,attack:A,defense:D,attackKey:aS,defenseKey:dS,attackStage:as,defenseStage:ds,base,randomMin:rmin,randomMax:rmax,random:rr,factors,final:dmg}}:{}) };
  }
  critRoll(user, move) {
    let stage = (move.crit || 0) + (this.hasAb(user, 'lucky') ? 1 : 0) + (user.item === 'scope' ? 1 : 0) + (this.field === 'bloodmoon' ? 2 : 0);
    const ch = [1 / 16, 1 / 8, 1 / 2, 1][Math.min(3, stage)];
    return R() < ch;
  }

  async gainGauge(si, amt) {
    const s = this.sides[si]; const m = this.act(si);
    if (m && m.item === 'amulet') amt *= 1.5;
    const before = s.gauge; s.gauge = Math.min(100, s.gauge + amt);
    if (before < 100 && s.gauge >= 100) { Sound.gauge(); Scene.pop(si, '覚醒MAX!', '#ffe060', 26); }
  }

  // ダメージ適用（耐え判定込み）
  async applyDamage(target, dmg, o = {}) {
    if (dmg <= 0) return 0;
    const si = this.sideOf(target);
    let real = Math.min(target.hp, dmg);
    let endure = null;
    if (real >= target.hp) {
      if (target.hp === target.maxhp && this.hasAb(target, 'sturdy') && o.direct) endure = `${this.mn(target)}は 頑丈で 持ちこたえた！`;
      else if (target.hp === target.maxhp && target.item === 'sash' && !target.itemUsed && o.direct) { target.itemUsed = true; target.itemRevealed = true;Scene.itemPulse?.(si,'sash'); endure = `${this.mn(target)}は 守りの護符で 持ちこたえた！`; }
      else if (o.direct && target.hp > 1 && R() < 0.04) endure = `${this.mn(target)}は 執念で 踏みとどまった！！`;
      if (endure) real = target.hp - 1;
    }
    target.hp -= real;
    Scene.damageApplied?.(si,real);
    if (o.num !== false) Scene.dmgNum(si, real, o.crit ? '#ffe060' : '#ffffff');
    if (endure) await this.say(endure);
    if (o.direct) await this.gainGauge(si, real / target.maxhp * 55);
    // 紅き果実
    if (target.hp > 0 && target.hp <= target.maxhp / 4 && target.item === 'berry' && !target.itemUsed) {
      target.itemUsed = true; target.itemRevealed = true;
      Scene.itemPulse?.(si,'berry');
      await this.say(`${this.mn(target)}は 紅き果実を 食べた！`);
      await this.heal(target, 0.5);
    }
    return real;
  }
  async heal(m, frac, quiet = false) {
    if (m.hp <= 0 || m.hp >= m.maxhp) { if (!quiet) await this.say(`${this.mn(m)}の HPは 満タンだ！`); return 0; }
    const v = Math.min(m.maxhp - m.hp, Math.max(1, Math.floor(m.maxhp * frac)));
    m.hp += v; await Scene.heal(this.sideOf(m));
    if (!quiet) await this.say(`${this.mn(m)}の HPが 回復した！`);
    return v;
  }
  async indirect(m, frac, msg) { // 技以外のダメージ
    if (m.hp <= 0) return;
    if (this.hasAb(m, 'magicguard')) { return; }
    const d = Math.max(1, Math.floor(m.maxhp * frac));
    Scene.S.spr[this.sideOf(m)].hurt = 0.4;
    m.hp = Math.max(0, m.hp - d);
    Scene.dmgNum(this.sideOf(m), d, '#ff9090');
    if (msg) await this.say(msg);
  }

  async checkFaint(m, killer = null) {
    if (m.hp > 0 || m.fainted) return false;
    m.fainted = true;
    const si = this.sideOf(m);
    await Scene.faint(si);
    await this.say(`${this.mn(m)}は 倒れた！`);
    await this.gainGauge(si, 25);
    if (killer && killer.hp > 0 && this.hasAb(killer, 'souleater')) { killer.abRevealed = true; await this.say(`${this.mn(killer)}は 魂を 喰らった！`); await this.changeStage(killer, { atk: 1, mag: 1 }); }
    return true;
  }

  // ---------- 技の実行 ----------
  async useMove(si, move) {
    const user = this.act(si);
    const ti = 1 - si; let target = this.act(ti);
    if (!user || user.hp <= 0) return;
    // 行動不能判定
    if (user.status === 'frz') {
      if (R() < 0.25 || move.t === 'fire') { user.status = null; await this.say(`${this.mn(user)}の 氷が 溶けた！`); }
      else { await Scene.generic(si, '#a0f0ff'); await this.say(`${this.mn(user)}は 凍って 動けない！`); return; }
    }
    if (user.status === 'slp') {
      user.statusTurns--;
      if (user.statusTurns > 0) { await this.say(`${this.mn(user)}は ぐうぐう 眠っている……`); return; }
      user.status = null; await this.say(`${this.mn(user)}は 目を 覚ました！`);
    }
    if (user.vol.flinch) { await this.say(`${this.mn(user)}は 怯んで 動けない！`); return; }
    if (user.status === 'par' && R() < 0.25) { await Scene.status(si, 'par'); await this.say(`${this.mn(user)}は 体が痺れて 動けない！`); return; }
    if (user.vol.cnf > 0) {
      user.vol.cnf--;
      if (user.vol.cnf === 0) await this.say(`${this.mn(user)}の 混乱が 解けた！`);
      else {
        await this.say(`${this.mn(user)}は 混乱している！`);
        if (R() < 1 / 3) {
          await this.say('わけも わからず 自分を 攻撃した！');
          const { dmg } = this.calc(user, user, { t: 'none', c: 'p', pw: 40 });
          await Scene.selfHit(si);
          await this.applyDamage(user, dmg);
          await this.checkFaint(user);
          return;
        }
      }
    }
    // 宣言
    if (move.isUlt) {
      this.sides[si].gauge = 0; this.stats.ults++;
      await this.say(`${this.mn(user)}の 覚醒奥義！`);
      await Scene.cutin(user, si, move.n, move.t);
    }
    await this.say(`${this.mn(user)}の ${move.n}！`);
    if(this._forgeStrike)this._forgeStrike.executed=true;
    if (!move.isUlt) user.revealed.add(move.id);
    if (!move.protect) user.vol.protectChain = 0;

    if (move.protect) {
      const ch = 1 / Math.pow(3, user.vol.protectChain);
      if (R() < ch) { user.vol.protect = true; user.vol.protectChain++; await Scene.attack(si, move); await this.say(`${this.mn(user)}は 結界に 守られた！`); }
      else { user.vol.protectChain = 0; await this.say('しかし うまく 決まらなかった！'); }
      return;
    }
    const needsTarget = move.c !== 's' || move.st || move.roar || (move.foe && move.c === 's');
    if (needsTarget && (!target || target.hp <= 0)) { await this.say('しかし 相手が いない！'); return; }
    if (needsTarget && target.vol.protect) {
      if (move.isUlt) { await this.say('覚醒奥義が 結界を 貫いた！'); target.vol.protect = false; }
      else { let blocked=false;const contact=async()=>{if(blocked)return;blocked=true;await Scene.shieldBlock(ti)};await Scene.attack(si,move,{onImpact:contact});if(!blocked)await contact();await this.say(`${this.mn(target)}は 攻撃から 身を守った！`);return; }
    }
    // 照準判定
    if (needsTarget && move.ac > 0 && !move.isUlt) {
      let acc = move.ac;
      if (move.id === 'thunderfall' && this.field === 'rain') acc = 101;
      if (move.id === 'blizzard' && this.field === 'snow') acc = 101;
      if (target.item === 'powder' && acc <= 100) { acc *= 0.9; }
      if (R() * 100 >= acc) {
        let dodged=false;const contact=async()=>{if(dodged)return;dodged=true;await Scene.miss(ti)};
        if(move.c!=='s')await Scene.attack(si,move,{onImpact:contact});if(!dodged)await contact();
        await this.say(`しかし ${this.mn(target)}には 当たらなかった！`);
        if (target.item === 'powder' && R() < 0.5) { target.itemRevealed = true; await this.say(`（${this.mn(target)}の 幻惑の粉が 舞っている……）`); }
        return;
      }
    }

    if (move.c === 's') { await Scene.attack(si, move); await this.statusMove(si, user, target, move); return; }
    if (move.chaos) { await Scene.attack(si, move); await this.chaosMove(si, user, target, 1); return; }
    if (move.chaosUlt) { await Scene.attack(si, Object.assign({}, move, { fx: 'u_chaos' })); for (let i = 0; i < 3; i++) { if (this.act(ti).hp <= 0 || user.hp <= 0) break; await this.chaosMove(si, user, this.act(ti), 1.6); } return; }

    // Damage and hit feedback are committed at the visual contact, before recovery.
    let pw = move.pw;
    if (move.gamble) { pw = rint(1, 20) * 10; await this.say(`運命の天秤が 傾いた…… 出力${pw}！`); }
    if (move.ohko) {
      let landed=false,blocked=false;
      const contact=async()=>{if(landed)return;landed=true;if(this.hasAb(target,'sturdy')){blocked=true;target.abRevealed=true;await Scene.shieldBlock(ti);return}const feedback=Scene.hit(ti,2,false,move.t);await this.applyDamage(target,target.hp,{direct:true,num:false});await feedback};
      await Scene.attack(si,move,{onImpact:contact});if(!landed)await contact();
      if(blocked){await this.say(`${this.mn(target)}は 頑丈で 限界断裂を 防いだ！`);return}
      await this.say('限界断裂！！');
      await this.checkFaint(target, user);
      return;
    }
    const hits = move.hits ? (R() < 0.35 ? 2 : R() < 0.5 ? 3 : R() < 0.7 ? 4 : 5) : 1;
    let total = 0, hitN = 0, lastEff = 1, anyCrit = false;
    for (let h = 0; h < hits; h++) {
      if (target.hp <= 0) break;
      const crit = this.critRoll(user, move);
      const super_ = R() < 0.012; // 超会心
      const { dmg, eff } = this.calc(user, target, Object.assign({}, move), { pw, crit: crit || super_, ult: move.isUlt });
      lastEff = eff;
      let d = super_ ? Math.floor(dmg * 2) : dmg;
      let landed=false,absorbed=false,real=0;
      const contact=async()=>{if(landed)return;landed=true;
        if(this.hasAb(target,'absorbthunder')&&move.t==='thunder'){absorbed=true;target.abRevealed=true;await this.heal(target,.25,true);return}
        const feedback=Scene.hit(ti,eff,crit||super_,move.t);
        real=await this.applyDamage(target,d,{direct:true,crit:crit||super_});await feedback;
      };
      await Scene.attack(si,Object.assign({},move),{onImpact:contact});if(!landed)await contact();
      if(absorbed){await this.say(`${this.mn(target)}は 雷を 吸収した！`);return}
      total += real; hitN++;
      if (super_) { this.stats.crits++; Scene.banner('超 会 心 ！！', '#ff3060', '運命が牙を剥いた', 1.5); Sound.alarm(); await this.say('超会心の一撃！！ 運命が 牙を剥いた！'); }
      else if (crit) { this.stats.crits++; anyCrit = true; }
    }
    if (anyCrit && hits === 1) await this.say('綻びに 当たった！');
    if (hits > 1) await this.say(`${hitN}回 当たった！`);
    if (lastEff >= 4) await this.say('効果は 絶大だ！！');
    else if (lastEff > 1) await this.say('効果は 抜群だ！');
    else if (lastEff > 0 && lastEff < 1) await this.say('効果は いまひとつのようだ……');
    await this.gainGauge(si, total / target.maxhp * 35);

    // 追加効果
    const fainted = target.hp <= 0;
    const ser = this.hasAb(user, 'serene') ? 2 : 1;
    if (!fainted) {
      if (move.st && R() * 100 < move.st[1] * ser) await this.inflict(target, move.st[0], move.st[1] < 100);
      if (move.slp && R() * 100 < move.slp * ser) await this.inflict(target, 'slp', true);
      if (move.cnf && R() * 100 < move.cnf * ser) await this.confuse(target);
      if (move.fl && R() * 100 < move.fl * ser) target.vol.flinch = true;
      if (user.item === 'kingsrock' && R() < 0.1) {target.vol.flinch = true;Scene.itemPulse?.(si,'kingsrock')}
      if (move.foe && (move.isUlt || R() * 100 < (move.ch || 100) * ser)) await this.changeStage(target, move.foe);
    }
    if (move.self && user.hp > 0) await this.changeStage(user, move.self);
    // 吸収・反動
    if (move.drain && user.hp > 0 && total > 0) { const v = Math.floor(total * move.drain); if (v > 0 && user.hp < user.maxhp) { user.hp = Math.min(user.maxhp, user.hp + v); await Scene.heal(si); await this.say(`${this.mn(target)}から 生命力を 吸い取った！`); } }
    if (move.healUser && user.hp > 0) await this.heal(user, move.healUser);
    if (move.healTeam) { for (const m of this.sides[si].team) if (m.hp > 0 && m !== user) m.hp = Math.min(m.maxhp, m.hp + Math.floor(m.maxhp * move.healTeam)); await this.heal(user, move.healTeam, true); await this.say('瑞光が 仲間全員を 癒した！'); }
    if (user.item === 'shellbell' && total > 0 && user.hp > 0 && user.hp < user.maxhp) { user.hp = Math.min(user.maxhp, user.hp + Math.floor(total / 6)); user.itemRevealed = true;Scene.itemPulse?.(si,'shellbell'); await this.say(`${this.mn(user)}は 吸魂の鈴で 少し回復した！`); }
    if (move.recoil && total > 0) { const d = Math.max(1, Math.floor(total * move.recoil)); if (!this.hasAb(user, 'magicguard')) { user.hp = Math.max(0, user.hp - d); Scene.dmgNum(si, d, '#ff9090'); await this.say(`${this.mn(user)}は 反動で ダメージを 受けた！`); } }
    if (user.item === 'lifeorb' && total > 0 && user.hp > 0 && !this.hasAb(user, 'magicguard')) { user.itemRevealed = true;Scene.itemPulse?.(si,'lifeorb'); await this.indirect(user, 0.1, `${this.mn(user)}は 命の宝珠に 命を削られた！`); }
    // 接触
    if (move.contact && user.hp > 0) {
      if (this.hasAb(target, 'flamebody') && R() < 0.3) { target.abRevealed = true; await this.inflict(user, 'brn', true); }
      if (this.hasAb(target, 'staticbody') && R() < 0.3) { target.abRevealed = true; await this.inflict(user, 'par', true); }
      if (this.hasAb(target, 'cursedbody') && R() < 0.3) { target.abRevealed = true; await this.inflict(user, 'crs', true); }
      if (target.item === 'helmet') { target.itemRevealed = true;Scene.itemPulse?.(ti,'helmet'); await this.indirect(user, 1 / 6, `${this.mn(user)}は 棘の鎧で 傷ついた！`); }
    }
    if (!fainted && this.hasAb(target, 'berserk') && total > 0) { target.abRevealed = true; await this.changeStage(target, { atk: 1 }); }
    if (move.selfko) { user.hp = 0; }
    if (move.haze) await this.haze(true);
    await this.checkFaint(target, user);
    await this.checkFaint(user);
    // 帰還
    if (move.pivot && user.hp > 0 && this.alive(si).length > 1 && !this.over) {
      const idx = await this.chooseReplacement(si, false);
      if (idx !== null && idx !== undefined) await this.doSwitch(si, idx);
    }
  }

  async haze(quiet = false) {
    for (const si of [0, 1]) { const m = this.act(si); if (m) m.stages = { atk: 0, def: 0, mag: 0, res: 0, spd: 0 }; }
    await this.say('全ての 能力変化が 霧散した！');
  }

  async statusMove(si, user, target, move) {
    if (move.heal) {
      await this.heal(user, move.heal);
      if (move.cure && user.status) { user.status = null; await this.say(`${this.mn(user)}の 状態異常が 治った！`); }
    }
    if (move.self) await this.changeStage(user, move.self);
    if (move.st) await this.inflict(target, move.st[0]);
    if (move.foe) await this.changeStage(target, move.foe);
    if (move.field) await this.setField(move.field, 5);
    if (move.hazard) {
      const fs = this.sides[1 - si];
      if (fs.hazard >= 3) { await this.say('しかし 魔針は これ以上 撒けない！'); return; }
      fs.hazard++; await Scene.spikes(1 - si);
      await this.say(`${fs.isPlayer ? 'あなた' : '相手'}の 足元に 魔針が 散らばった！（${fs.hazard}層）`);
    }
    if (move.haze) await this.haze();
    if (move.roar) {
      const others = this.sides[1 - si].team.map((m, i) => [m, i]).filter(([m, i]) => m.hp > 0 && i !== this.sides[1 - si].active);
      if (!others.length) { await this.say('しかし 効果が なかった！'); return; }
      await this.say(`${this.mn(target)}は 咆哮に 怯えて 逃げ出した！`);
      await this.doSwitch(1 - si, pick(others)[1], true);
    }
  }

  // 混沌の賽
  async chaosMove(si, user, target, power = 1) {
    this.stats.chaos++;
    const roll = rint(1, 10);
    const ti = 1 - si;
    switch (roll) {
      case 1: case 2: {
        const t = pick(Object.keys(TYPES));
        await this.say(`賽の目は「${TYPES[t].n}」！ 大当たり！`);
        const mv = { t, c: user.st.mag >= user.st.atk ? 'm' : 'p', pw: Math.floor(150 * power), fx: 'nova' };
        await Scene.attack(si, mv);
        const crit = this.critRoll(user, mv);
        const { dmg, eff } = this.calc(user, target, mv, { crit });
        await Scene.hit(ti, eff, crit, t);
        await this.applyDamage(target, dmg, { direct: true, crit });
        if (eff > 1) await this.say('効果は 抜群だ！');
        await this.checkFaint(target, user);
        break;
      }
      case 3: await this.say('賽の目は「癒」！'); await this.heal(user, 0.5 * power); break;
      case 4: await this.say('賽の目は「災」…… 裏目に出た！'); await Scene.selfHit(si); await this.applyDamage(user, Math.floor(user.maxhp * 0.25)); await this.checkFaint(user); break;
      case 5: { const st = pick(['brn', 'par', 'psn', 'crs', 'slp', 'frz']); await this.say(`賽の目は「${STATUS_N[st]}」！`); await this.inflict(target, st); break; }
      case 6: { const k = pick(STAGE_KEYS); await this.say('賽の目は「昇」！'); await this.changeStage(user, { [k]: 2 }); break; }
      case 7: await this.say('賽の目は「衰」！'); await this.changeStage(target, { [pick(STAGE_KEYS)]: -1, [pick(STAGE_KEYS)]: -1 }); break;
      case 8: { await this.say('賽の目は「変」！ 世界が 揺らぐ！'); const f = pick(Object.keys(FIELDS).filter(k => k !== this.field)); await this.setField(f, 5); break; }
      case 9: {
        await this.say('賽の目は「逆」！ 運命が 反転する！');
        const r1 = user.hp / user.maxhp, r2 = target.hp / target.maxhp;
        user.hp = Math.max(1, Math.round(r2 * user.maxhp)); target.hp = Math.max(1, Math.round(r1 * target.maxhp));
        Scene.flash('#ff40c0', 0.6); Sound.chaos();
        await this.say('お互いの 体力の割合が 入れ替わった！');
        break;
      }
      default: await this.say('賽の目は「無」…… 何も 起きなかった。');
    }
  }

  // ---------- 交代 ----------
  async doSwitch(si, idx, forced = false) {
    const s = this.sides[si];
    const cur = this.act(si);
    if (cur && cur.hp > 0) {
      if (this.hasAb(cur, 'regen') && cur.hp < cur.maxhp) { cur.hp = Math.min(cur.maxhp, cur.hp + Math.floor(cur.maxhp / 3)); cur.abRevealed = true; }
      if (!forced) await this.say(si === 0 ? `戻れ、${cur.name}！` : `${s.name}は ${cur.name}を 引っ込めた！`);
      await Scene.recall(si);
    }
    if (cur) { cur.stages = { atk: 0, def: 0, mag: 0, res: 0, spd: 0 }; cur.vol = { cnf: 0, flinch: false, protect: false, protectChain: 0 }; }
    s.active = idx;
    const m = this.act(si);
    Scene.setMon(si, m);
    await this.say(si === 0 ? `行け！ ${m.name}！` : `${s.name}は ${m.name}を 繰り出した！`);
    await Scene.summon(si);
    await this.onEntry(si);
  }
  async onEntry(si) {
    const m = this.act(si), s = this.sides[si];
    if (s.hazard > 0 && !this.hasAb(m, 'magicguard')) {
      await this.indirect(m, [0, 1 / 8, 1 / 6, 1 / 4][s.hazard], `${this.mn(m)}に 魔針が 突き刺さった！`);
      if (await this.checkFaint(m)) return;
    }
    const callers = { sunCall: 'sun', rainCall: 'rain', stormCall: 'storm', snowCall: 'snow', miasmaCall: 'miasma', sanctCall: 'sanct', moonCall: 'bloodmoon', chaosCall: 'chaos' };
    if (callers[m.ability]) { m.abRevealed = true; await this.say(`${this.mn(m)}の 生得刻印「${ABILITIES[m.ability].n}」！`); await this.setField(callers[m.ability], 5, true); }
    if (m.ability === 'intimidate') {
      const f = this.act(1 - si);
      if (f && f.hp > 0) { m.abRevealed = true; await this.say(`${this.mn(m)}の 威圧！`); await this.changeStage(f, { atk: -1 }); }
    }
  }
  async chooseReplacement(si, forced) {
    const s = this.sides[si];
    const opts = s.team.map((m, i) => i).filter(i => s.team[i].hp > 0 && i !== s.active);
    if (!opts.length) return null;
    if (s.isPlayer) return await this.ui.chooseSwitch(this, forced);
    return this.aiReplacement(si);
  }

  // ---------- ターン ----------
  order(acts) {
    const pr = a => {
      if (a.kind === 'switch') return 10;
      if (a.kind === 'ult') return 0;
      const mv = a.move; let p = mv.pr || 0;
      if (mv.c === 's' && this.hasAb(this.act(a.si), 'prankster')) p += 1;
      return p;
    };
    const q = acts.map(a => ({ a, p: pr(a), qc: this.act(a.si).item === 'quickclaw' && R() < 0.2, sp: this.speed(this.act(a.si)), r: R() }));
    q.sort((x, y) => (y.p - x.p) || ((y.qc ? 1 : 0) - (x.qc ? 1 : 0)) || (y.sp - x.sp) || (y.r - x.r));
    return q.map(x => { if (x.qc) x.a.qc = true; return x.a; });
  }

  async start() {
    Scene.setSides(this.sides[0], this.sides[1]);
    Scene.setField(this.field, 0);
    Scene.setHazard(0, 0); Scene.setHazard(1, 0);
    this.sides.forEach(s => s.team.forEach(resetMon));
    await this.say(`${this.sides[1].name}が 勝負を 仕掛けてきた！`);
    if (this.field !== 'none') await this.say(`この戦場には 異変「${FIELDS[this.field].n}」が 渦巻いている…… ${FIELDS[this.field].d}`);
    Scene.setMon(1, this.act(1));
    await this.say(`${this.sides[1].name}は ${this.act(1).name}を 繰り出した！`);
    await Scene.summon(1);
    Scene.setMon(0, this.act(0));
    await this.say(`行け！ ${this.act(0).name}！`);
    await Scene.summon(0);
    // 素早い方から登場時効果
    const ord = this.speed(this.act(0)) >= this.speed(this.act(1)) ? [0, 1] : [1, 0];
    for (const si of ord) await this.onEntry(si);
    while (!this.over) {
      await this.runTurn();
    }
    return this.winner;
  }

  async runTurn() {
    this.turn++;
    this.ui.turn && this.ui.turn(this.turn);
    const pa = await this.ui.chooseAction(this);
    pa.si = 0;
    const ea = this.aiChoose(1); ea.si = 1;
    const acts = this.order([pa, ea]);
    for (const a of acts) {
      if (this.over) break;
      if (this.act(a.si).hp <= 0) continue;
      if (a.qc) await this.say(`${this.mn(this.act(a.si))}は 先制の爪で 素早く 動いた！`);
      if (a.kind === 'switch') await this.doSwitch(a.si, a.idx);
      else if (a.kind === 'ult') await this.useMove(a.si, this.act(a.si).ult);
      else await this.useMove(a.si, a.move);
      this.checkOver();
      if (this.over) break;
    }
    if (!this.over) await this.endOfTurn();
    this.checkOver();
    if (!this.over) await this.replaceFainted();
    this.checkOver();
  }
  checkOver() {
    if (this.over) return;
    const a0 = this.alive(0).length, a1 = this.alive(1).length;
    if (a0 === 0 || a1 === 0) { this.over = true; this.winner = a1 === 0 && a0 > 0 ? 0 : a0 === 0 && a1 > 0 ? 1 : 1; }
  }
  async replaceFainted() {
    for (const si of [1, 0]) {
      const m = this.act(si);
      if (m.hp <= 0) {
        if (!m.fainted) await this.checkFaint(m);
        const idx = await this.chooseReplacement(si, true);
        if (idx === null) continue;
        await this.doSwitch(si, idx, true);
        this.checkOver(); if (this.over) return;
      }
    }
    // 魔針で倒れた場合など
    if (this.act(0).hp <= 0 || this.act(1).hp <= 0) { this.checkOver(); if (!this.over) await this.replaceFainted(); }
  }

  async endOfTurn({unitsOnly=false}={}) {
    const ord = this.speed(this.act(0)) >= this.speed(this.act(1)) ? [0, 1] : [1, 0];
    const F = this.field;
    for (const si of ord) {
      const m = this.act(si); if (m.hp <= 0) continue;
      if (F === 'snow' && !m.types.includes('ice') && !m.types.includes('steel')) await this.indirect(m, 1 / 16, `吹雪が ${this.mn(m)}を 襲う！`);
      if (F === 'storm' && R() < 0.22) { await Scene.lightningOn(si); await this.indirect(m, 1 / 10, `雷雲から ${this.mn(m)}に 落雷！`); if (m.hp > 0 && R() < 0.3) await this.inflict(m, 'par', true); }
      if (F === 'miasma' && !m.types.includes('dark') && R() < 0.1 && this.canStatus(m, 'psn')) { await this.say('瘴気が 体を 蝕む……'); await this.inflict(m, 'psn', true); }
      if (F === 'sanct' && m.status && R() < 0.25) { m.status = null; await Scene.heal(si); await this.say(`聖域の加護で ${this.mn(m)}の 状態異常が 治った！`); }
      if (F === 'grove' && m.hp < m.maxhp) { m.hp = Math.min(m.maxhp, m.hp + Math.floor(m.maxhp / 16)); await this.say(`樹海の恵みで ${this.mn(m)}は 回復した。`); }
      if (await this.checkFaint(m)) continue;
      if (m.status === 'brn') await this.indirect(m, 1 / 16, `${this.mn(m)}は 火傷に 苦しんでいる！`);
      if (m.status === 'psn') await this.indirect(m, 1 / 8, `${this.mn(m)}は 毒に 蝕まれている！`);
      if (m.status === 'crs') { m.curseN++; await this.indirect(m, Math.min(m.curseN, 8) / 16, `呪詛が ${this.mn(m)}を 締め上げる！（${m.curseN}段階）`); }
      if (await this.checkFaint(m)) continue;
      if (m.item === 'leftovers' && m.hp < m.maxhp) { m.hp = Math.min(m.maxhp, m.hp + Math.floor(m.maxhp / 16)); m.itemRevealed = true;Scene.itemPulse?.(si,'leftovers'); await this.say(`${this.mn(m)}は 再生の苔で 回復した。`); }
      if (m.ability === 'speedboost') { m.abRevealed = true; await this.changeStage(m, { spd: 1 }); }
      if (m.ability === 'moody') { m.abRevealed = true; const ks = shuffle(STAGE_KEYS); await this.say(`${this.mn(m)}の 気分が 変わった！`); await this.changeStage(m, { [ks[0]]: 2, [ks[1]]: -1 }); }
      if (m.item === 'dice' && R() < 0.3) { m.itemRevealed = true; await this.say(`${this.mn(m)}の 気まぐれの賽が 転がった！`); await this.changeStage(m, { [pick(STAGE_KEYS)]: 1 }); }
    }
    for (const si of [0, 1]) { const m = this.act(si); m.vol.protect = false; m.vol.flinch = false; }
    if(unitsOnly)return;
    // 場の継続
    if (this.fieldTurns > 0) {
      this.fieldTurns--; Scene.S.fieldTurns = this.fieldTurns;
      if (this.fieldTurns === 0) { await this.say(`異変「${FIELDS[this.field].n}」が 収まった。`); this.field = 'none'; Scene.setField('none', 0); }
    }
    // 理不尽な事象
    if (R() < 0.06) {
      const f = pick(Object.keys(FIELDS).filter(k => k !== this.field && k !== 'none'));
      await this.say('……空気が 変わった。');
      await this.setField(f, 0, true);
    }
    const chaosRate = this.field === 'chaos' ? 0.21 : 0.07;
    if (R() < chaosRate) await this.chaosEvent();
  }

  async chaosEvent() {
    this.stats.chaos++;
    const si = R() < 0.5 ? 0 : 1, m = this.act(si);
    if (!m || m.hp <= 0) return;
    const ev = rint(1, 6);
    Sound.alarm();
    switch (ev) {
      case 1: Scene.banner('混沌事件：隕石落下', '#ff9040', '', 1.4); await this.say('混沌事件！ 空から 隕石が 降ってきた！'); await Scene.meteorOn(si); await this.indirect(m, 0.12, `${this.mn(m)}に 直撃した！`); await this.checkFaint(m); break;
      case 2: Scene.banner('混沌事件：魔力の奔流', '#ff60e0', '', 1.4); await this.say(`混沌事件！ 魔力の奔流が ${this.mn(m)}に 流れ込む！`); await this.changeStage(m, { [pick(STAGE_KEYS)]: 2 }); break;
      case 3: Scene.banner('混沌事件：精霊の気まぐれ', '#80ffb0', '', 1.4); await this.say(`混沌事件！ 精霊が ${this.mn(m)}に 微笑んだ！`); await this.heal(m, 0.2, true); break;
      case 4: Scene.banner('混沌事件：観客の熱狂', '#ffe060', '', 1.4); await this.say('混沌事件！ 闘技場の 観客が 熱狂している！ 両者の覚醒ゲージが 上昇！'); await this.gainGauge(0, 25); await this.gainGauge(1, 25); break;
      case 5: Scene.banner('混沌事件：狂気の囁き', '#c040ff', '', 1.4); await this.say(`混沌事件！ 何者かの 囁きが ${this.mn(m)}を 狂わせる！`); await this.confuse(m); break;
      case 6: Scene.banner('混沌事件：時の淀み', '#80c0ff', '', 1.4); await this.say('混沌事件！ 時が 淀んだ…… 全ての能力変化が 消えた！'); for (const k of [0, 1]) this.act(k).stages = { atk: 0, def: 0, mag: 0, res: 0, spd: 0 }; await Scene.generic(si, '#80c0ff'); break;
    }
  }

  // ---------- AI ----------
  estDmgPct(user, target, move) {
    if (move.c === 's' || move.ohko || move.chaos) return 0;
    let pw = move.gamble ? 100 : move.pw;
    const { dmg } = this.calc(user, target, move, { pw, est: true });
    const hits = move.hits ? 3 : 1;
    return Math.min(1.2, dmg * hits / target.hp);
  }
  aiChoose(si) {
    const s = this.sides[si], me = this.act(si), foe = this.act(1 - si);
    const lv = this.aiLevel; const noise = lv >= 3 ? 0.12 : lv >= 2 ? 0.22 : 0.35;
    if (s.gauge >= 100 && R() < 0.8) return { kind: 'ult' };
    const meFaster = this.speed(me) > this.speed(foe);
    const foeStages = STAGE_KEYS.reduce((a, k) => a + Math.max(0, foe.stages[k]), 0);
    const scores = me.moves.map(mv => {
      let sc = 0;
      if (mv.c !== 's') {
        const p = this.estDmgPct(me, foe, mv) * (mv.ac ? mv.ac / 100 : 1);
        sc = p * 100;
        if (p >= 1) sc += (meFaster || (mv.pr || 0) > 0) ? 120 : 60;
        if (mv.pr && foe.hp / foe.maxhp < 0.3) sc += 30;
        if (mv.selfko) sc = me.hp / me.maxhp < 0.3 ? sc : sc * 0.3;
        if (mv.recoil && me.hp / me.maxhp < 0.25) sc *= 0.6;
        if (mv.ohko) sc = 34;
        if (mv.chaos) sc = 38;
        if (mv.pivot && this.alive(si).length > 1) sc += 5;
      } else {
        if (mv.st) sc = this.canStatus(foe, mv.st[0]) ? ({ slp: 70, par: meFaster ? 30 : 60, brn: foe.st.atk > foe.st.mag ? 65 : 35, crs: 55, psn: 45, frz: 50 })[mv.st[0]] : 0;
        if (mv.heal) sc = me.hp / me.maxhp < 0.45 ? 85 : me.hp / me.maxhp < 0.7 ? 25 : 0;
        if (mv.self) { const cur = Object.keys(mv.self).reduce((a, k) => a + me.stages[k], 0); sc = (me.hp / me.maxhp > 0.65 && cur < 4) ? 50 - cur * 10 : 5; if (this.hasAb(me, 'contrary')) sc = 50; }
        if (mv.protect) sc = me.vol.protectChain ? 0 : (foe.status === 'psn' || foe.status === 'crs' || foe.status === 'brn') ? 40 : 14;
        if (mv.field) { const fb = FIELD_BOOST[mv.field]; sc = this.field === mv.field ? 0 : (fb && me.types.includes(fb[0])) ? 45 : mv.field === 'bloodmoon' ? 40 : 12; }
        if (mv.hazard) sc = s.idx !== undefined && this.sides[1 - si].hazard < 3 && this.alive(1 - si).length > 1 ? 40 - this.sides[1 - si].hazard * 12 : 0;
        if (mv.haze) sc = foeStages >= 2 ? 70 : 0;
        if (mv.roar) sc = foeStages >= 2 && this.alive(1 - si).length > 1 ? 65 : 0;
        if (mv.foe) sc = 30;
      }
      return sc * (1 - noise + R() * noise * 2);
    });
    let best = 0; scores.forEach((v, i) => { if (v > scores[best]) best = i; });
    // 交代判断
    if (lv >= 1 && scores[best] < 30 && this.alive(si).length > 1 && R() < 0.25 + lv * 0.12) {
      const cand = s.team.map((m, i) => [m, i]).filter(([m, i]) => m.hp > 0 && i !== s.active)
        .map(([m, i]) => [i, Math.max(...m.moves.map(mv => this.estDmgPct(m, foe, mv))) - Math.max(...foe.moves.map(mv => this.estDmgPct(foe, m, mv))) * 0.6])
        .sort((a, b) => b[1] - a[1]);
      if (cand.length && cand[0][1] > 0.35) return { kind: 'switch', idx: cand[0][0] };
    }
    return { kind: 'move', move: me.moves[best] };
  }
  aiReplacement(si) {
    const s = this.sides[si], foe = this.act(1 - si);
    const cand = s.team.map((m, i) => [m, i]).filter(([m, i]) => m.hp > 0 && i !== s.active);
    if (!foe || foe.hp <= 0 || this.aiLevel < 2) return pick(cand)[1];
    cand.sort((a, b) => Math.max(...b[0].moves.map(mv => this.estDmgPct(b[0], foe, mv))) - Math.max(...a[0].moves.map(mv => this.estDmgPct(a[0], foe, mv))));
    return cand[0][1];
  }
}

