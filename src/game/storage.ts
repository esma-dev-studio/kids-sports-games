import type { Mode } from './types'
import { EMPTY_STATS, type Stats } from './badges'

const KEY = 'signal-hero:v1'

export interface Best {
  score: number
  combo: number
  gaman: number
}

export interface ScoreEntry {
  name: string
  score: number
}

export const RANK_MAX = 5

/** 直近数回の成績スナップショット（上達の見える化用・末尾5件だけ保持） */
export interface HistoryEntry {
  avgReaction: number
  resistRate: number
}

export interface SaveData {
  best: Best
  scores: ScoreEntry[]
  lastName: string
  stats: Stats
  badges: string[]
  tutorialSeen: boolean
  mode: Mode
  reducedMotion: boolean
  sound: boolean
  haptics: boolean
  // 横断的DDA：直近成績の指数移動平均。プレイのたびに静かに更新し、次回の開始難度をその子に合わせる
  recentAvgReaction: number
  recentResistRate: number
  // 上達の見える化用の推移ログ（最新5件）
  history: HistoryEntry[]
}

const DEFAULT: SaveData = {
  best: { score: 0, combo: 0, gaman: 0 },
  scores: [],
  lastName: '',
  stats: EMPTY_STATS,
  badges: [],
  tutorialSeen: false,
  mode: 'easy',
  reducedMotion: false,
  sound: true,
  haptics: true,
  recentAvgReaction: 650,
  recentResistRate: 0.75,
  history: [],
}

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT }
    const parsed = JSON.parse(raw) as Partial<SaveData>
    return {
      ...DEFAULT,
      ...parsed,
      best: { ...DEFAULT.best, ...(parsed.best ?? {}) },
      scores: Array.isArray(parsed.scores) ? parsed.scores.slice(0, RANK_MAX) : [],
      stats: { ...EMPTY_STATS, ...(parsed.stats ?? {}) },
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
      history: Array.isArray(parsed.history) ? parsed.history.slice(-5) : [],
    }
  } catch {
    return { ...DEFAULT }
  }
}

/** score が TOP N に入るか */
export function qualifies(scores: ScoreEntry[], score: number): boolean {
  if (score <= 0) return false
  if (scores.length < RANK_MAX) return true
  return score > scores[scores.length - 1].score
}

/** スコアをランキングへ追加して保存。追加後の順位(0始まり, 圏外なら-1)を返す */
export function addScore(data: SaveData, name: string, score: number): { data: SaveData; rank: number } {
  const entry: ScoreEntry = { name: (name.trim() || 'プレイヤー').slice(0, 8), score }
  const scores = [...data.scores, entry].sort((a, b) => b.score - a.score).slice(0, RANK_MAX)
  const rank = scores.indexOf(entry)
  const next = { ...data, scores, lastName: entry.name }
  save(next)
  return { data: next, rank }
}

export function save(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // localStorage 不可の環境では黙って諦める（ゲームは続行できる）
  }
}

/**
 * 1ラウンド分の成績で「直近成績」を指数移動平均更新し、推移ログ（最新5件）に積む。
 * avgReaction が未計測（GO命中0回）のときは反応時間の平均更新をスキップし、直前値を引き継ぐ。
 */
export function recordRound(
  data: SaveData,
  avgReaction: number,
  resistRate: number,
  hasReaction: boolean,
  alpha: number,
): SaveData {
  const nextAvg = hasReaction
    ? data.recentAvgReaction * (1 - alpha) + avgReaction * alpha
    : data.recentAvgReaction
  const nextResist = data.recentResistRate * (1 - alpha) + resistRate * alpha
  const lastAvg = data.history.length ? data.history[data.history.length - 1].avgReaction : Math.round(nextAvg)
  const entry: HistoryEntry = {
    avgReaction: hasReaction ? Math.round(avgReaction) : lastAvg,
    resistRate,
  }
  return {
    ...data,
    recentAvgReaction: nextAvg,
    recentResistRate: nextResist,
    history: [...data.history, entry].slice(-5),
  }
}
