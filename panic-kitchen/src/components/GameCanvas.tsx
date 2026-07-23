import { useEffect, useRef } from 'react'
import { KitchenGame } from '../game/engine'
import type { Mode, RoundResult } from '../game/types'
import { H, W } from '../game/config'

interface Props {
  mode: Mode
  reducedMotion: boolean
  sound: boolean
  attract: boolean
  onEnd?: (r: RoundResult) => void
}

export function GameCanvas({ mode, reducedMotion, sound, attract, onEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const game = new KitchenGame({
      mode,
      reducedMotion,
      sound,
      attract,
      onEnd: (r) => onEndRef.current?.(r),
    })

    let raf = 0
    let last = 0
    const loop = (ts: number) => {
      if (!last) last = ts
      const dt = Math.min(0.05, (ts - last) / 1000)
      last = ts
      game.update(dt)
      game.render(ctx)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const toXY = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: (e.clientX - rect.left) * (W / rect.width),
        y: (e.clientY - rect.top) * (H / rect.height),
      }
    }
    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      const { x, y } = toXY(e)
      game.pointerDown(x, y)
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      const { x, y } = toXY(e)
      game.pointerMove(x, y)
    }
    const onUp = () => game.pointerUp()
    // キーボード操作：数字キー(1〜)で、その順位のお皿（左→右）へ食材を自動で送る
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= 9) {
        e.preventDefault()
        game.sendByKey(n - 1)
      }
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('keydown', onKey)
    }
  }, [mode, reducedMotion, sound, attract])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="game-canvas"
      aria-label="パニックキッチンのゲーム画面"
      tabIndex={attract ? -1 : 0}
    />
  )
}
