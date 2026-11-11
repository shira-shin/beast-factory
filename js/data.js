// ===== 封獣工廠ヴァルガ — データ定義 =====
'use strict';

const TYPES = {
  fire:    { n: '炎', c: '#ff5a2a', g: '#ffb347' },
  water:   { n: '水', c: '#2f8cff', g: '#7fd4ff' },
  wood:    { n: '樹', c: '#3fbf4f', g: '#b6f27a' },
  thunder: { n: '雷', c: '#f5c400', g: '#fff17a' },
  ice:     { n: '氷', c: '#5fe0f0', g: '#e6ffff' },
  steel:   { n: '鋼', c: '#9aa8b8', g: '#e8eef5' },
  dark:    { n: '冥', c: '#8a3cff', g: '#d29cff' },
  holy:    { n: '聖', c: '#ffe08a', g: '#ffffff' },
  none:    { n: '無', c: '#b8a99a', g: '#f2e9df' },
};

// 攻撃側 -> 防御側
const CHART = {
  fire:    { wood: 2, ice: 2, steel: 2, fire: .5, water: .5 },
  water:   { fire: 2, steel: 2, water: .5, wood: .5 },
  wood:    { water: 2, thunder: 2, fire: .5, wood: .5, steel: .5 },
  thunder: { water: 2, steel: 2, wood: .5, thunder: .5 },
  ice:     { wood: 2, thunder: 2, fire: .5, ice: .5, steel: .5 },
  steel:   { ice: 2, holy: 2, fire: .5, water: .5, steel: .5 },
  dark:    { holy: 2, dark: 2, steel: .5 },
  holy:    { dark: 2, steel: .5, holy: .5 },
  none:    { steel: .5 },
};
function typeEff(atkType, defTypes) {
  let m = 1;
  for (const d of defTypes) m *= (CHART[atkType] && CHART[atkType][d]) || 1;
  return m;
}

const STAT_N = { hp: 'HP', atk: '攻撃', def: '防御', mag: '魔力', res: '抗魔', spd: '素早さ' };
const STATUS_N = { brn: '火傷', frz: '凍結', par: '麻痺', psn: '毒', crs: '呪詛', slp: '眠り' };
const STATUS_C = { brn: '#ff6a3a', frz: '#7fe8ff', par: '#f5d000', psn: '#b44cff', crs: '#6a1f8f', slp: '#8fa0c0' };

// ---- 技 ----
// c: p=物理 m=魔法 s=変化 / fx: 演出パターン
const MOVES = {};
function M(id, n, t, c, pw, ac, o = {}) { MOVES[id] = Object.assign({ id, n, t, c, pw, ac }, o); }

// 無
M('tackle', '体当たり', 'none', 'p', 50, 100, { fx: 'lunge', contact: 1, d: '基本の突進攻撃。' });
M('quick', '疾駆', 'none', 'p', 40, 100, { pr: 1, fx: 'dash', contact: 1, d: '必ず先制できる。' });
M('reckless', '捨て身', 'none', 'p', 120, 100, { recoil: .33, fx: 'lunge', contact: 1, d: '与えたダメージの1/3を自分も受ける。' });
M('explode', '魂爆', 'none', 'p', 250, 100, { selfko: 1, fx: 'explode', d: '自分は瀕死になる。' });
M('guillotine', '断罪の刃', 'none', 'p', 0, 30, { ohko: 1, fx: 'guillotine', d: '命中すれば一撃で倒す。命中30。' });
M('pivot', '帰還の一撃', 'none', 'p', 70, 100, { pivot: 1, fx: 'slash', contact: 1, d: '攻撃後、控えと交代する。' });
M('chaos', '混沌の賽', 'none', 'm', 0, 100, { chaos: 1, fx: 'chaos', d: '何が起きるか誰にもわからない。' });
M('gamble', '運命の天秤', 'none', 'p', 0, 90, { gamble: 1, fx: 'gamble', d: '威力が10〜200でランダムに決まる。' });
M('dance', '狂乱の舞', 'none', 's', 0, 0, { self: { atk: 1, spd: 1 }, fx: 'buff', d: '攻撃と素早さを1段階上げる。' });
M('swords', '剣気解放', 'none', 's', 0, 0, { self: { atk: 2 }, fx: 'buff', d: '攻撃を2段階上げる。' });
M('meditate', '瞑想', 'none', 's', 0, 0, { self: { mag: 1, res: 1 }, fx: 'buff', d: '魔力と抗魔を1段階上げる。' });
M('protect', '守護結界', 'none', 's', 0, 0, { protect: 1, pr: 4, fx: 'shield', d: 'そのターンの攻撃を防ぐ。連続使用で失敗しやすい。' });
M('recover', '再生', 'none', 's', 0, 0, { heal: .5, fx: 'heal', d: 'HPを最大の半分回復する。' });
M('spikes', '魔針散布', 'none', 's', 0, 0, { hazard: 1, fx: 'spikes', d: '相手の場に魔針を撒く。交代で出てきた魔獣にダメージ（最大3層）。' });
M('haze', '霧散', 'none', 's', 0, 0, { haze: 1, fx: 'haze', d: '全ての能力変化を元に戻す。' });
M('roar', '咆哮', 'none', 's', 0, 0, { roar: 1, pr: -6, fx: 'roar', d: '相手を強制的に交代させる。後攻。' });
M('glare', '睨み', 'none', 's', 0, 90, { st: ['par', 100], fx: 'status', d: '相手を麻痺させる。' });

