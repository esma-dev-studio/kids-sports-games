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

const EMPTY_BEST: Best = { score: 0, combo: 0, early: 0 }

export interface SaveData {
  // 互換のため残す（新規では easy 相当の記録として扱う。表示は scoresByMode/bestByMode を使う）
  best: Best
  scores: ScoreEntry[]
  bestByMode: Record<Mode, Best>
  scoresByMode: Record<Mode, ScoreEntry[]>
  lastName: string
  stats: Stats
  badges: string[]
  tutorialSeen: boolean
  mode: Mode
  reducedMotion: boolean
  sound: boolean
}

function freshDefault(): SaveData {
  return {
    best: { ...EMPTY_BEST },
    scores: [],
    bestByMode: { easy: { ...EMPTY_BEST }, normal: { ...EMPTY_BEST }, hard: { ...EMPTY_BEST } },
    scoresByMode: { easy: [], normal: [], hard: [] },
    lastName: '',
    stats: { ...EMPTY_STATS },
    badges: [],
    tutorialSeen: false,
    mode: 'easy',
    reducedMotion: false,
    sound: true,
  }
}

export function load(): SaveData {
  const base = freshDefault()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<SaveData>
    const legacyBest = { ...EMPTY_BEST, ...(parsed.best ?? {}) }
    const legacyScores = Array.isArray(parsed.scores) ? parsed.scores.slice(0, RANK_MAX) : []
    const bestByMode: Record<Mode, Best> = {
      // 旧データ（モード区別なし）は easy 相当としてフォールバック移行
      easy: { ...EMPTY_BEST, ...(parsed.bestByMode?.easy ?? legacyBest) },
      normal: { ...EMPTY_BEST, ...(parsed.bestByMode?.normal ?? {}) },
      hard: { ...EMPTY_BEST, ...(parsed.bestByMode?.hard ?? {}) },
    }
    const scoresByMode: Record<Mode, ScoreEntry[]> = {
      easy: Array.isArray(parsed.scoresByMode?.easy) ? parsed.scoresByMode!.easy.slice(0, RANK_MAX) : legacyScores,
      normal: Array.isArray(parsed.scoresByMode?.normal) ? parsed.scoresByMode!.normal.slice(0, RANK_MAX) : [],
      hard: Array.isArray(parsed.scoresByMode?.hard) ? parsed.scoresByMode!.hard.slice(0, RANK_MAX) : [],
    }
    return {
      ...base,
      ...parsed,
      best: legacyBest,
      scores: legacyScores,
      bestByMode,
      scoresByMode,
      stats: { ...EMPTY_STATS, ...(parsed.stats ?? {}) },
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
    }
  } catch {
    return base
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

export function addScore(data: SaveData, name: string, score: number, mode: Mode): { data: SaveData; rank: number } {
  const entry: ScoreEntry = { name: (name.trim() || 'プレイヤー').slice(0, 8), score }
  const list = [...data.scoresByMode[mode], entry].sort((a, b) => b.score - a.score).slice(0, RANK_MAX)
  const rank = list.indexOf(entry)
  const scoresByMode = { ...data.scoresByMode, [mode]: list }
  const next = { ...data, scoresByMode, lastName: entry.name }
  save(next)
  return { data: next, rank }
}
