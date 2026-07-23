import { useEffect, useRef } from 'react'
import { MiraiGame } from '../game/engine'
import type { Mode, RoundResult } from '../game/types'
import { H, W } from '../game/config'

interface Props {
  mode: Mode
  reducedMotion: boolean
  sound: boolean
  attract: boolean
  guided?: boolean
  onEnd?: (r: RoundResult) => void
  onGuideDone?: () => void
}

// キーボードでパッドを動かす速さ(px/s)。各モードのpadSpeed上限で結局クランプされるので、
// それより十分速い値にしておけば「押しっぱなしでpadSpeedいっぱいまで動く」体験になる。
const KEY_SPEED = 1000

export function GameCanvas({ mode, reducedMotion, sound, attract, guided, onEnd, onGuideDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const onGuideDoneRef = useRef(onGuideDone)
  onGuideDoneRef.current = onGuideDone

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const game = new MiraiGame({
      mode, reducedMotion, sound, attract, guided,
      onEnd: (r) => onEndRef.current?.(r),
      onGuideDone: () => onGuideDoneRef.current?.(),
    })

    const keys = new Set<string>()

    let raf = 0
    let last = 0
    const loop = (ts: number) => {
      if (!last) last = ts
      const dt = Math.min(0.05, (ts - last) / 1000)
      last = ts
      let dir = 0
      if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) dir -= 1
      if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) dir += 1
      if (dir !== 0) game.moveBy(dir * KEY_SPEED * dt)
      game.update(dt)
      game.render(ctx)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    let dragging = false
    const toXY = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) }
    }
    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      dragging = true
      const { x, y } = toXY(e)
      game.pointerDown(x, y)
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const { x, y } = toXY(e)
      game.pointerMove(x, y)
    }
    const onUp = () => { dragging = false }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    // キーボード操作（↑↓ / W・S）。お手本デモ(attract)では無効にして自動再生のじゃまをしない。
    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S'].includes(e.key)) { keys.add(e.key); e.preventDefault() }
    }
    const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.key) }
    if (!attract) {
      canvas.addEventListener('keydown', onKeyDown)
      canvas.addEventListener('keyup', onKeyUp)
    }

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('keyup', onKeyUp)
    }
  }, [mode, reducedMotion, sound, attract, guided])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="game-canvas"
      tabIndex={attract ? -1 : 0}
      aria-label={attract ? 'みらいキャッチのお手本デモ画面' : 'みらいキャッチのゲーム画面。指またはマウスでパッドをドラッグ、または上下キーかW/Sキーで動かしてボールをキャッチします。'}
    />
  )
}
