import { useEffect, useRef } from 'react'
import { SignalGame } from '../game/engine'
import type { Mode, RoundResult } from '../game/types'
import { H, W } from '../game/config'

interface Props {
  mode: Mode
  reducedMotion: boolean
  sound: boolean
  attract: boolean
  haptics?: boolean
  bestScore?: number
  guided?: boolean
  onEnd?: (r: RoundResult) => void
  onGuidedDone?: () => void
}

export function GameCanvas({ mode, reducedMotion, sound, attract, haptics, bestScore, guided, onEnd, onGuidedDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const onGuidedDoneRef = useRef(onGuidedDone)
  onGuidedDoneRef.current = onGuidedDone

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
      haptics,
      bestScore,
      guided,
      onEnd: (r) => onEndRef.current?.(r),
      onGuidedDone: () => onGuidedDoneRef.current?.(),
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

    // キーボード操作：Space/Enterで本命ノード、数字キー1〜9で任意ノードを狙える
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        game.hitActive()
        return
      }
      const m = /^Digit([1-9])$/.exec(e.code)
      if (m) {
        e.preventDefault()
        game.hitNode(Number(m[1]) - 1)
      }
    }
    canvas.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('keydown', onKey)
    }
    // 設定が変わったらエンジンを作り直す（親のkeyでも再マウントする）
  }, [mode, reducedMotion, sound, attract, haptics, bestScore, guided])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="game-canvas"
      tabIndex={attract ? -1 : 0}
      aria-label="まもれ！シグナル・ヒーローのゲーム画面。スペースキーまたはタップで反応できます"
    />
  )
}
