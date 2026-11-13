# 素材と実装の出典

ユーザー提供の preview.html と最初に作成した対戦版を基に復元・拡張しました。

- 契約具14種、召喚・霧・防護・修復・破勢のアトラス5枚、状態8種と戦場10種のアトラス2枚：内蔵image_genで新規生成。全21枚のPNG原本とプロンプトはart-direction/relics/。隣接フレームの補間、身体の出現マスク、UIへの接続は本作のコードで実装。

- Atelier版の魔獣30体、工廠背景、8属性のエフェクト：内蔵image_genで新規生成。生成原本とプロンプトはart-direction/。封印紋は以前の生成画像を継続使用。
- BGM10曲はユーザー提供。The Silent Forge、The Measured Strike、Steel Against Marrow、The Iron Wake、The Anvil’s Rest、Cold Iron Pivot、Predatory Edge、A Calculated Parley、The Pending Strike、The Patient Lunge。提供曲の権利・利用条件はこの作業では変更せず、CC0素材としては扱っていません。
- 提供MP3の原本は `assets/music/originals/` に保存。ゲーム用コピーは曲構成を保ち、音量調整と128kbps MP3への圧縮のみ実施。原本は配布版には含めません。
- 以前の仮BGM Factory ambiance / yd、Bilwe / James Gargette（ともにCC0）は旧版の資料として保持。現行ゲームでは再生しません。
- 効果音186パターン：Kenney Impact Sounds / RPG Audio / Sci-fi Soundsの音素材105点を重ね、音程・帯域・時間差を調整して本作向けに制作。各素材はCC0。https://kenney.nl/assets/impact-sounds / https://kenney.nl/assets/rpg-audio / https://kenney.nl/assets/sci-fi-sounds
- 追加効果音70点（assets/audio/ext/）：旧リポジトリ shira-shin/beast-factory から流用。“Oculus Audio Pack 01” by Oculus VR, LLC — CC BY 4.0（Meta Open Sound 経由、MP3に変換・トリミング）／ Kenney RPG Audio — CC0 ／ sfx-kit by Wyzowl — CC0。https://creativecommons.org/licenses/by/4.0/
- 効果音の取得ミラー：https://github.com/GeorgeQLe/assets-sfx-combat 。使用した元ファイルと組み合わせはtest/foley-results.jsonへ記録。
- メッシュ変形の実装参考：PixiJS公式MeshPlane資料と公開例。https://pixijs.download/v8.11.0/docs/scene.MeshPlane.html / https://github.com/pixijs/pixijs-skills/blob/main/skills/pixijs-scene-mesh/references/mesh-plane.md
- 粒子画像：Kenney Particle Pack 1.1（CC0）。https://kenney.nl/assets/particle-pack
- PixiJS 8.6.6 / pixi-filters 6.0.5：MIT。https://github.com/pixijs/pixijs / https://github.com/pixijs/filters
- Howler.js 2.2.4：MIT。https://github.com/goldfire/howler.js
- GSAP 3.12.5：GSAP Standard License。配布コードのライセンスヘッダーを保持。https://gsap.com/standard-license/

描画ライブラリを戻し、従来の攻撃・奥義演出を保持しています。コンテンツを削らず、画像・音の圧縮と描画解像度・フレームレートの上限で負荷を調整しました。
