import type { EngineOpts, NodeType, Phase, RoundResult } from './types'
import { DIFF, H, LIVES, ROUND_TIME, W } from './config'
import { playGaman, playMiss, playPop } from './audio'
import { load, save } from './storage'

interface Node { x: number; y: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; r: number; col: string }
interface Ring { x: number; y: number; r: number; life: number; col: string }
interface Floater { x: number; y: number; text: string; life: number; col: string }

const COL = {
  court: '#e8f2ee', courtRing: '#cfe3db', courtLine: '#bcd6cc',
  idle: '#c3d4cd', idleEdge: '#a9c2b8',
  go: '#1fa88a', goEdge: '#14806b', goGlow: 'rgba(31,168,138,0.30)',
  nogo: '#e2564a', nogoEdge: '#b83a30', nogoGlow: 'rgba(226,86,74,0.28)',
  ink: '#0f2f28', white: '#ffffff', gold: '#f4b740', spark: '#7fe0c8',
}

const CX = W * 0.5
const CY = H * 0.5 + 6
const RING = 210
const NODE_R = 40

export class SignalGame {
  private opts: EngineOpts
  private diff = DIFF.easy
  private nodes: Node[] = []

  private active = -1
  private type: NodeType = 'go'
  private phase: Phase = 'gap'
  private t = 0
  private litDur = 1
  private gap = 0.45
  private judged = false

  private score = 0
  private dispScore = 0
  private combo = 0
  private gaman = 0
  private lives = LIVES
  private timeLeft = ROUND_TIME

  private maxCombo = 0
  private maxGaman = 0
  private goShown = 0
  private goHit = 0
  private nogoShown = 0
  private nogoResisted = 0
  private nogoTapped = 0
  private reactionTimes: number[] = []

  private parts: Particle[] = []
  private rings: Ring[] = []
  private floats: Floater[] = []
  private flash = 0
  private flashCol = COL.goGlow

  private now = 0
  private ended = false
  private endPending = false

  // お手本ゴースト（attract時のみ）
  private ghost = { x: CX, y: CY, tx: CX, ty: CY, show: 0, press: 0 }
  private ghostDelay = 999

  constructor(opts: EngineOpts) {
    this.opts = opts
    this.diff = DIFF[opts.mode]
    this.gap = this.diff.gap
    for (let i = 0; i < this.diff.nodeCount; i++) {
      const a = -Math.PI / 2 + i * ((Math.PI * 2) / this.diff.nodeCount)
      this.nodes.push({ x: CX + Math.cos(a) * RING, y: CY + Math.sin(a) * RING })
    }
    this.pickNext()
  }

  private goProb(): number {
    return Math.max(this.diff.goProbFloor, this.diff.goProb - this.combo * 0.01)
  }

  private pickNext(): void {
    let idx = 0
    do { idx = (Math.random() * this.nodes.length) | 0 } while (idx === this.active && this.nodes.length > 1)
    this.active = idx
    this.type = Math.random() < this.goProb() ? 'go' : 'nogo'
    const base = this.diff.litMin + Math.random() * (this.diff.litMax - this.diff.litMin)
    this.litDur = Math.max(this.diff.litFloor, base - this.combo * 0.015)
    this.t = 0
    this.phase = 'lit'
    this.judged = false
    if (this.type === 'go') this.goShown++
    else this.nogoShown++

    if (this.opts.attract) {
      const n = this.nodes[idx]
      this.ghost.tx = n.x
      this.ghost.ty = n.y
      this.ghostDelay = this.type === 'go' ? 0.18 + Math.random() * 0.16 : 999
    }
  }

