// 依存なしの軽量WebAudio。ユーザー操作後にunlock()で自動再生制限を回避。
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

// インターセプト成功。stepが大きいほど1音ずつ高く（コンボ音階）
export function playCatch(step?: number): void {
  const ratio = step ? Math.pow(2, Math.min(12, Math.max(0, step)) / 12) : 1
  blip([620 * ratio, 930 * ratio], 0.13, 'triangle', 0.16)
}
// はやよみ（早めの先回り成功）
export function playEarly(): void {
  blip([784, 1046, 1318], 0.12, 'triangle', 0.15)
}
// 抜かれた（失点）
export function playMiss(): void {
  blip([220, 165], 0.2, 'sawtooth', 0.11)
}
// 新記録・新バッジのお祝い
export function playFanfare(): void {
  blip([523.25, 659.25, 783.99, 1046.5], 0.18, 'triangle', 0.16)
}
