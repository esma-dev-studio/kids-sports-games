import type { EngineOpts, NodeType, Phase, RoundResult } from './types'
import {
  DDA_BAND_MAX, DDA_BAND_MIN, DDA_EMA_ALPHA, DDA_REF_REACTION, DDA_REF_RESIST,
  DIFF, H, LIVES, ROUND_TIME, RUSH_GAP_MUL, RUSH_SCORE_MUL, RUSH_WINDOWS,
  SHUFFLE_AT, SHUFFLE_ROTATE_SPEED, W, type Diff,
} from './config'
import { playFanfare, playGaman, playMiss, playPop } from './audio'
import { load, recordRound, save } from './storage'

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

// 描画専用の配色（夜の交差点/信号盤テーマ）。ロジックには一切関与しない。
const VCOL = {
  bgTop: '#0d2420', bgMid: '#0a1c1a', bgBottom: '#061210',
  glow: 'rgba(60,150,130,0.14)',
  panelTop: 'rgba(18,44,40,0.92)', panelBottom: 'rgba(8,20,18,0.92)',
  panelBorder: 'rgba(255,255,255,0.12)',
  idleCore: '#3a4d47', idleRim: '#26362f',
  goCoreLight: '#c8f7e6', goCoreDark: '#0f6b57',
  nogoCoreLight: '#ffd9d4', nogoCoreDark: '#8f281f',
  textSoft: 'rgba(210,232,225,0.75)', textStrong: '#f2fbf7',
}
const F = '"M PLUS Rounded 1c", system-ui, sans-serif'

const CX = W * 0.5
const CY = H * 0.5 + 6
const RING = 210
const NODE_R = 40

export class SignalGame {
  private opts: EngineOpts
  private diff: Diff = DIFF.easy
  private nodes: Node[] = []
  private baseAngle: number[] = []

  private active = -1
  private type: NodeType = 'go' // 「本命」ノード（フェイント時も含め、当てるべきGOの種別）
  private ntype: NodeType[] = [] // 現在ひかっている各ノードの種別（フェイント時は複数）
  private lit: number[] = [] // 現在ひかっているノードのindex一覧（通常は1つ、フェイント時は全部）
  private isFeint = false
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
  private feverTime = 0
  private discernTime = 0 // 見きわめタイム（がまん5連鎖ごとに発火。がまん得点2倍）

  // チャンスラッシュ／配置シャッフル（中盤の山場）
  private rushActive = false
  private shuffled = false
  private ringRot = 0
  private ringRotTarget = 0

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

  // 命中の瞬間の一撃パンチ演出（対象ノードだけ一瞬拡大）
  private hitPunch = 0
  private punchIdx = -1

  private bestScoreOpt = 0
  private bestAnnounced = false

  // チュートリアルの体験ステップ（guided時のみ）：0=GOを叩く練習, 1=がまんする練習, 2=両方できた
  private guidedStep: 0 | 1 | 2 = 0

  private now = 0
  private ended = false
  private endPending = false

  // お手本ゴースト（attract時のみ）
  private ghost = { x: CX, y: CY, tx: CX, ty: CY, show: 0, press: 0 }
  private ghostDelay = 999

  constructor(opts: EngineOpts) {
    this.opts = opts
    const base = DIFF[opts.mode]
    this.diff = base
    if (opts.guided) {
      this.diff = DIFF.easy
    } else if (!opts.attract) {
      const saved = load()
      this.diff = this.applyDda(base, saved.recentAvgReaction, saved.recentResistRate)
      this.bestScoreOpt = opts.bestScore ?? saved.best.score ?? 0
    }
    this.gap = opts.guided ? 0.7 : this.diff.gap
    for (let i = 0; i < this.diff.nodeCount; i++) {
      const a = -Math.PI / 2 + i * ((Math.PI * 2) / this.diff.nodeCount)
      this.baseAngle.push(a)
      this.nodes.push({ x: CX + Math.cos(a) * RING, y: CY + Math.sin(a) * RING })
    }
    this.pickNext()
  }

