// 依存なしの軽量WebAudio SFX。ユーザー操作後にunlock()を呼んでからならブラウザの自動再生制限を回避できる。
let ctx: AudioContext | null = null

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  return ctx
}

export function unlock(): void {
  const c = ac()
  if (c && c.state === 'suspended') void c.resume()
}

function blip(freqs: number[], dur: number, type: OscillatorType, gain: number): void {
  const c = ac()
  if (!c) return
  const now = c.currentTime
  const master = c.createGain()
  master.gain.value = gain
  master.connect(c.destination)
  freqs.forEach((f, i) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(f, now + i * 0.045)
    g.gain.setValueAtTime(0.0001, now + i * 0.045)
    g.gain.exponentialRampToValueAtTime(1, now + i * 0.045 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.045 + dur)
    o.connect(g)
    g.connect(master)
    o.start(now + i * 0.045)
    o.stop(now + i * 0.045 + dur + 0.02)
  })
}

// 味方を叩けた（正解）。stepが大きいほど1音ずつ高くなる（コンボ音階）
export function playPop(step?: number): void {
  const ratio = step ? Math.pow(2, Math.min(12, Math.max(0, step)) / 12) : 1
  blip([660 * ratio, 990 * ratio], 0.14, 'triangle', 0.18)
}
// ニセ光を我慢できた（見きわめ成功）— 静かな肯定。chord=trueで「見きわめタイム」突入の三度和音に増強
export function playGaman(chord?: boolean): void {
  if (chord) { blip([523.25, 659.25, 783.99], 0.26, 'triangle', 0.14); return }
  blip([523.25], 0.22, 'sine', 0.1)
}
// ニセ光に触ってしまった（ミス）
export function playMiss(): void {
  blip([196, 130.8], 0.2, 'sawtooth', 0.12)
}
// 新記録・新バッジのお祝い（短い上昇ファンファーレ）
export function playFanfare(): void {
  blip([523.25, 659.25, 783.99, 1046.5], 0.18, 'triangle', 0.16)
}
