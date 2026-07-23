import type { Mode } from './types'

export interface Station {
  key: string
  col: string
  light: string
  name: string
}

// 色＋アイコン（形）の二重符号化。色覚に依存させない。
export const STATIONS: Station[] = [
  { key: 'fruit', col: '#e5533c', light: '#f7b3a6', name: 'フルーツ' },
  { key: 'fish', col: '#3d84c6', light: '#a9cdec', name: 'さかな' },
  { key: 'bread', col: '#e0a12a', light: '#f2d79a', name: 'パン' },
  { key: 'leaf', col: '#4caa5a', light: '#b3ddba', name: 'やさい' },
]

export interface Diff {
  stationCount: number
  spawnBase: number // 出現間隔の基本（秒）
  spawnFloor: number // 最短出現間隔（秒）
  fallScale: number // 落下速度の倍率
  need: number // お皿1枚を完成させる必要個数
  maxItems: number // 同時に存在できる食材数
  settleLife: number // 食材が「しおれる」までの秒数（着地後）
}

export const DIFF: Record<Mode, Diff> = {
  easy: { stationCount: 3, spawnBase: 1.15, spawnFloor: 0.6, fallScale: 0.85, need: 3, maxItems: 5, settleLife: 7 },
  normal: { stationCount: 4, spawnBase: 0.85, spawnFloor: 0.42, fallScale: 1.0, need: 4, maxItems: 6, settleLife: 5 },
}

export const W = 1040
export const H = 620
export const ROUND_TIME = 50 // 1ラウンドの秒数
export const SHUFFLE_EVERY_MIN = 12 // 皿シャッフル間隔の最短（秒）
export const SHUFFLE_EVERY_MAX = 22 // 皿シャッフル間隔の最長（秒）
export const SHUFFLE_SCAN_BONUS_TIME = 3 // シャッフル直後、正解にボーナスが付く秒数
export const SHUFFLE_LABEL_DIM_TIME = 1.5 // シャッフル直後、皿名ラベルを薄くする秒数

// DDA（成績連動の適応難易度）
export const INTENSITY_MIN = 0.8
export const INTENSITY_MAX = 1.3
export const INTENSITY_UPDATE_EVERY = 3 // 何秒ごとにintensityを見直すか
export const RECENT_WINDOW = 8 // 直近何アクション見るか

// オーダーラッシュ
export const RUSH_EVERY = 15 // 何秒ごとにラッシュが来るか
export const RUSH_DURATION = 4 // ラッシュの継続秒数
export const RUSH_SPAWN_MULT = 0.5 // ラッシュ中のスポーン間隔倍率（小さいほど速い）
export const RUSH_SCORE_GATE = 100 // このスコア未満の初心者にはラッシュを出さない

// きらきら食材（ゴールデン）
export const GOLDEN_SCORE_GATE = 120 // このスコア以上でゴールデン出現が有効に
export const GOLDEN_CHANCE = 0.1 // 出現時にゴールデンになる確率

// 制限時間つきの特別皿
export const RUSH_PLATE_SCORE_GATE = 150
export const RUSH_PLATE_CHANCE = 0.35 // 皿が空になった時に特別皿化する確率
export const RUSH_PLATE_TIME = 9 // 特別皿の制限時間（秒）
export const RUSH_PLATE_BONUS = 80

// 星の閾値（リザルトの「手ぎわ」評価。resultのナッジ文言と同期させる）
export const SPEED_STAR3_PLATES = 8
export const SPEED_STAR2_PLATES = 4

export const MODE_LABEL: Record<Mode, string> = {
  easy: 'やさしい',
  normal: 'ふつう',
}
