import type { Mode } from './types'
import { EMPTY_STATS, type Stats } from './badges'

const KEY = 'mirai-catch:v1'

export interface Best {
  score: number
  combo: number
  early: number
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
  stats: Stats
  badges: string[]
  tutorialSeen: boolean
  mode: Mode
  reducedMotion: boolean
  sound: boolean
}

const DEFAULT: SaveData = {
  best: { score: 0, combo: 0, early: 0 },
  scores: [],
  lastName: '',
  stats: EMPTY_STATS,
  badges: [],
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
      stats: { ...EMPTY_STATS, ...(parsed.stats ?? {}) },
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
    }
  } catch {
    return { ...DEFAULT }
  }
}

export function save(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // localStorage 不可でも続行
  }
}

export function qualifies(scores: ScoreEntry[], score: number): boolean {
  if (score <= 0) return false
  if (scores.length < RANK_MAX) return true
  return score > scores[scores.length - 1].score
}

export function addScore(data: SaveData, name: string, score: number): { data: SaveData; rank: number } {
  const entry: ScoreEntry = { name: (name.trim() || 'プレイヤー').slice(0, 8), score }
  const scores = [...data.scores, entry].sort((a, b) => b.score - a.score).slice(0, RANK_MAX)
  const rank = scores.indexOf(entry)
  const next = { ...data, scores, lastName: entry.name }
  save(next)
  return { data: next, rank }
}