  /** 直近成績（反応の速さ・見きわめ成功率）から開始難度を±15%の帯だけ静かに補正する */
  private applyDda(base: Diff, recentAvgReaction: number, recentResistRate: number): Diff {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const reactionFactor = clamp(recentAvgReaction / DDA_REF_REACTION, DDA_BAND_MIN, DDA_BAND_MAX)
    const resistFactor = clamp(recentResistRate / DDA_REF_RESIST, DDA_BAND_MIN, DDA_BAND_MAX)
    // skill: 小さいほど得意（反応が速く、見きわめもできている）。1.0が標準
    const skill = clamp((reactionFactor + (2 - resistFactor)) / 2, DDA_BAND_MIN, DDA_BAND_MAX)
    return {
      ...base,
      litMin: base.litMin * skill,
      litMax: base.litMax * skill,
      goProb: clamp(base.goProb + (skill - 1) * 0.6, base.goProbFloor, 0.85),
    }
  }

  private goProb(): number {
    return Math.max(this.diff.goProbFloor, this.diff.goProb - this.combo * 0.01)
  }

  private pickNext(): void {
    let idx = 0
    do { idx = (Math.random() * this.nodes.length) | 0 } while (idx === this.active && this.nodes.length > 1)
    this.active = idx

    if (this.opts.guided) {
      // チュートリアルの体験ステップ：長めの猶予でGO→がまんの順に1回ずつ練習させる
      this.type = this.guidedStep === 0 ? 'go' : 'nogo'
      this.litDur = 1.7
      this.isFeint = false
      this.ntype = new Array(this.nodes.length).fill('nogo') as NodeType[]
      this.ntype[idx] = this.type
      this.lit = [idx]
      this.t = 0
      this.phase = 'lit'
      this.judged = false
      if (this.type === 'go') this.goShown++
      else this.nogoShown++
      return
    }

    this.type = this.rushActive || Math.random() < this.goProb() ? 'go' : 'nogo'
    const base = this.diff.litMin + Math.random() * (this.diff.litMax - this.diff.litMin)
    this.litDur = Math.max(this.diff.litFloor, base - this.combo * 0.015)

    // フェイント（一斉点滅）：真のGOは1つだけ、残りは全部ニセ光。ラッシュ中や攻略デモでは出さない
    this.isFeint = !this.opts.attract && !this.rushActive && this.diff.feintProb > 0 && Math.random() < this.diff.feintProb
    this.ntype = new Array(this.nodes.length).fill('nogo') as NodeType[]
    if (this.isFeint) {
      this.type = 'go'
      this.ntype[idx] = 'go'
      this.lit = this.nodes.map((_, i) => i)
      this.litDur += 0.3
    } else {
      this.ntype[idx] = this.type
      this.lit = [idx]
    }

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

  /** 触覚フィードバック。reducedMotion時・haptics=false時・攻略デモ中は鳴らさない */
  private vibrate(pattern: number | number[]): void {
    if (this.opts.attract || this.opts.reducedMotion || this.opts.haptics === false) return
    try { navigator.vibrate?.(pattern) } catch { /* 非対応環境では無視 */ }
  }

  /** 自己ベストを超えた瞬間に一度だけ祝う */
  private checkBest(): void {
    if (this.opts.attract || this.bestScoreOpt <= 0 || this.bestAnnounced) return
    if (this.score >= this.bestScoreOpt) {
      this.bestAnnounced = true
      this.floater(CX, CY - 96, 'ベストこえた！', COL.gold)
      if (this.opts.sound) playFanfare()
    }
  }

  private judge(idx: number): void {
    if (this.phase !== 'lit' || this.judged || !this.lit.includes(idx)) return
    const n = this.nodes[idx]
    const type = this.ntype[idx]
    if (type === 'go') {
      this.judged = true
      const feverMul = this.feverTime > 0 || this.rushActive ? RUSH_SCORE_MUL : 1
      const feintBonus = this.isFeint ? 12 : 0
      const gain = (10 + this.combo * 2 + feintBonus) * feverMul
      this.score += gain
      this.combo++
      if (this.combo > this.maxCombo) this.maxCombo = this.combo
      this.goHit++
      this.reactionTimes.push(this.t * 1000)
      this.flash = 1; this.flashCol = COL.goGlow
      this.burst(n.x, n.y, COL.spark, 14)
      this.burst(n.x, n.y, COL.gold, 6)
      this.ring(n.x, n.y, COL.go)
      this.hitPunch = 1; this.punchIdx = idx
      this.vibrate(15)
      this.floater(n.x, n.y - NODE_R, (this.isFeint ? 'みつけた！+' : '+') + gain, this.isFeint ? COL.gold : COL.go)
      if (this.combo >= 2) this.floater(CX, CY + 58, this.combo + ' COMBO', COL.gold)
      if (this.combo > 0 && this.combo % 10 === 0) {
        this.feverTime = 3
        this.floater(CX, CY - 96, 'チャンス！ ×2', COL.gold)
      }
      if (this.opts.sound) playPop(this.combo)
      this.checkBest()
      if (this.opts.guided && this.guidedStep === 0) this.guidedStep = 1
      this.phase = 'clear'; this.t = 0
    } else {
      this.judged = true
      this.combo = 0
      if (!this.opts.guided) this.lives-- // 体験ステップはミスしても減点しない
      this.nogoTapped++
      this.flash = 1; this.flashCol = COL.nogoGlow
      this.burst(n.x, n.y, COL.nogo, 10)
      this.floater(n.x, n.y - NODE_R, 'ミス！', COL.nogo)
      this.vibrate([40, 30, 40])
      if (this.opts.sound) playMiss()
      this.phase = 'clear'; this.t = 0
      if (this.lives <= 0 && !this.opts.attract && !this.opts.guided) this.endPending = true
    }
  }

  private expire(): void {
    const n = this.nodes[this.active]
    if (this.type === 'go' && !this.judged) {
      this.combo = 0 // 見逃し：コンボリセット（ライフは減らさない）
    } else if (this.type === 'nogo' && !this.judged) {
      // ニセ光を我慢できた＝見きわめ成功。我慢が得点になる中核。GOに引けを取らない即時＆同格の報酬にする。
      this.gaman++
      this.nogoResisted++
      if (this.gaman > this.maxGaman) this.maxGaman = this.gaman
      const discernMul = this.discernTime > 0 ? 2 : 1
      const gain = (8 + this.gaman * 2) * discernMul
      this.score += gain
      this.ring(n.x, n.y, COL.nogo)
      this.floater(n.x, n.y - NODE_R, '見きわめ！+' + gain, COL.nogoEdge)
      this.vibrate(10)
      if (this.gaman % 5 === 0) {
        this.discernTime = 3
        this.floater(CX, CY - 96, 'みきわめタイム！ ×2', COL.nogoEdge)
        if (this.opts.sound) playGaman(true)
      } else {
        if (this.gaman % 3 === 0) this.floater(CX, CY + 58, 'がまん連鎖 x' + this.gaman, COL.nogoEdge)
        if (this.opts.sound) playGaman(false)
      }
      this.checkBest()
      if (this.opts.guided && this.guidedStep === 1) {
        this.guidedStep = 2
        this.opts.onGuidedDone?.()
      }
    }
    this.phase = 'gap'; this.t = 0
  }

  private finish(): void {
    if (this.ended) return
    this.ended = true
    const hitRate = this.goShown ? this.goHit / this.goShown : 0
    const hasReaction = this.reactionTimes.length > 0
    const avg = hasReaction
      ? this.reactionTimes.reduce((s, v) => s + v, 0) / this.reactionTimes.length
      : 9999
    const resistRate = this.nogoShown ? this.nogoResisted / this.nogoShown : 1

    let reactionStars = 1
    if (hitRate >= 0.8 && avg <= 560) reactionStars = 3
    else if (hitRate >= 0.6 && avg <= 780) reactionStars = 2

    let discernStars = 1
    if (resistRate >= 0.85) discernStars = 3
    else if (resistRate >= 0.6) discernStars = 2

    let data = load()
    const isBestScore = this.score > data.best.score
    data.best = {
      score: Math.max(data.best.score, this.score),
      combo: Math.max(data.best.combo, this.maxCombo),
      gaman: Math.max(data.best.gaman, this.maxGaman),
    }
    if (!this.opts.attract) {
      data = recordRound(data, avg, resistRate, hasReaction, DDA_EMA_ALPHA)
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
    if (this.ended || this.phase !== 'lit') return
    let bestIdx = -1
    let bestD = Infinity
    const rad = (NODE_R + 14) * (NODE_R + 14)
    for (const idx of this.lit) {
      const n = this.nodes[idx]
      const dx = mx - n.x, dy = my - n.y
      const d = dx * dx + dy * dy
      if (d <= rad && d < bestD) { bestD = d; bestIdx = idx }
    }
    if (bestIdx >= 0) this.judge(bestIdx)
  }

  /** キーボード操作：Space/Enterで「本命」ノードを叩く */
  hitActive(): void {
    if (this.phase === 'lit' && this.active >= 0) this.judge(this.active)
  }

  /** キーボード操作：数字キーで任意のノードindexを叩く（フェイント時の選択にも使える） */
  hitNode(index: number): void {
    if (this.phase === 'lit' && index >= 0 && index < this.nodes.length) this.judge(index)
  }

  update(dt: number): void {
    if (this.ended) return
    this.now += dt

    if (!this.opts.attract && !this.opts.guided) {
      this.timeLeft -= dt
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.finish(); return }

      const elapsed = ROUND_TIME - this.timeLeft
      const wasRush = this.rushActive
      this.rushActive = RUSH_WINDOWS.some(([s, e]) => elapsed >= s && elapsed < e)
      if (this.rushActive && !wasRush) this.floater(CX, CY - 110, 'ラッシュ！', COL.gold)

      if (!this.shuffled && elapsed >= SHUFFLE_AT) {
        this.shuffled = true
        this.ringRotTarget += Math.PI * 0.4 + Math.random() * Math.PI * 0.5
        if (this.opts.reducedMotion) this.ringRot = this.ringRotTarget
        this.floater(CX, CY - 110, 'ならびかえ！', COL.spark)
      }
      if (!this.opts.reducedMotion) {
        this.ringRot += (this.ringRotTarget - this.ringRot) * Math.min(1, dt * SHUFFLE_ROTATE_SPEED)
      }
      for (let i = 0; i < this.nodes.length; i++) {
        const a = this.baseAngle[i] + this.ringRot
        this.nodes[i].x = CX + Math.cos(a) * RING
        this.nodes[i].y = CY + Math.sin(a) * RING
      }
    }

    if (this.phase === 'lit') {
      this.t += dt
      if (this.opts.attract) this.updateGhost(dt)
      // 見きわめ（がまん）の解決を litDur満了より前倒しし、決断の手応えを即時化する
      if (!this.isFeint && this.type === 'nogo' && !this.judged && this.t >= this.litDur * 0.8) {
        this.expire()
      } else if (this.t >= this.litDur) {
        this.expire()
      }
    } else if (this.phase === 'clear') {
      this.t += dt
      if (this.t >= 0.28) {
        if (this.endPending) { this.finish(); return }
        this.phase = 'gap'; this.t = 0
      }
    } else {
      this.t += dt
      this.ghost.show = Math.max(0, this.ghost.show - dt * 3)
      const gapDur = this.rushActive ? this.gap * RUSH_GAP_MUL : this.gap
      if (this.t >= gapDur) this.pickNext()
    }

    this.ghost.x += (this.ghost.tx - this.ghost.x) * Math.min(1, dt * 9)
    this.ghost.y += (this.ghost.ty - this.ghost.y) * Math.min(1, dt * 9)
    this.ghost.press = Math.max(0, this.ghost.press - dt * 4)

    this.flash = Math.max(0, this.flash - dt * 3)
    this.feverTime = Math.max(0, this.feverTime - dt)
    this.discernTime = Math.max(0, this.discernTime - dt)
    this.hitPunch = Math.max(0, this.hitPunch - dt * 5)
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
    if ((this.feverTime > 0 || this.rushActive) && !this.opts.reducedMotion) {
      ctx.fillStyle = COL.gold
      ctx.globalAlpha = 0.07
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
    }
    const litNow = this.phase === 'lit'
    for (let i = 0; i < this.nodes.length; i++) {
      if (litNow && this.lit.includes(i)) continue
      const punch = i === this.punchIdx ? this.hitPunch : 0
      this.drawNode(ctx, this.nodes[i], false, 'go', punch)
    }
    if (litNow) {
      for (const i of this.lit) this.drawNode(ctx, this.nodes[i], true, this.ntype[i], 0)
    }
    this.drawFx(ctx)
    this.drawHUD(ctx)
    if (this.opts.guided) this.drawGuideHint(ctx)
    if (this.opts.attract) this.drawGhost(ctx)
    if (this.flash > 0 && !this.opts.reducedMotion) {
      ctx.fillStyle = this.flashCol
      ctx.globalAlpha = this.flash * 0.45
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
    // 夜の交差点/信号盤：深みのある縦グラデ＋中央のやわらかな放射光
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, VCOL.bgTop); bg.addColorStop(0.55, VCOL.bgMid); bg.addColorStop(1, VCOL.bgBottom)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    const glow = ctx.createRadialGradient(CX, CY, 20, CX, CY, RING + NODE_R + 140)
    glow.addColorStop(0, VCOL.glow)
    glow.addColorStop(1, 'rgba(60,150,130,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = 'rgba(180,220,205,0.16)'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(CX, CY, RING + NODE_R + 22, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = 'rgba(180,220,205,0.12)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(CX, CY, RING, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = 'rgba(180,220,205,0.14)'
    ctx.setLineDash([6, 10])
    ctx.beginPath(); ctx.arc(CX, CY, RING - NODE_R - 14, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])
  }

  private drawNode(ctx: CanvasRenderingContext2D, n: Node, isLit: boolean, type: NodeType, punch: number): void {
    const rm = this.opts.reducedMotion
    if (!isLit) {
      // 非アクティブ：控えめな放射グラデで沈んだ質感（発光なし）。命中直後だけ一瞬パンチで拡大する
      const scale = 1 + punch * 0.12
      const r = NODE_R * scale
      const ig = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.35, r * 0.1, n.x, n.y, r)
      ig.addColorStop(0, VCOL.idleCore)
      ig.addColorStop(1, VCOL.idleRim)
      ctx.fillStyle = ig
      ctx.strokeStyle = punch > 0.05 ? 'rgba(244,183,64,0.55)' : 'rgba(180,220,205,0.18)'
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.fillStyle = 'rgba(180,220,205,0.14)'
      ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.32, 0, Math.PI * 2); ctx.fill()
      return
    }
    const prog = this.t / this.litDur
    const pulse = 1 + Math.sin(this.now * 10) * 0.04
    const halo = rm ? 1.3 : 1.5 + 0.15 * Math.sin(this.now * 8)
    const isGo = type === 'go'
    const glowCol = isGo ? COL.goGlow : COL.nogoGlow
    const edgeCol = isGo ? COL.goEdge : COL.nogoEdge
    const coreLight = isGo ? VCOL.goCoreLight : VCOL.nogoCoreLight
    const coreDark = isGo ? VCOL.goCoreDark : VCOL.nogoCoreDark

    // ハロー（アクティブ対象のみ・軽量な単色グラデ、shadowBlurは使わない）
    ctx.fillStyle = glowCol
    ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R * halo, 0, Math.PI * 2); ctx.fill()

