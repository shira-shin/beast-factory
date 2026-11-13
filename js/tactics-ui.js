'use strict';
const TacticsUI=(()=>{
 const $=id=>document.getElementById(id),make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e};
 function button(text,fn,cls='sbtn'){const e=make('button',cls,text);e.type='button';e.onclick=fn;return e}
 function reload(b,m,mv){const n=ForgeTactics.remaining(b,m,mv),ct=ForgeTactics.cooldown(mv);return n?'再装填 '+n+'刻':ct?'再装填 '+ct+'刻':'連用可'}
 function decorate(b){if(b.isDuo)return;const me=b.act(0);document.querySelectorAll('#cmd .mbtn').forEach((bt,i)=>{const mv=me.moves[i];if(!mv)return;const n=ForgeTactics.remaining(b,me,mv);bt.disabled=!!n;bt.dataset.reload=n;bt.appendChild(make('span','reload-tag',reload(b,me,mv)))});const row=$('cmd').querySelector('.actrow');if(row){row.classList.add('with-breath');const breath=button('息継ぎ',()=>{UI._tacticsResolve?.({kind:'move',move:ForgeTactics.BREATH,stance:ForgeCombat.ensure(me).stance});UI.waitCmd()},'sbtn breath-button');breath.title=ForgeTactics.BREATH.d;row.appendChild(breath)}}
 const choose=UI.chooseAction;UI.chooseAction=function(b){return new Promise(resolve=>{UI._tacticsResolve=resolve;choose.call(UI,b).then(a=>{UI._tacticsResolve=null;resolve(a)});decorate(b)})};
 function duoStatus(b){if(!b.isDuo)return;let panel=$('duoRoster');if(!panel){panel=make('div','duo-roster');panel.id='duoRoster';document.querySelector('.stage').appendChild(panel)}panel.innerHTML='';
  for(const si of [1,0]){const team=make('div','duo-team team-'+si);b.sides[si].team.forEach((m,i)=>{const c=ForgeCombat.ensure(m),card=make('div','duo-unit'+(m.hp<=0?' fallen':''));card.dataset.team=si;card.dataset.unit=i;const title=make('b','',m.name);if(si===0||m.itemRevealed)title.appendChild(Assets.itemIcon(m.item,15));const line=make('span','',`${m.hp}/${m.maxhp}　${m.status?STATUS_N[m.status]+' ':''}${ForgeCombat.STANCES[c.stance].n}`);if(m.status)line.prepend(Assets.stateIcon(m.status,14));const bar=make('i','duo-hp');bar.style.setProperty('--hp',100*m.hp/m.maxhp+'%');const residue=make('small','',`残留 ${ForgeCombat.activeResidue(m,b.turn)} ／ 崩し ${c.strain}/3${c.brokenUntil>=b.turn&&c.brokenUntil>0?' 破勢':''}`);card.append(title,line,bar,residue);if(si===1){const a=b.enemyIntents.find(a=>a.idx===i);if(a&&m.hp>0){const mv=a.kind==='ult'?m.ult:a.move;card.appendChild(make('small','duo-intent',`${a.kind==='ult'?'奥義':mv.c==='s'?'布石':mv.contact?'接触':'遠隔'} → ${b.sides[0].team[a.target].name}`))}}team.appendChild(card)});panel.appendChild(team)}
 }
 const update=UI.combatUpdate;UI.combatUpdate=b=>{if(b.isDuo)duoStatus(b);else update?.(b)};
 UI.chooseDuoActions=function(b){return new Promise(resolve=>{
  Sound.warmCombat(b.act(0),b.act(1));const plans=[],living=b.liveIndices(0);let selected=living[0],target=b.liveIndices(1)[0];
  const render=()=>{b.focus(selected,target);ValgaUI.battleStatus(b);$('turnBar').firstElementChild.textContent='双獣 '+b.turn+' · '+FIELDS[b.field].n;const seal=button('刻印',()=>ValgaUI.details(b.act(0)),'');$('turnBar').lastElementChild.appendChild(seal);const m=b.act(0),foe=b.act(1),cmd=$('cmd');cmd.innerHTML='';
   const selector=make('div','duo-selector');living.forEach(i=>{const unit=b.sides[0].team[i];const bt=button(`${i+1} ${unit.name}${plans[i]?' ✓':''}`,()=>{selected=i;if(plans[i])target=plans[i].target;render()},'duo-select');bt.setAttribute('aria-pressed',String(i===selected));selector.appendChild(bt)});cmd.appendChild(selector);
   const targets=make('div','duo-targets');targets.appendChild(make('span','','標的'));b.liveIndices(1).forEach(i=>{const bt=button(b.sides[1].team[i].name,()=>{target=i;render()},'duo-target');bt.setAttribute('aria-pressed',String(i===target));targets.appendChild(bt)});cmd.appendChild(targets);
   CombatUI.stances(cmd,b);const grid=make('div','moves');
   const assign=(move,kind='move')=>{plans[selected]={si:0,idx:selected,target,kind,move,stance:ForgeCombat.ensure(m).stance};Sound.click();const next=living.find(i=>!plans[i]);if(next!==undefined)selected=next;render()};
   m.moves.forEach(mv=>{const n=ForgeTactics.remaining(b,m,mv),bt=button('',()=>assign(mv),'mbtn');bt.style.setProperty('--tc',TYPES[mv.t].c);bt.disabled=!!n;bt.innerHTML=`<span class="mn">${tk(mv.t)}${mv.n}</span><span class="ms">${catN[mv.c]}　出力 ${pwText(mv)} ／ ${mv.ac?'照準 '+mv.ac+'%':'必中'}</span>`;bt.append(CombatUI.moveHint(b,mv),make('span','reload-tag',reload(b,m,mv)));bt.title=mv.d||'';grid.appendChild(bt)});cmd.appendChild(grid);
   const actions=make('div','duo-actions');const ult=button('奥義 '+Math.floor(b.sides[0].gauge)+'%',()=>assign(m.ult,'ult'),'ubtn');ult.disabled=b.sides[0].gauge<100||living.some(i=>i!==selected&&plans[i]?.kind==='ult');const breath=button('息継ぎ',()=>assign(ForgeTactics.BREATH));breath.title=ForgeTactics.BREATH.d;const count=living.filter(i=>plans[i]).length;const commit=button(`展開 ${count}/${living.length}`,()=>{const ready=living.map(i=>plans[i] ? {...plans[i],stance:ForgeCombat.ensure(b.sides[0].team[i]).stance}:null);if(ready.length!==living.length||ready.some(a=>!a))return;UI.waitCmd();resolve(ready)},'btn duo-commit');commit.disabled=count!==living.length;actions.append(ult,breath,commit);cmd.appendChild(actions);
   const summary=make('div','duo-summary',living.map(i=>plans[i]?`${i+1}：${plans[i].move.n} → ${b.sides[1].team[plans[i].target].name}`:`${i+1}：術を選択`).join(' ／ '));cmd.appendChild(summary);duoStatus(b);Scene.fitCombat();
  };render();
 })};
 async function startDuo(){
  show('scr-battle');document.body.classList.add('duo-battle','battle-arrival');if(!sceneInit)sceneInit=Scene.init($('cv'),$('hud'));await sceneInit;Scene.clear();UI.logLines=[];UI.waitCmd();Sound.battle('duo');
  const b=new ForgeDuoBattle(G.team,G.enemy.team,UI,{enemyName:G.enemy.name,aiLevel:2,field:G.enemy.field});window.__battle=b;
  try{const winner=await b.start();UI.waitCmd();Sound.stopBgm();winner===0?Sound.fanfare():Sound.lose();await Scene.finishBattle(winner===0,'双獣試闘');await UI.log(`双獣試闘 ${winner===0?'勝利':'終了'}。交響 ${b.stats.links}回。`);const box=$('cmd');box.innerHTML='';box.append(button('同じ編成で再戦',()=>startDuo(),'btn'),button('編成へ戻る',()=>{document.body.classList.remove('duo-battle');preScreen()},'btn ghost'),button('タイトルへ',()=>{document.body.classList.remove('duo-battle');show('scr-title');Sound.bgm('title')},'btn ghost'))}catch(e){console.error(e);ValgaUI.error(e)}
 }
 const pre=preScreen;preScreen=function(){pre();let row=$('battleMode');if(!row){row=make('div','battle-mode');row.id='battleMode';$('btnFight').parentElement.before(row)}row.innerHTML='';const solo=button('一騎戦・七連戦',()=>{G.duoRequested=false;preScreen()},'btn ghost');const duo=button('双獣試闘・2対2',()=>{G.duoRequested=true;preScreen()},'btn ghost');solo.setAttribute('aria-pressed',String(!G.duoRequested));duo.setAttribute('aria-pressed',String(!!G.duoRequested));row.append(solo,duo,make('small','',G.duoRequested?'先頭の二体を同時展開。三体目は試闘に参加しません。七連戦の進行とは別の一戦です。':'一体ずつ展開。三体の交代と七連戦を進めます。'));$('btnFight').onclick=()=>{Sound.select();if(G.duoRequested)startDuo();else{document.body.classList.remove('duo-battle');battleScreen()}}};
 const start=$('btnStart').onclick;$('btnStart').onclick=()=>{G.duoRequested=false;start()};const duo=button('双獣試闘 2 VS 2',()=>{G.duoRequested=true;start()},'btn ghost');duo.id='btnDuo';$('btnStart').after(duo);
 document.addEventListener('valga-screen',()=>{if(document.body.dataset.screen!=='scr-battle')document.body.classList.remove('duo-battle')});
 return{reload,startDuo,duoStatus};
})();






