import type { Mode } from './types'

export interface Diff {
  nodeCount: number
  litMin: number // 発光の基本表示秒（＝反応の猶予）
  litMax: number
  litFloor: number // コンボで短縮したときの下限
  gap: number
  goProb: number // 味方(GO)が出る確率
  goProbFloor: number
}

// やさしい＝低速・NO-GO少なめ・ノード少なめ。ふつう＝速くNO-GO多め。
export const DIFF: Record<Mode, Diff> = {
  easy: {
    nodeCount: 6, litMin: 1.05, litMax: 1.45, litFloor: 0.62,
    gap: 0.5, goProb: 0.72, goProbFloor: 0.6,
  },
  normal: {
    nodeCount: 7, litMin: 0.85, litMax: 1.2, litFloor: 0.42,
    gap: 0.42, goProb: 0.62, goProbFloor: 0.46,
  },
}

export const W = 1040
export const H = 620
export const ROUND_TIME = 40 // 1ラウンドの秒数
export const LIVES = 3

export const MODE_LABEL: Record<Mode, string> = {
  easy: 'やさしい',
  normal: 'ふつう',
}
