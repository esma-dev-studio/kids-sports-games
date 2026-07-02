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
  easy: { speedMin: 340, speedMax: 440, ghostTime: 0.55, padW: 30, padH: 138, padSpeed: 760, curveProb: 0.22, lives: 0 },
  normal: { speedMin: 470, speedMax: 620, ghostTime: 0.36, padW: 22, padH: 96, padSpeed: 540, curveProb: 0.46, lives: 3 },
}

export const W = 1040
export const H = 620
export const GOAL_X = 118
export const ROUND_TIME = 40

export const MODE_LABEL: Record<Mode, string> = {
  easy: 'やさしい',
  normal: 'ふつう',
}
