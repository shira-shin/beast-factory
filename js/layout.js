// ===== 一目でわかる表示 =====
// 術ボタンに効果文・相性・威力を常時表示し、相手の狙いの欄を相手側へ寄せる。札の術一覧にも効果を出す。
'use strict';
const ValgaLayout=(()=>{
  const effLabel=(mv,foe)=>{if(!foe||mv.c==='s'||mv.chaos)return'';const e=typeEff(mv.t,foe.types);return e>=1.5?'<em class="mx-eff x3">絶大</em>':e>1?'<em class="mx-eff x2">抜群</em>':e<1?'<em class="mx-eff x05">半減</em>':''};
  function short(d){return (d||'').replace(/。$/,'')}
  function decorate(b){
    if(!b||b.isDuo)return;const me=b.act(0),foe=b.act(1);
    document.querySelectorAll('#cmd .mbtn').forEach((bt,i)=>{
      const mv=me.moves[i];if(!mv||bt.querySelector('.m-desc'))return;
      bt.classList.add('mx');
      const power=mv.c==='s'?'':`<span class="m-pow"><small>${({p:'打',m:'術'})[mv.c]}</small>${pwText(mv)}</span>`;
      bt.insertAdjacentHTML('afterbegin',power);
      const d=el('span','m-desc',`${effLabel(mv,foe)}${short(mv.d)}`);
      bt.querySelector('.ms')?.after(d);
    });
    const ub=document.querySelector('#cmd .ubtn');
    if(ub&&!ub.querySelector('.m-desc')){const u=me.ult,bits=[];if(u.st)bits.push(STATUS_N[u.st[0]]+u.st[1]+'%');if(u.healUser)bits.push('自分を'+Math.round(u.healUser*100)+'%回復');if(u.healTeam)bits.push('味方を回復');if(u.crit)bits.push('綻びやすい');if(u.cnf)bits.push('混乱'+u.cnf+'%');if(u.foe)bits.push('相手の能力↓');if(u.chaosUlt)bits.push('混沌を3連発');ub.appendChild(el('span','m-desc','結界を貫き必中'+(bits.length?'・'+bits.join('・'):'')))}
    const br=document.querySelector('#cmd .breath-button');if(br&&!br.querySelector('small'))br.insertAdjacentHTML('beforeend','<small>回復4%・軽減・再装填-1</small>');
    const sw=[...document.querySelectorAll('#cmd .sbtn')].find(x=>x.textContent==='交代');if(sw)sw.insertAdjacentHTML('beforeend','<small>控えと入れ替え</small>');
    placeCues();
  }
  const choose=UI.chooseAction;UI.chooseAction=function(b){const r=choose.call(UI,b);queueMicrotask(()=>decorate(b));setTimeout(()=>decorate(b),0);return r};
  // 相手の狙い欄を相手パネルの下へ
  function placeCues(){
    const cues=document.getElementById('combatCues'),cv=document.getElementById('cv'),stage=document.querySelector('#scr-battle .stage');if(!cues||!cv||!stage)return;
    try{const d=Scene.diagnostics(),r=cv.getBoundingClientRect(),sr=stage.getBoundingClientRect(),k=r.height/d.H,mini=Math.min(innerHeight<560&&innerWidth>innerHeight?.72:1,(d.W/2-24)/330);
      cues.style.top=(r.top-sr.top+(14+92*mini+16)*k)+'px';cues.style.right=(sr.right-r.right+14*k)+'px';cues.style.left='auto';cues.style.width=Math.min(340,330*mini*k)+'px'}catch{}
  }
  addEventListener('resize',()=>setTimeout(placeCues,60));
  // 札（貸し出し・交換・戦闘前）の術一覧にも効果文
  const card=monCard;monCard=function(m,opt){const c=card.apply(this,arguments);c.querySelectorAll('.mvs .mv').forEach(row=>{const t=row.getAttribute('title');if(t&&!row.querySelector('.mv-d'))row.appendChild(el('span','mv-d',short(t)))});return c};
  // 設定「表示」：取り込んだ画像の扱い
  function imageSettings(body){
    const ids=Assets.importedIds||[];if(!ids.length)return;
    const box=el('div','settings-images');
    const use=localStorage.getItem('valga_useImported')!=='false',face=localStorage.getItem('valga_importFacing')==='right'?'right':'left';
    box.appendChild(el('p','detail-info',`ブラウザに取り込んだ魔獣画像が ${ids.length}体分あります。`));
    const row=el('div','settings-actions');
    const b1=el('button','',use?'取り込んだ画像：使用中（標準の絵に戻す）':'標準の絵を使用中（取り込んだ画像を使う）');b1.type='button';b1.onclick=()=>{localStorage.setItem('valga_useImported',use?'false':'true');location.reload()};
    const b2=el('button','',face==='left'?'取り込んだ画像の向き：左向き':'取り込んだ画像の向き：右向き');b2.type='button';b2.onclick=()=>{localStorage.setItem('valga_importFacing',face==='left'?'right':'left');location.reload()};
    row.append(b1,b2);box.appendChild(row);box.appendChild(el('p','detail-info','味方・相手が互いを向くように自動で反転します。向きが逆に見える場合は「向き」を切り替えてください（再読み込みします）。'));
    body.appendChild(box);
  }
  document.addEventListener('click',e=>{const t=e.target.closest?.('.dialog-tabs button');if(t&&t.textContent==='表示')setTimeout(()=>{const body=document.querySelector('.dialog-body');if(body&&!body.querySelector('.settings-images'))imageSettings(body)},0)},true);
  return{decorate,placeCues};
})();
