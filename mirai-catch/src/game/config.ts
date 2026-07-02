import type { Mode } from './types'

export interface Diff {
  speedMin: number
  speedMax: number
  ghostTime: number // 予測ゴーストの表示秒
  padW: number
  padH: number
  padSpeed: number // px/s の移動上限（＝反応で追いつけず先回りが要る）
  curveProb: number
  lives: number // 0 = ノーフェイル（やさしい）
}

export const DIFF: Record<Mode, Diff> = {
  easy: { speedMin: 300, speedMax: 400, ghostTime: 0.62, padW: 30, padH: 156, padSpeed: 900, curveProb: 0.12, lives: 0 },
  normal: { speedMin: 360, speedMax: 470, ghostTime: 0.42, padW: 24, padH: 120, padSpeed: 640, curveProb: 0.34, lives: 3 },
}

export const W = 1040
export const H = 620
export const GOAL_X = 118
export const ROUND_TIME = 40

export const MODE_LABEL: Record<Mode, string> = {
  easy: 'やさしい',
  normal: 'ふつう',
}
