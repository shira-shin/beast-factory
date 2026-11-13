# VALGA Atelier：生成アート

内蔵 `image_gen` ツールを使用して、30体のクリーチャー、工廠闘技場、8属性のエフェクトを含む一枚のアトラスを新規生成しました。

- `gallery.html`：30体の一覧。配布用WebPを表示します。
- `contact-sheet.png`：一覧の確認用画像。
- `prompts.json`：実際に使用した全32アセット分のプロンプト。外部CLI/APIは使用していません。
- `各クリーチャーID.png`：背景透過の生成原本30枚。
- `arena-new.png`：新しい工廠闘技場の原本。
- `vfx-ink-atlas.png`：8属性の生成エフェクトの原本。

実行時の画像は `../assets/beasts/`、背景は `../assets/bg/arena.jpg`、生成エフェクトは `../assets/fx/ink-*.png` に反映済みです。生成原本の透明余白だけを検出し、WebP版は足元の位置と大きさが揃うように切り出して圧縮しています。以前のWebP画像は `../assets/beasts-previous/` に保持しています。

画像をMeshPlaneへ貼り、7×9の頂点で体形別の微小な揺れを付けています。浮遊・重装・獣・蛇体で動きの大きさと周期を変え、接近攻撃には予備動作、接近、残像、衝撃、帰還、着地を付けました。これはコードによる2Dメッシュ変形で、手描きの連番アニメーションや本格的な骨格リグではありません。

参照した実装資料：
- PixiJS公式 MeshPlane：https://pixijs.download/v8.11.0/docs/scene.MeshPlane.html
- PixiJS公開メッシュ資料：https://github.com/pixijs/pixijs-skills/blob/main/skills/pixijs-scene-mesh/references/mesh-plane.md

依存ライブラリを増やさず、既存のPixiJSとGSAP内で実装しています。
