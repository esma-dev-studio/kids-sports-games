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
    const top = Math.random() < 0.35
    // 終盤ほど速く（本番のみ）。attractは一定。
    const ramp = this.opts.attract ? 1 : 1 + Math.min(0.35, ((ROUND_TIME - this.timeLeft) / ROUND_TIME) * 0.35)
    const speed = this.rnd(this.diff.speedMin, this.diff.speedMax) * ramp
    // 望ましいキャッチ位置（PAD_X 平面での通過 y）＝必ずパッドが届く範囲。
    const catchY = this.rnd(PAD_MINY + 30, PAD_MAXY - 30)
    let sx: number, sy: number
    if (top) { sx = this.rnd(W * 0.6, W * 0.9); sy = -14 }
    else { sx = W - 14; sy = this.rnd(150, H - 150) }
    // まず PAD_X で catchY を通る直進速度（＝必ずゴール方向へ・必ず届く高さを通る）。
    const dx = PAD_X - sx, dy = catchY - sy
    const d = Math.sqrt(dx * dx + dy * dy) || 1
    const vx = (dx / d) * speed, vy = (dy / d) * speed
    let curve = Math.random() < this.diff.curveProb
    let curveA = (Math.random() < 0.5 ? -1 : 1) * this.rnd(0.5, 1.0)
    if (curve) {
      // 実ゲームと同じ全経路シミュレーションで検証：カーブ後も「必ず届く高さでPAD_X平面を通過」かつ
      // 「途中で画面外へ流れない」こと。収まらなければ直進化（＝確実にキャッチ可能）。
      let ok = false
      for (let i = 0; i < 7; i++) {
        const p = this.simPath(sx, sy, vx, vy, curveA)
        if (p.reached && p.crossY >= PAD_MINY + 28 && p.crossY <= PAD_MAXY - 28 && p.minY >= 4 && p.maxY <= H - 4) { ok = true; break }
        curveA *= 0.55
      }
      if (!ok) { curve = false; curveA = 0 }
    }
    this.ball = {
      x: sx, y: sy, vx, vy, r: 15,
      curve, curveA, curveApplied: false, age: 0,
      ghostT: this.diff.ghostTime, trail: [], color: curve ? COL.curve : COL.go, done: false,
    }
    this.balls++
    this.settled = 0
  }

  private simPath(sx: number, sy: number, vx0: number, vy0: number, curveA: number): { reached: boolean; crossY: number; minY: number; maxY: number } {
    let x = sx, y = sy, vx = vx0, vy = vy0, age = 0, applied = false, minY = sy, maxY = sy
    const dt = 1 / 60
    for (let s = 0; s < 3000; s++) {
      age += dt
      if (!applied && age > 0.34) {
        const sp = Math.sqrt(vx * vx + vy * vy)
        const ang = Math.atan2(vy, vx) + curveA * 0.5
        vx = Math.cos(ang) * sp; vy = Math.sin(ang) * sp; applied = true
      }
      const px = x
      x += vx * dt; y += vy * dt
      if (px > PAD_X && x <= PAD_X) return { reached: true, crossY: y, minY, maxY }
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (y < -30 || y > H + 30) return { reached: false, crossY: y, minY, maxY }
    }
    return { reached: false, crossY: y, minY, maxY }
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
    // お手本デモ(attract)のときだけ、無操作が続いたら自動操作へ戻す。本番プレイでは自動操作しない。
    if (this.opts.attract && !this.auto && this.now - this.lastInput > 3.2) this.auto = true
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
      if (b.y < -40 || b.y > H + 40) { this.balls--; this.ball = null }
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
    const rm = this.opts.reducedMotion
    // 背景：夜のグラデ＋中央のやわらかな光
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#14335d'); g.addColorStop(0.55, '#0c2140'); g.addColorStop(1, '#070f21')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    const glow = ctx.createRadialGradient(W * 0.52, H * 0.5, 40, W * 0.52, H * 0.5, W * 0.6)
    glow.addColorStop(0, 'rgba(80,160,235,0.13)'); glow.addColorStop(1, 'rgba(80,160,235,0)')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
    if (this.feverTime > 0 && !rm) {
      ctx.fillStyle = COL.good; ctx.globalAlpha = 0.06; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1
    }

    // ゴール（ネット表現＋発光ライン）
    const gz = GOAL_X + 30
    const gg = ctx.createLinearGradient(0, 0, gz, 0)
    gg.addColorStop(0, 'rgba(255,86,112,0.22)'); gg.addColorStop(1, 'rgba(255,86,112,0)')
    ctx.fillStyle = gg; ctx.fillRect(0, 0, gz, H)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.beginPath()
    for (let ny = 16; ny < H; ny += 26) { ctx.moveTo(0, ny); ctx.lineTo(gz, ny) }
    for (let nx = 12; nx < gz; nx += 22) { ctx.moveTo(nx, 0); ctx.lineTo(nx, H) }
    ctx.stroke()
    ctx.save()
    if (!rm) { ctx.shadowColor = 'rgba(255,110,140,0.9)'; ctx.shadowBlur = 16 }
    ctx.strokeStyle = 'rgba(255,146,166,0.95)'; ctx.setLineDash([12, 9]); ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(GOAL_X, 34); ctx.lineTo(GOAL_X, H - 34); ctx.stroke(); ctx.setLineDash([])
    ctx.restore()

    // リング
    for (const r of this.rings) {
      const a = 1 - r.t / r.life
      ctx.globalAlpha = a; ctx.strokeStyle = r.col; ctx.lineWidth = 4
      ctx.beginPath(); ctx.arc(r.x, r.y, 16 + r.t * 260, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.globalAlpha = 1

    const b = this.ball
    if (b) {
      // 予測ゴースト（着地点マーカー付き）
      if (b.ghostT > 0) {
        const ga = this.clamp(b.ghostT / this.diff.ghostTime, 0, 1) * 0.8
        const fy = this.futureY()
        ctx.strokeStyle = 'rgba(185,228,255,' + (ga * 0.7) + ')'; ctx.setLineDash([6, 8]); ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(PAD_X, fy); ctx.stroke(); ctx.setLineDash([])
        ctx.fillStyle = 'rgba(185,228,255,' + (ga * 0.2) + ')'
        ctx.beginPath(); ctx.arc(PAD_X, fy, b.r + 5, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = 'rgba(185,228,255,' + (ga * 0.85) + ')'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(PAD_X, fy, b.r + 5, 0, Math.PI * 2); ctx.stroke()
      }
      // トレイル
      for (let t = 0; t < b.trail.length; t++) {
        const tr = b.trail[t], ta = (t / b.trail.length) * 0.45
        ctx.fillStyle = 'rgba(' + (b.curve ? '255,150,80' : '90,200,255') + ',' + ta + ')'
        ctx.beginPath(); ctx.arc(tr.x, tr.y, b.r * (0.35 + (t / b.trail.length) * 0.55), 0, Math.PI * 2); ctx.fill()
      }
      // 本体（放射グラデ＋発光）
      ctx.save()
      if (!rm) { ctx.shadowColor = b.color; ctx.shadowBlur = 18 }
      const rg = ctx.createRadialGradient(b.x - b.r * 0.34, b.y - b.r * 0.4, b.r * 0.2, b.x, b.y, b.r)
      rg.addColorStop(0, b.curve ? '#ffe2c6' : '#dcf3ff')
      rg.addColorStop(0.5, b.color)
      rg.addColorStop(1, b.curve ? '#d75f1e' : '#1a75bd')
      ctx.fillStyle = rg
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.36, b.r * 0.24, 0, Math.PI * 2); ctx.fill()
      // カーブ球：回転する弧で表現（↺テキストは廃止）
      if (b.curve) {
        const dir = b.curveA < 0 ? -1 : 1
        const a0 = (rm ? 0.6 : this.now * 5) * dir
        ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4, a0, a0 + Math.PI * 1.25); ctx.stroke()
        ctx.lineCap = 'butt'
      }
    }

    // パッド（キャッチャー）：グラデ＋発光＋中央コア（色で自動/プレイヤーを区別）
    const px = this.pad.x, py = this.pad.y, pw = this.pad.w, ph = this.pad.h
    const cMain = this.auto ? '#3aa2ff' : '#40f0a4', cDark = this.auto ? '#1e6ed0' : '#1cb579'
    ctx.save()
    if (!rm) { ctx.shadowColor = cMain; ctx.shadowBlur = 16 }
    const pg = ctx.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0)
    pg.addColorStop(0, cDark); pg.addColorStop(0.5, cMain); pg.addColorStop(1, cDark)
    ctx.fillStyle = pg
    this.rr(ctx, px - pw / 2, py - ph / 2, pw, ph, Math.min(12, pw / 2)); ctx.fill()
    ctx.restore()
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    this.rr(ctx, px - pw * 0.16, py - ph / 2 + 6, Math.max(3, pw * 0.2), ph - 12, 3); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.beginPath(); ctx.arc(px, py, Math.min(5, pw * 0.3), 0, Math.PI * 2); ctx.fill()

    // パーティクル
    for (const p of this.parts) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill() }
    ctx.globalAlpha = 1
    // フローター
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (const f of this.floats) { ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4)); ctx.fillStyle = f.col; ctx.font = '800 23px "M PLUS Rounded 1c", system-ui, sans-serif'; ctx.fillText(f.text, f.x, f.y) }
    ctx.globalAlpha = 1

    this.drawHUD(ctx)
    if (this.flash > 0 && !rm) { ctx.fillStyle = this.flashCol; ctx.globalAlpha = this.flash * 0.26; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
  }

  private rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
  }

  private drawHUD(ctx: CanvasRenderingContext2D): void {
    const F = '"M PLUS Rounded 1c", system-ui, sans-serif'
    const rm = this.opts.reducedMotion
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    // スコアカード
    ctx.save()
    if (!rm) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 7 }
    const cg = ctx.createLinearGradient(0, 20, 0, 116)
    cg.addColorStop(0, 'rgba(20,44,80,0.92)'); cg.addColorStop(1, 'rgba(9,22,44,0.92)')
    ctx.fillStyle = cg; this.rr(ctx, 24, 20, 236, 96, 16); ctx.fill()
    ctx.restore()
    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 1; this.rr(ctx, 24, 20, 236, 96, 16); ctx.stroke()
    ctx.fillStyle = 'rgba(180,212,246,0.72)'; ctx.font = '700 12px ' + F; ctx.fillText('SCORE', 44, 47)
    ctx.fillStyle = '#fff'; ctx.font = '800 36px ' + F; ctx.fillText(String(Math.round(this.dispScore)), 44, 89)
    if (this.combo >= 2) { ctx.fillStyle = COL.gold; ctx.font = '800 16px ' + F; ctx.fillText('🔥' + this.combo, 168, 89) }
    if (this.feverTime > 0) { ctx.fillStyle = COL.gold; ctx.font = '800 13px ' + F; ctx.fillText('×2 チャンス！', 44, 109) }

    if (!this.opts.attract) {
      ctx.textAlign = 'right'
      if (this.diff.lives > 0) {
        for (let i = 0; i < this.diff.lives; i++) {
          const on = i < this.lives
          ctx.save()
          if (on && !rm) { ctx.shadowColor = COL.miss; ctx.shadowBlur = 10 }
          ctx.fillStyle = on ? COL.miss : 'rgba(255,255,255,0.18)'
          ctx.beginPath(); ctx.arc(W - 42 - i * 30, 42, 10, 0, Math.PI * 2); ctx.fill()
          ctx.restore()
        }
      } else {
        ctx.fillStyle = 'rgba(150,255,200,0.9)'; ctx.font = '700 14px ' + F; ctx.fillText('やさしい：ミスしても だいじょうぶ', W - 30, 46)
      }
      // 残り時間バー
      const bw = 300, bx = W - bw - 40, by = 62
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; this.rr(ctx, bx, by, bw, 12, 6); ctx.fill()
      const w = (bw * this.timeLeft) / ROUND_TIME
      if (w > 0) {
        const tg = ctx.createLinearGradient(bx, 0, bx + bw, 0)
        if (this.timeLeft > 8) { tg.addColorStop(0, '#2f8fe0'); tg.addColorStop(1, '#6ee0ff') }
        else { tg.addColorStop(0, '#ff5470'); tg.addColorStop(1, '#ff9a6a') }
        ctx.fillStyle = tg; this.rr(ctx, bx, by, w, 12, 6); ctx.fill()
      }
      ctx.textAlign = 'left'
    } else {
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(150,225,255,0.9)'; ctx.font = '800 15px ' + F
      ctx.fillText('🤖 じどうデモ さいせい中', W - 30, 46)
      ctx.textAlign = 'left'
    }
  }
}