// 炎
M('ember', '火炎弾', 'fire', 'm', 60, 100, { st: ['brn', 10], fx: 'orb', d: '10%で火傷。' });
M('inferno', '業火', 'fire', 'm', 110, 85, { st: ['brn', 30], fx: 'pillar', d: '30%で火傷。' });
M('flameclaw', '灼爪', 'fire', 'p', 75, 100, { st: ['brn', 20], fx: 'claw', contact: 1, d: '20%で火傷。' });
M('overheat', '焦熱爆陣', 'fire', 'm', 130, 90, { self: { mag: -2 }, fx: 'nova', d: '使うと魔力が2段階下がる。' });
M('willo', '鬼火', 'fire', 's', 0, 85, { st: ['brn', 100], fx: 'status', d: '相手を火傷にする。' });
M('firefang', '炎牙', 'fire', 'p', 65, 95, { st: ['brn', 10], fl: 10, fx: 'bite', contact: 1, d: '10%で火傷、10%で怯み。' });
M('flarerush', '煉獄突進', 'fire', 'p', 120, 100, { recoil: .33, st: ['brn', 10], fx: 'dash', contact: 1, d: '反動1/3。10%で火傷。' });
M('sunrite', '陽喚の儀', 'fire', 's', 0, 0, { field: 'sun', fx: 'field', d: '場を「灼熱」に変える。' });

// 水
M('aqua', '水流波', 'water', 'm', 65, 100, { foe: { spd: -1 }, ch: 20, fx: 'wave', d: '20%で相手の素早さ↓。' });
M('tsunami', '大海嘯', 'water', 'm', 110, 80, { fx: 'tsunami', d: '巨大な津波で押し流す。' });
M('jaws', '渦潮の顎', 'water', 'p', 80, 100, { fl: 20, fx: 'bite', contact: 1, d: '20%で怯み。' });
M('raindance', '雨乞い', 'water', 's', 0, 0, { field: 'rain', fx: 'field', d: '場を「豪雨」に変える。' });
M('drop', '癒しの雫', 'water', 's', 0, 0, { heal: .5, cure: 1, fx: 'heal', d: 'HPを半分回復し状態異常も治す。' });
M('torrentcut', '激流斬', 'water', 'p', 90, 95, { crit: 1, fx: 'slash', contact: 1, d: '急所に当たりやすい。' });

// 樹
M('leafblade', '翠刃', 'wood', 'p', 75, 100, { crit: 1, fx: 'leaves', contact: 1, d: '急所に当たりやすい。' });
M('drain', '吸精蔦', 'wood', 'm', 75, 100, { drain: .5, fx: 'vines', d: '与えたダメージの半分を回復。' });
M('spore', '眠り胞子', 'wood', 's', 0, 75, { st: ['slp', 100], fx: 'spore', d: '相手を眠らせる。' });
M('forest', '森羅万象', 'wood', 'm', 120, 85, { fx: 'forest', d: '大樹の力で叩き潰す。' });
M('thorn', '毒棘', 'wood', 'p', 60, 100, { st: ['psn', 30], fx: 'vines', contact: 1, d: '30%で毒。' });
M('toxicmist', '毒霧', 'wood', 's', 0, 90, { st: ['psn', 100], fx: 'spore', d: '相手を毒にする。' });
M('grove', '樹海創生', 'wood', 's', 0, 0, { field: 'grove', fx: 'field', d: '場を「樹海」に変える。' });

// 雷
M('bolt', '雷撃', 'thunder', 'm', 90, 100, { st: ['par', 10], fx: 'bolt', d: '10%で麻痺。' });
M('thunderfall', '落雷', 'thunder', 'm', 120, 70, { st: ['par', 30], fx: 'thunderfall', d: '30%で麻痺。豪雨なら必中。' });
M('twave', '電磁波', 'thunder', 's', 0, 90, { st: ['par', 100], fx: 'status', d: '相手を麻痺させる。' });
M('tpunch', '雷光拳', 'thunder', 'p', 75, 100, { st: ['par', 10], fx: 'punch', contact: 1, d: '10%で麻痺。' });
M('discharge', '放電', 'thunder', 'm', 80, 100, { st: ['par', 30], fx: 'nova', d: '30%で麻痺。' });
M('voltdash', '迅雷', 'thunder', 'p', 45, 100, { pr: 1, fx: 'dash', contact: 1, d: '必ず先制できる。' });

// 氷
M('icicle', '氷柱連弾', 'ice', 'p', 25, 100, { hits: [2, 5], fx: 'shards', d: '2〜5回連続で攻撃。' });
M('frostbreath', '凍息', 'ice', 'm', 90, 100, { st: ['frz', 10], fx: 'beam', d: '10%で凍結。' });
M('zero', '絶対零度', 'ice', 'm', 0, 30, { ohko: 1, fx: 'zero', d: '命中すれば一撃で倒す。命中30。' });
M('icefang', '氷牙', 'ice', 'p', 65, 95, { st: ['frz', 10], fl: 10, fx: 'bite', contact: 1, d: '10%で凍結、10%で怯み。' });
M('blizzard', '大吹雪', 'ice', 'm', 110, 70, { st: ['frz', 10], fx: 'blizzard', d: '10%で凍結。吹雪の場では必中。' });
M('icearmor', '氷鎧', 'ice', 's', 0, 0, { self: { def: 1, res: 1 }, fx: 'buff', d: '防御と抗魔を1段階上げる。' });
M('snowcall', '雪乞い', 'ice', 's', 0, 0, { field: 'snow', fx: 'field', d: '場を「吹雪」に変える。' });

