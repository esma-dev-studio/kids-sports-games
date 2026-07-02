import type { EngineOpts, RoundResult } from './types'
import { DIFF, GOAL_X, H, ROUND_TIME, W } from './config'
import { playCatch, playEarly, playMiss } from './audio'
import { load, save } from './storage'

interface Ball {
  x: number; y: number; vx: number; vy: number; r: number
  curve: boolean; curveA: number; curveApplied: boolean; age: number
  ghostT: number; trail: { x: number; y: number }[]; color: string; done: boolean
}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; r: number; col: string }
interface Ring { x: number; y: number; t: number; life: number; col: string }
interface Floater { x: number; y: number; text: string; life: number; col: string }

const PAD_X = GOAL_X + 60
const PAD_MINY = 86
const PAD_MAXY = H - 66

const COL = {
  go: '#37c2ff', curve: '#ff8a3d', good: '#7be0b0', gold: '#ffd45e', miss: '#ff5470', ink: '#eaf3ff',
}

export class MiraiGame {
  private opts: EngineOpts
  private diff = DIFF.easy
  private pad = { x: PAD_X, y: H / 2, ty: H / 2, w: 24, h: 120 }
  private ball: Ball | null = null

  private score = 0
  private dispScore = 0
  private combo = 0
  private maxCombo = 0
  private lives = 0
  private timeLeft = ROUND_TIME
  private feverTime = 0

  private intercepts = 0
  private balls = 0
  private earlyIntercepts = 0
  private curveIntercepts = 0
  private conceded = 0

  private parts: Particle[] = []
  private rings: Ring[] = []
  private floats: Floater[] = []
  private flash = 0
  private flashCol = COL.good

  private now = 0
  private spawnTimer = 0.4
  private settled = 0
  private ended = false

  // attract お手本
  private lastInput = -999
  private auto: boolean

  constructor(opts: EngineOpts) {
    this.opts = opts
    this.diff = DIFF[opts.mode]
    this.pad.w = this.diff.padW
    this.pad.h = this.diff.padH
    this.lives = this.diff.lives
    this.auto = opts.attract
  }

  private rnd(a: number, b: number) { return a + Math.random() * (b - a) }
  private clamp(v: number, a: number, b: number) { return v < a ? a : v > b ? b : v }

  private spawnBall(): void {
    const top = Math.random() < 0.4
    const speed = this.rnd(this.diff.speedMin, this.diff.speedMax)
    const curve = Math.random() < this.diff.curveProb
    const aimX = this.rnd(GOAL_X + 120, W - 360)
    const aimY = this.rnd(150, H - 150)
    let sx: number, sy: number
    if (top) { sx = this.rnd(W * 0.4, W * 0.92); sy = -12 }
    else { sx = W - 14; sy = this.rnd(130, H - 130) }
    const dx = aimX - sx, dy = aimY - sy
    const d = Math.sqrt(dx * dx + dy * dy) || 1
    this.ball = {
      x: sx, y: sy, vx: (dx / d) * speed, vy: (dy / d) * speed, r: 15,
      curve, curveA: (Math.random() < 0.5 ? -1 : 1) * this.rnd(1.4, 2.4), curveApplied: false, age: 0,
      ghostT: this.diff.ghostTime, trail: [], color: curve ? COL.curve : COL.go, done: false,
    }
    this.balls++
    this.settled = 0
  }

  private futureY(): number {
    // ball が PAD_X 平面に達するときの y を予測
    const b = this.ball
    if (!b || b.vx >= 0) return b ? b.y : H / 2
    const tHit = (PAD_X - b.x) / b.vx
    if (tHit <= 0) return b.y
    const steps = Math.max(1, Math.floor(tHit / 0.016))
    let x = b.x, y = b.y, vx = b.vx, vy = b.vy, age = b.age, applied = b.curveApplied
    const dt = tHit / steps
    for (let i = 0; i < steps; i++) {
      age += dt
      if (b.curve && !applied && age > 0.34) {
        const sp = Math.sqrt(vx * vx + vy * vy)
        const ang = Math.atan2(vy, vx) + b.curveA * 0.5
        vx = Math.cos(ang) * sp; vy = Math.sin(ang) * sp; applied = true
      }
      x += vx * dt; y += vy * dt
    }
    return y
  }

