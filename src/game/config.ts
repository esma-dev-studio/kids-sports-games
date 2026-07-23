import type { Mode } from './types'

export interface Diff {
  nodeCount: number
  litMin: number // 発光の基本表示秒（＝反応の猶予）
  litMax: number
  litFloor: number // コンボで短縮したときの下限
  gap: number
  goProb: number // 味方(GO)が出る確率
  goProbFloor: number
  feintProb: number // 全ノード一斉点滅（フェイント）が発生する確率。0で発生しない
}

// やさしい＝低速・NO-GO少なめ・ノード少なめ・フェイントなし。ふつう＝速くNO-GO多め＋フェイントあり。
export const DIFF: Record<Mode, Diff> = {
  easy: {
    nodeCount: 6, litMin: 1.05, litMax: 1.45, litFloor: 0.62,
    gap: 0.5, goProb: 0.72, goProbFloor: 0.6, feintProb: 0,
  },
  normal: {
    nodeCount: 7, litMin: 0.85, litMax: 1.2, litFloor: 0.42,
    gap: 0.42, goProb: 0.62, goProbFloor: 0.46, feintProb: 0.14,
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

// --- チャンスラッシュ（中盤の山場）：[開始秒, 終了秒] のペアを ROUND_TIME 内に収める ---
export const RUSH_WINDOWS: [number, number][] = [[10, 13], [22, 25], [34, 37]]
export const RUSH_GAP_MUL = 0.55 // ラッシュ中はスポーン間隔を短縮
export const RUSH_SCORE_MUL = 2

// --- 配置シャッフル（中盤に1回、リングをゆっくり回転させる） ---
export const SHUFFLE_AT = 20 // 秒
export const SHUFFLE_ROTATE_SPEED = 4 // 補間の速さ（reducedMotion時は即時反映）

// --- 横断的DDA（直近成績で開始難度を微調整。上限あり） ---
export const DDA_REF_REACTION = 650 // ms（基準の反応時間）
export const DDA_REF_RESIST = 0.75 // 基準の見きわめ成功率
export const DDA_BAND_MIN = 0.85 // 補正の下限（-15%）
export const DDA_BAND_MAX = 1.15 // 補正の上限（+15%）
export const DDA_EMA_ALPHA = 0.3 // 指数移動平均の重み
