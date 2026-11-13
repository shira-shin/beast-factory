'use strict';
// Turn counts are absolute: CT 2 locks the following two turns, including while benched.
const ForgeTactics=(()=>{
 const BREATH={id:'forge_breath',n:'息継ぎ',t:'none',c:'s',pw:0,ac:0,pr:1,heal:.04,fx:'buff',d:'耐久を4%修復。次の直撃を25%軽減し、自分の再装填を1刻短縮、覚醒+6。'};
 function cooldown(mv){if(mv.id===BREATH.id||mv.isUlt)return 0;if(mv.ohko||mv.selfko)return 3;if(mv.pw>=115||mv.heal||mv.protect||mv.field||mv.chaos)return 2;if(mv.pw>=90||mv.st||mv.self||mv.foe||mv.hazard||mv.roar||mv.haze)return 1;return 0}
 function clocks(m){return m.reload||(m.reload={})}
 function remaining(b,m,mv){return Math.max(0,(clocks(m)[mv.id]||0)-b.turn)}
 function available(b,m){return m.moves.filter(mv=>!remaining(b,m,mv))}
 const reset=resetMon;resetMon=function(m){reset(m);delete m.reload};
 const use=Battle.prototype.useMove;Battle.prototype.useMove=async function(si,mv){const m=this.act(si);if(remaining(this,m,mv)){await this.say(m.name+'の'+mv.n+'は再装填中。');return}if(mv.isUlt&&this.sides[si].gauge<100){await this.say('覚醒が不足している。');return}return use.call(this,si,mv)};
 Battle.prototype.onTechniqueExecuted=async function(m,mv){
  if(mv.id===BREATH.id){for(const key of Object.keys(clocks(m)))m.reload[key]=Math.max(this.turn,m.reload[key]-1);ForgeCombat.ensure(m).veil=true;await this.gainGauge(this.sideOf(m),6);Scene.passive?.(this.sideOf(m),'再装填促進','none')}
  else if(cooldown(mv))clocks(m)[mv.id]=this.turn+cooldown(mv)+1;
 };
 const ai=Battle.prototype.aiChoose;Battle.prototype.aiChoose=function(si){const m=this.act(si),saved=m.moves;const ready=available(this,m);if(!ready.length)return{kind:'move',move:BREATH};try{m.moves=ready;const a=ai.call(this,si);return a}finally{m.moves=saved}};
 return{BREATH,cooldown,remaining,available};
})();

// Exhibition rules: two deployed units on each side, one order per living unit.
class ForgeDuoBattle extends Battle{
 constructor(a,b,ui,opt={}){super(a.slice(0,2),b.slice(0,2),ui,opt);this.isDuo=true;this.plans=[[],[]];this.links=[null,null];this.enemyIntents=[];this.focusIndices=[0,0];this.stats.links=0}
 focus(a,b){this.sides[0].active=a;this.sides[1].active=b;this.focusIndices=[a,b];Scene.duoFocus?.(this.sides.map(s=>s.team),this.focusIndices);this.ui.combatUpdate?.(this)}
 liveIndices(si){return this.sides[si].team.map((m,i)=>m.hp>0?i:-1).filter(i=>i>=0)}
 async chooseReplacement(){return null}
 async replaceFainted(){}
 async doSwitch(){await this.say('全機展開中。交代できる控えはいない。')}
 async haze(quiet=false){for(const s of this.sides)for(const m of s.team)m.stages={atk:0,def:0,mag:0,res:0,spd:0};if(!quiet){await Scene.generic(0,'#aac8e0');await this.say('全機の能力変動が霧散した。')}}
 async chaosEvent(){const a=this.liveIndices(0),b=this.liveIndices(1);if(a.length&&b.length)this.focus(pick(a),pick(b));await super.chaosEvent()}
 aiOrder(idx){const targets=this.liveIndices(0);const target=pick(targets);this.focus(target,idx);const m=this.act(1),c=ForgeCombat.ensure(m);c.previousStance=c.stance;c.stance=m.hp<m.maxhp*.4?'counter':pick(['rush','counter','weave']);let a=this.aiChoose(1);if(a.kind==='switch')a={kind:'move',move:ForgeTactics.available(this,m)[0]||ForgeTactics.BREATH};return{...a,si:1,idx,target,stance:c.stance}}
 async start(){
  this.sides.forEach(s=>s.team.forEach(resetMon));Scene.setSides(this.sides[0],this.sides[1]);Scene.setField(this.field,0);this.focus(0,0);
  await this.say('双獣試闘。二つの刻印を重ね、互いの隙をつなげ。');
  for(const idx of [0,1])for(const si of [1,0]){this.focus(si===0?idx:0,si===1?idx:0);await Scene.summon(si);await this.onEntry(si)}
  while(!this.over)await this.runTurn();return this.winner;
 }
 async onTechniqueExecuted(m,mv){await super.onTechniqueExecuted(m,mv);if(mv.c==='s'||m.hp<=0)return;const si=this.sideOf(m),target=this.act(1-si),last=this.links[si];
  if(last&&last.turn===this.turn&&last.uid!==m.uid&&last.target===target.uid&&!last.used){last.used=true;this.stats.links++;await this.gainGauge(si,10);await Scene.duet?.(si,mv.t);await this.say('交響成立。二体の攻勢が重なり、覚醒+10。')}
  else this.links[si]={turn:this.turn,uid:m.uid,target:target.uid,used:false};
 }
 async runTurn(){
  this.turn++;this.ui.turn?.(this.turn);this.enemyIntents=this.liveIndices(1).map(i=>this.aiOrder(i));
  const prior=this.sides[0].team.map(m=>ForgeCombat.ensure(m).stance);
  this.focus(this.liveIndices(0)[0],this.liveIndices(1)[0]);
  const plans=await this.ui.chooseDuoActions(this);this.plans=[plans,this.enemyIntents];
  const acts=[...plans,...this.enemyIntents].map(a=>{const m=this.sides[a.si].team[a.idx],c=ForgeCombat.ensure(m);if(a.si===0)c.previousStance=prior[a.idx];c.stance=a.stance||c.stance;return{...a,sp:this.speed(m),qc:m.item==='quickclaw'&&R()<.2,pr:a.kind==='ult'?0:(a.move?.pr||0)+(a.move?.c==='s'&&m.ability==='prankster'?1:0),tie:R()}}).sort((a,b)=>b.pr-a.pr||Number(b.qc)-Number(a.qc)||b.sp-a.sp||b.tie-a.tie);
  for(const a of acts){if(this.over)break;const m=this.sides[a.si].team[a.idx];if(m.hp<=0)continue;
   // Orders keep their selected target; if it fell, redirect to the surviving opponent.
   const living=this.liveIndices(1-a.si);if(!living.length){this.checkOver();break}const target=living.includes(a.target)?a.target:living[0];
   this.focus(a.si===0?a.idx:target,a.si===1?a.idx:target);Scene.stance?.(a.si,ForgeCombat.ensure(m).stance);
   if(a.qc)await this.say(m.name+'の先制の爪が駆動し、先に踏み込んだ。');await this.useMove(a.si,a.kind==='ult'?m.ult:a.move);this.checkOver();this.ui.combatUpdate?.(this);
  }
  if(!this.over){
   // Unit effects once per deployed unit, shared field/chaos clocks once per round.
   for(let lane=0;lane<2;lane++){this.focus(lane,lane);await super.endOfTurn({unitsOnly:lane===0});this.checkOver();if(this.over)break}
  }
  this.checkOver();this.ui.combatUpdate?.(this);
 }
}
