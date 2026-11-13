// Simulates whole runs: AI-controlled player vs the game's enemy generator.
const fs=require('fs'),vm=require('vm'),path=require('path');
const dir=process.argv[2]||require('path').join(__dirname,'../js'),RUNS=+process.argv[3]||300;
const ctx={console,setTimeout,clearTimeout,Math:Object.create(Math)};
let seed=+(process.env.SEED||7);ctx.Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
ctx.Sound=new Proxy({},{get:()=>()=>{}});ctx.Scene=new Proxy({S:{spr:[{},{}]}},{get:(o,k)=>k==='S'?o.S:()=>Promise.resolve()});
vm.createContext(ctx);for(const f of ['data.js','balance.js','battle.js','combat.js','tactics.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx);
const ui=fs.readFileSync(path.join(dir,'ui.js'),'utf8');const gen=ui.slice(ui.indexOf('function genEnemy'),ui.indexOf('function scoutReport'));
vm.runInContext('var G={round:1,battleNo:1,team:[]};'+gen+';globalThis.g={BEASTS,makeMon,resetMon,Battle,shuffle,ForgeCombat,pick,genEnemy,G};',ctx);
const g=ctx.g;
const score=m=>m.maxhp*.25+Math.max(m.st.atk,m.st.mag)*.7+Math.max(m.st.def,m.st.res)*.2+m.st.spd*.25;
(async()=>{const res=[];
for(let r=0;r<RUNS;r++){
 Object.assign(g.G,{round:1,battleNo:1});let streak=0;
 const pool=g.shuffle(g.BEASTS).slice(0,6).map(b=>g.makeMon(b,{mult:1}));g.G.team=pool.sort((a,b)=>score(b)-score(a)).slice(0,3);
 while(streak<84){
  const e=g.genEnemy();let turns=0;
  const u={log:async()=>{},turn:()=>{if(++turns>150)throw Error('dl')},
   chooseAction:async b=>{const c=g.ForgeCombat.ensure(b.act(0));c.previousStance=c.stance;const old=b.aiLevel;b.aiLevel=3;const a=b.aiChoose(0);b.aiLevel=old;c.stance=g.pick(['rush','counter','weave']);a.stance=c.stance;return a},
   chooseSwitch:async b=>b.sides[0].team.findIndex((m,j)=>m.hp>0&&j!==b.sides[0].active)};
  g.G.team.forEach(g.resetMon);const b=new g.Battle(g.G.team,e.team,u,{aiLevel:e.aiLevel,field:e.field});
  b.chooseReplacement=async function(si){return this.aiReplacement(si)};
  let w;try{w=await b.start()}catch{w=1}
  if(w!==0)break;streak++;
  // swap: take enemy's best if better than our worst
  const offers=e.team.map(m=>g.makeMon(m.beast,{mult:1,nature:m.nature,item:m.item,mutant:m.mutant}));const best=offers.sort((a,b)=>score(b)-score(a))[0];const worst=g.G.team.map((m,i)=>[score(m),i]).sort((a,b)=>a[0]-b[0])[0];if(score(best)>worst[0])g.G.team[worst[1]]=best;
  if(g.G.battleNo===7){g.G.round++;g.G.battleNo=1}else g.G.battleNo++;
 }
 res.push(streak)}
res.sort((a,b)=>a-b);const pct=q=>res[Math.floor(q*(res.length-1))];
const reach=n=>(res.filter(x=>x>=n).length/res.length*100).toFixed(1)+'%';
console.log({runs:RUNS,median:pct(.5),p25:pct(.25),p75:pct(.75),p90:pct(.9),reach7:reach(7),reach14:reach(14),reach21:reach(21),reach42:reach(42)});
// per-battle loss rate
})();
