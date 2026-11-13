// GitHub Pages 用：素材を埋め込んだ単体版を docs/index.html に書き出す（node build-pages.cjs）
const fs=require('fs'),path=require('path'),vm=require('vm');const root=__dirname,read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ids=JSON.parse(read('manifest-additions.json')).beasts;
const fx=vm.runInNewContext(read('js/assets.js').match(/const FX_NAMES = (\[[\s\S]*?\]);/)[1]);
const scope={window:{}};vm.runInNewContext(read('js/audio-bank.js'),scope);const audio=scope.window.VALGA_AUDIO;
const items=fs.readdirSync(path.join(root,'assets/items')).filter(p=>p.endsWith('.webp')).map(p=>'assets/items/'+p);
const media=[...ids.map(id=>'assets/beasts/'+id+'.webp'),...items,'assets/bg/arena.jpg',...fx.map(n=>'assets/fx/'+n+'.png'),...Object.values(audio.sfx).flat(),...new Set(Object.values(audio.music).map(m=>m.file))];
const mime={'.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg'};const files={};for(const p of media)files[p]='data:'+mime[path.extname(p)]+';base64,'+fs.readFileSync(path.join(root,p)).toString('base64');
let html=read('index.html');html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,p)=>'<style>'+read(p).replace(/url\(['"]?\.\.\/assets\/bg\/arena\.jpg['"]?\)/g,'url("'+files['assets/bg/arena.jpg']+'")')+'</style>');
html=html.replace('<script src="vendor/pixi.min.js">','<script>window.VALGA_FILES='+JSON.stringify(files)+';</script><script src="vendor/pixi.min.js">');html=html.replace(/<script src="([^"]+)"><\/script>/g,(_,p)=>'<script>'+read(p).replace(/<\/script/gi,'<\/script')+'</script>');html=html.replace('href="icon.svg"','href="data:image/svg+xml;base64,'+fs.readFileSync(path.join(root,'icon.svg')).toString('base64')+'"');
fs.mkdirSync(path.join(root,'docs'),{recursive:true});fs.writeFileSync(path.join(root,'docs/index.html'),html);
console.log('docs/index.html',(Buffer.byteLength(html)/1048576).toFixed(1)+'MiB');
