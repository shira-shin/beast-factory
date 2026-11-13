'use strict';
const ValgaUI=(()=>{
  let modal=null,previousFocus=null,announceTimer=null;
  const pages=new Map(),history=[];
  const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  window.VALGA_MOTION=store.get('motion',matchMedia('(prefers-reduced-motion: reduce)').matches?'reduced':'full');
  function close(){if(!modal)return;modal.remove();modal=null;$('app').inert=false;previousFocus?.focus?.()}
  function dialog(title,render,tabs=[]){
    close();previousFocus=document.activeElement;
    modal=el('div','dialog-backdrop');
    const box=el('section','game-dialog');box.role='dialog';box.setAttribute('aria-modal','true');box.setAttribute('aria-label',title);
    const head=el('div','dialog-head');head.appendChild(el('h2','',title));const x=el('button','dialog-close','×');x.type='button';x.setAttribute('aria-label','閉じる');x.onclick=close;head.appendChild(x);box.appendChild(head);
    const body=el('div','dialog-body');
    if(tabs.length){const nav=el('div','dialog-tabs');nav.role='tablist';tabs.forEach((label,i)=>{const bt=el('button','',label);bt.type='button';bt.role='tab';bt.setAttribute('aria-selected',String(i===0));bt.onclick=()=>{Sound.click();[...nav.children].forEach((t,j)=>t.setAttribute('aria-selected',String(i===j)));body.replaceChildren();render(body,i)};nav.appendChild(bt)});box.appendChild(nav)}
    render(body,0);box.appendChild(body);modal.appendChild(box);document.body.appendChild(modal);$('app').inert=true;x.focus();
    modal.onclick=e=>{if(e.target===modal)close()};
  }
  function details(m){
    Sound.click();dialog(m.name,(body,tab)=>{
      if(tab===0){
        const hero=el('div','detail-hero');hero.appendChild(Assets.portrait(m.beast,180,150,m.mutant));hero.appendChild(el('div','',`<h3>${esc(m.name)}</h3><p>${m.beast.title}</p>${m.types.map(tk).join('')}`));body.appendChild(hero);
        body.appendChild(el('div','detail-stats',['hp','atk','def','mag','res','spd'].map(k=>`<div class="detail-stat"><span>${STAT_N[k]}</span><b>${k==='hp'?m.maxhp:m.st[k]}</b></div>`).join('')));
        body.appendChild(el('p','detail-info',`<strong>生得刻印 ${ABILITIES[m.ability].n}</strong><br>${ABILITIES[m.ability].d}`));
        const equipment=el('p','detail-info relic-summary',`<strong>契約具 ${ITEMS[m.item].n}</strong><br>${ITEMS[m.item].d}`);equipment.prepend(Assets.itemIcon(m.item,42));body.appendChild(equipment);
        body.appendChild(el('p','detail-info',`<strong>気質 ${m.nature.n}</strong> ${m.nature.up?STAT_N[m.nature.up]+'↑ '+STAT_N[m.nature.dn]+'↓':'補正なし'}${m.mutant?' ／ 変異種':''}`));
      }else if(tab===1){m.moves.forEach(mv=>body.appendChild(moveDescription(mv)))}
      else{body.appendChild(el('div','help-copy',`<h3>${m.ult.n}</h3><p>${TYPES[m.ult.t].n} ／ ${m.ult.chaosUlt?'混沌の技を三度発動':'出力 '+m.ult.pw}</p><p>覚醒ゲージ100%で解放。結界を貫き、確実に着弾する。</p><p>${m.ult.d||''}</p><p>${m.beast.lore||''}</p>`))}
    },['能力・生得刻印','術の説明','奥義・伝承']);
  }
  function itemDetails(m){Sound.click();dialog('契約具',body=>{const hero=el('div','relic-detail');hero.appendChild(Assets.itemIcon(m.item,96));hero.appendChild(el('div','',`<h3>${ITEMS[m.item].n}</h3><p>${ITEMS[m.item].d}</p><small>${m.name?m.name+'が装備':'契約具の記録'}${m.itemUsed?' ／ 使用済み':''}</small>`));body.appendChild(hero);if(!m.name){const back=el('button','btn ghost','図鑑へ戻る');back.onclick=itemCatalog;body.appendChild(back)}})}
  function itemCatalog(){const ids=Object.keys(ITEMS);dialog('契約具図鑑',(body,page)=>{const grid=el('div','relic-library');ids.slice(page*6,page*6+6).forEach(id=>{const bt=el('button');bt.type='button';bt.append(Assets.itemIcon(id,52),el('span','',ITEMS[id].n));bt.onclick=()=>itemDetails({item:id});grid.appendChild(bt)});body.appendChild(grid)},['1–6','7–12','13–14'])}
  function moveDescription(mv,foe){
    const eff=foe&&mv.c!=='s'?typeEff(mv.t,foe.types):null;
    return el('div','detail-move',`<b>${tk(mv.t)} ${mv.n}</b>${catN[mv.c]} ／ 出力 ${pwText(mv)} ／ ${mv.ac?'照準 '+mv.ac+'%':'必中'} ／ 再装填 ${ForgeTactics.cooldown(mv)}刻${eff!==null?' ／ 属性干渉 ×'+eff:''}<p>${mv.d||''}</p>`);
  }
  function help(){
    const steps=[['三体と契約する','貸し出された6体から3体を選びます。選んだ順が出撃順になります。','「詳細」で能力・生得刻印・契約具・技を確認。下の前後ボタンで札を切り替えます。'],['偵察して先頭を決める','相手の主属性・戦型・異変を見て、属性干渉の良い魔獣を先頭にします。','自分の小さな札をタップすると先頭へ。属性干渉表は最後のタブから確認できます。'],['術と交代を使い分ける','術ボタンを押すと行動を決定します。術の説明は戦闘画面上部から確認できます。','交代も1ターンの行動。覚醒ゲージが100%になると必中の奥義を使えます。ログをタップすると演出中の文章を送れます。'],['七連戦を勝ち抜く','勝つたび、相手の魔獣1体と自分の魔獣1体を交換できます。交換せず進むことも可能です。','7連勝ごとに再契約。さらに強い敵が現れ、21戦目には工廠長が待っています。戦闘前には自動で続きが保存されます。']];
    dialog('遊び方',(body,i)=>{if(i===4){body.innerHTML=$('chartWrap').innerHTML;return}const [title,a,b]=steps[i];body.innerHTML=`<div class="help-step">STEP ${i+1} / 4</div><div class="help-copy"><h3>${title}</h3><p>${a}</p><p>${b}</p></div>`},['契約','偵察','戦闘','連戦','属性干渉']);
  }
  function settings(){
    dialog('工廠の設定',(body,tab)=>{
      if(tab===0){
        for(const[label,key,value]of[['BGM','music',Sound.musicVolume],['効果音','sfx',Sound.sfxVolume]]){const row=el('label','settings-row');row.appendChild(el('span','',label));const input=el('input');input.type='range';input.min=0;input.max=100;input.value=Math.round(value*100);input.setAttribute('aria-label',label+'音量');const val=el('span','',input.value+'%');input.oninput=()=>{const n=+input.value/100;Sound.setVolumes(key==='music'?n:Sound.musicVolume,key==='sfx'?n:Sound.sfxVolume);val.textContent=input.value+'%'};row.append(input,val);body.appendChild(row)}
        const actions=el('div','settings-actions'),mute=el('button','',Sound.muted?'音を出す':'すべて消音');mute.onclick=()=>{Sound.init();Sound.toggleMute();mute.textContent=Sound.muted?'音を出す':'すべて消音';syncMute()};let i=0;const test=el('button','','効果音を試聴');test.onclick=()=>Sound.preview(['fire','water','wood','thunder','ice','steel','dark','holy','hitGlass','heavy','guardBreak','wing'][i++%12]);actions.append(mute,test);body.appendChild(actions);body.appendChild(el('p','detail-info','提供いただいた10曲を収録。通常戦は6曲を戦闘ごとに切り替えます。双獣戦・決戦・勝利後には専用曲を再生します。再生：'+(Sound.diagnostics.currentTitle||'停止中')));
        body.appendChild(el('p','detail-info','追加曲用のプロンプトは BGM-PROMPTS.md に収録。効果音：Kenney（CC0）を素材に、材質・動作・術式ごとに構成。'));
      }else if(tab===1){
        const select=el('select','settings-select');select.setAttribute('aria-label','描画品質');for(const[v,n]of[['light','軽量 · 30fps / 粒子150'],['balanced','標準 · 40fps / 粒子300'],['high','精細 · 45fps / 粒子480']]){const op=el('option','',n);op.value=v;select.appendChild(op)}select.value=window.VALGA_QUALITY;select.onchange=()=>Scene.setQuality(select.value);body.appendChild(select);
        const actions=el('div','settings-actions'),motion=el('button','',window.VALGA_MOTION==='reduced'?'揺れ・閃光：控えめ':'揺れ・閃光：標準');motion.onclick=()=>{window.VALGA_MOTION=window.VALGA_MOTION==='reduced'?'full':'reduced';store.set('motion',window.VALGA_MOTION);motion.textContent=window.VALGA_MOTION==='reduced'?'揺れ・閃光：控えめ':'揺れ・閃光：標準'};const full=el('button','','全画面にする');full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{full.textContent='この端末では全画面非対応'}};const speed=el('button','','演出速度 ×'+G.speed);speed.onclick=()=>{$('btnSpeed').click();speed.textContent='演出速度 ×'+G.speed};actions.append(motion,speed,full);body.appendChild(actions);body.appendChild(el('p','detail-info','選定画面と非表示中は戦場の描画を停止。音は使う分だけ読み込みます。'));
      }else if(tab===2){const auto=el('button','btn',IdleMode.enabled?'放置を止めて手動へ':'完全放置を有効にする');auto.onclick=()=>{IdleMode.set(!IdleMode.enabled);auto.textContent=IdleMode.enabled?'放置を止めて手動へ':'完全放置を有効にする'};body.appendChild(auto);body.appendChild(el('p','detail-info','三体の選定、先頭の判断、術・構え・交代、勝利後の交換、敗北後の再挑戦を自動で進めます。上部の「放置 ON」で、進行中の行動が終わってから手動へ戻れます。'));body.appendChild(el('p','detail-info','ページを開いて動作している間のモードです。設定や詳細を開いている間は判断を待ちます。端末のスリープ中やページを閉じている間は進みません。'));
      }else{const relics=el('button','btn ghost','契約具図鑑');relics.onclick=itemCatalog;body.appendChild(relics)}
    },['音','表示','自動進行','図鑑']);
  }
  function syncMute(){$('btnMute').textContent=Sound.muted?'音 OFF':'音 ON'}
  function paginate(container){
    if(container.id==='preCards')return;
    const cards=[...container.children].filter(c=>c.classList.contains('card'));if(!cards.length)return;
    const capacity=container.id==='rentCards'?(innerWidth<=700&&innerHeight>innerWidth?2:3):1;
    let state=pages.get(container);
    if(!state){
      const nav=el('nav','pager');nav.setAttribute('aria-label','札のページ切り替え');const prev=el('button','','‹ 前へ'),next=el('button','','次へ ›'),label=el('span','page-count');prev.type=next.type='button';nav.append(prev,label,next);container.after(nav);state={index:0,nav,prev,next,label,cards};pages.set(container,state);prev.onclick=()=>{state.index--;Sound.click();paginate(container)};next.onclick=()=>{state.index++;Sound.click();paginate(container)};
    }
    if(state.cards[0]!==cards[0])state.index=0;
    state.cards=cards;state.index=Math.max(0,Math.min(Math.ceil(cards.length/capacity)-1,state.index));
    cards.forEach((card,i)=>card.hidden=Math.floor(i/capacity)!==state.index);state.prev.disabled=state.index===0;state.next.disabled=state.index>=Math.ceil(cards.length/capacity)-1;state.label.textContent=(state.index+1)+' / '+Math.ceil(cards.length/capacity);state.nav.hidden=cards.length<=capacity;
  }
  function draft(team){let summary=$('draftSummary');if(!summary){summary=el('div','draft-summary');summary.id='draftSummary';$('rentCards').after(summary)}summary.innerHTML=`<span class="selection-count">契約 ${team.length} / 3</span>　${team.map((m,i)=>['壱','弐','参'][i]+' '+esc(m.name)).join(' ／ ')||'札をタップして選択'}`}
  function announce(name,type){let node=$('moveAnnouncement');if(!node){node=el('div','battle-announcement');node.id='moveAnnouncement';document.querySelector('.stage').appendChild(node)}clearTimeout(announceTimer);node.textContent=name;node.style.borderColor=TYPES[type]?.c||'#d6b578';node.classList.add('on');announceTimer=setTimeout(()=>node.classList.remove('on'),900/Math.sqrt(G.speed))}
  function battleStatus(b){
    let bar=$('turnBar');if(!bar){bar=el('div','turn-bar');bar.id='turnBar';document.querySelector('.hud').prepend(bar)}
    bar.replaceChildren();bar.appendChild(el('span','',`TURN ${String(b.turn).padStart(2,'0')} · 第${G.battleNo}戦 / 7`));const tools=el('div');
    const moves=el('button','','術式');moves.type='button';moves.onclick=()=>dialog(b.act(0).name+'の技',body=>b.act(0).moves.forEach(m=>body.appendChild(moveDescription(m,b.act(1)))));
    const intel=el('button','battle-intel-toggle','偵察');intel.type='button';intel.onclick=()=>dialog('戦況',body=>{body.innerHTML=UI.intel(b);body.querySelector('.intel').style.display='flex';body.appendChild(el('p','detail-info',FIELDS[b.field].n+'：'+FIELDS[b.field].d))});
    const logs=el('button','','履歴');logs.type='button';logs.onclick=()=>{const count=Math.max(1,Math.ceil(history.length/4));dialog('戦闘履歴',(body,page)=>{const start=Math.max(0,history.length-(page+1)*4);const end=history.length-page*4;history.slice(start,end).forEach(t=>body.appendChild(el('p','detail-info',t)))},Array.from({length:Math.min(5,count)},(_,i)=>i===0?'最新':String(i+1)))};const item=el('button','','装具');item.type='button';item.onclick=()=>itemDetails(b.act(0));tools.append(moves,intel,logs,item);bar.appendChild(tools);
  }
  function saveCheckpoint(){if(G.team.length!==3)return;store.set('checkpoint',{version:1,streak:G.streak,battleNo:G.battleNo,round:G.round,wins:G.wins,crits:G.crits,chaos:G.chaos,ults:G.ults,team:G.team.map(m=>({id:m.id,nature:m.nature,item:m.item,mutant:m.mutant}))})}
  function resume(){const saved=store.get('checkpoint',null);if(!saved||!Array.isArray(saved.team)||saved.team.length!==3)return;try{const team=saved.team.map(m=>makeMon(BEAST_BY_ID[m.id],{nature:m.nature,item:m.item,mutant:m.mutant}));Object.assign(G,saved,{team});updateChips();Sound.init();Sound.select();preScreen()}catch{store.set('checkpoint',null);toast('保存データを読み込めませんでした。新しく挑戦してください。')}}
  document.addEventListener('valga-screen',e=>{
    const id=e.detail;
    close();
    if(id==='scr-pre')setTimeout(saveCheckpoint,0);
    if(id==='scr-over')store.set('checkpoint',null);
    if(id==='scr-battle')history.length=0;
    if(id==='scr-title'){
      let bt=$('btnContinue');const saved=store.get('checkpoint',null);
      if(!bt){bt=el('button','btn ghost','続きから');bt.id='btnContinue';bt.type='button';bt.onclick=resume;$('btnStart').after(bt)}bt.hidden=!saved;
    }
    setTimeout(()=>document.querySelectorAll('.cards').forEach(paginate),0);
  });
  const observer=new MutationObserver(records=>{for(const r of records){if(r.target.classList?.contains('cards'))paginate(r.target)}});
  document.querySelectorAll('.cards').forEach(c=>observer.observe(c,{childList:true}));
  $('btnSettings').onclick=()=>{Sound.init();Sound.click();settings()};$('btnHelp').onclick=()=>{Sound.init();Sound.click();help()};syncMute();
  document.addEventListener('keydown',e=>{
    if(modal){if(e.key==='Escape'){e.preventDefault();close()}else if(e.key==='Tab'){const focusable=[...modal.querySelectorAll('button,input,select,summary,a[href],[tabindex="0"]')].filter(x=>!x.disabled);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}return}
    if(e.key.toLowerCase()==='m'){Sound.init();Sound.toggleMute();syncMute()}
    if(document.body.dataset.screen==='scr-battle'&&['1','2','3','4'].includes(e.key))document.querySelectorAll('.mbtn')[+e.key-1]?.click();
    if(e.code==='Space'&&document.body.dataset.screen==='scr-battle'&&e.target===document.body){e.preventDefault();UI.skip?.()}
  });
  let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>document.querySelectorAll('.cards').forEach(paginate),60)});
  return {dialog,close,details,itemDetails,itemCatalog,help,settings,draft,announce,battleStatus,paginate,remember(t){history.push(t);if(history.length>80)history.shift()},error(error){dialog('戦闘を再開してください',body=>{body.appendChild(el('p','detail-info','処理を続けられませんでした。戦闘前の状態からやり直せます。'));const bt=el('button','btn','戦闘前から再開');bt.onclick=()=>{close();resume()};body.appendChild(bt)})}};
})();


