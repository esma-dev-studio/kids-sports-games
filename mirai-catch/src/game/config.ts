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
  maxBalls: number // 同時に画面へ出す最大数（1=順番に1つずつ）
  // かくれんぼゾーン：ボールがこのx範囲(occludeHi>x>occludeLo)にいる間は本体を隠す。
  // occludeHi<=occludeLo なら無効（easyはオフ）。
  occludeLo: number
  occludeHi: number
}

export const DIFF: Record<Mode, Diff> = {
  easy: { speedMin: 340, speedMax: 440, ghostTime: 0.55, padW: 30, padH: 138, padSpeed: 760, curveProb: 0.22, lives: 0, maxBalls: 1, occludeLo: 0, occludeHi: 0 },
  normal: { speedMin: 470, speedMax: 620, ghostTime: 0.32, padW: 22, padH: 96, padSpeed: 540, curveProb: 0.46, lives: 3, maxBalls: 1, occludeLo: 330, occludeHi: 470 },
  // むずかしい：同時に2〜3個・速さに強弱（どれを先に止めるか判断）。カーブは控えめにして「優先順位」を主眼に。
  // no-fail(lives:0)＝40秒スコアアタック。同時球は物理的に全部は取れず、ライフ制だと理不尽に早期終了するため。
  hard: { speedMin: 380, speedMax: 720, ghostTime: 0.34, padW: 22, padH: 100, padSpeed: 660, curveProb: 0.30, lives: 0, maxBalls: 3, occludeLo: 300, occludeHi: 480 },
}

// DDA（動的難易度）で speed/ghost/spawn 間隔を補正できる最大幅（±）。モードの性格を壊さないための上限。
export const DDA_MAX = 0.25

export const W = 1040
export const H = 620
export const GOAL_X = 118
export const ROUND_TIME = 40

export const MODE_LABEL: Record<Mode, string> = {
  easy: 'やさしい',
  normal: 'ふつう',
  hard: 'むずかしい',
}
