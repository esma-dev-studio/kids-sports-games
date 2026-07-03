import type { EngineOpts, RoundResult } from './types'
import { DIFF, H, ROUND_TIME, SHUFFLE_EVERY, STATIONS, W, type Station } from './config'
import { playComplete, playMiss, playPlace } from './audio'
import { load, save } from './storage'

interface Plate { s: Station; x: number; y: number; w: number; h: number; fill: number; need: number; glow: number; shake: number; face: string; faceT: number }
type ItemState = 'fly' | 'held' | 'gone'
interface Item {
  s: Station; x: number; y: number; vx: number; vy: number; r: number
  state: ItemState; settleY: number; wob: number; blink: number
}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; r: number; col: string }
interface Floater { x: number; y: number; text: string; life: number; col: string }

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(a: T[]): T => a[(Math.random() * a.length) | 0]

export class KitchenGame {
  private opts: EngineOpts
  private diff = DIFF.easy
  private stations: Station[]

  private plates: Plate[] = []
  private items: Item[] = []
  private particles: Particle[] = []
  private floaters: Floater[] = []

  private score = 0
  private combo = 0
  private patience = 1
  private timeLeft = ROUND_TIME
  private flash = 0
  private now = 0
  private spawnTimer = 0.6
  private shuffleTimer = SHUFFLE_EVERY
  private ended = false

  private correct = 0
  private mistakes = 0
  private platesDone = 0
  private maxCombo = 0

  // ドラッグ
  private held: Item | null = null
  private pointerX = W / 2
  private pointerY = H / 2

  // お手本（attract）
  private auto: boolean
  private ghostX = W / 2
  private ghostY = H / 2
  private ghostVisX = W / 2
  private ghostVisY = H / 2
  private ghostHold: Item | null = null

  constructor(opts: EngineOpts) {
    this.opts = opts
    this.diff = DIFF[opts.mode]
    this.auto = opts.attract
    this.stations = STATIONS.slice(0, this.diff.stationCount)
    this.layoutPlates()
    for (let i = 0; i < 3; i++) this.spawnItem()
  }

  private layoutPlates(): void {
    const n = this.stations.length
    const gap = 24
    const marginX = 70
    const pw = (W - marginX * 2 - gap * (n - 1)) / n
    const order = this.stations.map((_, i) => i).sort(() => Math.random() - 0.5)
    this.plates = []
    for (let i = 0; i < n; i++) {
      const s = this.stations[order[i]]
      this.plates.push({ s, x: marginX + i * (pw + gap), y: H - 150, w: pw, h: 118, fill: 0, need: this.diff.need, glow: 0, shake: 0, face: '', faceT: 0 })
    }
  }

  private spawnItem(): void {
    if (this.items.length >= this.diff.maxItems) return
    const s = pick(this.stations)
    const side = pick(['top', 'left', 'right'] as const)
    let x: number, y: number, vx: number, vy: number
    const fs = this.diff.fallScale
    if (side === 'top') { x = rnd(180, W - 180); y = -30; vx = rnd(-70, 70); vy = rnd(90, 160) * fs }
    else if (side === 'left') { x = -30; y = rnd(60, 220); vx = rnd(150, 210); vy = rnd(-60, 40) }
    else { x = W + 30; y = rnd(60, 220); vx = -rnd(150, 210); vy = rnd(-60, 40) }
    this.items.push({
      s, x, y, vx, vy, r: 30, state: 'fly',
      settleY: rnd(150, 300) + (side === 'top' ? 0 : 120),
      wob: rnd(0, 6.28), blink: rnd(0, 200),
    })
  }

