// 依存なしの軽量WebAudio SFX。ユーザー操作後にunlock()を呼んでから鳴らす。
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
    o.frequency.setValueAtTime(f, now + i * 0.05)
    g.gain.setValueAtTime(0.0001, now + i * 0.05)
    g.gain.exponentialRampToValueAtTime(1, now + i * 0.05 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + dur)
    o.connect(g)
    g.connect(master)
    o.start(now + i * 0.05)
    o.stop(now + i * 0.05 + dur + 0.02)
  })
}

// 正しいお皿に入れた。stepが大きいほど1音ずつ高くなる（コンボ音階）
export function playPlace(step?: number): void {
  const ratio = step ? Math.pow(2, Math.min(12, Math.max(0, step)) / 12) : 1
  blip([784 * ratio, 1046 * ratio], 0.12, 'triangle', 0.16)
}
// お皿が完成した（できあがり！）
export function playComplete(): void {
  blip([523, 659, 784], 0.16, 'triangle', 0.18)
}
// まちがえた／落とした
export function playMiss(): void {
  blip([220, 165], 0.18, 'sawtooth', 0.12)
}
// 新記録・新バッジのお祝い（短い上昇ファンファーレ）
export function playFanfare(): void {
  blip([523.25, 659.25, 783.99, 1046.5], 0.18, 'triangle', 0.16)
}

// 端末の振動（対応端末のみ）。reducedMotion・音オフに配慮し呼び出し側で抑制条件を渡す。
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined') return
  const v = navigator.vibrate?.bind(navigator)
  if (v) { try { v(pattern) } catch { /* 非対応環境は無視 */ } }
}
