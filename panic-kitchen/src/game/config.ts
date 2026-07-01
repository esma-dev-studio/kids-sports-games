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
}

export const DIFF: Record<Mode, Diff> = {
  easy: { stationCount: 3, spawnBase: 1.15, spawnFloor: 0.6, fallScale: 0.85, need: 3, maxItems: 5 },
  normal: { stationCount: 4, spawnBase: 0.85, spawnFloor: 0.42, fallScale: 1.0, need: 4, maxItems: 6 },
}

export const W = 1040
export const H = 620
export const ROUND_TIME = 50 // 1ラウンドの秒数
export const SHUFFLE_EVERY = 22 // 皿の配置シャッフル間隔（秒）

export const MODE_LABEL: Record<Mode, string> = {
  easy: 'やさしい',
  normal: 'ふつう',
}