  private burst(x: number, y: number, col: string, count: number): void {
    const n = this.opts.reducedMotion ? Math.ceil(count * 0.4) : count
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = this.rnd(60, 300)
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, r: this.rnd(2, 5), col })
    }
  }
  private ring(x: number, y: number, col: string): void { this.rings.push({ x, y, t: 0, life: 0.32, col }) }
  private floater(x: number, y: number, text: string, col: string): void { this.floats.push({ x, y, text, life: 1, col }) }

  private intercept(early: boolean): void {
    const b = this.ball!
    const mult = this.feverTime > 0 ? 2 : 1
    const base = (early ? 150 : 100) + this.combo * 2
    const gain = base * mult
    this.score += gain
    this.combo++
    if (this.combo > this.maxCombo) this.maxCombo = this.combo
    this.intercepts++
    if (early) this.earlyIntercepts++
    if (b.curve) this.curveIntercepts++
    this.flash = 1; this.flashCol = early ? COL.good : COL.go
    this.burst(b.x, b.y, b.color, early ? 22 : 14)
    this.ring(this.pad.x, this.pad.y, early ? COL.good : COL.go)
    this.floater(this.pad.x + 30, this.pad.y - 34, early ? 'ズバリ！+' + gain : 'ナイス読み！+' + gain, early ? COL.gold : COL.good)
    if (this.combo > 0 && this.combo % 10 === 0) { this.feverTime = 3; this.floater(W / 2, 120, 'チャンス！ ×2', COL.gold) }
    if (this.opts.sound) { if (early) playEarly(); else playCatch(this.combo) }
    b.done = true
  }

  private concede(): void {
    const b = this.ball!
    this.combo = 0
    this.conceded++
    this.burst(GOAL_X, b.y, COL.miss, 12)
    this.ring(GOAL_X + 20, b.y, COL.miss)
    if (this.diff.lives > 0) {
      this.lives--
      this.floater(GOAL_X + 70, b.y - 24, 'ぬけた…', COL.miss)
      if (this.opts.sound) playMiss()
      if (this.lives <= 0 && !this.opts.attract) { b.done = true; this.finish(); return }
    } else {
      this.floater(GOAL_X + 70, b.y - 24, 'おしい！ つぎいこう', COL.miss)
    }
    b.done = true
  }

  private finish(): void {
    if (this.ended) return
    this.ended = true
    const predictRate = this.intercepts ? this.earlyIntercepts / this.intercepts : 0
    const accRate = this.balls ? this.intercepts / this.balls : 0
    let predictStars = 1
    if (this.intercepts >= 3 && predictRate >= 0.6) predictStars = 3
    else if (predictRate >= 0.35) predictStars = 2
    let accuracyStars = 1
    if (accRate >= 0.8) accuracyStars = 3
    else if (accRate >= 0.55) accuracyStars = 2

    const data = load()
    const isBestScore = this.score > data.best.score
    data.best = {
      score: Math.max(data.best.score, this.score),
      combo: Math.max(data.best.combo, this.maxCombo),
      early: Math.max(data.best.early, this.earlyIntercepts),
    }
    save(data)

    const result: RoundResult = {
      score: this.score, maxCombo: this.maxCombo, intercepts: this.intercepts, balls: this.balls,
      earlyIntercepts: this.earlyIntercepts, curveIntercepts: this.curveIntercepts, conceded: this.conceded,
      predictStars, accuracyStars, isBestScore,
    }
    this.opts.onEnd?.(result)
  }

  pointerMove(_x: number, y: number): void {
    this.pad.ty = this.clamp(y, PAD_MINY, PAD_MAXY)
    this.lastInput = this.now
    this.auto = false
  }
  pointerDown(x: number, y: number): void { this.pointerMove(x, y) }

  update(dt: number): void {
    if (this.ended) return
    this.now += dt
    if (!this.opts.attract) {
      this.timeLeft -= dt
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.finish(); return }
    }
    if (!this.auto && this.now - this.lastInput > 3.2) this.auto = true
    this.feverTime = Math.max(0, this.feverTime - dt)

    // 出題
    if (!this.ball) {
      this.spawnTimer -= dt
      if (this.spawnTimer <= 0) { this.spawnBall(); this.spawnTimer = this.rnd(0.5, 0.9) }
    } else {
      const b = this.ball
      b.age += dt
      if (b.curve && !b.curveApplied && b.age > 0.34) {
        const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
        const ang = Math.atan2(b.vy, b.vx) + b.curveA * 0.5
        b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.curveApplied = true
      }
      const prevX = b.x
      b.x += b.vx * dt; b.y += b.vy * dt
      b.ghostT -= dt
      b.trail.push({ x: b.x, y: b.y })
      if (b.trail.length > 10) b.trail.shift()
      if (b.y < -40 || b.y > H + 40) { this.ball = null }
      else {
        // パッド平面を横切ったか
        if (prevX > PAD_X && b.x <= PAD_X) {
          if (Math.abs(b.y - this.pad.y) < this.pad.h / 2 + b.r) {
            this.intercept(this.settled > 0.22)
          }
        }
        if (b.x <= GOAL_X + b.r && !b.done) this.concede()
        if (b.done) this.ball = null
      }
    }

    // パッド移動（速度上限＝先回りが要る）。attractは未来位置へ。
    if (this.auto) this.pad.ty = this.futureY()
    const dy = this.pad.ty - this.pad.y
    const maxStep = this.diff.padSpeed * dt
    const step = this.clamp(dy, -maxStep, maxStep)
    this.pad.y += step
    this.pad.y = this.clamp(this.pad.y, PAD_MINY, PAD_MAXY)
    if (Math.abs(step) < maxStep * 0.25 && Math.abs(dy) < 8) this.settled += dt
    else this.settled = 0

    this.flash = Math.max(0, this.flash - dt * 3)
    this.dispScore += (this.score - this.dispScore) * Math.min(1, dt * 8)
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]
      p.life -= dt * 1.6; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 240 * dt; p.vx *= 0.96
      if (p.life <= 0) this.parts.splice(i, 1)
    }
    for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].t += dt; if (this.rings[i].t >= this.rings[i].life) this.rings.splice(i, 1) }
    for (let i = this.floats.length - 1; i >= 0; i--) { const f = this.floats[i]; f.life -= dt * 1.1; f.y -= dt * 30; if (f.life <= 0) this.floats.splice(i, 1) }
  }

  // ---- 描画 ----
  render(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#11294a'); g.addColorStop(1, '#0a1830')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    if (this.feverTime > 0 && !this.opts.reducedMotion) {
      ctx.fillStyle = COL.good; ctx.globalAlpha = 0.07; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1
    for (let gx = 0; gx < W; gx += 52) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke() }

    // ゴールライン
    ctx.fillStyle = 'rgba(255,84,112,0.16)'; ctx.fillRect(0, 0, GOAL_X + 30, H)
    ctx.strokeStyle = 'rgba(255,120,140,0.8)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(GOAL_X, 40); ctx.lineTo(GOAL_X, H - 40); ctx.stroke(); ctx.setLineDash([])

    // リング
    for (const r of this.rings) {
      const a = 1 - r.t / r.life
      ctx.globalAlpha = a; ctx.strokeStyle = r.col; ctx.lineWidth = 4
      ctx.beginPath(); ctx.arc(r.x, r.y, 16 + r.t * 260, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.globalAlpha = 1

    const b = this.ball
    if (b) {
      if (b.ghostT > 0) {
        const ga = this.clamp(b.ghostT / this.diff.ghostTime, 0, 1) * 0.7
        const fy = this.futureY()
        ctx.strokeStyle = 'rgba(255,255,255,' + (ga * 0.7) + ')'; ctx.setLineDash([7, 7]); ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(PAD_X, fy); ctx.stroke(); ctx.setLineDash([])
        ctx.fillStyle = 'rgba(255,255,255,' + (ga * 0.5) + ')'
        ctx.beginPath(); ctx.arc(PAD_X, fy, b.r, 0, Math.PI * 2); ctx.fill()
      }
      for (let t = 0; t < b.trail.length; t++) {
        const tr = b.trail[t], ta = (t / b.trail.length) * 0.4
        ctx.fillStyle = 'rgba(' + (b.curve ? '255,138,61' : '55,194,255') + ',' + ta + ')'
        ctx.beginPath(); ctx.arc(tr.x, tr.y, b.r * (0.4 + (t / b.trail.length) * 0.5), 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = b.color
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.32, 0, Math.PI * 2); ctx.fill()
      if (b.curve) { ctx.fillStyle = '#fff'; ctx.font = '12px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('↺', b.x, b.y) }
    }

    // パッド（キャッチャー）
    ctx.fillStyle = this.auto ? '#4fb8ff' : '#6effb0'
    this.rr(ctx, this.pad.x - this.pad.w / 2, this.pad.y - this.pad.h / 2, this.pad.w, this.pad.h, 10); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '18px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(this.auto ? '🤖' : '🧤', this.pad.x, this.pad.y)

    for (const p of this.parts) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill() }
    ctx.globalAlpha = 1
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (const f of this.floats) { ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4)); ctx.fillStyle = f.col; ctx.font = 'bold 22px system-ui,sans-serif'; ctx.fillText(f.text, f.x, f.y) }
    ctx.globalAlpha = 1

    this.drawHUD(ctx)
    if (this.flash > 0 && !this.opts.reducedMotion) { ctx.fillStyle = this.flashCol; ctx.globalAlpha = this.flash * 0.28; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
  }

  private rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
  }

  private drawHUD(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = 'rgba(0,0,0,0.32)'; this.rr(ctx, 24, 20, 220, 92, 14); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '13px system-ui,sans-serif'; ctx.fillText('SCORE', 42, 46)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 34px system-ui,sans-serif'; ctx.fillText(String(Math.round(this.dispScore)), 42, 84)
    if (this.combo >= 2) { ctx.fillStyle = COL.gold; ctx.font = '600 15px system-ui,sans-serif'; ctx.fillText('🔥 ' + this.combo, 150, 84) }
    if (this.feverTime > 0) { ctx.fillStyle = COL.gold; ctx.font = 'bold 15px system-ui,sans-serif'; ctx.fillText('×2 チャンス！', 42, 106) }

    if (!this.opts.attract) {
      // ライフ（ふつうのみ） or ノーフェイル表示
      ctx.textAlign = 'right'
      if (this.diff.lives > 0) {
        for (let i = 0; i < this.diff.lives; i++) { ctx.fillStyle = i < this.lives ? COL.miss : 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(W - 40 - i * 30, 40, 11, 0, Math.PI * 2); ctx.fill() }
      } else {
        ctx.fillStyle = 'rgba(150,255,200,0.9)'; ctx.font = '600 14px system-ui,sans-serif'; ctx.fillText('やさしい：ミスしても だいじょうぶ', W - 30, 44)
      }
      // 残り時間バー
      const bw = 300
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; this.rr(ctx, W - bw - 40, 60, bw, 14, 7); ctx.fill()
      ctx.fillStyle = this.timeLeft > 8 ? '#37c2ff' : COL.miss
      const w = (bw * this.timeLeft) / ROUND_TIME
      if (w > 0) { this.rr(ctx, W - bw - 40, 60, w, 14, 7); ctx.fill() }
      ctx.textAlign = 'left'
    } else {
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(150,225,255,0.9)'; ctx.font = 'bold 15px system-ui,sans-serif'
      ctx.fillText('🤖 じどうデモ さいせい中', W - 30, 44)
      ctx.textAlign = 'left'
    }
  }
}