// 鋼
M('ironfist', '鋼拳', 'steel', 'p', 80, 100, { fx: 'punch', contact: 1, d: '硬い拳で殴る。' });
M('steelcut', '断鋼斬', 'steel', 'p', 100, 90, { crit: 1, fx: 'slash', contact: 1, d: '急所に当たりやすい。' });
M('irondef', '鉄壁', 'steel', 's', 0, 0, { self: { def: 2 }, fx: 'buff', d: '防御を2段階上げる。' });
M('gatling', '機銃連撃', 'steel', 'p', 20, 95, { hits: [2, 5], fx: 'gatling', d: '2〜5回連続で攻撃。' });
M('hammer', '重鋼槌', 'steel', 'p', 130, 85, { self: { spd: -1 }, fx: 'hammer', contact: 1, d: '使うと素早さが1段階下がる。' });
M('flashcannon', '光鋼砲', 'steel', 'm', 85, 100, { foe: { res: -1 }, ch: 10, fx: 'beam', d: '10%で相手の抗魔↓。' });

// 冥
M('shadowstrike', '影討', 'dark', 'p', 70, 100, { pr: 1, fx: 'shadow', contact: 1, d: '影から必ず先制する。' });
M('darkorb', '冥球', 'dark', 'm', 85, 100, { foe: { res: -1 }, ch: 20, fx: 'orb', d: '20%で相手の抗魔↓。' });
M('hex', '呪言', 'dark', 's', 0, 90, { st: ['crs', 100], fx: 'status', d: '相手を呪詛状態にする。毎ターン増大するダメージ。' });
M('souleat', '魂喰い', 'dark', 'm', 75, 100, { drain: .5, fx: 'souleat', d: '与えたダメージの半分を回復。' });
M('nightmare', '悪夢', 'dark', 'm', 100, 85, { cnf: 30, fx: 'nightmare', d: '30%で相手を混乱させる。' });
M('grudge', '怨嗟の爪', 'dark', 'p', 70, 100, { grudge: 1, fx: 'claw', contact: 1, d: '自分が状態異常なら威力2倍。' });
M('miasma', '瘴気招来', 'dark', 's', 0, 0, { field: 'miasma', fx: 'field', d: '場を「瘴気」に変える。' });
M('bloodrite', '紅月の儀', 'dark', 's', 0, 0, { field: 'bloodmoon', fx: 'field', d: '場を「紅月」に変える。急所率が激増。' });

// 聖
M('holylight', '聖光', 'holy', 'm', 80, 100, { fx: 'beam', d: '清らかな光線。' });
M('judgment', '裁きの光', 'holy', 'm', 120, 85, { fx: 'judgment', d: '天から光の柱を降らせる。' });
M('pray', '祈り', 'holy', 's', 0, 0, { heal: .5, cure: 1, fx: 'heal', d: 'HPを半分回復し状態異常も治す。' });
M('holysword', '聖剣', 'holy', 'p', 90, 100, { crit: 1, fx: 'slash', contact: 1, d: '急所に当たりやすい。' });
M('purify', '浄化の波', 'holy', 'm', 70, 100, { haze: 1, fx: 'wave', d: '攻撃後、全ての能力変化を元に戻す。' });
M('revelation', '天啓', 'holy', 's', 0, 0, { self: { mag: 1, spd: 1 }, fx: 'buff', d: '魔力と素早さを1段階上げる。' });
M('sanctum', '聖域展開', 'holy', 's', 0, 0, { field: 'sanct', fx: 'field', d: '場を「聖域」に変える。' });

// ---- 特性 ----
const ABILITIES = {
  intimidate: { n: '威圧', d: '登場時、相手の攻撃を1段階下げる。' },
  regen: { n: '再生体', d: '交代で引っ込むとHPが1/3回復する。' },
  speedboost: { n: '加速', d: '毎ターン終了時に素早さが上がる。' },
  sturdy: { n: '頑丈', d: 'HP満タンから一撃では倒れない。' },
  cursedbody: { n: '呪いの躯', d: '接触攻撃を受けると30%で相手を呪詛にする。' },
  blaze: { n: '逆境', d: 'HPが1/3以下になると技の威力が1.5倍。' },
  berserk: { n: '狂戦士', d: '攻撃を受けるたびに攻撃が上がる。' },
  adapt: { n: '適応力', d: 'タイプ一致の補正が2倍になる。' },
  lucky: { n: '強運', d: '急所に当たりやすい。' },
  contrary: { n: '天邪鬼', d: '能力変化が全て逆になる。' },
  gambler: { n: '博徒', d: 'ダメージ乱数が0.4〜1.8倍になる（敵味方とも）。' },
  guts: { n: '不屈', d: '状態異常のとき攻撃が1.5倍。火傷の減少も受けない。' },
  magicguard: { n: '魔装', d: '攻撃技以外のダメージを受けない。' },
  absorbthunder: { n: '避雷', d: '雷技を受けると、ダメージの代わりにHPを1/4回復。' },
  flamebody: { n: '炎の躯', d: '接触攻撃を受けると30%で相手を火傷にする。' },
  staticbody: { n: '帯電', d: '接触攻撃を受けると30%で相手を麻痺させる。' },
  sunCall: { n: '日照り', d: '登場時、場を「灼熱」にする。' },
  rainCall: { n: '雨呼び', d: '登場時、場を「豪雨」にする。' },
  stormCall: { n: '嵐呼び', d: '登場時、場を「雷雲」にする。' },
  snowCall: { n: '雪降らし', d: '登場時、場を「吹雪」にする。' },
  miasmaCall: { n: '瘴気纏い', d: '登場時、場を「瘴気」にする。' },
  sanctCall: { n: '聖域纏い', d: '登場時、場を「聖域」にする。' },
  moonCall: { n: '紅月の使徒', d: '登場時、場を「紅月」にする。' },
  chaosCall: { n: '混沌の器', d: '登場時、場を「魔潮」にする。' },
  multiscale: { n: '多重鱗', d: 'HP満タンのとき受けるダメージ半減。' },
  technician: { n: '技巧', d: '威力60以下の技の威力が1.5倍。' },
  serene: { n: '天恵', d: '技の追加効果の確率が2倍。' },
  moody: { n: '気分屋', d: '毎ターン、ランダムな能力が2段階上がり、別の能力が1段階下がる。' },
  souleater: { n: '魂喰らい', d: '相手を倒すと攻撃と魔力が上がる。' },
  thickfat: { n: '厚い脂肪', d: '炎と氷の技のダメージ半減。' },
  prankster: { n: '悪戯心', d: '変化技が先制で出せる。' },
};