    // 本体：放射グラデで立体感
    const bodyR = NODE_R * pulse
    const rg = ctx.createRadialGradient(n.x - bodyR * 0.32, n.y - bodyR * 0.38, bodyR * 0.15, n.x, n.y, bodyR)
    rg.addColorStop(0, coreLight)
    rg.addColorStop(0.55, isGo ? COL.go : COL.nogo)
    rg.addColorStop(1, coreDark)
    ctx.save()
    if (!rm) { ctx.shadowColor = edgeCol; ctx.shadowBlur = 14 }
    ctx.fillStyle = rg
    ctx.strokeStyle = edgeCol; ctx.lineWidth = 4
    ctx.beginPath(); ctx.arc(n.x, n.y, bodyR, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.restore()

    // 小さな白ハイライト（安っぽい絵文字の代わり）
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath(); ctx.arc(n.x - bodyR * 0.32, n.y - bodyR * 0.36, bodyR * 0.2, 0, Math.PI * 2); ctx.fill()

    // 形での二重符号化：GO=丸のリング、NOGO=×
    if (isGo) {
      ctx.strokeStyle = COL.white; ctx.lineWidth = 6; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R * 0.5, 0, Math.PI * 2); ctx.stroke()
    } else {
      ctx.strokeStyle = COL.white; ctx.lineWidth = 7; ctx.lineCap = 'round'
      const d = NODE_R * 0.42
      ctx.beginPath()
      ctx.moveTo(n.x - d, n.y - d); ctx.lineTo(n.x + d, n.y + d)
      ctx.moveTo(n.x + d, n.y - d); ctx.lineTo(n.x - d, n.y + d)
      ctx.stroke()
    }
    ctx.lineCap = 'butt'
    ctx.strokeStyle = edgeCol
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(n.x, n.y, NODE_R + 9, -Math.PI / 2, -Math.PI / 2 + (1 - prog) * Math.PI * 2)
    ctx.stroke()
  }

  /** チュートリアルの体験ステップ：本命ノードの近くに「タッチ！」「まって！」を大きく出す */
  private drawGuideHint(ctx: CanvasRenderingContext2D): void {
    if (this.phase !== 'lit' || this.active < 0) return
    const n = this.nodes[this.active]
    const isGoStep = this.guidedStep === 0
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '800 26px ' + F
    ctx.fillStyle = isGoStep ? COL.go : COL.nogo
    ctx.fillText(isGoStep ? 'タッチ！' : 'まって！', n.x, n.y + NODE_R + 44)
  }

  private drawGhost(ctx: CanvasRenderingContext2D): void {
    if (this.ghost.show <= 0.02) return
    ctx.globalAlpha = this.ghost.show * 0.9
    const pr = 1 - this.ghost.press * 0.25
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.beginPath(); ctx.arc(this.ghost.x, this.ghost.y + 2, 20 * pr, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = COL.white; ctx.strokeStyle = COL.goEdge; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(this.ghost.x, this.ghost.y, 15 * pr, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = COL.goEdge
    ctx.beginPath(); ctx.arc(this.ghost.x, this.ghost.y, 6 * pr, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  }

  private drawHUD(ctx: CanvasRenderingContext2D): void {
    const rm = this.opts.reducedMotion
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'

    // 中央スコアカード：グラデ地＋半透明ボーダー
    const cw = 236, ch = 140, cx0 = CX - cw / 2, cy0 = CY - 70
    ctx.save()
    if (!rm) { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6 }
    const cardG = ctx.createLinearGradient(0, cy0, 0, cy0 + ch)
    cardG.addColorStop(0, VCOL.panelTop); cardG.addColorStop(1, VCOL.panelBottom)
    ctx.fillStyle = cardG
    this.rr(ctx, cx0, cy0, cw, ch, 18); ctx.fill()
    ctx.restore()
    ctx.strokeStyle = VCOL.panelBorder; ctx.lineWidth = 1.5
    this.rr(ctx, cx0, cy0, cw, ch, 18); ctx.stroke()

    ctx.fillStyle = VCOL.textSoft; ctx.font = '700 18px ' + F
    ctx.fillText('SCORE', CX, CY - 46)
    ctx.font = '800 44px ' + F; ctx.fillStyle = VCOL.textStrong
    ctx.fillText(String(Math.round(this.dispScore)), CX, CY - 8)
    if (this.feverTime > 0) {
      ctx.font = '800 15px ' + F; ctx.fillStyle = COL.gold
      ctx.fillText('×2', CX + 84, CY - 46)
    }

    ctx.font = '700 15px ' + F; ctx.fillStyle = VCOL.textSoft
    ctx.fillText('COMBO', CX - 58, CY + 38)
    ctx.fillText('がまん', CX + 58, CY + 38)
    ctx.font = '800 25px ' + F
    ctx.fillStyle = this.combo > 0 ? COL.gold : 'rgba(210,232,225,0.35)'
    ctx.fillText('x' + this.combo, CX - 58, CY + 60)
    ctx.fillStyle = this.gaman > 0 ? '#ff9c90' : 'rgba(210,232,225,0.35)'
    ctx.fillText('x' + this.gaman, CX + 58, CY + 60)
    if (this.discernTime > 0) {
      ctx.font = '800 13px ' + F; ctx.fillStyle = '#ff9c90'
      ctx.fillText('×2', CX + 92, CY + 30)
    }

    if (!this.opts.attract && !this.opts.guided) {
      if (this.bestScoreOpt > 0) {
        const remain = this.bestScoreOpt - Math.round(this.dispScore)
        ctx.font = '700 15px ' + F; ctx.fillStyle = VCOL.textSoft
        ctx.fillText(remain > 0 ? `ベストまで あと${remain}` : 'ベストこえた！', CX, 40)
      }
      // ライフ：色＋形（○の充填/未充填）で区別
      ctx.textAlign = 'left'
      for (let i = 0; i < LIVES; i++) {
        const on = i < this.lives
        ctx.save()
        if (on && !rm) { ctx.shadowColor = COL.nogo; ctx.shadowBlur = 8 }
        ctx.fillStyle = on ? COL.nogo : 'rgba(210,232,225,0.16)'
        ctx.beginPath(); ctx.arc(44 + i * 34, 44, 13, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
        ctx.strokeStyle = on ? COL.nogoEdge : 'rgba(210,232,225,0.22)'
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(44 + i * 34, 44, 13, 0, Math.PI * 2); ctx.stroke()
      }
      // 残り時間バー：グラデ地
      const bw = 300, bx = W - bw - 40, by = 34
      ctx.fillStyle = 'rgba(210,232,225,0.14)'
      this.rr(ctx, bx, by, bw, 18, 9); ctx.fill()
      const w = (bw * this.timeLeft) / ROUND_TIME
      if (w > 0) {
        const tg = ctx.createLinearGradient(bx, 0, bx + bw, 0)
        if (this.timeLeft > 8) { tg.addColorStop(0, COL.goEdge); tg.addColorStop(1, COL.go) }
        else { tg.addColorStop(0, COL.nogoEdge); tg.addColorStop(1, COL.nogo) }
        ctx.fillStyle = tg
        this.rr(ctx, bx, by, w, 18, 9); ctx.fill()
      }
      ctx.fillStyle = VCOL.textStrong; ctx.font = '700 18px ' + F; ctx.textAlign = 'right'
      ctx.fillText(Math.ceil(this.timeLeft) + '秒', W - 40, 66)
      if (this.rushActive) {
        ctx.font = '800 15px ' + F; ctx.fillStyle = COL.gold
        ctx.fillText('ラッシュ！', W - 40, 92)
      }
      ctx.textAlign = 'center'
    } else if (this.opts.guided) {
      ctx.fillStyle = VCOL.textSoft; ctx.font = '800 16px ' + F
      ctx.fillText('れんしゅう', CX, 40)
    } else {
      ctx.fillStyle = VCOL.textSoft; ctx.font = '800 16px ' + F
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
      ctx.font = '800 24px ' + F; ctx.fillStyle = f.col
      ctx.fillText(f.text, f.x, f.y)
    }
    ctx.globalAlpha = 1
  }
}
