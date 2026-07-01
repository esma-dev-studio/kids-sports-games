export type Mode = 'easy' | 'normal'

export interface RoundResult {
  score: number
  platesDone: number
  correct: number
  mistakes: number
  maxCombo: number
  accuracyStars: number
  speedStars: number
  accuracy: number // 0-100（%）
  isBestScore: boolean
}

export interface EngineOpts {
  mode: Mode
  reducedMotion: boolean
  sound: boolean
  attract: boolean // true=メニューのお手本自動デモ, false=本番プレイ
  onEnd?: (r: RoundResult) => void
}