  private burst(x: number, y: number, col: string, n: number): void {
    const count = this.opts.reducedMotion ? Math.ceil(n * 0.4) : n
    for (let i = 0; i < count; i++) {
      const a = rnd(0, 6.28), sp = rnd(90, 300)
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 1, col, r: rnd(2.5, 5) })
    }
  }
  private floater(x: number, y: number, text: string, col: string): void { this.floaters.push({ x, y, text, life: 1, col }) }

  private plateAt(x: number, y: number): Plate | null {
    for (const p of this.plates) {
      if (x > p.x - 6 && x < p.x + p.w + 6 && y > p.y - 50 && y < p.y + p.h + 6) return p
    }
    return null
  }

  private tryPlace(it: Item, p: Plate | null): void {
    if (!p) { it.state = 'fly'; it.vx = 0; it.vy = 60; return }
    if (p.s.key === it.s.key && p.fill < p.need) {
      p.fill++; p.shake = 1
      this.combo++
      if (this.combo > this.maxCombo) this.maxCombo = this.combo
      this.correct++
      p.face = this.combo >= 8 ? 'great' : 'happy'; p.faceT = 0.6
      const gain = 10 + this.combo * 2
      this.score += gain
      this.flash = 0.35
      this.burst(it.x, it.y, p.s.col, 10)
      this.floater(it.x, it.y - 20, '+' + gain, p.s.col)
      if (this.combo >= 2) this.floater(it.x, it.y - 46, this.combo + ' コンボ!', '#e08a1a')
      if (this.opts.sound) playPlace(this.combo)
      it.state = 'gone'
      if (p.fill >= p.need) this.completePlate(p)
    } else {
      this.combo = 0
      this.mistakes++
      p.face = 'oops'; p.faceT = 0.6
      this.patience = Math.max(0, this.patience - 0.12)
      this.burst(it.x, it.y, '#999', 6)
      this.floater(it.x, it.y - 20, 'ちがう！', '#c0392b')
      if (this.opts.sound) playMiss()
      it.state = 'fly'; it.vx = rnd(-60, 60); it.vy = -160
    }
  }

  private completePlate(p: Plate): void {
    p.glow = 1
    p.face = 'great'; p.faceT = 0.9
    this.platesDone++
    this.score += 50
    this.flash = 0.6
    this.burst(p.x + p.w / 2, p.y + p.h * 0.4, p.s.col, 24)
    this.floater(p.x + p.w / 2, p.y - 10, 'できあがり!', p.s.col)
    this.patience = Math.min(1, this.patience + 0.14)
    if (this.opts.sound) playComplete()
    const reset = p
    window.setTimeout(() => { reset.fill = 0 }, 520)
  }

  private matchPlate(key: string): Plate | null {
    for (const p of this.plates) if (p.s.key === key && p.fill < p.need) return p
    return null
  }

  private finish(): void {
    if (this.ended) return
    this.ended = true
    const attempts = this.correct + this.mistakes
    const acc = attempts ? this.correct / attempts : 1
    let accuracyStars = 1
    if (acc >= 0.9) accuracyStars = 3
    else if (acc >= 0.7) accuracyStars = 2
    let speedStars = 1
    if (this.platesDone >= 8) speedStars = 3
    else if (this.platesDone >= 4) speedStars = 2

    const data = load()
    const isBestScore = this.score > data.best.score
    data.best = {
      score: Math.max(data.best.score, this.score),
      plates: Math.max(data.best.plates, this.platesDone),
      combo: Math.max(data.best.combo, this.maxCombo),
    }
    save(data)

    const result: RoundResult = {
      score: this.score,
      platesDone: this.platesDone,
      correct: this.correct,
      mistakes: this.mistakes,
      maxCombo: this.maxCombo,
      accuracyStars,
      speedStars,
      accuracy: Math.round(acc * 100),
      isBestScore,
    }
    this.opts.onEnd?.(result)
  }

  // ---- 入力 ----
  private grabAt(x: number, y: number): Item | null {
    let best: Item | null = null
    let bd = 60 * 60
    for (const it of this.items) {
      if (it.state === 'gone' || it.state === 'held') continue
      const d = (it.x - x) * (it.x - x) + (it.y - y) * (it.y - y)
      if (d < bd) { bd = d; best = it }
    }
    return best
  }

  pointerDown(x: number, y: number): void {
    if (this.ended) return
    this.auto = false
    this.releaseGhost()
    this.pointerX = x; this.pointerY = y
    const g = this.grabAt(x, y)
    if (g) { this.held = g; g.state = 'held' }
  }
  pointerMove(x: number, y: number): void {
    this.pointerX = x; this.pointerY = y
    if (this.held && !this.opts.attract) this.auto = false
  }
  pointerUp(): void {
    if (this.held) { this.tryPlace(this.held, this.plateAt(this.held.x, this.held.y)); this.held = null }
  }

  private releaseGhost(): void {
    if (this.ghostHold) { this.ghostHold.state = 'fly'; this.ghostHold.vx = 0; this.ghostHold.vy = 60; this.ghostHold = null }
  }

  // ---- 更新 ----
  update(dt: number): void {
    if (this.ended) return
    this.now += dt

    if (!this.opts.attract) {
      this.timeLeft -= dt
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.finish(); return }
    }

    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnItem()
      this.spawnTimer = Math.max(this.diff.spawnFloor, this.diff.spawnBase - this.score * 0.0006)
    }

    this.shuffleTimer -= dt
    if (this.shuffleTimer <= 0) {
      this.shuffleTimer = SHUFFLE_EVERY
      this.shufflePlates()
    }

    if (this.auto) this.autoStep(dt)

    if (this.held) {
      this.held.x += (this.pointerX - this.held.x) * Math.min(1, dt * 20)
      this.held.y += (this.pointerY - this.held.y) * Math.min(1, dt * 20)
    }

    this.ghostVisX += (this.ghostX - this.ghostVisX) * Math.min(1, dt * 12)
    this.ghostVisY += (this.ghostY - this.ghostVisY) * Math.min(1, dt * 12)

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]
      if (it.state === 'gone') { this.items.splice(i, 1); continue }
      if (it.state === 'fly') {
        it.vy += 520 * this.diff.fallScale * dt
        it.x += it.vx * dt; it.y += it.vy * dt
        if (it.y > it.settleY && it.vy > 0 && it.y < H - 190) {
          it.vy *= -0.32; it.y = it.settleY; it.vx *= 0.7
          if (Math.abs(it.vy) < 40) it.vy = 0
        }
        if (it.y > H + 40) {
          this.combo = 0
          this.patience = Math.max(0, this.patience - 0.06)
          this.floater(it.x, H - 120, 'おっと！', '#c0392b')
          this.items.splice(i, 1); continue
        }
        if (it.x < -60 || it.x > W + 60) { this.items.splice(i, 1); continue }
      }
    }

    if (!this.opts.attract) {
      this.patience = Math.max(0, this.patience - 0.006 * dt)
      if (this.patience <= 0) { this.finish(); return }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.7
      if (p.life <= 0) this.particles.splice(i, 1)
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]; f.y -= dt * 42; f.life -= dt * 0.95
      if (f.life <= 0) this.floaters.splice(i, 1)
    }
    for (const p of this.plates) {
      if (p.glow > 0) p.glow -= dt * 1.2
      if (p.shake > 0) p.shake -= dt * 3
      if (p.faceT > 0) { p.faceT -= dt; if (p.faceT <= 0) p.face = '' }
    }
    if (this.flash > 0) this.flash -= dt * 1.8
  }

  private shufflePlates(): void {
    if (this.plates.length < 2) return
    const a = (Math.random() * this.plates.length) | 0
    let b = (Math.random() * this.plates.length) | 0
    if (a === b) b = (b + 1) % this.plates.length
    const ax = this.plates[a].x, aw = this.plates[a].w
    this.plates[a].x = this.plates[b].x; this.plates[a].w = this.plates[b].w
    this.plates[b].x = ax; this.plates[b].w = aw
    this.plates[a].shake = 1; this.plates[b].shake = 1
    this.floater(W / 2, H - 210, 'シャッフル!', '#7a5cc0')
  }

  private autoStep(dt: number): void {
    if (!this.ghostHold) {
      let cand: Item | null = null
      let cd = Infinity
      for (const it of this.items) {
        if (it.state !== 'fly') continue
        if (!this.matchPlate(it.s.key)) continue
        const d = (it.x - this.ghostX) ** 2 + (it.y - this.ghostY) ** 2
        if (d < cd) { cd = d; cand = it }
      }
      if (cand) {
        this.ghostX += (cand.x - this.ghostX) * Math.min(1, dt * 10)
        this.ghostY += (cand.y - this.ghostY) * Math.min(1, dt * 10)
        if (Math.abs(cand.x - this.ghostX) < 30 && Math.abs(cand.y - this.ghostY) < 30) {
          this.ghostHold = cand; cand.state = 'held'
        }
      } else {
        this.ghostX += (W / 2 - this.ghostX) * Math.min(1, dt * 3)
        this.ghostY += (H * 0.4 - this.ghostY) * Math.min(1, dt * 3)
      }
    } else {
      const p = this.matchPlate(this.ghostHold.s.key) ?? this.plates[0]
      const tx = p.x + p.w / 2, ty = p.y + p.h * 0.3
      this.ghostX += (tx - this.ghostX) * Math.min(1, dt * 9)
      this.ghostY += (ty - this.ghostY) * Math.min(1, dt * 9)
      this.ghostHold.x = this.ghostX; this.ghostHold.y = this.ghostY
      if (Math.abs(tx - this.ghostX) < 26 && Math.abs(ty - this.ghostY) < 26) {
        this.tryPlace(this.ghostHold, p)
        this.ghostHold = null
      }
    }
  }

  // ---- 描画 ----
  render(ctx: CanvasRenderingContext2D): void {
    this.drawScene(ctx)
    for (const p of this.plates) this.drawPlate(ctx, p)
    for (const it of this.items) if (it.state !== 'held') this.drawItem(ctx, it)
    this.drawParticles(ctx)
    for (const it of this.items) if (it.state === 'held') { this.drawDropHint(ctx, it); this.drawItem(ctx, it) }
    if (this.opts.attract) this.drawGhostHand(ctx)
    this.drawHUD(ctx)
    this.drawFloaters(ctx)
    if (this.flash > 0 && !this.opts.reducedMotion) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.5})`
      ctx.fillRect(0, 0, W, H)
    }
  }

  private rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  private icon(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, r: number): void {
    ctx.save()
    ctx.translate(x, y)
    if (key === 'fruit') {
      ctx.fillStyle = '#c53a26'; ctx.beginPath(); ctx.arc(0, 2, r * 0.62, 0, 6.28); ctx.fill()
      ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -r * 0.5); ctx.lineTo(4, -r * 0.78); ctx.stroke()
      ctx.fillStyle = '#5ab24f'; ctx.beginPath(); ctx.ellipse(11, -r * 0.72, 7, 4, 0.5, 0, 6.28); ctx.fill()
    } else if (key === 'fish') {
      ctx.fillStyle = '#2f6fa8'; ctx.beginPath(); ctx.ellipse(-3, 2, r * 0.6, r * 0.4, 0, 0, 6.28); ctx.fill()
      ctx.beginPath(); ctx.moveTo(r * 0.5, 2); ctx.lineTo(r * 0.86, -r * 0.32); ctx.lineTo(r * 0.86, r * 0.36); ctx.closePath(); ctx.fill()
    } else if (key === 'bread') {
      ctx.fillStyle = '#c98a1e'; ctx.beginPath()
      ctx.moveTo(-r * 0.6, r * 0.3); ctx.quadraticCurveTo(-r * 0.6, -r * 0.55, 0, -r * 0.55)
      ctx.quadraticCurveTo(r * 0.6, -r * 0.55, r * 0.6, r * 0.3); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#e9c07a'; ctx.fillRect(-r * 0.6, r * 0.15, r * 1.2, r * 0.2)
    } else {
      ctx.fillStyle = '#3f9a4d'; ctx.beginPath()
      ctx.moveTo(0, -r * 0.6); ctx.quadraticCurveTo(r * 0.7, -r * 0.2, 0, r * 0.6)
      ctx.quadraticCurveTo(-r * 0.7, -r * 0.2, 0, -r * 0.6); ctx.fill()
      ctx.strokeStyle = '#2c6e37'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -r * 0.4); ctx.lineTo(0, r * 0.5); ctx.stroke()
    }
    ctx.restore()
  }

  private drawItem(ctx: CanvasRenderingContext2D, it: Item): void {
    const rm = this.opts.reducedMotion
    const bob = it.state === 'fly' ? Math.sin(this.now * 7 + it.wob) * 3 : 0
    const x = it.x, y = it.y + bob
    // 落ち影
    ctx.fillStyle = 'rgba(60,30,10,0.14)'
    ctx.beginPath(); ctx.ellipse(x, y + it.r * 0.78, it.r * 0.8, it.r * 0.24, 0, 0, 6.28); ctx.fill()
    // 本体：放射グラデで立体感（held中のみ軽い発光）
    ctx.save()
    if (it.state === 'held' && !rm) { ctx.shadowColor = it.s.col; ctx.shadowBlur = 12 }
    const rg = ctx.createRadialGradient(x - it.r * 0.32, y - it.r * 0.38, it.r * 0.15, x, y, it.r)
    rg.addColorStop(0, '#fff')
    rg.addColorStop(0.45, it.s.light)
    rg.addColorStop(1, it.s.col)
    ctx.fillStyle = rg
    ctx.beginPath(); ctx.arc(x, y, it.r, 0, 6.28); ctx.fill()
    ctx.restore()
    ctx.strokeStyle = it.s.col; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(x, y, it.r, 0, 6.28); ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath(); ctx.arc(x - it.r * 0.34, y - it.r * 0.4, it.r * 0.22, 0, 6.28); ctx.fill()
    this.icon(ctx, it.s.key, x, y - 2, it.r)
    const ey = y - it.r * 0.28
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(x - 8, ey, 6, 0, 6.28); ctx.arc(x + 8, ey, 6, 0, 6.28); ctx.fill()
    ctx.fillStyle = '#222'
    const look = it.state === 'held' ? 2 : Math.sin(this.now * 3 + it.wob) * 2
    ctx.beginPath(); ctx.arc(x - 8 + look, ey + 1, 3, 0, 6.28); ctx.arc(x + 8 + look, ey + 1, 3, 0, 6.28); ctx.fill()
  }

  private drawDropHint(ctx: CanvasRenderingContext2D, it: Item): void {
    const p = this.plateAt(it.x, it.y)
    if (!p) return
    ctx.strokeStyle = p.s.key === it.s.key ? p.s.col : '#c0392b'
    ctx.lineWidth = 4; ctx.setLineDash([8, 6])
    ctx.strokeRect(p.x + 4, p.y - 46, p.w - 8, p.h + 50); ctx.setLineDash([])
  }

  // 皿のごきげんフェイス（絵文字を使わず色+形で描画）
  private drawFace(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, r: number): void {
    ctx.save()
    ctx.translate(x, y)
    const col = kind === 'oops' ? '#c0392b' : kind === 'great' ? '#e08a1a' : '#7a5230'
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1.6, r * 0.14)
    ctx.lineCap = 'round'
    const ex = r * 0.34, ey = -r * 0.08
    if (kind === 'oops') {
      // 驚き目（丸）＋小さい◯口
      ctx.beginPath(); ctx.arc(-ex, ey, r * 0.16, 0, 6.28); ctx.arc(ex, ey, r * 0.16, 0, 6.28); ctx.fill()
      ctx.beginPath(); ctx.arc(0, r * 0.38, r * 0.16, 0, 6.28); ctx.stroke()
    } else if (kind === 'great') {
      // にっこり目（弧）＋大きな笑み
      ctx.beginPath(); ctx.arc(-ex, ey, r * 0.18, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke()
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.18, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke()
      ctx.beginPath(); ctx.arc(0, r * 0.06, r * 0.42, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke()
    } else if (kind === 'happy') {
      // 普通の丸目＋微笑み
      ctx.beginPath(); ctx.arc(-ex, ey, r * 0.11, 0, 6.28); ctx.arc(ex, ey, r * 0.11, 0, 6.28); ctx.fill()
      ctx.beginPath(); ctx.arc(0, r * 0.02, r * 0.34, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke()
    } else {
      // 待機中：ニュートラル
      ctx.beginPath(); ctx.arc(-ex, ey, r * 0.1, 0, 6.28); ctx.arc(ex, ey, r * 0.1, 0, 6.28); ctx.fill()
      ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.32); ctx.lineTo(r * 0.2, r * 0.32); ctx.stroke()
    }
    ctx.restore()
  }

  private drawPlate(ctx: CanvasRenderingContext2D, p: Plate): void {
    const rm = this.opts.reducedMotion
    const cx = p.x + p.w / 2, cy = p.y + p.h * 0.42
    // 注文カード（必要個数のアイコン）
    ctx.fillStyle = '#fffaf1'
    this.rr(ctx, cx - 46, p.y - 42, 92, 30, 7); ctx.fill()
    ctx.strokeStyle = 'rgba(122,82,48,0.18)'; ctx.lineWidth = 1.5
    this.rr(ctx, cx - 46, p.y - 42, 92, 30, 7); ctx.stroke()
    for (let k = 0; k < p.need; k++) {
      ctx.globalAlpha = k < p.fill ? 1 : 0.28
      this.icon(ctx, p.s.key, cx - 30 + k * 20, p.y - 27, 13)
      ctx.globalAlpha = 1
    }
    // 皿の落ち影
    ctx.fillStyle = 'rgba(60,30,10,0.16)'
    ctx.beginPath(); ctx.ellipse(cx, p.y + p.h * 0.74, p.w * 0.46, 16, 0, 0, 6.28); ctx.fill()
    const pop = 1 + p.shake * 0.05
    ctx.save(); ctx.translate(cx, cy); ctx.scale(pop, pop); ctx.translate(-cx, -cy)
    // 皿本体：放射グラデで陶器の質感
    const dish = ctx.createRadialGradient(cx - p.w * 0.14, cy - p.h * 0.14, 4, cx, cy, p.w * 0.5)
    dish.addColorStop(0, '#ffffff')
    dish.addColorStop(0.62, '#fbf3e6')
    dish.addColorStop(1, '#e7d9c2')
    ctx.fillStyle = dish
    ctx.beginPath(); ctx.ellipse(cx, cy, p.w * 0.46, p.h * 0.34, 0, 0, 6.28); ctx.fill()
    ctx.strokeStyle = 'rgba(122,82,48,0.25)'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.ellipse(cx, cy, p.w * 0.46, p.h * 0.34, 0, 0, 6.28); ctx.stroke()
    // 内皿（食材カラー）
    const inner = ctx.createRadialGradient(cx - p.w * 0.1, cy - p.h * 0.1, 2, cx, cy, p.w * 0.33)
    inner.addColorStop(0, '#fff')
    inner.addColorStop(0.5, p.s.light)
    inner.addColorStop(1, p.s.col)
    ctx.fillStyle = inner
    ctx.beginPath(); ctx.ellipse(cx, cy, p.w * 0.33, p.h * 0.24, 0, 0, 6.28); ctx.fill()
    ctx.lineWidth = 4; ctx.strokeStyle = p.s.col
    ctx.beginPath(); ctx.ellipse(cx, cy, p.w * 0.46, p.h * 0.34, 0, 0, 6.28); ctx.stroke()
    this.icon(ctx, p.s.key, cx, cy, 20)
    ctx.restore()
    // ゲージ
    const gy = p.y + p.h - 4
    ctx.fillStyle = 'rgba(90,55,20,0.14)'; this.rr(ctx, p.x + 10, gy, p.w - 20, 10, 5); ctx.fill()
    const gw = (p.w - 20) * (p.fill / p.need)
    if (gw > 0) {
      const gg = ctx.createLinearGradient(p.x + 10, 0, p.x + 10 + gw, 0)
      gg.addColorStop(0, p.s.light); gg.addColorStop(1, p.s.col)
      ctx.fillStyle = gg
      this.rr(ctx, p.x + 10, gy, gw, 10, 5); ctx.fill()
    }
    ctx.fillStyle = '#6b4a2a'; ctx.font = '600 15px "M PLUS Rounded 1c", system-ui, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(p.s.name, cx, cy + p.h * 0.5 + 4)
    if (p.glow > 0) {
      ctx.save()
      ctx.globalAlpha = p.glow
      if (!rm) { ctx.shadowColor = p.s.col; ctx.shadowBlur = 10 }
      ctx.strokeStyle = p.s.col; ctx.lineWidth = 5
      ctx.beginPath(); ctx.ellipse(cx, cy, p.w * 0.46 + (1 - p.glow) * 40, p.h * 0.34 + (1 - p.glow) * 30, 0, 0, 6.28); ctx.stroke()
      ctx.restore()
    }
    // お皿のごきげんフェイス（通常はニュートラル・反応時に一瞬ぷるん）
    const fsc = rm ? 1 : 1 + Math.min(0.9, Math.max(0, p.faceT)) * 0.28
    ctx.save()
    ctx.translate(cx, p.y - 60); ctx.scale(fsc, fsc)
    this.drawFace(ctx, p.face || 'idle', 0, 0, 20)
    ctx.restore()
  }

  private drawScene(ctx: CanvasRenderingContext2D): void {
    const rm = this.opts.reducedMotion
    // 背景：深みのある縦グラデ（暖色のキッチン空気感）
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#fff2dc'); g.addColorStop(0.5, '#fbe4c2'); g.addColorStop(1, '#f0cf9c')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    // 中央付近のやわらかな放射光
    const glow = ctx.createRadialGradient(W * 0.5, H * 0.34, 30, W * 0.5, H * 0.34, W * 0.62)
    glow.addColorStop(0, 'rgba(255,255,255,0.42)'); glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
    // タイル壁
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    for (let y = 0; y < H - 200; y += 52) {
      for (let x = ((y / 52) % 2 === 0 ? 0 : 34); x < W; x += 68) { this.rr(ctx, x + 4, y + 4, 60, 44, 6); ctx.fill() }
    }
    // カウンター（木目の質感・グラデ）
    const counter = ctx.createLinearGradient(0, H - 200, 0, H)
    counter.addColorStop(0, '#d9a468'); counter.addColorStop(1, '#b87d47')
    ctx.fillStyle = counter; ctx.fillRect(0, H - 200, W, 200)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, H - 200, W, 5)
    ctx.fillStyle = 'rgba(90,50,15,0.28)'; ctx.fillRect(0, H - 196, W, 6)
    if (!rm) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      for (let s = 0; s < 4; s++) {
        const wx = 120 + s * 260 + Math.sin(this.now * 1.2 + s) * 20
        ctx.beginPath(); ctx.ellipse(wx, 60 + Math.sin(this.now * 1.8 + s) * 10, 26, 14, 0, 0, 6.28); ctx.fill()
      }
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.fillStyle = p.col
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawFloaters(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life))
      ctx.fillStyle = f.col; ctx.font = '700 22px "M PLUS Rounded 1c", system-ui, sans-serif'
      ctx.fillText(f.text, f.x, f.y)
    }
    ctx.globalAlpha = 1
  }

  private drawGhostHand(ctx: CanvasRenderingContext2D): void {
    const rm = this.opts.reducedMotion
    const x = this.ghostVisX, y = this.ghostVisY
    ctx.save(); ctx.globalAlpha = 0.9
    if (!rm) { ctx.shadowColor = '#7a5cc0'; ctx.shadowBlur = 10 }
    const hg = ctx.createRadialGradient(x - 4, y - 5, 2, x, y, 14)
    hg.addColorStop(0, '#b39ce0'); hg.addColorStop(1, '#7a5cc0')
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, 14, 0, 6.28); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.28); ctx.fill()
    ctx.restore()
    ctx.strokeStyle = 'rgba(122,92,192,0.5)'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(x, y, 20 + Math.sin(this.now * 9) * 3, 0, 6.28); ctx.stroke()
  }

  private drawHUD(ctx: CanvasRenderingContext2D): void {
    const F = '"M PLUS Rounded 1c", system-ui, sans-serif'
    const rm = this.opts.reducedMotion
    ctx.textBaseline = 'alphabetic'

    // スコアカード（グラデ地＋半透明ボーダー）
    ctx.save()
    if (!rm) { ctx.shadowColor = 'rgba(90,55,20,0.28)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5 }
    const sc = ctx.createLinearGradient(0, 16, 0, 70)
    sc.addColorStop(0, 'rgba(255,250,240,0.95)'); sc.addColorStop(1, 'rgba(250,235,210,0.95)')
    ctx.fillStyle = sc; this.rr(ctx, 18, 16, 196, 54, 12); ctx.fill()
    ctx.restore()
    ctx.strokeStyle = 'rgba(122,82,48,0.22)'; ctx.lineWidth = 1; this.rr(ctx, 18, 16, 196, 54, 12); ctx.stroke()
    ctx.fillStyle = '#8a6238'; ctx.font = '600 14px ' + F; ctx.textAlign = 'left'
    ctx.fillText('スコア', 34, 38)
    ctx.fillStyle = '#3a2a18'; ctx.font = '700 26px ' + F
    ctx.fillText(String(this.score), 34, 62)
    if (this.combo >= 2) {
      ctx.fillStyle = '#e08a1a'; ctx.font = '700 20px ' + F; ctx.textAlign = 'right'
      ctx.fillText(this.combo + ' コンボ', 200, 56)
    }

    // 右上：がまんメーター＋残り時間
    const mx = W - 266, my = 22, mw = 248, mh = 20
    ctx.save()
    if (!rm) { ctx.shadowColor = 'rgba(90,55,20,0.28)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5 }
    const mc = ctx.createLinearGradient(0, my - 8, 0, my + mh + 50)
    mc.addColorStop(0, 'rgba(255,250,240,0.95)'); mc.addColorStop(1, 'rgba(250,235,210,0.95)')
    ctx.fillStyle = mc; this.rr(ctx, mx - 10, my - 8, mw + 20, mh + 58, 12); ctx.fill()
    ctx.restore()
    ctx.strokeStyle = 'rgba(122,82,48,0.22)'; ctx.lineWidth = 1
    this.rr(ctx, mx - 10, my - 8, mw + 20, mh + 58, 12); ctx.stroke()
    ctx.fillStyle = '#8a6238'; ctx.font = '600 13px ' + F; ctx.textAlign = 'left'
    ctx.fillText('がまんメーター', mx, my + 2)
    ctx.fillStyle = 'rgba(90,55,20,0.14)'; this.rr(ctx, mx, my + 8, mw, mh, 10); ctx.fill()
    const pc0 = this.patience > 0.5 ? '#8fd39c' : this.patience > 0.25 ? '#f2c168' : '#f08a76'
    const pc1 = this.patience > 0.5 ? '#4caa5a' : this.patience > 0.25 ? '#e0a12a' : '#e5533c'
    if (this.patience > 0.02) {
      const pg = ctx.createLinearGradient(mx, 0, mx + mw * this.patience, 0)
      pg.addColorStop(0, pc0); pg.addColorStop(1, pc1)
      ctx.fillStyle = pg
      this.rr(ctx, mx, my + 8, mw * this.patience, mh, 10); ctx.fill()
    }

    if (!this.opts.attract) {
      ctx.fillStyle = 'rgba(90,55,20,0.14)'; this.rr(ctx, mx, my + 36, mw, 12, 6); ctx.fill()
      const tw = (mw * this.timeLeft) / ROUND_TIME
      if (tw > 0) {
        const tg = ctx.createLinearGradient(mx, 0, mx + tw, 0)
        if (this.timeLeft > 10) { tg.addColorStop(0, '#7fb8e8'); tg.addColorStop(1, '#3d84c6') }
        else { tg.addColorStop(0, '#f08a76'); tg.addColorStop(1, '#e5533c') }
        ctx.fillStyle = tg
        this.rr(ctx, mx, my + 36, tw, 12, 6); ctx.fill()
      }
      ctx.fillStyle = '#8a6238'; ctx.font = '700 12px ' + F; ctx.textAlign = 'right'
      ctx.fillText(Math.ceil(this.timeLeft) + '秒', mx + mw, my + 2)
    } else {
      ctx.save()
      if (!rm) { ctx.shadowColor = 'rgba(122,92,192,0.5)'; ctx.shadowBlur = 10 }
      const ag = ctx.createLinearGradient(W / 2 - 70, 0, W / 2 + 70, 0)
      ag.addColorStop(0, '#8f6fd6'); ag.addColorStop(1, '#6a4ab0')
      ctx.fillStyle = ag; this.rr(ctx, W / 2 - 70, 16, 140, 30, 15); ctx.fill()
      ctx.restore()
      ctx.fillStyle = '#fff'; ctx.font = '700 14px ' + F; ctx.textAlign = 'center'
      ctx.fillText('お手本デモ中', W / 2, 36)
    }
    ctx.textAlign = 'left'
  }
}
