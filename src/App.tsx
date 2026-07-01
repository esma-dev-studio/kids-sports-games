import { useCallback, useMemo, useState } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { MODE_LABEL } from './game/config'
import type { Mode, RoundResult } from './game/types'
import { unlock } from './game/audio'
import { load, save, type SaveData } from './game/storage'

type Screen = 'menu' | 'tutorial' | 'playing' | 'result'

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
    setData(load()) // ベスト更新を反映
    setScreen('result')
  }, [])

  const showBackdrop = screen === 'menu' || screen === 'tutorial' || screen === 'result'

  const best = data.best

  const modeButtons = useMemo<Mode[]>(() => ['easy', 'normal'], [])

  return (
    <div className="app">
      <header className="app-head">
        <h1>まもれ！シグナル・ヒーロー</h1>
        <p className="tagline">味方が光ったらタッチ、敵のニセ光は<b>がまん</b>。</p>
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
              <p className="panel-lead">
                <span className="chip go">○ 味方＝たたく</span>
                <span className="chip nogo">× 敵＝がまん</span>
              </p>
              <p className="panel-sub">ニセ光を見きわめて手を止めると「見きわめボーナス」でスコアが伸びる！</p>

              <div className="mode-row" role="group" aria-label="むずかしさ">
                {modeButtons.map((m) => (
                  <button
                    key={m}
                    className={`mode ${data.mode === m ? 'sel' : ''}`}
                    onClick={() => persist({ mode: m })}
                  >
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>

              <button className="cta" onClick={onStart}>はじめる</button>

              <div className="best">
                自己ベスト｜スコア <b>{best.score}</b>　コンボ <b>{best.combo}</b>　がまん連鎖 <b>{best.gaman}</b>
              </div>

              <div className="toggles">
                <label>
                  <input type="checkbox" checked={data.sound} onChange={(e) => persist({ sound: e.target.checked })} />
                  音
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={data.reducedMotion}
                    onChange={(e) => persist({ reducedMotion: e.target.checked })}
                  />
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
                <li><span className="chip go">○</span> みかたが光ったら、すぐタッチ！</li>
                <li><span className="chip nogo">×</span> 敵のニセ光は、さわらずにがまん。</li>
                <li>がまんできると「見きわめボーナス」でスコアアップ。</li>
              </ol>
              <p className="panel-sub">まちがえても大丈夫。ライフは3つ、40秒で1ゲーム。</p>
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
                  <span className="metric-label">反応の速さ</span>
                  <Stars n={result.reactionStars} />
                  <span className="metric-sub">
                    命中 {result.goHit}/{result.goShown}・{result.avgReaction}ms
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">見きわめ（がまん）</span>
                  <Stars n={result.discernStars} />
                  <span className="metric-sub">
                    がまん {result.nogoResisted}/{result.nogoShown}
                  </span>
                </div>
              </div>
              <p className="panel-sub">最大コンボ {result.maxCombo}・最大がまん連鎖 {result.maxGaman}</p>
              <div className="btn-row">
                <button className="cta" onClick={beginPlay}>もう1回</button>
                <button className="ghost-btn" onClick={() => setScreen('menu')}>メニュー</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="app-foot">
        鍛わるのは主に「速く見きわめて我慢する」知覚・認知の力。実際のバスケ／サッカーの上達を保証するものではありません。
      </footer>
    </div>
  )
}
