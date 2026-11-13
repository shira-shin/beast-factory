'use strict';
// Explanations observe the same calculations as combat. They never roll the dice.
const BattleExplanation=(()=>{
 const STATUS={brn:'ターン末に最大耐久の1/16を失う。打撃の攻撃能力は半分（不屈の闘志を除く）。燼の魔獣には付かない。',psn:'ターン末に最大耐久の1/8を失う。鉄の魔獣には付かない。',crs:'ターン末に最大耐久の1/16、2/16…と損傷が増え、8/16で上限。耀の魔獣には付かない。',par:'機動が半分。行動時に25%で動けない。電の魔獣には付かない。',frz:'行動時に25%で解凍。燼の術なら必ず解凍して行動。霜の魔獣・灼熱の場では新たに付かない。',slp:'付与時に1〜3刻。行動時に残り刻を減らし、0になるとそのまま行動できる。'};
 const fmt=n=>Number(n.toFixed(2)).toString();
 function unit(b,m){const c=ForgeCombat.ensure(m),si=b.sideOf(m);return{name:m.name,hp:m.hp,maxhp:m.maxhp,types:m.types.map(t=>TYPES[t].n),stance:ForgeCombat.STANCES[c.stance],residue:ForgeCombat.activeResidue(m,b.turn),residueLeft:c.residue&&c.residueUntil>=b.turn?c.residueUntil-b.turn+1:0,strain:c.strain,broken:c.brokenUntil>0&&c.brokenUntil>=b.turn,veil:c.veil,tether:c.tetherUntil>0&&c.tetherUntil>=b.turn,status:m.status?{name:STATUS_N[m.status],description:STATUS[m.status]}:null,confused:m.vol.cnf>0,stages:{...m.stages},speed:b.speed(m),ability:ABILITIES[m.ability],signature:ForgeCombat.SIG[m.id],item:si===0||m.itemRevealed?{...ITEMS[m.item],used:m.itemUsed}:null,gauge:b.sides[si].gauge}}
 function preview(b,a,t,mv){
  const ready=ForgeTactics.remaining(b,a,mv),reaction=ForgeCombat.reaction(t,mv.t,b.turn),out={move:mv,ready,cooldown:ForgeTactics.cooldown(mv),eff:typeEff(mv.t,t.types),reaction,min:0,max:0,notes:[],factors:[],accuracy:mv.ac?Math.min(100,mv.ac):100};
  if(mv.isUlt)out.accuracy=100;
  if((mv.id==='thunderfall'&&b.field==='rain')||(mv.id==='blizzard'&&b.field==='snow')){out.accuracy=100;out.notes.push('この天候では照準判定を通過する。')}
  if(t.item==='powder'&&t.itemRevealed&&mv.ac<=100&&mv.ac>0&&!mv.isUlt){const weatherCertain=(mv.id==='thunderfall'&&b.field==='rain')||(mv.id==='blizzard'&&b.field==='snow');if(!weatherCertain){out.accuracy*=.9;out.notes.push('幻惑の粉で照準×0.9。')}}
  if(ready)out.notes.push('再装填中：あと'+ready+'刻は選べない。');
  if(a.hp<=0)out.notes.push('この魔獣は戦闘不能で行動できない。下記は能力比較用。');
  if(t.hp<=0)out.notes.push('この相手は戦闘不能。実際の標的には選べない。');
  if(mv.isUlt&&b.sides[b.sideOf(a)].gauge<100)out.notes.push('覚醒100%が必要。');
  if(mv.d)out.notes.push(mv.d);
  if(mv.st||mv.slp){const st=mv.st?.[0]||'slp',chance=mv.c==='s'?100:Math.min(100,(mv.st?.[1]||mv.slp)*(a.ability==='serene'?2:1));out.notes.push(b.canStatus(t,st)?'着弾後の'+STATUS_N[st]+'付与判定：'+chance+'%。':STATUS_N[st]+'は現在の相手には新たに付かない（既存の状態異常・属性・天候・耐久を確認）。')}
  if(mv.heal)out.notes.push('自身の最大耐久の'+fmt(mv.heal*100)+'%を修復。現在の不足は'+(a.maxhp-a.hp)+'。');
  if(mv.c==='s'){out.notes.push('布石は直接の損傷計算を行わない。属性の有利不利で回復量・能力変化は増減しない。');return out}
  if(t.vol.protect&&!mv.isUlt)out.notes.push('相手は現在、結界で防護中。この術は防がれる。');
  if(mv.ohko||mv.chaos||mv.chaosUlt){out.variable=true;out.notes.push(mv.ohko?'照準を通過すると通常の損傷計算を使わず残り耐久を削る。頑丈で防がれる。':'結果が抽選される術。事前の固定損傷予測はできない。');return out}
  const opt={est:true,explain:true,ult:mv.isUlt,pw:mv.gamble?100:mv.pw},r=b.calc(a,t,mv,opt);out.explanation=r.explanation;out.factors=r.explanation.factors;out.min=b.calc(a,t,mv,{...opt,roll:r.explanation.randomMin}).dmg;out.max=b.calc(a,t,mv,{...opt,roll:r.explanation.randomMax}).dmg;
  if(mv.gamble){out.variable=true;out.notes.push('出力10〜200を抽選。下記は出力100の参考値。')}
  if(mv.hits)out.notes.push('下記は1発分。2〜5回の連撃では各着弾で状態を再計算する。');
  if(t.vol.protect&&!mv.isUlt){out.min=out.max=0;out.notes.unshift('相手は現在、結界で防護中。通常術は防がれる。')}else if(t.vol.protect&&mv.isUlt)out.notes.unshift('覚醒奥義は結界を貫く。');
  if(t.ability==='absorbthunder'&&mv.t==='thunder'){out.min=out.max=0;out.notes.unshift('相手の避雷に吸収され、相手が最大耐久の25%回復する。')}
  if(reaction)out.notes.push('反応「'+reaction.n+'」：'+reaction.d);
  out.notes.push('通常着弾1発の幅。綻び・超会心・踏みとどまり・行動前の状態変化・残り耐久による上限は含まない。');return out;
 }
 const calc=Battle.prototype.calc;Battle.prototype.calc=function(a,t,mv,o={}){const track=this._guideAction&&!o.est,r=calc.call(this,a,t,mv,track?{...o,explain:true}:o);if(track)this._guideAction.latest={target:t,calculated:r.dmg,explanation:r.explanation};return r};
 const say=Battle.prototype.say;Battle.prototype.say=function(text){const c=this._guideAction||this._guideEvent;if(c&&c.messages.length<24)c.messages.push(String(text));return say.call(this,text)};
 function health(b){return b.sides.flatMap(s=>s.team.map(m=>({uid:m.uid,name:m.name,hp:m.hp})))}
 function finish(b,r){r.complete=true;r.healthChanges=health(b).map(m=>({...m,before:r.beforeUnits?.find(u=>u.uid===m.uid)?.hp??m.hp})).filter(m=>m.hp!==m.before);delete r.beforeUnits;delete r.latest}
 function append(b,record){record.beforeUnits=health(b);const list=b.explanationHistory||(b.explanationHistory=[]);list.push(record);while(list.length>36)list.shift()}
 const use=Battle.prototype.useMove;Battle.prototype.useMove=async function(si,mv){const a=this.act(si),t=this.act(1-si),prev=this._guideAction,record={turn:this.turn,kind:'術',actor:a.name,target:t?.name,move:mv.n,field:FIELDS[this.field].n,hits:[],messages:[],complete:false};append(this,record);this._guideAction=record;try{return await use.call(this,si,mv)}finally{finish(this,record);this._guideAction=prev}};
 const damage=Battle.prototype.applyDamage;Battle.prototype.applyDamage=async function(t,dmg,o={}){const c=this._guideAction,latest=c?.latest,hit=c?{target:t.name,before:t.hp,requested:dmg,calculated:latest?.target===t?latest.calculated:null,explanation:latest?.target===t?latest.explanation:null,direct:!!o.direct}:null;const real=await damage.call(this,t,dmg,o);if(hit){hit.actual=real;hit.after=t.hp;c.hits.push(hit);if(c.hits.length>10)c.hits.shift();if(c.latest===latest)c.latest=null}return real};
 // Keep environmental and turn-end reasons even when no technique was used.
 const end=Battle.prototype.endOfTurn;Battle.prototype.endOfTurn=async function(...args){const prev=this._guideEvent,r={turn:this.turn,kind:'ターン末',actor:'戦場・状態・パッシブ',field:FIELDS[this.field].n,messages:[],hits:[],complete:false,beforeUnits:health(this)};this._guideEvent=r;try{return await end.apply(this,args)}finally{finish(this,r);this._guideEvent=prev;if(r.messages.length||r.healthChanges.length){const list=this.explanationHistory||(this.explanationHistory=[]);list.push(r);while(list.length>36)list.shift()}}};
 const switchFn=Battle.prototype.doSwitch;Battle.prototype.doSwitch=async function(si,idx,...args){const next=this.sides[si].team[idx];if(!next)return switchFn.call(this,si,idx,...args);const prev=this._guideAction,r={turn:this.turn,kind:'交代',actor:this.act(si)?.name||'交代',target:next.name,move:'交代 → '+next.name,field:FIELDS[this.field].n,messages:[],hits:[],complete:false};append(this,r);this._guideAction=r;try{return await switchFn.call(this,si,idx,...args)}finally{finish(this,r);this._guideAction=prev}};
 return{STATUS,fmt,unit,preview};
})();