// ---- 持ち物 ----
const ITEMS = {
  lifeorb: { n: '命の宝珠', d: '技の威力1.3倍。攻撃するたびHPが1/10減る。' },
  sash: { n: '守りの護符', d: 'HP満タンから倒される攻撃を1度だけHP1で耐える。' },
  leftovers: { n: '再生の苔', d: '毎ターンHPが1/16回復する。' },
  feather: { n: '疾風の羽', d: '素早さが1.3倍。' },
  expert: { n: '達人の帯', d: '効果抜群の技のダメージ1.25倍。' },
  berry: { n: '紅き果実', d: 'HPが1/4以下になると1度だけHPを半分回復。' },
  scope: { n: '鷹の眼鏡', d: '急所に当たりやすい。' },
  quickclaw: { n: '先制の爪', d: '20%の確率で優先して行動できる。' },
  dice: { n: '気まぐれの賽', d: '毎ターン30%でランダムな能力が上がる。' },
  helmet: { n: '棘の鎧', d: '接触攻撃してきた相手にHP1/6のダメージ。' },
  shellbell: { n: '吸魂の鈴', d: '与えたダメージの1/6を回復する。' },
  powder: { n: '幻惑の粉', d: '相手の技の命中率が10%下がる。' },
  kingsrock: { n: '王者の印', d: '攻撃技に10%の怯み効果がつく。' },
  amulet: { n: '覚醒の護石', d: '覚醒ゲージが溜まりやすくなる（1.5倍）。' },
};

// ---- 場（異変） ----
const FIELDS = {
  none:      { n: '静寂', d: '何も起きていない。', sky: ['#1a1830', '#3a3060', '#6a5080'], p: 'motes', tint: null },
  sun:       { n: '灼熱', d: '炎技1.5倍・水技0.5倍。', sky: ['#4a1005', '#c0401a', '#ffb050'], p: 'embers', tint: 'rgba(255,120,40,0.10)' },
  rain:      { n: '豪雨', d: '水技1.5倍・炎技0.5倍。落雷が必中。', sky: ['#05101e', '#163050', '#2a5070'], p: 'rain', tint: 'rgba(40,90,160,0.12)' },
  storm:     { n: '雷雲', d: '雷技1.5倍。毎ターン落雷が降り注ぐ。', sky: ['#0a0818', '#2a2050', '#504070'], p: 'storm', tint: 'rgba(240,220,60,0.05)' },
  snow:      { n: '吹雪', d: '氷技1.5倍。氷・鋼以外は毎ターン1/16ダメージ。', sky: ['#0e1a2a', '#4a6a8a', '#b0d0e8'], p: 'snow', tint: 'rgba(200,240,255,0.12)' },
  miasma:    { n: '瘴気', d: '冥技1.5倍。冥以外は毎ターン10%で毒になる。', sky: ['#0a0414', '#301040', '#602070'], p: 'miasma', tint: 'rgba(140,40,200,0.12)' },
  sanct:     { n: '聖域', d: '聖技1.5倍・冥技0.75倍。毎ターン状態異常が25%で治る。', sky: ['#2a2a40', '#8080b0', '#fff0c0'], p: 'feathers', tint: 'rgba(255,240,180,0.10)' },
  bloodmoon: { n: '紅月', d: '急所率が大幅に上昇。全ダメージ1.1倍。', sky: ['#120005', '#400010', '#901020'], p: 'bloodmoon', tint: 'rgba(200,0,30,0.12)' },
  chaos:     { n: '魔潮', d: 'ダメージ乱数0.5〜1.5。混沌事件の発生率3倍。', sky: ['#05001a', '#30106a', '#ff40b0'], p: 'chaos', tint: 'rgba(255,60,200,0.08)' },
  grove:     { n: '樹海', d: '樹技1.5倍。毎ターン全員HPが1/16回復。', sky: ['#04140a', '#104a20', '#50a050'], p: 'pollen', tint: 'rgba(80,200,80,0.08)' },
};
const FIELD_BOOST = { sun: ['fire', 1.5, 'water', .5], rain: ['water', 1.5, 'fire', .5], storm: ['thunder', 1.5], snow: ['ice', 1.5], miasma: ['dark', 1.5], sanct: ['holy', 1.5, 'dark', .75], grove: ['wood', 1.5] };

