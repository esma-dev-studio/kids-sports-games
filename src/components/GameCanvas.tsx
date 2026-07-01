import { useEffect, useRef } from 'react'
import { SignalGame } from '../game/engine'
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

    const game = new SignalGame({
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

    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) * (W / rect.width)
      const y = (e.clientY - rect.top) * (H / rect.height)
      game.pointerDown(x, y)
    }
    canvas.addEventListener('pointerdown', onDown)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
    }
    // 設定が変わったらエンジンを作り直す（親のkeyでも再マウントする）
  }, [mode, reducedMotion, sound, attract])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="game-canvas"
      aria-label="まもれ！シグナル・ヒーローのゲーム画面"
    />
  )
}
