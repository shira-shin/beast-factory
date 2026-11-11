# 封獣工廠ヴァルガ（BEAST FACTORY VALGA）

スマホのブラウザで遊べる、札を繋いで戦う魔獣バトル。三体の封獣を借りて七連戦を勝ち抜く。

**遊ぶ**：GitHub Pages を有効にすると `https://<ユーザー名>.github.io/beast-factory/` で開ける（`docs/index.html`）。
`docs/index.html`（= `dist/preview.html`）は素材を全部埋め込んだ単体ファイルなので、ダブルクリックでも動く。

## ルールの核

| 仕組み | 内容 |
|---|---|
| 三体同時の札バトル | 味方3体の技が札になって山札に入る。毎巡5枚引き、魂火3で使う |
| 相生連鎖 | 樹→炎→雷→鋼→氷→水→樹 の順に繋ぐと1枚ごとに+25%。聖は万能、冥は2段跳ぶがHPを削る |
| 刻印と崩封 | 敵の隠れた弱点を突くと封印値が減り、0で崩封（1巡停止・被ダメ1.5倍） |
| 封印札 | 弱った敵を即封印。封じた魔獣は報酬で仲間にできる |
| 敵の意図 | 敵の次の行動と狙いが頭上に出る |
| 覚醒奥義 | ゲージが満ちたら味方を2回押して敵全体に奥義 |
| 理不尽 | 異変（場）の急変、混沌事件、賽の目 |
| ラン | 戦闘後に護符・札の強化・魔獣の交代から1つ。7戦で1周。称号20種 |

## 開発

```
index.html        画面（スマホ縦1画面）
js/data.js        魔獣・技・属性・異変のデータ
js/rules.js       相生リング・札・護符・称号
js/engine.js      バトルエンジン
js/stage.js       描画と演出（PixiJS + pixi-filters + GSAP）
js/audio.js       効果音・BGM（録音素材＋WebAudio合成）
js/game.js        進行とUI
assets/           エフェクト・効果音・魔獣画像
build.py          素材を埋め込んだ dist/preview.html と docs/index.html を作る
build-preview.ps1 Windows用：assets/beasts の画像を preview.html に埋め込む
PROMPTS.md        魔獣画像の生成プロンプト集
```

魔獣画像は、タイトル画面の「画像」からフォルダごと取り込める（ブラウザ内に保存）。全員に配る場合は `assets/beasts/<id>.webp` に置き、`js/manifest.js` にIDを足してから `python3 build.py`。

## クレジット

- 効果音：“Oculus Audio Pack 01” by Oculus VR, LLC — CC BY 4.0（Meta Open Sound 経由、MP3に変換・トリミング）
- ピアノ音源：Meta Piano — CC0（Meta Open Sound）
- 効果音：Kenney RPG Audio — CC0 ／ sfx-kit by Wyzowl — CC0
- エフェクト素材：Kenney Particle Pack — CC0
- ライブラリ：PixiJS, pixi-filters（MIT）／ GSAP
