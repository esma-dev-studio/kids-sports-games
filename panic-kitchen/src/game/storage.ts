import type { Mode } from './types'

const KEY = 'panic-kitchen:v1'

export interface Best {
  score: number
  plates: number
  combo: number
}

export interface ScoreEntry {
  name: string
  score: number
}

export const RANK_MAX = 5

export interface SaveData {
  best: Best
  scores: ScoreEntry[]
  lastName: string
  tutorialSeen: boolean
  mode: Mode
  reducedMotion: boolean
  sound: boolean
}

const DEFAULT: SaveData = {
  best: { score: 0, plates: 0, combo: 0 },
  scores: [],
  lastName: '',
  tutorialSeen: false,
  mode: 'easy',
  reducedMotion: false,
  sound: true,
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
    // localStorage 不可でもゲームは続行できる
  }
}
