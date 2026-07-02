# アプリ開発④ — 子ども向けスポーツ認知ゲーム

子どもが楽しく遊べて、遊ぶうちに **反射神経・全体把握・空間認識・周辺視野・意思決定** などの知覚-認知能力が鍛えられ、バスケットボール／サッカーの能力に **間接的に** 転移することを狙ったWebゲームの企画フォルダ。

## 公開サイト（GitHub Pages）

- ハブ: https://esma-dev-studio.github.io/kids-sports-games/
- まもれ！シグナル・ヒーロー: https://esma-dev-studio.github.io/kids-sports-games/signal-hero/
- パニックキッチン: https://esma-dev-studio.github.io/kids-sports-games/panic-kitchen/
- みらいキャッチ 〜さきよみディフェンス〜: https://esma-dev-studio.github.io/kids-sports-games/mirai-catch/

リポジトリ: https://github.com/esma-dev-studio/kids-sports-games （main=ソース、gh-pages=公開ビルド）

## ゲームアプリ（実装済み）

各ゲームは独立した Vite + React + TypeScript + Canvas アプリ。開発サーバは各フォルダで `npm install`（初回のみ）→ `npm run dev`、公開ビルドは `npm run build`。

| フォルダ | ゲーム | 概要 |
|---|---|---|
| `signal-hero/`（※現在はリポジトリ直下） | **まもれ！シグナル・ヒーロー** | 味方○を叩き、敵×のニセ光は我慢する反射×抑制のGo/No-Go。我慢するほど伸びる「見きわめボーナス」が核 |
| `panic-kitchen/` | **パニックキッチン 〜まぜまぜ大混雑〜** | 飛んでくる食材を色＋アイコンの合うお皿へドラッグ。周辺視野・全体把握・状況判断を鍛える仕分けアクション |
| `mirai-catch/` | **みらいキャッチ 〜さきよみディフェンス〜** | 飛んでくる球の“未来の通り道”を先読みし、着く前に先回りキャッチ（GK型）。予測・空間認識を鍛える |

> 補足: シグナル・ヒーローは現状このフォルダ直下（`package.json`/`src/`）に置いています。パニックキッチンは `panic-kitchen/` サブフォルダの独立アプリです。両ゲームとも やさしい/ふつうモード・二軸★リザルト・自己ベスト保存・演出ひかえめ・お手本デモを備えます。

## 企画・評価アセット

| パス | 内容 |
|---|---|
| `docs/01_ゲーム案の評価結果.md` | 6つのゲーム案と、3専門家パネル（発達心理／スポーツ科学／ゲーム開発）による採点ランキング、最終推奨案 |
| `docs/02_サブエージェント体制.md` | 開発用サブエージェント体制の設計（3レイヤー・8ロール） |
| `.claude/agents/*.md` | 上記体制の実ファイル（director / sports-science-reviewer / core-dev / ui-dev / art-sfx / qa-playtest / deploy） |
| `previews/index.html` | 6案の動くプレビュー（自動デモ＋操作可）のギャラリー。ブラウザで開く |
| `data/ideation-result.json` | アイデア創出ワークフローの生の出力（採点・全案データ） |

## プレビューの見かた

`previews/index.html` をダブルクリックしてブラウザで開くと、6案を一覧できます。各デモは放置すると"お手本"が自動で回り、クリック/タップで自分でも操作できます。

## 再デプロイ手順（GitHub Pages 更新）

1. 各ゲームをビルド
   - `npm run build`（シグナル・ヒーロー → `dist/`）
   - `cd panic-kitchen && npm run build`（→ `panic-kitchen/dist/`）
2. サイトを組み立て: `node scripts/build-site.mjs` → `_site/`（ハブ＋`signal-hero/`＋`panic-kitchen/`）を生成
3. `gh-pages` ブランチへ公開（`_site/` の中身を force push）
   ```sh
   cd _site
   git init -b gh-pages && git add -A && git commit -m "Deploy"
   git push -f https://github.com/esma-dev-studio/kids-sports-games.git gh-pages
   ```
   反映まで数十秒。ソース(main)の更新は通常の `git push origin main`。

## 技術前提

- Vite + React + TypeScript + Canvas（想定）
- バックエンドなし、GitHub Pages 公開
- PC（マウス/キーボード）＋スマホ/タブレット（タッチ）両対応

## 能力転移についての注意

このゲームで鍛わるのは主に知覚-認知能力（抑制制御・反応速度・複数対象の同時監視）であり、ドリブル・シュート・パスなど競技固有スキルの上達を保証するものではありません。UIコピーは「バスケ／サッカーが上手くなる」と断定せず、「速く見きわめる力の下地づくり」と控えめに位置づけます。
