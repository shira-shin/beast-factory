'use strict';
/* Additional combat layer. Original moves, abilities, items, switching and fields remain. */
const ForgeCombat=(()=>{
 const STANCES={rush:{n:'踏込',d:'与ダメージ+12%。受けるダメージも+12%。'},counter:{n:'迎撃',d:'接触攻撃を25%軽減し、相手の崩しを進める。遠隔攻撃は被ダメージ5%増。'},weave:{n:'纏装',d:'魔法を18%軽減。属性反応を起こすと覚醒+4。物理は8%増。'}};
 const REACTIONS={
  'fire:water':{n:'蒸裂',mod:1.18,break:1,d:'燼を水で蒸裂させ、損傷と崩しを増やす。'},
  'water:thunder':{n:'導雷',mod:1.15,slow:true,d:'濡れを伝って雷が走り、機動を1段階下げる。'},
  'water:ice':{n:'霜縛',mod:1.12,slow:true,break:1,d:'濡れを凍結させ、崩しと減速を与える。'},
  'wood:fire':{n:'焚芯',mod:1.2,gauge:8,d:'芽を燃料にして損傷と覚醒を増やす。'},
  'water:wood':{n:'根生',mod:1.08,drain:.15,d:'濡れに根を張り、与えた損傷の15%を吸収する。'},
  'ice:steel':{n:'砕氷',mod:1.2,break:2,d:'霜の継ぎ目を砕き、崩しを大きく進める。'},
  'dark:holy':{n:'祓影',mod:1.15,cure:true,break:1,d:'影を払って崩しを進め、自身の状態異常も解除。'},
  'holy:dark':{n:'失光',mod:1.12,weaken:true,d:'照りを食い、相手の抗魔を1段階下げる。'},
  'ice:fire':{n:'融解',mod:1.15,weaken:true,d:'霜を溶かし、相手の抗魔を1段階下げる。'},
  'thunder:steel':{n:'磁裂',mod:1.1,break:1,d:'帯電を鋼で引き裂き、崩しを進める。'},
 };
 const SIG={
  ignivolg:['追炉','燼が残る相手へ踏込で攻撃すると、覚醒+8。'],vulcanos:['炉壁','迎撃中に出力90以上を受けると防御+1。'],homura:['灰祓','属性反応を起こすと自身の状態異常を解除、覚醒+6。'],
  leviaru:['海蝕','濡れが残る相手への水攻撃で防御−1。'],mare:['沈黙の槍','迎撃で接触を受けると、相手に最大HPの6%を返す。'],aquamira:['月膜','纏装でターンを終えると、自身と最も傷ついた控えを4%修復。'],
  druida:['深根','同じ場に2ターン以上留まると、毎ターンHPを5%修復。'],mandra:['毒芽','属性反応後、毒が有効な相手に毒を与える。'],silva:['境界走り','登場時に崩しを消し、覚醒+8。'],
  voltis:['雷路','導雷を起こすと、さらに崩し+1・覚醒+8。'],galva:['蓄電架','迎撃で受けた攻撃を2回まで蓄電。次の攻撃で1蓄電につき出力+12%。'],raika:['虚尾','纏装で布石術を使うと、次の一撃を25%軽減する虚尾を作る。'],
  frostheim:['氷殻','霜の残留を帯びた状態で纏装すると、受ける攻撃をさらに20%軽減。'],setsuna:['霜刃','崩し2以上の相手への接触攻撃は+18%。'],crystalos:['固定架','迎撃中の一撃をさらに15%軽減。'],
  legion:['継鎧','登場時、倒れた仲間の数だけ防御と抗魔が上昇。'],zanba:['返刀','HP半分以下から、迎撃中の相手へ与える損傷+20%。'],abyss:['観測','相手の技を2つ見た後は、相手が次に使う技を看破できる。'],
  necros:['骨火','属性反応を起こすとHPを8%修復。'],jester:['逆札','纏装で布石術か混沌の技を使うと相手の覚醒を8奪う。'],seraph:['導輪','属性反応を起こすと追加で覚醒+10。'],
  arthur:['誓刃','迎撃から踏込へ切り替えたターンの物理損傷+20%。'],kirin:['清祓','登場時、状態異常の仲間1体を浄化。'],gorgo:['蛇眼','迎撃中、相手が前ターンと同じ技を使うと相手の機動−1。'],
  brute:['地杭','出力100以上の物理攻撃は、崩しを追加で1進める。'],phoenix:['灰還','自ら交代すると状態異常と残留を消し、HPを12%修復。'],kraken:['絡索','接触攻撃後、相手の崩しが2以上なら次ターンまで自発的交代を封じる。'],
  moth:['月塵','纏装で布石術を使うと、相手に影の残留を置く。'],chaostia:['双相','直前とは違う属性で攻撃すると損傷+12%。'],grimwald:['主炉','覚醒100%で受ける攻撃を15%軽減。奥義の損傷+15%。'],
 };
 const residueNames={fire:'燼',water:'濡れ',wood:'芽',thunder:'帯電',ice:'霜',steel:'歪み',dark:'影',holy:'照り',none:'無'};
 function ensure(m){if(!m)return null;return m.combat||(m.combat={stance:'weave',previousStance:null,residue:null,residueUntil:0,strain:0,brokenUntil:0,lastMove:null,lastType:null,charges:0,entryTurn:0,veil:false,tetherUntil:0,once:{}})}
 function reaction(m,t,turn){const c=ensure(m);return c.residue&&c.residueUntil>=turn?REACTIONS[c.residue+':'+t]||null:null}
 function setResidue(m,t,turn){if(t==='none')return;const c=ensure(m);c.residue=t;c.residueUntil=turn+2}
 function activeResidue(m,turn){const c=ensure(m);return c.residue&&c.residueUntil>=turn?residueNames[c.residue]:'なし'}
 function tell(b){const ea=b.pendingEnemyAction;if(!ea)return'相手の出方を探っている';if(ea.kind==='switch')return'封獣札へ手を伸ばしている';if(ea.kind==='ult')return'奥義を解き放つ気配';const mv=ea.move;if(b.act(0).id==='abyss'&&b.act(1).revealed.size>=2)return'観測：'+mv.n;if(mv.c==='s')return'魔力を内へ集めている';return mv.contact?'間合いを詰めている':'遠方に魔力を集めている'}
 function enemyStance(b){const enemy=b.act(1),last=b.lastPlayerMove;if(last?.contact&&R()<.7)return'counter';if(enemy.hp/enemy.maxhp>.65&&R()<.55)return'rush';return enemy.st.mag>enemy.st.atk?'weave':'counter'}
 async function sig(b,m){const c=ensure(m),key=b.turn+':'+m.id;if(c.once[key])return;c.once[key]=true;const side=b.sideOf(m);Scene.passive?.(side,SIG[m.id][0],m.types[0]);}
 function addStrain(b,m,n){const c=ensure(m);if(m.hp<=0)return false;c.strain=Math.min(3,c.strain+n);if(c.strain>=3){c.strain=0;c.brokenUntil=b.turn+1;Scene.breakGuard?.(b.sideOf(m));return true}return false}
 const calc=Battle.prototype.calc;
 Battle.prototype.calc=function(user,target,move,o={}){
  const result=calc.call(this,user,target,move,o),u=ensure(user),t=ensure(target);let mod=1;
  const factor=(value,label)=>{mod*=value;result.explanation?.factors.push({label,value,group:'構え・封印刻'})};
  if(u.stance==='rush')factor(1.12,'自身の踏込');
  if(t.stance==='rush')factor(1.12,'相手の踏込');
  if(t.stance==='counter')factor(move.contact?.75:1.05,move.contact?'相手の迎撃：接触を軽減':'相手の迎撃：遠隔への隙');
  if(t.stance==='weave')factor(move.c==='m'?.82:1.08,move.c==='m'?'相手の纏装：術式を軽減':'相手の纏装：打撃への隙');
  if(t.brokenUntil>=this.turn&&t.brokenUntil>0)factor(1.2,'相手が破勢中');
  const r=reaction(target,move.t,this.turn);if(r)factor(r.mod,'残留反応「'+r.n+'」');
  if(t.veil)factor(.75,'虚尾／息継ぎの軽減膜');
  if(user.id==='galva')factor(1+u.charges*.12,'蓄電架：'+u.charges+'蓄電');
  if(user.id==='setsuna'&&move.contact&&t.strain>=2)factor(1.18,'霜刃');
  if(user.id==='zanba'&&user.hp<=user.maxhp/2&&t.stance==='counter')factor(1.2,'返刀');
  if(user.id==='arthur'&&u.previousStance==='counter'&&u.stance==='rush'&&move.c==='p')factor(1.2,'誓刃');
  if(user.id==='chaostia'&&u.lastType&&u.lastType!==move.t)factor(1.12,'双相');
  if(user.id==='grimwald'&&move.isUlt)factor(1.15,'主炉：奥義');
  if(target.id==='crystalos'&&t.stance==='counter')factor(.85,'相手の固定架');
  if(target.id==='frostheim'&&t.stance==='weave'&&t.residue==='ice'&&t.residueUntil>=this.turn)factor(.8,'相手の氷殻');
  if(target.id==='grimwald'&&this.sides[this.sideOf(target)].gauge>=100)factor(.85,'相手の主炉：覚醒100%');
  const dmg=Math.max(result.dmg?1:0,Math.floor(result.dmg*mod));if(result.explanation)result.explanation.final=dmg;
  return{...result,dmg,reaction:r?.n||null};
 };
 const apply=Battle.prototype.applyDamage;
 Battle.prototype.applyDamage=async function(target,dmg,o={}){
  const context=this._forgeStrike;const real=await apply.call(this,target,dmg,o);
  if(!context||context.target!==target||!o.direct||!real||context.processed)return real;
  context.processed=true;const user=context.user,move=context.move,u=ensure(user),t=ensure(target),si=this.sideOf(user),ti=1-si;
  const r=context.reaction;
  addStrain(this,target,(move.contact?1:0)+(move.hits?1:0)+(r?.break||0)+(user.id==='brute'&&move.c==='p'&&move.pw>=100?1:0));
  if(r){
    this.stats.reactions=(this.stats.reactions||0)+1;
    await Scene.reaction?.(ti,context.residue,move.t,r.n);
    await this.gainGauge(si,(r.gauge||4)+(u.stance==='weave'?4:0));
    if(r.slow&&target.hp>0)await this.changeStage(target,{spd:-1});
    if(r.weaken&&target.hp>0)await this.changeStage(target,{res:-1});
    if(r.cure&&user.status){user.status=null;await Scene.heal(si)}
    if(r.drain&&user.hp>0){user.hp=Math.min(user.maxhp,user.hp+Math.max(1,Math.floor(real*r.drain)));await Scene.heal(si)}
  }
  if(t.stance==='counter'&&move.contact&&target.hp>0){addStrain(this,user,1);await this.gainGauge(ti,6);Scene.passive?.(ti,'迎撃',target.types[0])}
  if(t.veil){t.veil=false;Scene.passive?.(ti,'虚尾が砕けた','thunder')}
  if(target.id==='galva'&&t.stance==='counter'&&target.hp>0){t.charges=Math.min(2,t.charges+1);await sig(this,target)}
  if(target.id==='vulcanos'&&t.stance==='counter'&&move.pw>=90&&target.hp>0){await this.changeStage(target,{def:1});await sig(this,target)}
  if(target.id==='mare'&&t.stance==='counter'&&move.contact&&user.hp>0){await this.indirect(user,.06);await sig(this,target)}
  if(target.id==='gorgo'&&t.stance==='counter'&&context.previousUserMove===move.id&&user.hp>0){await this.changeStage(user,{spd:-1});await sig(this,target)}
  if(user.hp>0){
    if(user.id==='ignivolg'&&context.residue==='fire'&&u.stance==='rush'){await this.gainGauge(si,8);await sig(this,user)}
    if(user.id==='leviaru'&&context.residue==='water'&&move.t==='water'&&target.hp>0){await this.changeStage(target,{def:-1});await sig(this,user)}
    if(user.id==='homura'&&r){user.status=null;await this.gainGauge(si,6);await sig(this,user)}
    if(user.id==='mandra'&&r&&target.hp>0&&this.canStatus(target,'psn')){await this.inflict(target,'psn',true);await sig(this,user)}
    if(user.id==='voltis'&&r?.n==='導雷'){addStrain(this,target,1);await this.gainGauge(si,8);await sig(this,user)}
    if(user.id==='necros'&&r){await this.heal(user,.08,true);await sig(this,user)}
    if(user.id==='seraph'&&r){await this.gainGauge(si,10);await sig(this,user)}
    if(user.id==='galva'&&u.charges){u.charges=0;await sig(this,user)}
    if(user.id==='brute'&&move.c==='p'&&move.pw>=100)await sig(this,user);
    if(user.id==='kraken'&&move.contact&&t.strain>=2&&target.hp>0){t.tetherUntil=this.turn+1;await sig(this,user)}
  }
  if(target.hp>0)setResidue(target,move.t,this.turn);
  this.ui.combatUpdate?.(this);return real;
 };
 const resetOriginal=resetMon;resetMon=function(m){resetOriginal(m);delete m.combat};
 const use=Battle.prototype.useMove;
 Battle.prototype.useMove=async function(si,move){
  const user=this.act(si),target=this.act(1-si),u=ensure(user),t=ensure(target);const prev=this._forgeStrike;
  this._forgeStrike={user,target,move,residue:t?.residueUntil>=this.turn?t.residue:null,reaction:target?reaction(target,move.t,this.turn):null,previousUserMove:u.lastMove,processed:false};
  try{await use.call(this,si,move);if(!this._forgeStrike.executed)return;
   await this.onTechniqueExecuted?.(user,move);
   if(user.hp>0&&move.c==='s'){
    if(user.id==='raika'&&u.stance==='weave'){u.veil=true;await sig(this,user)}
    if(user.id==='moth'&&u.stance==='weave'&&target?.hp>0){setResidue(target,'dark',this.turn);await sig(this,user)}
   }
   if(user.hp>0&&user.id==='jester'&&u.stance==='weave'&&(move.c==='s'||move.chaos)){this.sides[1-si].gauge=Math.max(0,this.sides[1-si].gauge-8);await this.gainGauge(si,8);await sig(this,user)}
   u.lastMove=move.id;u.lastType=move.t;if(si===0)this.lastPlayerMove=move;
  }finally{this._forgeStrike=prev}
 };
 const entry=Battle.prototype.onEntry;
 Battle.prototype.onEntry=async function(si){await entry.call(this,si);const m=this.act(si);if(!m||m.hp<=0)return;const c=ensure(m);c.entryTurn=this.turn;c.strain=0;c.residue=null;c.brokenUntil=0;
  if(m.id==='silva'){await this.gainGauge(si,8);await sig(this,m)}
  if(m.id==='kirin'){const hurt=this.sides[si].team.find(x=>x.hp>0&&x.status);if(hurt){hurt.status=null;await sig(this,m)}}
  if(m.id==='legion'){const fallen=this.sides[si].team.filter(x=>x.hp<=0).length;if(fallen){await this.changeStage(m,{def:fallen,res:fallen});await sig(this,m)}}
 };
 const switchFn=Battle.prototype.doSwitch;
 Battle.prototype.doSwitch=async function(si,idx,forced=false){const cur=this.act(si),c=ensure(cur);if(!forced&&cur.hp>0&&c.tetherUntil>=this.turn&&c.tetherUntil>0){await this.say(cur.name+'は絡索に捕らわれている！');return}
  if(!forced&&cur.id==='phoenix'&&cur.hp>0){cur.status=null;cur.hp=Math.min(cur.maxhp,cur.hp+Math.floor(cur.maxhp*.12));await sig(this,cur)}
  c.residue=null;c.strain=0;c.brokenUntil=0;await switchFn.call(this,si,idx,forced);
 };
 const end=Battle.prototype.endOfTurn;
 Battle.prototype.endOfTurn=async function(options){await end.call(this,options);for(const si of [0,1]){const m=this.act(si);if(!m||m.hp<=0)continue;const c=ensure(m);
  if(m.id==='aquamira'&&c.stance==='weave'){let changed=false;for(const target of [m,...this.sides[si].team.filter(x=>x!==m&&x.hp>0).sort((a,b)=>a.hp/a.maxhp-b.hp/b.maxhp).slice(0,1)])if(target.hp<target.maxhp){target.hp=Math.min(target.maxhp,target.hp+Math.max(1,Math.floor(target.maxhp*.04)));changed=true}if(changed){await Scene.heal(si);await sig(this,m)}}
  if(m.id==='druida'&&this.turn-c.entryTurn>=2&&m.hp<m.maxhp){await this.heal(m,.05,true);await sig(this,m)}
  if(c.residueUntil<this.turn)c.residue=null;if(c.brokenUntil<this.turn)c.brokenUntil=0;
 }this.ui.combatUpdate?.(this)};
 Battle.prototype.runTurn=async function(){
  this.turn++;this.ui.turn?.(this.turn);
  const enemy=ensure(this.act(1));enemy.previousStance=enemy.stance;enemy.stance=enemyStance(this);
  const ea=this.aiChoose(1);ea.si=1;ea.actorUid=this.act(1).uid;this.pendingEnemyAction=ea;
  const player=ensure(this.act(0));const prior=player.stance;this.ui.combatUpdate?.(this);
  const pa=await this.ui.chooseAction(this);pa.si=0;pa.actorUid=this.act(0).uid;player.previousStance=prior;player.stance=pa.stance&&STANCES[pa.stance]?pa.stance:player.stance;
  Scene.stance?.(0,player.stance);Scene.stance?.(1,enemy.stance);
  for(const a of this.order([pa,ea])){if(this.over)break;if(this.act(a.si).hp<=0)continue;if(a.kind!=='switch'&&a.actorUid!==this.act(a.si).uid)continue;
   if(a.qc)await this.say(this.mn(this.act(a.si))+'は先に踏み込んだ！');
   if(a.kind==='switch')await this.doSwitch(a.si,a.idx);else if(a.kind==='ult')await this.useMove(a.si,this.act(a.si).ult);else await this.useMove(a.si,a.move);
   this.checkOver();this.ui.combatUpdate?.(this);if(this.over)break;
  }
  if(!this.over)await this.endOfTurn();this.checkOver();if(!this.over)await this.replaceFainted();this.checkOver();
 };
 return{STANCES,REACTIONS,SIG,ensure,reaction,activeResidue,tell,addStrain};
})();
