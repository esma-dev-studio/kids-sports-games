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
  onEnd?: (r: RoundResult) => void
}
