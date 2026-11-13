'use strict';
// Hold to inspect, tap to commit; the hold gesture never submits an action.
(()=>{
 let timer=null,held=null,suppress=null,popup=null;
 const close=()=>{popup?.remove();popup=null;held?.removeAttribute('aria-describedby')};
 const show=bt=>{const b=window.__battle;if(!b||b.over)return;const index=[...bt.parentElement.children].indexOf(bt),m=b.act(0),mv=m.moves[index];if(!mv)return;suppress=bt;held=bt;close();popup=document.createElement('aside');popup.className='technique-inspector';popup.id='techniqueInspector';popup.setAttribute('role','tooltip');
  const title=document.createElement('b');title.textContent=mv.n;const desc=document.createElement('p');desc.textContent=mv.d||'刻印を解放する。';const detail=document.createElement('small');detail.textContent=`再装填 ${ForgeTactics.cooldown(mv)}刻 ／ ${mv.contact?'接触':'遠隔'}${mv.c==='s'?'・布石':''}`;popup.append(title,desc,detail);document.body.appendChild(popup);const r=bt.getBoundingClientRect(),pr=popup.getBoundingClientRect();popup.style.left=Math.max(10,Math.min(innerWidth-pr.width-10,r.left))+'px';popup.style.top=Math.max(50,r.top-pr.height-10)+'px';bt.setAttribute('aria-describedby',popup.id);Sound.preview('inspect');};
 document.addEventListener('pointerdown',e=>{clearTimeout(timer);const bt=e.target.closest?.('.mbtn');if(!bt){close();suppress=null;return}if(bt.disabled)return;close();suppress=null;timer=setTimeout(()=>show(bt),430)});
 for(const name of ['pointerup','pointercancel','pointerleave'])document.addEventListener(name,()=>clearTimeout(timer));
 document.addEventListener('click',e=>{if(suppress&&suppress.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();suppress=null}},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});document.addEventListener('valga-screen',close);
})();
