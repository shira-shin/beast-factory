const fs=require('fs'),vm=require('vm'),path=require('path');
const dir=process.argv[2]||require('path').join(__dirname,'../js'),N=+process.argv[3]||300;
const ctx={console,setTimeout,clearTimeout,Math:Object.create(Math)};
let seed=11;ctx.Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
ctx.Sound=new Proxy({},{get:()=>()=>{}});ctx.Scene=new Proxy({S:{spr:[{},{}]}},{get:(o,k)=>k==='S'?o.S:()=>Promise.resolve()});
vm.createContext(ctx);for(const f of ['data.js','balance.js','battle.js','combat.js','tactics.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx);
const ui=fs.readFileSync(path.join(dir,'ui.js'),'utf8');const gen=ui.slice(ui.indexOf('function genEnemy'),ui.indexOf('function scoutReport'));
vm.runInContext('var G={round:1,battleNo:1,team:[]};'+gen+';globalThis.g={BEASTS,makeMon,resetMon,Battle,shuffle,ForgeCombat,pick,genEnemy,G};',ctx);
const g=ctx.g;const score=m=>m.maxhp*.25+Math.max(m.st.atk,m.st.mag)*.7+Math.max(m.st.def,m.st.res)*.2+m.st.spd*.25;
(async()=>{const out=[];
for(const [r,n] of [[1,1],[1,4],[1,7],[2,1],[2,7],[3,1],[3,4],[3,7],[4,4],[6,7]]){let w=0;
 for(let i=0;i<N;i++){Object.assign(g.G,{round:r,battleNo:n});const pool=g.shuffle(g.BEASTS).slice(0,6).map(b=>g.makeMon(b,{mult:1}));g.G.team=pool.sort((a,b)=>score(b)-score(a)).slice(0,3);
  const e=g.genEnemy();let turns=0;
  const u={log:async()=>{},turn:()=>{if(++turns>150)throw Error('dl')},chooseAction:async b=>{const c=g.ForgeCombat.ensure(b.act(0));c.previousStance=c.stance;const old=b.aiLevel;b.aiLevel=3;const a=b.aiChoose(0);b.aiLevel=old;c.stance=g.pick(['rush','counter','weave']);a.stance=c.stance;return a},chooseSwitch:async b=>b.sides[0].team.findIndex((m,j)=>m.hp>0&&j!==b.sides[0].active)};
  const b=new g.Battle(g.G.team,e.team,u,{aiLevel:e.aiLevel,field:e.field});b.chooseReplacement=async function(si){return this.aiReplacement(si)};
  let x;try{x=await b.start()}catch{x=1}if(x===0)w++}
 out.push(`r${r}n${n}:${(w/N*100).toFixed(0)}%`)}
console.log(out.join(' '))})();
