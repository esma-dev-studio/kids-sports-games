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
  wilts: number // しおれて消えた数
  goldenCaught: number // きらきら食材を正しく届けた数
  postShuffleStreak: number // シャッフル直後の連続正解の最大数（全体把握ミッション用）
}

export interface EngineOpts {
  mode: Mode
  reducedMotion: boolean
  sound: boolean
  attract: boolean // true=メニューのお手本自動デモ, false=本番プレイ
  onEnd?: (r: RoundResult) => void
}
