// ===== 封札連鎖ルール：相生リング・札・護符・称号 =====
'use strict';

// 相生リング：この順に札を繋ぐと連鎖が伸びる。聖は万能、冥は代償付きで2段跳ぶ
const RING = ['wood', 'fire', 'thunder', 'steel', 'ice', 'water'];
const ringNext = t => RING[(RING.indexOf(t) + 1) % RING.length];

// 技 → 札
function cardCost(mv) {
  if (mv.ohko) return 3;
  if (mv.c === 's') return mv.field ? 1 : mv.heal ? 2 : 1;
  if (mv.chaos) return 1;
  if (mv.gamble) return 2;
  const pw = mv.hits ? mv.pw * 3 : mv.pw;
  return pw <= 60 ? 1 : pw <= 95 ? 2 : 3;
}
// 変化技の札としての効果（ゲーム内の説明）
function cardText(mv, plus = 0) {
  const p = plus ? `（強化+${plus}）` : '';
  if (mv.seal) return '弱った敵を封印して即座に倒す。HP35%以下（崩封中は60%以下）で成功。';
  if (mv.c !== 's') {
    let s = mv.ohko ? '30%で一撃必殺' : mv.chaos ? '何が起きるかわからない' : mv.gamble ? '威力10〜200' : `威力${Math.round(mv.pw * (1 + plus * 0.25))}${mv.hits ? '×2〜5回' : ''}`;
    if (mv.st) s += `・${mv.st[1]}%で${STATUS_N[mv.st[0]]}`;
    if (mv.drain) s += '・吸収';
    if (mv.recoil) s += '・反動';
    if (mv.pr) s += '・崩封値-1追加';
    if (mv.pivot) s += '・札を1枚引く';
    if (mv.crit) s += '・急所率↑';
    return s + p;
  }
  if (mv.protect) return '味方全員に守り25。' + p;
  if (mv.heal) return `最もHPの低い味方を${Math.round(mv.heal * 80)}%回復${mv.cure ? '・状態異常も治す' : ''}。` + p;
  if (mv.self) return 'この獣の次の攻撃札の威力×1.6（重ねがけ可）。' + p;
  if (mv.field) return `異変「${FIELDS[mv.field].n}」を起こし、札を1枚引く。`;
  if (mv.hazard) return '敵の足元に魔針。毎ターン敵全員に5%ダメージ（3層まで）。';
  if (mv.haze) return '味方の状態異常を全て治し、敵の力溜めを消す。';
  if (mv.roar) return '狙った敵の次の行動を止める。';
  if (mv.st) return `狙った敵を${STATUS_N[mv.st[0]]}にする（命中${mv.ac || 100}）。`;
  return mv.d || '';
}

// 封印札（全デッキに2枚入る）
const SEAL_CARD = { id: 'seal', n: '封印札', t: 'none', c: 's', pw: 0, ac: 0, seal: 1, d: '弱った敵を封印する。' };

// ---- 護符（ラン中の永続効果） ----
const RELICS = {
  ember:  { n: '火種の護符', d: '各戦闘の最初のターン、魂火+1。' },
  bell:   { n: '連鎖の鈴', d: '連鎖2から魂火が戻る（通常は3から）。' },
  herb:   { n: '薬草袋', d: '戦闘後の回復が20%→45%になる。' },
  brush:  { n: '封印の筆', d: '封印の成功ラインが+15%。' },
  eye:    { n: '看破の眼', d: '敵の刻印（弱点）が最初から全て見える。' },
  belt:   { n: '鉄の帯', d: '毎ターン開始時、味方全員に守り8。' },
  hawk:   { n: '鷹の羽', d: '急所率+12%。' },
  stone:  { n: '覚醒の石', d: '戦闘開始時、覚醒ゲージ40%。' },
  dice:   { n: '狂い賽', d: '混沌事件が2倍起きるが、7割はあなたに味方する。' },
  finger: { n: '六本目の指', d: '手札が6枚になる。' },
  blood:  { n: '血の盟約', d: '冥の札で連鎖してもHPを失わない。' },
  moon:   { n: '紅月の欠片', d: '急所のダメージが1.5倍→2倍。' },
};

// ---- 称号 ----
const TITLES = [
  { id: 'first', n: '初陣', d: '初めて戦闘に勝つ' },
  { id: 'seal1', n: '封印師', d: '初めて魔獣を封印する' },
  { id: 'seal30', n: '封印の大家', d: '累計30体を封印する' },
  { id: 'chain4', n: '相生の徒', d: '1ターンで4連鎖する' },
  { id: 'chain6', n: '一巡の理', d: '1ターンで6連鎖（リング一周）する' },
  { id: 'chain9', n: '輪廻の環', d: '1ターンで9連鎖する' },
  { id: 'break3', n: '崩しの名手', d: '1戦闘で3体を崩封する' },
  { id: 'onehit', n: '一撃必殺', d: '一撃で300以上のダメージを与える' },
  { id: 'wipe', n: '殲滅の契約者', d: '奥義1発で敵を2体以上倒す' },
  { id: 'chaos10', n: '理不尽の体現者', d: '累計10回の混沌事件を生き延びる' },
  { id: 'moon', n: '紅月を見た者', d: '異変「紅月」の下で勝つ' },
  { id: 'flawless', n: '無傷の封獣師', d: '味方が1体も倒れずに勝つ' },
  { id: 'clutch', n: '逆転の契約者', d: '最後の1体がHP10%以下の状態で勝つ' },
  { id: 'gambler', n: '博徒', d: '混沌の賽か運命の天秤で敵を倒す' },
  { id: 'round1', n: '七連の証', d: '1周（7連勝）する' },
  { id: 'round3', n: '工廠を穿つ者', d: '工廠長グリムヴァルトを倒す' },
  { id: 'round6', n: '原初に触れし者', d: '混沌の原初神カオスティアを倒す' },
  { id: 'ult10', n: '覚醒者', d: '累計10回、奥義を放つ' },
  { id: 'relic5', n: '護符蒐集家', d: '1回の挑戦で護符を5つ集める' },
  { id: 'streak14', n: '連勝の鬼', d: '14連勝する' },
];
