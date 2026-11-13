// ===== 道のりと節目の表示 =====
// 1周＝7戦。各周の第7戦は番人戦。21勝目（第3周の番人）が工廠長グリムヴァルトとの決戦で「工廠制覇」、
// 42勝目（第6周の番人）が原初神カオスティアとの決戦で「真・封獣解放」。以降は果てなき周回。
'use strict';
const ValgaProgress=(()=>{
  const LAP=7;
  const GOALS=[
    {wins:7,  key:'lap',   name:'第一周 突破',       foe:'番人',               note:'七戦目の番人を倒すと、札の再契約ができる'},
    {wins:21, key:'clear', name:'工廠制覇',          foe:'工廠長グリムヴァルト', note:'第三周の決戦。ここがひとつ目のエンディング'},
    {wins:42, key:'true',  name:'真・封獣解放',      foe:'原初神カオスティア',   note:'第六周の決戦。真のエンディング'},
  ];
  const isBoss=(r,n)=>n===7&&(r===3||r===6||(r>6&&r%3===0));
  const total=()=>(G.round-1)*LAP+G.battleNo; // 次に戦う通算戦数（＝必要な勝利数）
  function nextGoal(wins=G.streak){return GOALS.find(g=>g.wins>wins)||{wins:(Math.floor(wins/21)+1)*21,key:'endless',name:'果てなき周回',foe:'混沌の番人',note:'記録を伸ばし続けよう'}}
  function nodeLabel(r,n){return n<7?String(n):isBoss(r,n)?'決':'番'}
  function lapTrack(opts={}){
    const r=G.round,cur=opts.current??G.battleNo,done=opts.done??(G.battleNo-1);
    const wrap=el('div','runtrack');
    const lane=el('div','rt-lane');
    for(let n=1;n<=LAP;n++){
      const node=el('div','rt-node'+(n<=done?' done':'')+(n===cur&&n>done?' now':'')+(n===7?(isBoss(r,7)?' boss':' gate'):''));
      node.innerHTML=`<b>${nodeLabel(r,n)}</b><small>${n===7?(isBoss(r,7)?'決戦':'番人'):'第'+n+'戦'}</small>`;
      lane.appendChild(node);
      if(n<LAP)lane.appendChild(el('i','rt-link'+(n<done+(opts.animate?0:0)?' done':'')+(n===done&&opts.animate?' fill':'')));
    }
    wrap.appendChild(el('div','rt-head',`<span class="rt-lap">第${r}周</span><span class="rt-count">${Math.min(done,LAP)} / ${LAP} 勝</span>`));
    wrap.appendChild(lane);
    const g=nextGoal(opts.wins??G.streak),wins=opts.wins??G.streak;
    const gateName=isBoss(r,7)?'決戦':'番人戦',lines=[];
    if(done>=LAP)lines.push(`<span><b>第${r}周 突破！</b></span>`);
    else if(cur>=LAP)lines.push(`<span>次は <b>${gateName}</b>（第${r}周の7戦目）</span>`);
    else lines.push(`<span>${gateName}は7戦目 ・ <b>あと${LAP-cur}勝</b>で挑戦</span>`);
    lines.push(`<span>次の節目「${g.name}」（${g.wins}勝）まで <b>あと${Math.max(0,g.wins-wins)}勝</b></span>`);
    wrap.appendChild(el('div','rt-foot',lines.join('')));
    // 全体の道のり（42勝まで）
    const span=wins>=42?Math.ceil((wins+1)/21)*21:42,bar=el('div','rt-journey');
    bar.innerHTML=`<i style="width:${Math.min(100,wins/span*100)}%"></i>`+GOALS.concat(span>42?[{wins:span,name:'∞'}]:[]).map(x=>`<em class="${wins>=x.wins?'got':''}" style="left:${x.wins/span*100}%"><span>${x.wins}勝</span></em>`).join('');
    wrap.appendChild(bar);
    return wrap;
  }
  function chip(){
    let c=document.getElementById('chipRun');
    if(!c){c=el('span','stat run-chip');c.id='chipRun';const right=document.querySelector('.tb-right');right?.prepend(c)}
    const scr=document.body.dataset.screen;
    c.hidden=!['scr-pre','scr-battle','scr-swap'].includes(scr);
    const g=nextGoal();
    const doneInLap=Math.min(7,scr==='scr-swap'?G.battleNo:G.battleNo-1);
    c.innerHTML=`<b>第${G.round}周 ${doneInLap}/7勝</b><span>${G.streak}連勝 ・ ${g.name}まで${Math.max(0,g.wins-G.streak)}勝</span>`;
  }
  function titleGoals(){
    const host=document.querySelector('#scr-title .hero-copy');if(!host||host.querySelector('.goal-list'))return;
    const box=el('div','goal-list');
    box.innerHTML=`<div class="gl-h"><span>挑戦の道のり</span><span class="gl-best">${bestText()}</span></div><div class="gl-rows">`+
      `<div class="gl-row"><b>7勝</b><i>第一周突破</i><span>7戦目の番人を倒す</span></div>`+
      `<div class="gl-row big"><b>21勝</b><i>工廠制覇（クリア）</i><span>第三周の決戦で工廠長を倒す</span></div>`+
      `<div class="gl-row"><b>42勝</b><i>真・封獣解放</i><span>第六周で原初神を倒す</span></div></div>`;
    host.appendChild(box);
  }
  const bestText=()=>`最高 <b>${G.best}</b> 連勝${G.best>=21?'・制覇済':''}`;
  function refreshTitle(){const b=document.querySelector('#scr-title .gl-best');if(b)b.innerHTML=bestText()}
  // 戦闘前：道のりを差し込む
  const pre=preScreen;preScreen=function(){
    const r=pre.apply(this,arguments);
    const head=document.querySelector('#scr-pre .head');
    document.querySelector('#scr-pre .runtrack')?.remove();
    head?.after(lapTrack());
    const e=G.enemy;if(e){const sub=$('preSub');const g=nextGoal();sub.innerHTML=`第${G.round}周 ${G.battleNo}/7 ・ ${G.streak}連勝中 ・ 「${g.name}」まであと${g.wins-G.streak}勝`}
    chip();return r;
  };
  // 勝利後：節目の祝福 → 交換画面
  const swap=swapScreen;swapScreen=function(){
    const res=swap.apply(this,arguments);
    const box=document.querySelector('#scr-swap .result');
    box?.querySelector('.runtrack')?.remove();
    box?.appendChild(lapTrack({done:G.battleNo,current:G.battleNo+1,animate:true}));
    const won=G.streak,goal=GOALS.find(g=>g.wins===won);
    if(goal)celebrate(goal);else if(G.battleNo===7)celebrate({name:`第${G.round}周 突破`,wins:won,key:'lap',note:'次の周では敵がさらに強くなる。札の再契約ができる'});
    chip();return res;
  };
  function celebrate(goal){
    const ov=el('div','milestone '+goal.key);
    const ending=goal.key==='clear'||goal.key==='true';
    ov.innerHTML=`<div class="ms-rays"></div><div class="ms-card"><div class="ms-k">${ending?'ENDING':'MILESTONE'}</div><div class="ms-t">${goal.name}</div><div class="ms-n">${goal.wins}<small>連勝</small></div><p>${ending?(goal.key==='clear'?'工廠長グリムヴァルトを打ち倒し、封獣工廠を制覇した。<br>だが工廠の地下で、何かが目を覚まそうとしている——':'原初神カオスティアは鎮まり、全ての封獣は解き放たれた。<br>ここから先は、記録だけが語る果てなき戦い。'):goal.note}</p>${ending?`<div class="ms-stats">綻び ${G.crits}回 ・ 混沌 ${G.chaos}回 ・ 奥義 ${G.ults}回</div>`:''}<div class="row center"><button class="btn" type="button">${ending?'さらに先へ挑む':'先へ進む'}</button>${ending?'<button class="btn ghost" type="button">タイトルへ</button>':''}</div></div>`;
    document.body.appendChild(ov);Sound.play?.('levelup',{gain:.6});
    const bs=ov.querySelectorAll('button');
    bs[0].onclick=()=>{Sound.select?.();ov.classList.add('out');setTimeout(()=>ov.remove(),400)};
    if(bs[1])bs[1].onclick=()=>{Sound.select?.();ov.remove();show('scr-title');Sound.bgm?.('title');refreshTitle()};
    // 放置モードでは自動で閉じる
    if(document.body.classList.contains('idle-mode'))setTimeout(()=>bs[0].click(),2600);
  }
  document.addEventListener('valga-screen',e=>{chip();if(e.detail==='scr-title'){titleGoals();refreshTitle()}});
  setTimeout(()=>{titleGoals();chip()},0);
  return{GOALS,nextGoal,lapTrack,chip,isBoss,total,celebrate};
})();
