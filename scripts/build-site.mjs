// ビルド済みの2ゲーム（dist/ と panic-kitchen/dist/）を _site/ にまとめる（組み立て専用）。
//   _site/index.html        … ランディング（ハブ）
//   _site/signal-hero/       … まもれ！シグナル・ヒーロー
//   _site/panic-kitchen/     … パニックキッチン
//
// 事前に各ゲームをビルドしておくこと:
//   npm run build            (シグナル・ヒーロー -> dist/)
//   npm --prefix panic-kitchen run build   (パニックキッチン -> panic-kitchen/dist/)
// そのうえで:
//   node scripts/build-site.mjs
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = resolve(ROOT, '_site')

const signalDist = resolve(ROOT, 'dist')
const kitchenDist = resolve(ROOT, 'panic-kitchen', 'dist')

for (const [name, dir] of [['signal-hero', signalDist], ['panic-kitchen', kitchenDist]]) {
  if (!existsSync(dir)) {
    console.error(`✗ ${name} の dist がありません: ${dir}\n  先に各ゲームで npm run build を実行してください。`)
    process.exit(1)
  }
}

rmSync(SITE, { recursive: true, force: true })
mkdirSync(SITE, { recursive: true })
cpSync(signalDist, resolve(SITE, 'signal-hero'), { recursive: true })
cpSync(kitchenDist, resolve(SITE, 'panic-kitchen'), { recursive: true })
copyFileSync(resolve(ROOT, 'scripts', 'landing.html'), resolve(SITE, 'index.html'))
writeFileSync(resolve(SITE, '.nojekyll'), '')

console.log('✓ _site を作成しました: index.html(ハブ) / signal-hero/ / panic-kitchen/')
