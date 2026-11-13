// Balance simulator: usage node sim.cjs <jsdir> <battles> [mode]
const fs=require('fs'),vm=require('vm'),path=require('path');
const dir=process.argv[2]||require('path').join(__dirname,'../js'),N=+process.argv[3]||2000,mode=process.argv[4]||'team';
const ctx={console,setTimeout,clearTimeout,Math:Object.create(Math)};
let seed=+(process.env.SEED||12345);ctx.Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
ctx.Sound=new Proxy({},{get:()=>()=>{}});
ctx.Scene=new Proxy({S:{spr:[{},{}]}},{get:(o,k)=>k==='S'?o.S:()=>Promise.resolve()});
vm.createContext(ctx);for(const f of ['data.js','balance.js','battle.js','combat.js','tactics.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx);
vm.runInContext(`globalThis.game={BEASTS,BEAST_BY_ID,makeMon,Battle,shuffle,ForgeCombat,ForgeTactics,pick}`,ctx);
const g=ctx.game;const ids=g.BEASTS.map(b=>b.id);
const stat={};ids.forEach(i=>stat[i]={w:0,n:0,ko:0,turns:0});
async function fight(A,B){
 const ta=A.map(id=>g.makeMon(g.BEAST_BY_ID[id],{mutant:0})),tb=B.map(id=>g.makeMon(g.BEAST_BY_ID[id],{mutant:0}));
 let turns=0;
 const ui={log:async()=>{},turn:()=>{if(++turns>150)throw Error('deadlock')},
  chooseAction:async b=>{const c=g.ForgeCombat.ensure(b.act(0));c.previousStance=c.stance;c.stance=g.pick(['rush','counter','weave']);const a=b.aiChoose(0);a.stance=c.stance;return a},
  chooseSwitch:async b=>b.sides[0].team.findIndex((m,j)=>m.hp>0&&j!==b.sides[0].active)};
 // make side 0 decide like AI: swap perspective by temporarily using aiChoose(0)
 const b=new g.Battle(ta,tb,ui,{aiLevel:3,field:'none'});
 b.chooseReplacement=async function(si){return this.aiReplacement(si)};
 let w;try{w=await b.start()}catch(e){return null}
 return {w,turns,ta,tb};
}
(async()=>{
 let dead=0,total=0;
 for(let i=0;i<N;i++){
  let A,B;
  if(mode==='solo'){A=[ids[i%ids.length]];B=[g.pick(ids)]}else{const s=g.shuffle(ids);A=s.slice(0,3);B=s.slice(3,6)}
  const r=await fight(A,B);if(!r){dead++;continue}total++;
  for(const id of A){stat[id].n++;if(r.w===0)stat[id].w++;stat[id].turns+=r.turns}
  for(const id of B){stat[id].n++;if(r.w===1)stat[id].w++;stat[id].turns+=r.turns}
 }
 const rows=ids.map(id=>({id,name:g.BEAST_BY_ID[id].n,wr:+(stat[id].w/stat[id].n*100).toFixed(1),n:stat[id].n,t:+(stat[id].turns/stat[id].n).toFixed(1)})).sort((a,b)=>b.wr-a.wr);
 console.log('battles',total,'deadlocks',dead);rows.forEach(r=>console.log(String(r.wr).padStart(5),r.id.padEnd(10),r.name,'n='+r.n,'turns='+r.t));
 const wr=rows.map(r=>r.wr);const mean=wr.reduce((a,b)=>a+b)/wr.length;console.log('sd',Math.sqrt(wr.reduce((a,b)=>a+(b-mean)**2,0)/wr.length).toFixed(2));
})();
