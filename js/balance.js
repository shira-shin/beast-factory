// ===== 2026-11-13 バランス調整 =====
// 2万戦の自動対戦（AI同士・ランダム3体編成）で勝率が37〜62%に開いていたため、
// 全28体が概ね45〜55%に収まるよう基礎値と術を調整する。
'use strict';
(function(){
  // 新しい術
  M('hornrush','翠角突','wood','p',100,95,{fx:'lunge',contact:1,d:'角を構えて一直線に突き抜ける。'});
  M('venomrose','毒薔薇の鞭','wood','m',90,100,{st:['psn',30],fx:'vines',d:'30%で毒。'});
  M('jokerlance','道化の投げ札','dark','m',95,100,{crit:1,fx:'orb',d:'綻びに当たりやすい。'});
  M('magmaburst','熔核噴出','fire','p',95,100,{st:['brn',20],fx:'hammer',contact:1,d:'20%で火傷。'});
  // 基礎値 [HP, 攻撃, 防御, 魔力, 抗魔, 機動]
  const B={
    seraph:[85,70,80,100,95,90], voltis:[80,80,70,102,78,108], zanba:[80,112,80,60,70,96],
    legion:[100,104,106,50,82,45], phoenix:[90,75,80,104,90,96], leviaru:[95,100,85,85,90,78],
    homura:[75,85,70,103,86,92], frostheim:[100,90,90,108,90,70], abyss:[85,60,80,124,100,85],
    setsuna:[75,106,70,90,80,112],
    jester:[100,90,88,110,88,104], silva:[95,126,88,80,84,116], mandra:[100,70,92,122,96,80],
    aquamira:[112,50,88,107,118,70], crystalos:[120,106,135,70,102,34], kraken:[112,128,94,75,90,70],
    vulcanos:[110,124,120,60,82,40], galva:[92,120,108,95,82,76], druida:[128,102,118,86,106,32],
    gorgo:[92,82,92,110,98,88], moth:[85,60,80,118,104,110], kirin:[98,85,90,108,106,92],
    ignivolg:[84,120,80,70,74,112],
    necros:[92,112,86,112,82,82], raika:[74,75,68,118,86,125], brute:[132,124,92,50,82,54], arthur:[97,115,115,70,95,57],
  };
  const MV={
    jester:['chaos','jokerlance','overheat','hex'],
    silva:['leafblade','hornrush','grove','quick'],
    mandra:['venomrose','souleat','spore','drain'],
    vulcanos:['hammer','magmaburst','irondef','spikes'],
  };
  for(const b of BEASTS){if(B[b.id])b.b=B[b.id];if(MV[b.id])b.moves=MV[b.id]}
})();
