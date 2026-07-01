import { useCallback, useMemo, useState } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { MODE_LABEL } from './game/config'
import type { Mode, RoundResult } from './game/types'
import { unlock } from './game/audio'
import { addScore, load, qualifies, RANK_MAX, save, type SaveData, type ScoreEntry } from './game/storage'
import { BADGES, accumulate, earnedIds, type Badge } from './game/badges'

type Screen = 'menu' | 'tutorial' | 'playing' | 'result' | 'ranking' | 'badges'

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`星${n}つ`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? 'star on' : 'star'}>★</span>
      ))}
    </span>
  )
}

function RankTable({ scores, highlight }: { scores: ScoreEntry[]; highlight?: number }) {
  if (scores.length === 0) {
    return <p className="rank-empty">まだ記録がありません。1ゲームあそぶと登録できます。</p>
  }
  return (
    <ol className="rank-list">
      {scores.map((s, i) => (
        <li key={i} className={i === highlight ? 'rank-row me' : 'rank-row'}>
          <span className="rank-no">{i + 1}</span>
          <span className="rank-name">{s.name}</span>
          <span className="rank-score">{s.score}</span>
        </li>
      ))}
    </ol>
  )
}

function BadgeGrid({ earned }: { earned: Set<string> }) {
  return (
    <div className="badge-grid">
      {BADGES.map((b) => {
        const got = earned.has(b.id)
        return (
          <div key={b.id} className={got ? `badge got ${b.tier}` : 'badge locked'}>
            <span className="badge-icon">{got ? b.icon : '🔒'}</span>
            <span className="badge-name">{got ? b.name : '？？？'}</span>
            <span className="badge-desc">{b.desc}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function App() {
  const [data, setData] = useState<SaveData>(() => load())
  const [screen, setScreen] = useState<Screen>('menu')
  const [result, setResult] = useState<RoundResult | null>(null)
  const [playKey, setPlayKey] = useState(0)
  const [nameInput, setNameInput] = useState('')
  const [newRank, setNewRank] = useState<number | null>(null)
  const [registered, setRegistered] = useState(false)
  const [newBadges, setNewBadges] = useState<Badge[]>([])

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
    const prev = load()
    const stats = accumulate(prev.stats, r)
    const earned = earnedIds(stats)
    const newly = earned.filter((id) => !prev.badges.includes(id))
    const next: SaveData = { ...prev, stats, badges: earned }
    save(next)
    setData(next)
    setResult(r)
    setNameInput(next.lastName || 'プレイヤー')
    setNewRank(null)
    setRegistered(false)
    setNewBadges(BADGES.filter((b) => newly.includes(b.id)))
    setScreen('result')
  }, [])

  const onRegister = useCallback(() => {
    if (!result) return
    const { data: next, rank } = addScore(data, nameInput, result.score)
    setData(next)
    setNewRank(rank)
    setRegistered(true)
  }, [result, data, nameInput])

  const showBackdrop = screen === 'menu' || screen === 'tutorial' || screen === 'result' || screen === 'ranking'
  const best = data.best
  const modeButtons = useMemo<Mode[]>(() => ['easy', 'normal'], [])
  const canRegister = !!result && !registered && qualifies(data.scores, result.score)
  const earnedSet = useMemo(() => new Set(data.badges), [data.badges])

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
              <div className="sub-links">
                <button className="rank-link" onClick={() => setScreen('ranking')}>ランキング</button>
                <button className="rank-link" onClick={() => setScreen('badges')}>バッジ図鑑 {data.badges.length}/{BADGES.length}</button>
              </div>

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

              {newBadges.length > 0 && (
                <div className="new-badges">
                  <p className="nb-title">あたらしいバッジ {newBadges.length}こ！</p>
                  <div className="nb-list">
                    {newBadges.slice(0, 8).map((b) => (
                      <span key={b.id} className={`nb-item ${b.tier}`}>
                        <span className="nb-ic">{b.icon}</span>{b.name}
                      </span>
                    ))}
                    {newBadges.length > 8 && <span className="nb-more">ほか{newBadges.length - 8}こ</span>}
                  </div>
                </div>
              )}

              <div className="rank-block">
                {canRegister && (
                  <div className="rank-entry">
                    <p className="rank-in">ランクイン！ なまえを入れて登録しよう</p>
                    <div className="rank-form">
                      <input
                        className="name-input"
                        value={nameInput}
                        maxLength={8}
                        onChange={(e) => setNameInput(e.target.value)}
                        aria-label="なまえ"
                      />
                      <button className="ghost-btn" onClick={onRegister}>登録</button>
                    </div>
                  </div>
                )}
                <RankTable scores={data.scores} highlight={registered ? newRank ?? undefined : undefined} />
              </div>

              <div className="btn-row">
                <button className="cta" onClick={beginPlay}>もう1回</button>
                <button className="ghost-btn" onClick={() => setScreen('menu')}>メニュー</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'ranking' && (
          <div className="overlay">
            <div className="panel">
              <h2 className="panel-title">ランキング TOP{RANK_MAX}</h2>
              <RankTable scores={data.scores} />
              <button className="cta" onClick={() => setScreen('menu')}>とじる</button>
            </div>
          </div>
        )}
      </div>

      {screen === 'badges' && (
        <div className="badges-modal">
          <div className="badges-inner">
            <div className="badges-head">
              <h2>バッジ図鑑 <span className="badges-count">{data.badges.length} / {BADGES.length}</span></h2>
              <button className="ghost-btn" onClick={() => setScreen('menu')}>とじる</button>
            </div>
            <BadgeGrid earned={earnedSet} />
          </div>
        </div>
      )}

      <footer className="app-foot">
        鍛わるのは主に「速く見きわめて我慢する」知覚・認知の力。実際のバスケ／サッカーの上達を保証するものではありません。
      </footer>
    </div>
  )
}