// ---- 魔獣 ----
// b: [HP, 攻撃, 防御, 魔力, 抗魔, 素早さ]
// art.body: quad | serpent | humanoid | bird | golem | blob | eye | plant
const BEASTS = [
  { id: 'ignivolg', n: 'イグニヴォルグ', title: '焦土の狼王', types: ['fire'], b: [80, 115, 75, 70, 70, 110], ab: 'intimidate',
    moves: ['flameclaw', 'flarerush', 'quick', 'dance'], ult: { n: '紅蓮狼牙・千火', t: 'fire', c: 'p', pw: 170, st: ['brn', 50], fx: 'u_fire' },
    art: { body: 'quad', col: ['#d8401a', '#5a1408', '#ffcf40'], eye: '#fff36a', mane: 'flame', tail: 'flame', horns: 0 },
    lore: '火山帯の封印から逃れた狼。走った跡は百年焦げたままという。' },
  { id: 'vulcanos', n: 'ヴァルカノス', title: '熔鉄の巨神', types: ['fire', 'steel'], b: [105, 120, 120, 60, 80, 35], ab: 'sturdy',
    moves: ['hammer', 'flarerush', 'irondef', 'spikes'], ult: { n: '熔核崩落', t: 'fire', c: 'p', pw: 190, fx: 'u_meteor' },
    art: { body: 'golem', col: ['#4a3a34', '#1e1612', '#ff6a1a'], eye: '#ffd040', core: 'lava' },
    lore: '溶岩の心臓を持つ古代兵器。鍛冶神の失敗作と伝わる。' },
  { id: 'homura', n: '焔姫ホムラ', title: '灰燼の巫女剣士', types: ['fire', 'holy'], b: [75, 85, 70, 115, 90, 95], ab: 'sunCall',
    moves: ['inferno', 'holylight', 'willo', 'meditate'], ult: { n: '天照焔舞', t: 'fire', c: 'm', pw: 175, fx: 'u_sun' },
    art: { body: 'humanoid', col: ['#f2e6d8', '#b01818', '#ffb000'], eye: '#ff4020', hair: '#ff3a1a', weapon: 'katana', aura: '#ff6a00', cape: '#7a0a0a' },
    lore: '魔獣の血を引く巫女。己の身に焔の獣を宿して戦う。' },
  { id: 'leviaru', n: 'リヴァイアル', title: '深淵の海蛇', types: ['water', 'dark'], b: [95, 110, 85, 85, 90, 80], ab: 'multiscale',
    moves: ['jaws', 'tsunami', 'dance', 'shadowstrike'], ult: { n: '冥海・大渦獄', t: 'water', c: 'p', pw: 175, fx: 'u_vortex' },
    art: { body: 'serpent', col: ['#1a3a8a', '#0a1430', '#40e0ff'], eye: '#ff2050', fins: 1, horns: 2 },
    lore: '船乗りが「海の終わり」と呼ぶ海溝に棲む。百隻を呑んだ。' },
  { id: 'mare', n: '潮騎士マーレ', title: '沈没王国の騎士', types: ['water', 'steel'], b: [90, 105, 110, 60, 85, 60], ab: 'rainCall',
    moves: ['torrentcut', 'ironfist', 'protect', 'swords'], ult: { n: '海神槍・トリアイナ', t: 'water', c: 'p', pw: 180, crit: 2, fx: 'u_spear' },
    art: { body: 'humanoid', col: ['#5a7a9a', '#14304a', '#40c0ff'], eye: '#80ffff', hair: '#20506a', weapon: 'trident', aura: '#40a0ff', helm: 1, cape: '#103050' },
    lore: '海に沈んだ王国の最後の騎士。主君の帰還を今も待つ。' },
  { id: 'aquamira', n: 'アクアミラ', title: '月光の水母', types: ['water', 'holy'], b: [100, 50, 80, 100, 115, 65], ab: 'regen',
    moves: ['aqua', 'drop', 'toxicmist', 'holylight'], ult: { n: '月涙の揺籠', t: 'holy', c: 'm', pw: 150, healUser: .5, fx: 'u_moon' },
    art: { body: 'blob', col: ['#80c8ff', '#2050a0', '#ffffff'], eye: '#ffffff', tentacles: 7 },
    lore: '満月の夜にだけ浮上する。触手に触れた者は夢を見続ける。' },
  { id: 'druida', n: 'ドルイダ', title: '千年樹の翁', types: ['wood', 'holy'], b: [120, 95, 115, 80, 100, 25], ab: 'thickfat',
    moves: ['forest', 'drain', 'spore', 'recover'], ult: { n: '世界樹の審判', t: 'wood', c: 'm', pw: 180, fx: 'u_forest' },
    art: { body: 'golem', col: ['#5a3a20', '#2a1a0a', '#80ff60'], eye: '#c0ff80', core: 'leaf', moss: 1 },
    lore: '森が魔獣化した存在。千年分の怒りを根に溜めている。' },
  { id: 'mandra', n: 'マンドラゴア', title: '絶叫の毒蘭', types: ['wood', 'dark'], b: [80, 70, 85, 110, 90, 75], ab: 'prankster',
    moves: ['toxicmist', 'souleat', 'spore', 'drain'], ult: { n: '冥花・断末魔', t: 'dark', c: 'm', pw: 160, cnf: 100, fx: 'u_scream' },
    art: { body: 'plant', col: ['#a02060', '#2a5a20', '#ff60c0'], eye: '#ffff40' },
    lore: '引き抜くと絶叫する毒の花。その声を聞いた者は二度と眠れない。' },
  { id: 'silva', n: 'シルヴァディア', title: '翠角の霊鹿', types: ['wood'], b: [85, 105, 80, 80, 80, 115], ab: 'serene',
    moves: ['leafblade', 'thorn', 'grove', 'quick'], ult: { n: '翠嵐角陣', t: 'wood', c: 'p', pw: 170, crit: 2, fx: 'u_leafstorm' },
    art: { body: 'quad', col: ['#e8f0d8', '#3a7a3a', '#60ff80'], eye: '#40ff80', antlers: 1, tail: 'leaf', mane: 'leaf' },
    lore: '森の境界を見張る霊獣。その角は春を呼ぶという。' },
  { id: 'voltis', n: 'ヴォルティス', title: '天穿つ雷鳥', types: ['thunder'], b: [80, 80, 70, 120, 80, 120], ab: 'stormCall',
    moves: ['bolt', 'thunderfall', 'twave', 'quick'], ult: { n: '天雷・神鳴', t: 'thunder', c: 'm', pw: 180, st: ['par', 50], fx: 'u_thunder' },
    art: { body: 'bird', col: ['#f8d020', '#2a2a60', '#ffffff'], eye: '#40ffff', crest: 1, spark: 1 },
    lore: '羽ばたくたびに雷雲が生まれる。嵐そのものが形をとった鳥。' },
  { id: 'galva', n: 'ガルヴァ・MkIII', title: '雷動機兵', types: ['thunder', 'steel'], b: [85, 110, 105, 90, 75, 70], ab: 'staticbody',
    moves: ['tpunch', 'gatling', 'discharge', 'voltdash'], ult: { n: 'オーバーロード・ブラスト', t: 'thunder', c: 'p', pw: 185, fx: 'u_laser' },
    art: { body: 'humanoid', col: ['#606878', '#1a1e2a', '#ffe020'], eye: '#ffe020', weapon: 'gauntlet', aura: '#ffe020', helm: 2, mech: 1 },
    lore: '封獣工廠が作り出した人造魔獣。魂のかわりに雷霊が入っている。' },
  { id: 'raika', n: '紫電狐ライカ', title: '九尾の雷狐', types: ['thunder', 'dark'], b: [70, 75, 65, 115, 85, 125], ab: 'lucky',
    moves: ['bolt', 'nightmare', 'chaos', 'shadowstrike'], ult: { n: '九尾紫電陣', t: 'thunder', c: 'm', pw: 170, cnf: 50, fx: 'u_ninetail' },
    art: { body: 'quad', col: ['#e8e0ff', '#6020a0', '#d070ff'], eye: '#ff40ff', tail: 'nine', ears: 1 },
    lore: '人を化かすのが大好きな狐。気まぐれに雷を落としていく。' },
  { id: 'frostheim', n: 'フロストヘイム', title: '永久凍土の竜', types: ['ice', 'dark'], b: [100, 90, 90, 115, 90, 70], ab: 'snowCall',
    moves: ['blizzard', 'frostbreath', 'darkorb', 'zero'], ult: { n: '終焉氷河', t: 'ice', c: 'm', pw: 180, st: ['frz', 30], fx: 'u_glacier' },
    art: { body: 'serpent', col: ['#a0d8f0', '#2a4a6a', '#ffffff'], eye: '#4080ff', horns: 3, wings: 1, crystals: 1 },
    lore: '世界の北端で眠る竜。目覚めるたびに一つの国が凍る。' },
  { id: 'setsuna', n: '雪華姫セツナ', title: '六花の剣舞姫', types: ['ice', 'holy'], b: [75, 110, 70, 90, 80, 115], ab: 'technician',
    moves: ['icicle', 'holysword', 'icefang', 'swords'], ult: { n: '六花繚乱・氷華斬', t: 'ice', c: 'p', pw: 175, crit: 3, fx: 'u_iceslash' },
    art: { body: 'humanoid', col: ['#ffffff', '#4060a0', '#a0f0ff'], eye: '#60c0ff', hair: '#e0f4ff', weapon: 'twin', aura: '#a0f0ff', cape: '#3050a0' },
    lore: '雪山の剣術道場の最後の弟子。斬られた者は痛みより先に美しさを感じる。' },
  { id: 'crystalos', n: 'クリスタロス', title: '氷晶の要塞獣', types: ['ice', 'steel'], b: [110, 95, 135, 70, 100, 30], ab: 'magicguard',
    moves: ['icicle', 'irondef', 'spikes', 'hammer'], ult: { n: '晶壁粉砕撃', t: 'ice', c: 'p', pw: 175, fx: 'u_glacier' },
    art: { body: 'golem', col: ['#a8d8f0', '#3a5a7a', '#e0ffff'], eye: '#40c0ff', core: 'crystal', crystals: 1 },
    lore: '氷晶が何万年もかけて意思を持った。動くたびに澄んだ音が鳴る。' },
  { id: 'legion', n: 'アイアン・レギオン', title: '不壊の重装兵', types: ['steel'], b: [100, 125, 125, 50, 85, 45], ab: 'berserk',
    moves: ['steelcut', 'hammer', 'reckless', 'protect'], ult: { n: '鉄軍進撃', t: 'steel', c: 'p', pw: 190, fx: 'u_hammer' },
    art: { body: 'humanoid', col: ['#808a98', '#2a2e38', '#ff4040'], eye: '#ff2020', weapon: 'greatsword', aura: '#ff4040', helm: 3, bulky: 1, cape: '#501010' },
    lore: '戦場で死んだ千人の兵士の鎧が集まり、一つの意思となった。' },
  { id: 'zanba', n: '剣鬼ザンバ', title: '百人斬りの浪人', types: ['steel', 'dark'], b: [80, 130, 85, 60, 70, 105], ab: 'souleater',
    moves: ['steelcut', 'shadowstrike', 'swords', 'guillotine'], ult: { n: '冥刀・無間斬', t: 'dark', c: 'p', pw: 180, crit: 3, fx: 'u_darkslash' },
    art: { body: 'humanoid', col: ['#3a3040', '#14101a', '#a040ff'], eye: '#ff3060', hair: '#201828', weapon: 'katana', aura: '#8020ff', hat: 1 },
    lore: '妖刀に魂を喰われた剣士。斬った相手の数だけ強くなる。' },
  { id: 'abyss', n: 'アビス・アイ', title: '深淵の観測者', types: ['dark'], b: [85, 60, 80, 130, 105, 85], ab: 'moody',
    moves: ['darkorb', 'hex', 'nightmare', 'haze'], ult: { n: '深淵凝視', t: 'dark', c: 'm', pw: 175, foe: { res: -2 }, fx: 'u_gaze' },
    art: { body: 'eye', col: ['#2a0a3a', '#100418', '#ff2080'], eye: '#ff2060', rings: 3 },
    lore: '深淵を覗く者を、深淵は見返す。それがこの眼である。' },
  { id: 'necros', n: 'ネクロス', title: '屍骨の炎竜', types: ['dark', 'fire'], b: [90, 110, 85, 110, 80, 80], ab: 'cursedbody',
    moves: ['inferno', 'souleat', 'grudge', 'willo'], ult: { n: '冥獄炎葬', t: 'dark', c: 'm', pw: 180, st: ['crs', 50], fx: 'u_hellfire' },
    art: { body: 'serpent', col: ['#d8d0c0', '#301a30', '#40ff80'], eye: '#40ff80', horns: 2, wings: 1, bone: 1 },
    lore: '古戦場で死した竜の骨に、怨念の緑炎が宿ったもの。' },
  { id: 'jester', n: 'ジェスター', title: '嘲笑う影道化', types: ['dark', 'none'], b: [80, 90, 80, 90, 80, 100], ab: 'contrary',
    moves: ['chaos', 'gamble', 'overheat', 'hex'], ult: { n: '道化の大博打', t: 'none', c: 'm', pw: 0, chaosUlt: 1, fx: 'u_chaos' },
    art: { body: 'humanoid', col: ['#f0f0f0', '#200a30', '#ff30a0'], eye: '#ffff40', hair: '#ff30a0', weapon: 'cards', aura: '#ff30a0', jester: 1 },
    lore: '工廠に紛れ込んだ謎の存在。誰の味方でもなく、ただ笑っている。' },
  { id: 'seraph', n: 'セラフィエル', title: '雷翼の熾天使', types: ['holy', 'thunder'], b: [85, 70, 80, 120, 100, 100], ab: 'sanctCall',
    moves: ['judgment', 'bolt', 'pray', 'revelation'], ult: { n: '神罰・雷光審判', t: 'holy', c: 'm', pw: 180, fx: 'u_judgment' },
    art: { body: 'bird', col: ['#fffaf0', '#c0a060', '#ffe060'], eye: '#ffe060', crest: 2, halo: 1, sixwing: 1 },
    lore: '天より遣わされた監視者。工廠の存在を許すか否か、見極めている。' },
  { id: 'arthur', n: '聖騎士アルトリウス', title: '白銀の誓約騎士', types: ['holy', 'steel'], b: [95, 115, 115, 70, 95, 55], ab: 'guts',
    moves: ['holysword', 'steelcut', 'swords', 'protect'], ult: { n: '聖剣解放・エクスカリバーン', t: 'holy', c: 'p', pw: 185, fx: 'u_holysword' },
    art: { body: 'humanoid', col: ['#e8eef8', '#3050a0', '#ffe060'], eye: '#80d0ff', hair: '#ffe080', weapon: 'greatsword', aura: '#ffe060', helm: 1, cape: '#2040a0', bulky: 1 },
    lore: '魔獣狩りの騎士団長。だが今は、魔獣と共に戦うことを選んだ。' },
  { id: 'kirin', n: '白麒麟', title: '瑞祥の聖獣', types: ['holy', 'wood'], b: [90, 85, 85, 105, 105, 90], ab: 'regen',
    moves: ['judgment', 'drain', 'grove', 'twave'], ult: { n: '瑞光天翔', t: 'holy', c: 'm', pw: 170, healTeam: .25, fx: 'u_sun' },
    art: { body: 'quad', col: ['#fffaf0', '#c0a060', '#80ffd0'], eye: '#40c0a0', horns: 1, mane: 'cloud', tail: 'cloud' },
    lore: '平和な世にだけ現れるはずの聖獣。なぜ工廠にいるのかは謎だ。' },
  { id: 'gorgo', n: 'ゴルゴニア', title: '石化の蛇女王', types: ['dark', 'wood'], b: [85, 80, 90, 105, 95, 85], ab: 'serene',
    moves: ['glare', 'thorn', 'darkorb', 'drain'], ult: { n: '石棺の魔眼', t: 'dark', c: 'm', pw: 160, st: ['par', 100], fx: 'u_gaze' },
    art: { body: 'serpent', col: ['#40a060', '#1a3a20', '#ffe040'], eye: '#ffe040', horns: 0, hood: 1 },
    lore: '目を合わせた者を石に変える蛇の女王。宝石を集める癖がある。' },
  { id: 'brute', n: 'ベヒモス', title: '大地喰らい', types: ['none'], b: [130, 120, 90, 50, 80, 50], ab: 'thickfat',
    moves: ['reckless', 'gamble', 'roar', 'dance'], ult: { n: '大地崩壊', t: 'none', c: 'p', pw: 200, fx: 'u_quake' },
    art: { body: 'quad', col: ['#806050', '#3a2418', '#ffb060'], eye: '#ff4020', horns: 2, bulky: 1, tail: 'club' },
    lore: '山ほどの巨体を持つ獣。空腹になると大地ごと喰らう。' },
  { id: 'phoenix', n: 'フェニクシア', title: '不死の焔鳥', types: ['fire', 'none'], b: [90, 75, 80, 115, 95, 100], ab: 'magicguard',
    moves: ['inferno', 'recover', 'sunrite', 'ember'], ult: { n: '輪廻転焔', t: 'fire', c: 'm', pw: 170, healUser: .4, fx: 'u_phoenix' },
    art: { body: 'bird', col: ['#ff6020', '#801010', '#ffe060'], eye: '#ffff80', crest: 1, flamewing: 1 },
    lore: '灰から何度でも甦る鳥。工廠はその灰を千年分保管している。' },
  { id: 'kraken', n: 'クラーケン', title: '海魔の暴君', types: ['water'], b: [105, 115, 90, 75, 85, 65], ab: 'adapt',
    moves: ['jaws', 'tsunami', 'raindance', 'reckless'], ult: { n: '千腕海獄', t: 'water', c: 'p', pw: 180, fx: 'u_vortex' },
    art: { body: 'blob', col: ['#a02040', '#401020', '#ffa040'], eye: '#ffe040', tentacles: 9, kraken: 1 },
    lore: '海の伝説。触腕の一本一本が独立した意思を持つという。' },
  { id: 'moth', n: 'ルナモス', title: '紅月の蛾', types: ['dark', 'holy'], b: [80, 60, 75, 115, 100, 110], ab: 'moonCall',
    moves: ['nightmare', 'holylight', 'spore', 'meditate'], ult: { n: '月蝕鱗粉', t: 'dark', c: 'm', pw: 165, slp: 50, fx: 'u_moon' },
    art: { body: 'bird', col: ['#c02040', '#200810', '#ffd0e0'], eye: '#ff8090', moth: 1 },
    lore: '紅い月にだけ現れる巨大な蛾。その鱗粉は血の味がする。' },
];
// ボス専用（交換で入手可能）
const LEGENDS = [
  { id: 'chaostia', n: 'カオスティア', title: '混沌の原初神', types: ['dark', 'holy'], b: [110, 110, 100, 130, 100, 100], ab: 'chaosCall', legend: 1,
    moves: ['chaos', 'judgment', 'darkorb', 'meditate'], ult: { n: '天地開闢', t: 'none', c: 'm', pw: 220, fx: 'u_chaos' },
    art: { body: 'eye', col: ['#ffffff', '#30106a', '#ff40b0'], eye: '#40ffff', rings: 5, halo: 1 },
    lore: '工廠の地下深くに封じられた原初の神。全ての魔獣はここから生まれた。' },
  { id: 'grimwald', n: 'グリムヴァルト', title: '工廠長の切り札', types: ['steel', 'fire'], b: [105, 130, 110, 90, 90, 85], ab: 'berserk', legend: 1,
    moves: ['hammer', 'flarerush', 'swords', 'quick'], ult: { n: '工廠炉心解放', t: 'fire', c: 'p', pw: 210, fx: 'u_meteor' },
    art: { body: 'golem', col: ['#30303a', '#101018', '#ff3010'], eye: '#ff2000', core: 'lava', crown: 1 },
    lore: '工廠長が自らの魂を炉に投じて生み出した、最強の人造魔獣。' },
];
const ALL_BEASTS = BEASTS.concat(LEGENDS);
const BEAST_BY_ID = Object.fromEntries(ALL_BEASTS.map(b => [b.id, b]));

