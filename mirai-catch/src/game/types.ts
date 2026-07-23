export type Mode = 'easy' | 'normal' | 'hard'

export interface RoundResult {
  mode: Mode
  score: number
  maxCombo: number
  intercepts: number
  balls: number
  earlyIntercepts: number
  curveIntercepts: number
  conceded: number
  predictStars: number // 予測の速さ（はやよみ率）
  accuracyStars: number // 読みの正確さ（インターセプト率）
  isBestScore: boolean
}

export interface EngineOpts {
  mode: Mode
  reducedMotion: boolean
  sound: boolean
  attract: boolean // true=メニューのお手本自動デモ
  guided?: boolean // true=さわって覚えるガイドつきチュートリアル（1球・超低速）
  onEnd?: (r: RoundResult) => void
  onGuideDone?: () => void // guided時、1球キャッチしたら呼ばれる
}
