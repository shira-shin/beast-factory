// ===== 演出強化レイヤー =====
// キャンバス演出の上にDOMの演出層を重ね、対戦開始・技名・損傷・相性・綻び・連撃・奥義・撃破・勝敗を
// 大きく、色と動きに差をつけて見せる。テンポ面では長押し早送りと、短い待ち時間を足す。
'use strict';
const Spectacle=(()=>{
  let root=null,boost=1,busyIntro=null;
  const reduced=()=>window.VALGA_MOTION==='reduced';
  const spd=()=>Math.max(1,(G.speed||1)*boost);
  const TC=t=>TYPES[t]||TYPES.none;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms/spd()));
  function layer(){
    if(root&&root.isConnected)return root;
    const stage=document.querySelector('#scr-battle .stage');if(!stage)return document.body;
    root=el('div','fxl');root.id='fxl';stage.appendChild(root);return root;
  }
  function pos(side){
    const L=layer(),box=L.getBoundingClientRect();
    try{const c=Scene.center(side),d=Scene.diagnostics(),cv=$('cv').getBoundingClientRect();
      return{x:cv.left-box.left+c.x/d.W*cv.width,y:cv.top-box.top+c.y/d.H*cv.height,w:box.width,h:box.height}}
    catch{return{x:box.width*(side?.68:.3),y:box.height*(side?.35:.55),w:box.width,h:box.height}}
  }
  function spawn(cls,html,style={},life=1200,parent){
    const n=el('div','fx '+cls,html);n.style.setProperty('--spd',spd());for(const[k,v]of Object.entries(style)){if(k.startsWith('--'))n.style.setProperty(k,v);else n.style[k]=v}
    (parent||layer()).appendChild(n);setTimeout(()=>n.remove(),life/spd());return n;
  }
  function stageKick(cls='kick',ms=260){const s=document.querySelector('#scr-battle .stage');if(!s||reduced())return;s.classList.remove(cls);void s.offsetWidth;s.classList.add(cls);setTimeout(()=>s.classList.remove(cls),ms/spd())}
  function flash(color='#fff',strength=.55,ms=380){if(reduced())strength*=.35;spawn('flash','',{background:`radial-gradient(circle at 50% 45%,${color} 0%,${color}aa 30%,transparent 75%)`,'--a':strength},ms)}
  function lines(color,ms=600,side){spawn('speedlines'+(side===1?' rev':''),'',{'--c':color},ms)}

  // ---------- 1. 対戦開始の VS 演出 ----------
  async function intro(b){
    const e=G.enemy;if(!e||b.isDuo)return;
    const me=b.sides[0].team[0],foe=b.sides[1].team[0],L=layer();
    const g=window.ValgaProgress?ValgaProgress.nextGoal():null;
    const title=e.boss?'決　戦':e.gate?'番人戦':`第${G.battleNo}戦`;
    const ov=el('div','vs-intro'+(e.boss?' boss':e.gate?' gate':''));
    ov.style.setProperty('--spd',spd());
    ov.style.setProperty('--c0',TC(me.types[0]).c);ov.style.setProperty('--c1',TC(foe.types[0]).c);
    ov.innerHTML=`<div class="vs-half l"><div class="vs-por"></div><div class="vs-name"><small>あなた</small>${me.name}</div><div class="vs-team">${b.sides[0].team.map(m=>`<span>${m.name}</span>`).join('')}</div></div>
      <div class="vs-half r"><div class="vs-por"></div><div class="vs-name"><small>${e.name}</small>${foe.name}</div><div class="vs-team">${b.sides[1].team.map((m,i)=>`<span>${i?'？？？':m.name}</span>`).join('')}</div></div>
      <div class="vs-mid"><div class="vs-round">第${G.round}周　${title}　<b>${G.battleNo}</b>/7</div><div class="vs-big">VS</div>${g?`<div class="vs-goal">「${g.name}」まで あと<b>${g.wins-G.streak}</b>勝</div>`:''}</div>`;
    ov.querySelector('.l .vs-por').appendChild(Assets.portrait(me.beast,420,380,me.mutant));
    ov.querySelector('.r .vs-por').appendChild(Assets.portrait(foe.beast,420,380,foe.mutant,true));
    L.appendChild(ov);Sound.ultimate?.();
    let done;const p=new Promise(r=>done=r);const skip=()=>done();ov.addEventListener('pointerdown',skip);
    busyIntro=skip;
    // 見せ場の後半は召喚と重ねて進め、待ち時間を短くする
    await Promise.race([p,sleep(e.boss||e.gate?1600:1050)]);busyIntro=null;
    setTimeout(()=>{ov.classList.add('out');setTimeout(()=>ov.remove(),360/spd())},450/spd());
  }
  const start=Battle.prototype.start;
  Battle.prototype.start=async function(){if(this.ui===UI&&!this.isDuo)try{await intro(this)}catch(err){console.warn(err)}return start.apply(this,arguments)};

  // ---------- 2. 技名コール ----------
  let lastAtk=0;
  const attack=Scene.attack;Scene.attack=function(atk,move){lastAtk=atk;return attack.apply(this,arguments)};
  ValgaUI.announce=function(name,type){
    const c=TC(type),side=lastAtk,mv=Object.values(MOVES).find(m=>m.n===name);
    const cat=mv?({p:'打撃',m:'術式',s:'布石'})[mv.c]:'奥義';
    layer().querySelectorAll('.callout').forEach(n=>n.remove());
    spawn('callout s'+side,`<span class="co-el" style="background:${c.c}">${c.n}</span><span class="co-name">${name}</span><span class="co-cat">${cat}${mv&&mv.pw?' '+mv.pw:''}</span>`,{'--c':c.c,'--g':c.g},1150);
    if(mv&&mv.c!=='s'&&mv.pw>=100)lines(c.g,520,side);
  };

  // ---------- 3. 損傷数字・相性・綻び・連撃 ----------
  let hitInfo={eff:1,crit:false,type:'none',at:0},combo={side:-1,n:0,at:0};
  const hit=Scene.hit;Scene.hit=function(side,eff=1,crit=false,type='none'){
    hitInfo={eff,crit,type,at:performance.now(),side};
    const P=pos(side),c=TC(type);
    if(crit){spawn('crit',`<b>綻び撃</b><small>CRITICAL</small>`,{left:P.x+'px',top:(P.y-95)+'px'},1100);flash('#ffe07a',.6,320);stageKick('kick-hard',320)}
    if(eff>=1.5){spawn('fxeff super',`<b>絶大！！</b>`,{left:P.x+'px',top:(P.y+60)+'px','--c':c.c},1200);flash(c.c,.5,360);stageKick('kick-hard',320)}
    else if(eff>1){spawn('fxeff good',`<b>効果抜群！</b>`,{left:P.x+'px',top:(P.y+60)+'px','--c':c.c},1100);stageKick('kick',240)}
    else if(eff>0&&eff<1)spawn('fxeff weak',`<b>いまひとつ…</b>`,{left:P.x+'px',top:(P.y+55)+'px'},900);
    spawn('burst',``,{left:P.x+'px',top:P.y+'px','--c':c.c,'--g':c.g},520);
    return hit.apply(this,arguments);
  };
  // キャンバス側の重複表示を抑える
  const pop=Scene.pop;Scene.pop=function(side,text){if(['綻び','絶大','干渉増幅','干渉減衰'].includes(text))return;if(text==='覚醒MAX!'){if(side===0)gaugeMax();return}return pop.apply(this,arguments)};
  Scene.dmgNum=function(side,n,color){
    const m=Scene.S.mons[side],max=m?.maxhp||200,pct=n/max,P=pos(side),now=performance.now();
    const fresh=now-hitInfo.at<900&&hitInfo.side===side;
    const indirect=color==='#ff9090';
    if(combo.side===side&&now-combo.at<900&&!indirect)combo.n++;else combo={side,n:1,at:now};combo.at=now;
    const tier=indirect?'tsmall':pct>=.5?'thuge':pct>=.28?'tbig':'tmid';
    const cls='dmg '+tier+(fresh&&hitInfo.crit?' dcrit':'')+(fresh&&hitInfo.eff>1?' good':'')+(side===0?' mine':'');
    spawn(cls,`<b>${n}</b>`,{left:(P.x+(Math.random()*60-30))+'px',top:(P.y-20-Math.random()*20)+'px'},1250);
    if(tier==='thuge'&&!indirect){flash('#ffffff',.35,240);stageKick('kick-hard',300)}
    if(combo.n>=2)comboBadge(side,combo.n);
  };
  function comboBadge(side,n){const P=pos(side);layer().querySelectorAll('.combo.s'+side).forEach(x=>x.remove());spawn('combo s'+side,`<b>${n}</b><span>HIT</span>`,{left:(P.x+(side?-150:120))+'px',top:(P.y-40)+'px'},900)}
  // 回復数字
  const heal=Battle.prototype.heal;Battle.prototype.heal=async function(m,frac,quiet){const before=m.hp,r=await heal.apply(this,arguments);const v=m.hp-before;if(v>0){const P=pos(this.sideOf(m));spawn('dmg heal',`<b>+${v}</b>`,{left:P.x+'px',top:(P.y-10)+'px'},1100)}return r};

  // ---------- 4. 覚醒MAX ----------
  function gaugeMax(){spawn('gauge-max',`<b>覚醒 MAX</b><span>奥義を解放できる</span>`,{},1500);flash('#ffd36a',.3,400)}

  // ---------- 5. 奥義カットイン（キャンバスの帯に色と文字の層を足す） ----------
  const cutin=Scene.cutin;Scene.cutin=function(mon,side,name,type){
    const c=TC(type);
    const ov=spawn('ult-layer s'+side,`<div class="ul-rays"></div><div class="ul-strip top"><span>${('覚醒奥義　'+name+'　').repeat(6)}</span></div><div class="ul-strip bot"><span>${('ULTIMATE ARTS　'+c.n+'　').repeat(8)}</span></div><div class="ul-kanji">${c.n}</div>`,{'--c':c.c,'--g':c.g},2100);
    flash(c.g,.7,260);setTimeout(()=>{flash('#ffffff',.85,420);stageKick('kick-hard',420)},1500/spd());
    return cutin.apply(this,arguments);
  };

  // ---------- 6. 属性反応・破勢・異変 ----------
  const reaction=Scene.reaction;if(reaction)Scene.reaction=function(side,from,to,name){const P=pos(side),a=TC(from),b=TC(to);spawn('react',`<small><i style="background:${a.c}">${a.n}</i>×<i style="background:${b.c}">${b.n}</i> 属性反応</small><b>${name}</b>`,{left:P.x+'px',top:(P.y-150)+'px','--c':b.c,'--g':b.g},1300);flash(b.c,.4,300);return reaction.apply(this,arguments)};
  const brk=Scene.breakGuard;if(brk)Scene.breakGuard=function(side){const P=pos(side);spawn('fxstamp brk',`<b>破勢</b><small>BREAK</small>`,{left:P.x+'px',top:(P.y-40)+'px'},1100);stageKick('kick-hard',300);return brk.apply(this,arguments)};

  // ---------- 7. 撃破 ----------
  const faint=Scene.faint;Scene.faint=function(side){
    const P=pos(side);
    spawn('fxstamp ko'+(side===0?' mine':''),side===1?`<b>撃破</b><small>K.O.</small>`:`<b>戦闘不能</b><small>DOWN</small>`,{left:P.x+'px',top:(P.y-30)+'px'},1300);
    if(side===1){flash('#fff3d0',.5,300);stageKick('kick-hard',380)}
    return faint.apply(this,arguments);
  };

  // ---------- 8. 勝敗 ----------
  const fin=Scene.finishBattle;Scene.finishBattle=async function(won,subtitle){
    const L=layer();const ov=el('div','result-fx '+(won?'rf-win':'rf-lose'));ov.style.setProperty('--spd',spd());
    const e=G.enemy,next=G.streak+(won?1:0),g=window.ValgaProgress?ValgaProgress.nextGoal(next):null;
    ov.innerHTML=won?`<div class="rf-rays"></div><div class="rf-k">VICTORY</div><div class="rf-t">勝利</div><div class="rf-s">${next}連勝${e?.gate?' ・ '+(e.boss?'決戦':'番人')+'撃破':''}</div>${g?`<div class="rf-g">「${g.name}」まで あと${g.wins-next}勝</div>`:''}`
      :`<div class="rf-k">DEFEAT</div><div class="rf-t">敗北</div><div class="rf-s">${G.streak}連勝で途絶えた</div>`;
    if(won)for(let i=0;i<36;i++){const s=el('i','conf');s.style.cssText=`left:${Math.random()*100}%;--d:${(Math.random()*1.2+.8).toFixed(2)}s;--x:${(Math.random()*160-80).toFixed(0)}px;--r:${(Math.random()*720-360).toFixed(0)}deg;background:${['#ffd36a','#ff7a3a','#fff3d0','#e8642e','#9fd8ff'][i%5]};animation-delay:${(Math.random()*.4).toFixed(2)}s`;ov.appendChild(s)}
    L.appendChild(ov);
    const banner=Scene.banner;Scene.banner=()=>{};try{await fin.apply(this,arguments)}finally{Scene.banner=banner}
    await sleep(won?500:300);ov.classList.add('out');setTimeout(()=>ov.remove(),400);
  };

  // ---------- 9. 窮地の赤い縁取り ----------
  setInterval(()=>{const b=window.__battle,s=document.querySelector('#scr-battle .stage');if(!s)return;const m=b?.act?.(0);s.classList.toggle('danger',!!(b&&!b.over&&m&&m.hp>0&&m.hp/m.maxhp<=.25&&document.body.dataset.screen==='scr-battle'))},400);

  // ---------- 10. テンポ：長押しで早送り・タップで送る ----------
  function setBoost(v){boost=v;Scene.S.speed=(G.speed||1)*boost;try{gsap.globalTimeline.timeScale(Scene.S.speed)}catch{}document.body.classList.toggle('ff',v>1)}
  const stageEl=()=>document.querySelector('#scr-battle .stage');
  let holdT=null;
  document.addEventListener('pointerdown',e=>{const s=stageEl();if(!s||!s.contains(e.target))return;if(busyIntro){busyIntro();return}UI.skip?.();holdT=setTimeout(()=>setBoost(3),220)});
  const release=()=>{clearTimeout(holdT);if(boost!==1)setBoost(1)};
  document.addEventListener('pointerup',release);document.addEventListener('pointercancel',release);
  document.addEventListener('keydown',e=>{if(e.key==='Shift'&&document.body.dataset.screen==='scr-battle')setBoost(3)});
  document.addEventListener('keyup',e=>{if(e.key==='Shift')release()});
  const log=UI.log;UI.log=function(t){
    // 早送り中は文章の待ちも短縮
    if(boost>1){const g=G.speed;G.speed=g*boost;try{return log.call(UI,t)}finally{G.speed=g}}
    return log.call(UI,t);
  };
  document.addEventListener('valga-screen',e=>{if(e.detail!=='scr-battle')release()});
  return{flash,spawn,pos,intro};
})();
