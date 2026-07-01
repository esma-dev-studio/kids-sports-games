import type { Mode } from './types'

const KEY = 'panic-kitchen:v1'

export interface Best {
  score: number
  plates: number
  combo: number
}

export interface SaveData {
  best: Best
  tutorialSeen: boolean
  mode: Mode
  reducedMotion: boolean
  sound: boolean
}

const DEFAULT: SaveData = {
  best: { score: 0, plates: 0, combo: 0 },
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
    }
  } catch {
    return { ...DEFAULT }
  }
}

export function save(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // localStorage 不可でもゲームは続行できる
  }
}
