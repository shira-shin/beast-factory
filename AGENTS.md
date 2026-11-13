# AGENTS.md

ユーザーへの説明・報告は日本語で行うこと。

- ゲーム本体：`index.html`・`js/`・`css/`・`assets/`（ビルド不要で `node serve.cjs` で動く）。
- 公開：GitHub Pages は `main` の `docs/` を公開。`node build-pages.cjs` で `docs/index.html`（単体版）を作り直してから push する。
- キャラ調整は `js/balance.js`。変える前後に `node test/balance-sim.cjs "" 20000` で勝率の偏りを確認する。
- 旧版（札連鎖バトル）は `legacy/` にある。旧版の手順は `legacy/AGENTS.md`。
