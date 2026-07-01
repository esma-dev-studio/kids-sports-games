import { useCallback, useState } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { MODE_LABEL } from './game/config'
import type { Mode, RoundResult } from './game/types'
import { unlock } from './game/audio'
import { load, save, type SaveData } from './game/storage'

type Screen = 'menu' | 'tutorial' | 'playing' | 'result'
const MODES: Mode[] = ['easy', 'normal']

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`星${n}つ`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? 'star on' : 'star'}>★</span>
      ))}
    </span>
  )
}

export default function App() {
  const [data, setData] = useState<SaveData>(() => load())
  const [screen, setScreen] = useState<Screen>('menu')
  const [result, setResult] = useState<RoundResult | null>(null)
  const [playKey, setPlayKey] = useState(0)

  const persist = useCallback((patch: Partial<SaveData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch }
      save(next)
      return next
    })
  }, [])

  const beginPlay = useCallback(() => {
    unlock()
    setPlayKey((k) => k + 1)
    setScreen('playing')
  }, [])

  const onStart = useCallback(() => {
    unlock()
    if (data.tutorialSeen) beginPlay()
    else setScreen('tutorial')
  }, [data.tutorialSeen, beginPlay])

  const onTutorialDone = useCallback(() => {
    persist({ tutorialSeen: true })
    beginPlay()
  }, [persist, beginPlay])

  const onEnd = useCallback((r: RoundResult) => {
    setResult(r)
    setData(load())
    setScreen('result')
  }, [])

  const showBackdrop = screen === 'menu' || screen === 'tutorial' || screen === 'result'
  const best = data.best

  return (
    <div className="app">
      <header className="app-head">
        <h1>パニックキッチン</h1>
        <p className="tagline">飛んでくる食材を、色の合うお皿へ！<b>まぜまぜ大混雑</b>。</p>
      </header>

      <div className="stage">
        {showBackdrop && (
          <GameCanvas key="backdrop" mode={data.mode} reducedMotion={data.reducedMotion} sound={false} attract />
        )}
        {screen === 'playing' && (
          <GameCanvas
            key={`play-${playKey}`}
            mode={data.mode}
            reducedMotion={data.reducedMotion}
            sound={data.sound}
            attract={false}
            onEnd={onEnd}
          />
        )}

        {screen === 'menu' && (
          <div className="overlay">
            <div className="panel">
              <p className="panel-sub big">食材をドラッグして、色とアイコンの合うお皿へ。お皿がいっぱいになると「できあがり！」でボーナス。</p>
              <div className="mode-row" role="group" aria-label="むずかしさ">
                {MODES.map((m) => (
                  <button key={m} className={`mode ${data.mode === m ? 'sel' : ''}`} onClick={() => persist({ mode: m })}>
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
              <button className="cta" onClick={onStart}>はじめる</button>
              <div className="best">
                自己ベスト｜スコア <b>{best.score}</b>　できあがり <b>{best.plates}</b>　コンボ <b>{best.combo}</b>
              </div>
              <div className="toggles">
                <label>
                  <input type="checkbox" checked={data.sound} onChange={(e) => persist({ sound: e.target.checked })} />
                  音
                </label>
                <label>
                  <input type="checkbox" checked={data.reducedMotion} onChange={(e) => persist({ reducedMotion: e.target.checked })} />
                  演出をひかえめに
                </label>
              </div>
            </div>
          </div>
        )}

        {screen === 'tutorial' && (
          <div className="overlay">
            <div className="panel">
              <h2 className="panel-title">あそびかた</h2>
              <ol className="how">
                <li>いろんな方向から食材が飛んでくるよ。</li>
                <li>食材をドラッグして、色とアイコンが合うお皿へ。</li>
                <li>お皿がいっぱいで「できあがり！」ボーナス。まちがい・落としに注意。</li>
              </ol>
              <p className="panel-sub">ときどきお皿の場所がシャッフル！ 全体をよく見てね。50秒で1ゲーム。</p>
              <button className="cta" onClick={onTutorialDone}>わかった！</button>
            </div>
          </div>
        )}

        {screen === 'result' && result && (
          <div className="overlay">
            <div className="panel">
              {result.isBestScore && <div className="ribbon">自己ベスト更新！</div>}
              <h2 className="panel-title">スコア {result.score}</h2>
              <div className="score-row">
                <div className="metric">
                  <span className="metric-label">仕分けの正確さ</span>
                  <Stars n={result.accuracyStars} />
                  <span className="metric-sub">正解 {result.correct}・ミス {result.mistakes}（{result.accuracy}%）</span>
                </div>
                <div className="metric">
                  <span className="metric-label">手ぎわ</span>
                  <Stars n={result.speedStars} />
                  <span className="metric-sub">できあがり {result.platesDone} 皿</span>
                </div>
              </div>
              <p className="panel-sub">最大コンボ {result.maxCombo}</p>
              <div className="btn-row">
                <button className="cta" onClick={beginPlay}>もう1回</button>
                <button className="ghost-btn" onClick={() => setScreen('menu')}>メニュー</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="app-foot">
        鍛わるのは主に「周辺視野・全体把握・状況判断」の力。実際のバスケ／サッカーの上達を保証するものではありません。
      </footer>
    </div>
  )
}