  private burst(x: number, y: number, col: string, count: number): void {
    const n = this.opts.reducedMotion ? Math.ceil(count * 0.4) : count
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 60 + Math.random() * 160
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, r: 3 + Math.random() * 3, col })
    }
  }
  private ring(x: number, y: number, col: string): void { this.rings.push({ x, y, r: NODE_R * 0.6, life: 1, col }) }
  private floater(x: number, y: number, text: string, col: string): void { this.floats.push({ x, y, text, life: 1, col }) }

  private judge(idx: number): void {
    if (idx !== this.active || this.phase !== 'lit' || this.judged) return
    const n = this.nodes[idx]
    if (this.type === 'go') {
      this.judged = true
      this.score += 10 + this.combo * 2
      this.combo++
      if (this.combo > this.maxCombo) this.maxCombo = this.combo
      this.goHit++
      this.reactionTimes.push(this.t * 1000)
      this.flash = 1; this.flashCol = COL.goGlow
      this.burst(n.x, n.y, COL.spark, 14)
      this.burst(n.x, n.y, COL.gold, 6)
      this.ring(n.x, n.y, COL.go)
      this.floater(n.x, n.y - NODE_R, '+' + (10 + (this.combo - 1) * 2), COL.go)
      if (this.combo >= 2) this.floater(CX, CY + 58, this.combo + ' COMBO', COL.gold)
      if (this.opts.sound) playPop()
      this.phase = 'clear'; this.t = 0
    } else {
      this.judged = true
      this.combo = 0
      this.lives--
      this.nogoTapped++
      this.flash = 1; this.flashCol = COL.nogoGlow
      this.burst(n.x, n.y, COL.nogo, 10)
      this.floater(n.x, n.y - NODE_R, 'ミス！', COL.nogo)
      if (this.opts.sound) playMiss()
      this.phase = 'clear'; this.t = 0
      if (this.lives <= 0 && !this.opts.attract) this.endPending = true
    }
  }

  private expire(): void {
    const n = this.nodes[this.active]
    if (this.type === 'go' && !this.judged) {
      this.combo = 0 // 見逃し：コンボリセット（ライフは減らさない）
    } else if (this.type === 'nogo' && !this.judged) {
      // ニセ光を我慢できた＝見きわめ成功。我慢が得点になる中核。
      this.gaman++
      this.nogoResisted++
      if (this.gaman > this.maxGaman) this.maxGaman = this.gaman
      this.score += 5 + this.gaman
      this.ring(n.x, n.y, COL.nogo)
      this.floater(n.x, n.y - NODE_R, '見きわめ！', COL.nogoEdge)
      if (this.gaman % 3 === 0) this.floater(CX, CY + 58, 'がまん連鎖 x' + this.gaman, COL.nogoEdge)
      if (this.opts.sound) playGaman()
    }
    this.phase = 'gap'; this.t = 0
  }

  private finish(): void {
    if (this.ended) return
    this.ended = true
    const hitRate = this.goShown ? this.goHit / this.goShown : 0
    const avg = this.reactionTimes.length
      ? this.reactionTimes.reduce((s, v) => s + v, 0) / this.reactionTimes.length
      : 9999
    const resistRate = this.nogoShown ? this.nogoResisted / this.nogoShown : 1

    let reactionStars = 1
    if (hitRate >= 0.8 && avg <= 560) reactionStars = 3
    else if (hitRate >= 0.6 && avg <= 780) reactionStars = 2

    let discernStars = 1
    if (resistRate >= 0.85) discernStars = 3
    else if (resistRate >= 0.6) discernStars = 2

    const data = load()
    const isBestScore = this.score > data.best.score
    data.best = {
      score: Math.max(data.best.score, this.score),
      combo: Math.max(data.best.combo, this.maxCombo),
      gaman: Math.max(data.best.gaman, this.maxGaman),
    }
    save(data)

    const result: RoundResult = {
      score: this.score,
      maxCombo: this.maxCombo,
      maxGaman: this.maxGaman,
      reactionStars,
      discernStars,
      goHit: this.goHit,
      goShown: this.goShown,
      nogoResisted: this.nogoResisted,
      nogoShown: this.nogoShown,
      avgReaction: Math.round(avg),
      isBestScore,
    }
    this.opts.onEnd?.(result)
  }

  pointerDown(mx: number, my: number): void {
    if (this.ended) return
    if (this.phase === 'lit') {
      const n = this.nodes[this.active]
      const dx = mx - n.x, dy = my - n.y
      if (dx * dx + dy * dy <= (NODE_R + 14) * (NODE_R + 14)) this.judge(this.active)
    }
  }

  update(dt: number): void {
    if (this.ended) return
    this.now += dt

    if (!this.opts.attract) {
      this.timeLeft -= dt
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.finish(); return }
    }

    if (this.phase === 'lit') {
      this.t += dt
      if (this.opts.attract) this.updateGhost(dt)
      if (this.t >= this.litDur) this.expire()
    } else if (this.phase === 'clear') {
      this.t += dt
      if (this.t >= 0.28) {
        if (this.endPending) { this.finish(); return }
        this.phase = 'gap'; this.t = 0
      }
    } else {
      this.t += dt
      this.ghost.show = Math.max(0, this.ghost.show - dt * 3)
      if (this.t >= this.gap) this.pickNext()
    }

    this.ghost.x += (this.ghost.tx - this.ghost.x) * Math.min(1, dt * 9)
    this.ghost.y += (this.ghost.ty - this.ghost.y) * Math.min(1, dt * 9)
    this.ghost.press = Math.max(0, this.ghost.press - dt * 4)

    this.flash = Math.max(0, this.flash - dt * 3)
    this.dispScore += (this.score - this.dispScore) * Math.min(1, dt * 8)

    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]
      p.life -= dt * 1.6; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 0.96
      if (p.life <= 0) this.parts.splice(i, 1)
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.life -= dt * 1.8; r.r += dt * 160
      if (r.life <= 0) this.rings.splice(i, 1)
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]; f.life -= dt * 1.1; f.y -= dt * 34
      if (f.life <= 0) this.floats.splice(i, 1)
    }
  }

  private updateGhost(dt: number): void {
    const n = this.nodes[this.active]
    if (this.type === 'go') {
      this.ghostDelay -= dt
      this.ghost.tx = n.x; this.ghost.ty = n.y
      this.ghost.show = Math.min(1, this.ghost.show + dt * 5)
      if (this.ghostDelay <= 0 && !this.judged) { this.ghost.press = 1; this.judge(this.active) }
    } else {
      this.ghost.tx = CX + Math.cos(this.now * 0.7) * 70
      this.ghost.ty = CY + Math.sin(this.now * 0.9) * 70
      this.ghost.show = Math.min(1, this.ghost.show + dt * 4)
    }
  }

  // ---- 描画 ----
  render(ctx: CanvasRenderingContext2D): void {
    this.drawCourt(ctx)
    for (let i = 0; i < this.nodes.length; i++) if (i !== this.active) this.drawNode(ctx, this.nodes[i], false)
    if (this.active >= 0) this.drawNode(ctx, this.nodes[this.active], this.phase === 'lit')
    this.drawFx(ctx)
    this.drawHUD(ctx)
    if (this.opts.attract) this.drawGhost(ctx)
    if (this.flash > 0 && !this.opts.reducedMotion) {
      ctx.fillStyle = this.flashCol
      ctx.globalAlpha = this.flash * 0.5
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
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

  private drawCourt(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COL.court
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = COL.courtLine; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(CX, CY, RING + NODE_R + 22, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = COL.courtRing; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(CX, CY, RING, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([6, 10])
    ctx.beginPath(); ctx.arc(CX, CY, RING - NODE_R - 14, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])
  }

  private drawNode(ctx: CanvasRenderingContext2D, n: Node, isActive: boolean): void {
    if (!isActive) {
      ctx.fillStyle = COL.idle
      ctx.strokeStyle = COL.idleEdge; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.fillStyle = COL.courtRing
      ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R * 0.32, 0, Math.PI * 2); ctx.fill()
      return
    }
    const prog = this.phase === 'lit' ? this.t / this.litDur : 1
    const pulse = 1 + Math.sin(this.now * 10) * 0.04
    const halo = this.opts.reducedMotion ? 1.35 : 1.5 + 0.15 * Math.sin(this.now * 8)
    if (this.type === 'go') {
      ctx.fillStyle = COL.goGlow
      ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R * halo, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = COL.go; ctx.strokeStyle = COL.goEdge; ctx.lineWidth = 4
      ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.strokeStyle = COL.white; ctx.lineWidth = 6; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R * 0.5, 0, Math.PI * 2); ctx.stroke()
    } else {
      ctx.fillStyle = COL.nogoGlow
      ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R * halo, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = COL.nogo; ctx.strokeStyle = COL.nogoEdge; ctx.lineWidth = 4
      ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.strokeStyle = COL.white; ctx.lineWidth = 7; ctx.lineCap = 'round'
      const d = NODE_R * 0.42
      ctx.beginPath()
      ctx.moveTo(n.x - d, n.y - d); ctx.lineTo(n.x + d, n.y + d)
      ctx.moveTo(n.x + d, n.y - d); ctx.lineTo(n.x - d, n.y + d)
      ctx.stroke()
    }
    ctx.lineCap = 'butt'
    if (this.phase === 'lit') {
      ctx.strokeStyle = this.type === 'go' ? COL.goEdge : COL.nogoEdge
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(n.x, n.y, NODE_R + 9, -Math.PI / 2, -Math.PI / 2 + (1 - prog) * Math.PI * 2)
      ctx.stroke()
    }
  }

  private drawGhost(ctx: CanvasRenderingContext2D): void {
    if (this.ghost.show <= 0.02) return
    ctx.globalAlpha = this.ghost.show * 0.9
    const pr = 1 - this.ghost.press * 0.25
    ctx.fillStyle = 'rgba(20,64,54,0.16)'
    ctx.beginPath(); ctx.arc(this.ghost.x, this.ghost.y + 2, 20 * pr, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = COL.white; ctx.strokeStyle = COL.goEdge; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(this.ghost.x, this.ghost.y, 15 * pr, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = COL.goEdge
    ctx.beginPath(); ctx.arc(this.ghost.x, this.ghost.y, 6 * pr, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  }

  private drawHUD(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    this.rr(ctx, CX - 118, CY - 70, 236, 140, 18); ctx.fill()
    ctx.strokeStyle = COL.courtRing; ctx.lineWidth = 2; this.rr(ctx, CX - 118, CY - 70, 236, 140, 18); ctx.stroke()

    ctx.fillStyle = COL.ink; ctx.font = 'bold 20px system-ui,sans-serif'
    ctx.fillText('SCORE', CX, CY - 46)
    ctx.font = 'bold 46px system-ui,sans-serif'; ctx.fillStyle = COL.go
    ctx.fillText(String(Math.round(this.dispScore)), CX, CY - 8)

    ctx.font = 'bold 16px system-ui,sans-serif'; ctx.fillStyle = COL.ink
    ctx.fillText('COMBO', CX - 58, CY + 38)
    ctx.fillText('がまん', CX + 58, CY + 38)
    ctx.font = 'bold 26px system-ui,sans-serif'
    ctx.fillStyle = this.combo > 0 ? COL.gold : COL.idleEdge
    ctx.fillText('x' + this.combo, CX - 58, CY + 60)
    ctx.fillStyle = this.gaman > 0 ? COL.nogoEdge : COL.idleEdge
    ctx.fillText('x' + this.gaman, CX + 58, CY + 60)

    if (!this.opts.attract) {
      // ライフ
      ctx.textAlign = 'left'
      for (let i = 0; i < LIVES; i++) {
        ctx.fillStyle = i < this.lives ? COL.nogo : COL.idle
        ctx.beginPath(); ctx.arc(44 + i * 34, 44, 13, 0, Math.PI * 2); ctx.fill()
      }
      // 残り時間バー
      const bw = 300
      ctx.fillStyle = 'rgba(15,47,40,0.12)'
      this.rr(ctx, W - bw - 40, 34, bw, 18, 9); ctx.fill()
      ctx.fillStyle = this.timeLeft > 8 ? COL.go : COL.nogo
      const w = (bw * this.timeLeft) / ROUND_TIME
      if (w > 0) { this.rr(ctx, W - bw - 40, 34, w, 18, 9); ctx.fill() }
      ctx.fillStyle = COL.ink; ctx.font = 'bold 18px system-ui,sans-serif'; ctx.textAlign = 'right'
      ctx.fillText(Math.ceil(this.timeLeft) + '秒', W - 40, 66)
      ctx.textAlign = 'center'
    } else {
      ctx.fillStyle = 'rgba(15,47,40,0.5)'; ctx.font = 'bold 16px system-ui,sans-serif'
      ctx.fillText('お手本デモ再生中', CX, 40)
    }
  }

  private drawFx(ctx: CanvasRenderingContext2D): void {
    for (const r of this.rings) {
      ctx.globalAlpha = Math.max(0, r.life)
      ctx.strokeStyle = r.col; ctx.lineWidth = 4
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.globalAlpha = 1
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.fillStyle = p.col
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4))
      ctx.font = 'bold 24px system-ui,sans-serif'; ctx.fillStyle = f.col
      ctx.fillText(f.text, f.x, f.y)
    }
    ctx.globalAlpha = 1
  }
}
