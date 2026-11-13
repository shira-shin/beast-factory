// ===== 音の緩急と切れ味 =====
// 旧リポジトリの効果音（打撃・刃・咆哮・重低音・ライザー等）を既存の効果音に重ね、
// 大技の前は音楽を絞り、着弾で一気に戻す。最後の一体同士になると曲を切り替える。
'use strict';
(()=>{
  const P=(n,o)=>Sound.play(n,o);
  const pan=side=>side===0?-.25:.25;
  let last=0;
  Sound.warm?.(['boom','punch','blade','whoosh','beastHurt']);
  // 振りかぶり：素早い風切り＋重い魔獣は踏ん張り声
  const swing=Sound.swing;Sound.swing=function(){swing.apply(this,arguments);P('whoosh',{gain:.55,rate:.9+Math.random()*.3});const m=Scene.S.mons?.[lastSide]?.beast?.art;if(m&&(m.body==='golem'||m.bulky||m.body==='quad')&&Math.random()<.55)P('beastEffort',{gain:.35,rate:m.body==='golem'?.8:1.05,pan:pan(lastSide)})};
  let lastSide=0;const begin=Sound.beginMove;Sound.beginMove=function(side,move){lastSide=side;if(move?.c==='p'&&/slash|claw|blade|spear|sword/.test(move.fx||''))P('draw',{gain:.3,pan:pan(side)});return begin.apply(this,arguments)};
  // 着弾：材質の音＋打撃/刃の芯＋重さに応じた低音
  const hit=Sound.hit;Sound.hit=function(eff=1,crit=false,type='none',side){
    hit.apply(this,arguments);
    const fx=(window.__lastMove?.fx)||'',cat=window.__lastMove?.c;
    if(cat==='p')P(/slash|claw|blade|spear|sword|leaves/.test(fx)?'blade':'punch',{gain:.6,rate:eff>1?.9:1.05,pan:pan(side)});
    if(eff>1||crit){P('boom',{gain:crit?.75:.55,pan:pan(side)});Sound.dip(.35,180,400)}
    if(crit)P('shatter',{gain:.45,rate:1.1});
  };
  const bm=Battle.prototype.useMove;Battle.prototype.useMove=function(si,mv){window.__lastMove=mv;return bm.apply(this,arguments)};
  // 大打撃（数字の段階に合わせる）
  const num=Scene.dmgNum;Scene.dmgNum=function(side,n,color){
    const m=Scene.S.mons[side],pct=n/(m?.maxhp||200);
    if(color!=='#ff9090'&&pct>=.45&&performance.now()-last>250){last=performance.now();P('subdrop',{gain:.6});if(Math.random()<.6)P('beastHurt',{gain:.4,rate:.85+Math.random()*.3,pan:pan(side)})}
    return num.apply(this,arguments);
  };
  // 撃破：断末魔＋落下音＋重低音、音楽を一瞬引く
  const faint=Scene.faint;Scene.faint=function(side){P('beastDeath',{gain:.55,rate:.9+Math.random()*.2,pan:pan(side)});P('faller',{gain:.5});setTimeout(()=>P('subdrop',{gain:.55}),260);Sound.dip(.15,700,900);return faint.apply(this,arguments)};
  // 奥義：ライザーで溜め、音楽を絞り、着弾で一気に戻す
  const cut=Scene.cutin;Scene.cutin=function(){P('riser',{gain:.7});Sound.dip(.08,1500,250);setTimeout(()=>{P('boom',{gain:.9});P('subdrop',{gain:.7})},1500/Math.max(1,G.speed||1));return cut.apply(this,arguments)};
  // 反応・破勢・覚醒MAX・混沌
  const re=Scene.reaction;if(re)Scene.reaction=function(){P('spell',{gain:.5});P('shatter',{gain:.3,rate:1.3});return re.apply(this,arguments)};
  const br=Scene.breakGuard;if(br)Scene.breakGuard=function(){P('shatter',{gain:.65,rate:.8});P('anvil',{gain:.45});return br.apply(this,arguments)};
  const gauge=Sound.gauge;Sound.gauge=function(){gauge.apply(this,arguments);P('power',{gain:.5})};
  const chaos=Sound.chaos;Sound.chaos=function(){chaos.apply(this,arguments);P('glitch',{gain:.4})};
  const buff=Sound.buff;Sound.buff=function(){buff.apply(this,arguments);if(Math.random()<.6)P('spell',{gain:.3,rate:1.2})};
  // 対戦開始：金床の一打、番人・決戦は不穏な笑い
  const start=Battle.prototype.start;Battle.prototype.start=function(){if(this.ui===UI){P('anvil',{gain:.6});setTimeout(()=>P('boom',{gain:.5}),350);if(G.enemy?.gate)setTimeout(()=>P('evil',{gain:.45}),600)}return start.apply(this,arguments)};
  // 勝敗と節目のジングル
  const fin=Scene.finishBattle;Scene.finishBattle=function(won){P(won?'winSting':'loseSting',{gain:.55});return fin.apply(this,arguments)};
  // 終盤：互いに最後の一体になったら曲を激しい方へ
  const summon=Scene.summon;Scene.summon=async function(side){const r=await summon.apply(this,arguments);const b=window.__battle;if(b&&!b.isDuo&&b.turn>0&&!b._climax&&b.alive(0).length===1&&b.alive(1).length===1){b._climax=true;Sound.bgm('danger');P('rumble',{gain:.5})}return r};
})();