const NATURES = [
  { n: '勇猛', up: 'atk', dn: 'mag' }, { n: '慎重', up: 'res', dn: 'mag' }, { n: '臆病', up: 'spd', dn: 'atk' },
  { n: '冷静', up: 'mag', dn: 'spd' }, { n: '頑固', up: 'atk', dn: 'res' }, { n: '図太', up: 'def', dn: 'atk' },
  { n: '陽気', up: 'spd', dn: 'mag' }, { n: '控目', up: 'mag', dn: 'atk' }, { n: '素直', up: null, dn: null },
  { n: '狂暴', up: 'atk', dn: 'def' }, { n: '不遜', up: 'mag', dn: 'res' }, { n: '鈍重', up: 'def', dn: 'spd' },
];

const TRAINER_TITLES = ['放浪の剣士', '魔女見習い', '封獣師', '辺境の傭兵', '没落貴族', '異端審問官', '賞金首', '墓守', '錬金術師', '吟遊詩人', '竜騎士崩れ', '盗賊頭', '天才少女', '工廠の看守', '亡国の王子', '仮面の男', '星詠み', '狂科学者'];
const TRAINER_NAMES = ['カイル', 'リリス', 'ガロウ', 'ミレイユ', 'ヴィクトル', 'セラ', 'ドラン', 'エリカ', 'ジーク', 'ノア', 'バルド', 'ルゥ', 'オルガ', 'シオン', 'ラザロ', 'フィーネ', 'クロウ', 'ユーリ', 'メルト', 'アッシュ'];
const TRAINER_QUOTES = ['俺の魔獣は気まぐれだが、強いぜ。', '運も実力のうちって言うでしょ？', 'この工廠から出たいなら、私を倒すことね。', '封印の鎖を解く覚悟はあるか。', '賭けようか。お前の連勝が、ここで終わる方に。', '……静かに。魔獣たちが血を求めている。', '勝てば官軍。負ければ餌だ。', 'さあ、始めよう。混沌の宴を！'];
