export type Mode = 'easy' | 'normal'
export type Phase = 'lit' | 'clear' | 'gap'
export type NodeType = 'go' | 'nogo'

export interface RoundResult {
  score: number
  maxCombo: number
  maxGaman: number
  reactionStars: number
  discernStars: number
  goHit: number
  goShown: number
  nogoResisted: number
  nogoShown: number
  avgReaction: number // ms（GO命中の平均反応時間）
  isBestScore: boolean
}

export interface EngineOpts {
  mode: Mode
  reducedMotion: boolean
  sound: boolean
  attract: boolean // true=メニューのお手本自動デモ, false=本番プレイ
  haptics?: boolean // 触覚フィードバック（既定true）。reducedMotion時は自動的に抑制される
  bestScore?: number // 自己ベストスコア（HUDの「ベストまであと」表示・演出に使用）
  guided?: boolean // true=チュートリアルの体験ステップ（GO成功1回＋がまん成功1回で自動終了。ミスは減点なし）
  onEnd?: (r: RoundResult) => void
  onGuidedDone?: () => void
}
