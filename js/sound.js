/* Valga: sample-based score and layered, non-repeating effects. Howler 2.2.4. */
'use strict';
const Sound=(()=>{
  const data=window.VALGA_AUDIO;
  const pref=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('valga_audio_'+key))??fallback}catch{return fallback}};
  let muted=pref('muted',false),musicVolume=pref('music',.44),sfxVolume=pref('sfx',.68),ready=false;
  let current=null,currentKey=null,requested=null,hidden=document.hidden;
  const effects=new Map(),effectUse=new Map(),tracks=new Map(),last=new Map(),voices=[];
  let moveContext=null;
  const rotation=new Map();let battleChoice=null;
  const persist=()=>{try{for(const [k,v] of Object.entries({muted,music:musicVolume,sfx:sfxVolume}))localStorage.setItem('valga_audio_'+k,JSON.stringify(v))}catch{}};
  const resolve=p=>window.VALGA_FILES?.[p]||p;
  function init(){
    if(!ready){
      ready=true;Howler.autoUnlock=true;Howler.mute(muted||hidden);
      warm(['click','select','miss']);
    }
    if(Howler.ctx?.state==='suspended')Howler.ctx.resume().catch(()=>{});
    if(requested&&!current)bgm(requested);
  }
  function trimEffects(){if(effects.size<=40)return;const protectedFiles=new Set(voices.map(v=>v.file));for(const[file,h]of [...effects].sort((a,b)=>(effectUse.get(a[0])||0)-(effectUse.get(b[0])||0))){if(effects.size<=40)break;if(!protectedFiles.has(file)){h.unload();effects.delete(file);effectUse.delete(file)}}}
  function effect(file){let h=effects.get(file);if(!h){h=new Howl({src:[resolve(file)],format:['mp3'],preload:false,volume:sfxVolume,pool:3});effects.set(file,h)}effectUse.set(file,performance.now());return h}
  function warm(names){if(!ready)return;for(const name of names)for(const file of (data.sfx[name]||[]).slice(0,2)){const h=effect(file);if(h.state()==='unloaded')h.load()}trimEffects()}
  function play(name,{gain=1,rate=1,pan=0}={}){
    if(!ready||muted||hidden)return;
    const list=data.sfx[name];if(!list)return;
    const previous=last.get(name)??-1;
    const offset=list.length>1?1+Math.floor(Math.random()*(list.length-1)):0;
    const n=previous<0?0:(previous+offset)%list.length;last.set(name,n);
    const file=list[n],howl=effect(file);if(howl.state()==='unloaded')howl.load();const id=howl.play();
    howl.volume(Math.min(1,sfxVolume*gain),id);howl.rate(rate*(.94+Math.random()*.12),id);howl.stereo?.(pan,id);
    voices.push({howl,id,file});while(voices.length>12){const old=voices.shift();if(old.howl.state()!=='unloaded')old.howl.stop(old.id)}trimEffects();
    return id;
  }
  function choose(name){
    if(battleChoice?.scene===name)return battleChoice.key;
    if(name==='battle')return'battle';
    if(name==='boss')return typeof G!=='undefined'&&G.enemy?.boss?'boss':'gate';
    return name;
  }
  function bgm(name){
    requested=name;if(!ready)return;
    const key=choose(name);if(key===currentKey)return;
    const meta=data.music[key]||(key==='duo'?data.music.battle:null);if(!meta)return;
    if(current&&tracks.get(meta.file)===current){currentKey=key;return}
    const previous=current;
    if(previous){previous.fade(previous.volume(),0,550);setTimeout(()=>{if(previous!==current){previous.stop();for(const [k,h] of tracks){if(tracks.size<=2)break;if(h!==current&&h!==previous){h.unload();tracks.delete(k)}}}},580)}
    let next=tracks.get(meta.file);
    if(!next){next=new Howl({src:[resolve(meta.file)],format:['mp3'],html5:true,loop:meta.loop!==false,volume:0,preload:true,onplayerror(){next.once('unlock',()=>{if(next===current)next.play()})}});tracks.set(meta.file,next)}
    current=next;currentKey=key;next.stop();next.volume(0);const id=next.play();next.fade(0,musicVolume,900,id);
  }
  function stopBgm(){requested=null;currentKey=null;const old=current;current=null;if(old){old.fade(old.volume(),0,250);setTimeout(()=>{if(old!==current)old.stop()},280)}}
  function duck(){if(!current)return;const track=current;track.fade(track.volume(),musicVolume*.38,100);setTimeout(()=>{if(track===current)track.fade(track.volume(),musicVolume,900)},1000)}
  const api={
    init,bgm,stopBgm,
    battle(name){const pool=data.musicPools?.[name];if(pool?.length){const n=rotation.get(name)||0;battleChoice={scene:name,key:pool[n%pool.length]};rotation.set(name,n+1)}else battleChoice=null;warm(['impact','hitOrganic','hitMetal','slash','heavy','wing','summon','recall']);bgm(name)},
    warmCombat(a,b){warm([...new Set([...a.types,...b.types,'impact','slash','hitOrganic','hitMetal','miss'])])},
    get muted(){return muted},get musicVolume(){return musicVolume},get sfxVolume(){return sfxVolume},
    toggleMute(){muted=!muted;Howler.mute(muted||hidden);persist();return muted},
    setVolumes(music,sfx){musicVolume=Math.max(0,Math.min(1,music));sfxVolume=Math.max(0,Math.min(1,sfx));current?.volume(musicVolume);persist()},
    beginMove(side,move){moveContext={side,move}},
    cast(type,power=1){play(type,{gain:(moveContext?.move.c==='p'?.35:.6)+Math.min(1,power)*.15,rate:power>1.3?.91:1,pan:moveContext?.side===0?-.2:.2})},
    hit(eff=1,crit=false,type='none',side){const m=typeof Scene!=='undefined'&&Scene.S.mons[side],a=m?.beast.art;const material=a?.crystals?'hitGlass':a?.body==='golem'&&m?.types.includes('wood')?'hitBark':a?.body==='golem'||a?.mech||a?.helm?'hitMetal':'hitOrganic';play(material,{gain:eff>1?.95:.75,rate:eff<1?1.08:.96,pan:side===0?-.23:.23});if(crit)play('crit',{gain:.55});if(eff>1&&moveContext?.move.c==='m')play(type,{gain:.2,rate:1.12})},
    swing(){play(/slash|claw|blade|spear|sword/.test(moveContext?.move.fx||'')?'slash':'miss',{gain:.48})},miss(){play('miss',{gain:.35})},
    motion(kind,side){play(kind,{gain:kind==='heavy'?.4:.22,pan:side===0?-.3:.3})},
    fracture(){duck();play('guardBreak',{gain:.8})},reaction(){play('react',{gain:.5})},
    buff(){play('buff',{gain:.55})},debuff(){play('debuff',{gain:.55,rate:.85})},heal(){play('heal',{gain:.65})},
    status(){play('status',{gain:.5})},faint(){play('faint',{gain:.75,rate:.78})},
    summon(){play('summon',{gain:.7})},recall(){play('recall',{gain:.55,rate:.8})},
    click(){play('click',{gain:.25})},select(){play('select',{gain:.35})},shield(){play('shield',{gain:.6})},
    explode(){duck();play('explode',{gain:.95})},chaos(){play('chaos',{gain:.65})},ultimate(){duck();play('ultimate',{gain:.85})},
    weather(field){const names={sun:'fire',rain:'water',storm:'thunder',snow:'ice',bloodmoon:'dark',miasma:'debuff',sanct:'holy',grove:'wood',chaos:'chaos',none:'wing'};play(names[field]||'wing',{gain:.46,rate:.83});if(field==='storm')play('heavy',{gain:.22});if(field==='snow'||field==='rain')play('wing',{gain:.15})},
    gauge(){play('gauge',{gain:.45})},alarm(){play('alarm',{gain:.5})},
    fanfare(){bgm('victory')},lose(){play('defeat',{gain:.65})},
    preview(name){init();play(name)},
    play(name,o){return play(name,o)},
    // BGMの緩急：一時的に絞ってから戻す（奥義の溜め・大打撃の圧）
    dip(level=.2,hold=300,back=600){if(!current)return;const t=current;t.fade(t.volume(),musicVolume*level,90);clearTimeout(api._dipT);api._dipT=setTimeout(()=>{if(t===current)t.fade(t.volume(),musicVolume,back)},hold)},
    swell(ms=500){if(!current)return;current.fade(current.volume(),musicVolume,ms)},
    warm,
    get diagnostics(){return {ready,currentKey,currentFile:data.music[currentKey]?.file,currentTitle:data.music[currentKey]?.title,musicPlaying:current?.playing()||false,musicLoop:current?.loop(),musicPosition:current?.seek()||0,musicStreaming:true,cachedTracks:tracks.size,muted,musicVolume,sfxVolume,availableEffects:Object.values(data.sfx).flat().length,cachedEffects:effects.size,activeVoices:voices.filter(v=>v.howl.playing(v.id)).length,loadedEffects:[...effects.values()].filter(h=>h.state()==="loaded").length,musicStates:Object.fromEntries(Object.entries(data.music).filter(([k,m])=>tracks.has(m.file)).map(([k,m])=>[k,tracks.get(m.file).state()])),variants:Object.fromEntries(Object.entries(data.sfx).map(([k,v])=>[k,v.length]))}}
  };
  document.addEventListener('visibilitychange',()=>{hidden=document.hidden;Howler.mute(muted||hidden)});
  return api;
})();
