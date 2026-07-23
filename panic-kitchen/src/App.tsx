import { useCallback, useMemo, useState } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { MODE_LABEL, SPEED_STAR3_PLATES } from './game/config'
import type { Mode, RoundResult } from './game/types'
import { unlock, playFanfare } from './game/audio'
import { addScore, load, qualifies, RANK_MAX, save, type SaveData, type ScoreEntry } from './game/storage'
import { BADGES, accumulate, earnedIds, nextBadges, type Badge } from './game/badges'

type Screen = 'menu' | 'tutorial' | 'playing' | 'result' | 'ranking' | 'badges'
const MODES: Mode[] = ['easy', 'normal']

// きょうのミッション（日付シードで3択から1つ選ぶ、小さな行動目標）
interface Mission { id: string; text: string; check: (r: RoundResult) => boolean }
const MISSIONS: Mission[] = [
  { id: 'wilt0-3plates', text: 'しおれさせずに 3さら できあがらせよう', check: (r) => r.wilts === 0 && r.platesDone >= 3 },
  { id: 'shuffle-streak3', text: 'シャッフルの あとに 3れんぞく せいかいしよう', check: (r) => r.postShuffleStreak >= 3 },
  { id: 'golden-2', text: 'きらきら食材を 2つ とどけよう', check: (r) => r.goldenCaught >= 2 },
]
function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function missionOfDay(key: string): Mission {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return MISSIONS[h % MISSIONS.length]
}

const MASCOT = { name: 'ぴよシェフ', emoji: '🐥' }
const SPEECH = {
  menu: 'きょうの キッチンも おおいそがし ぴよ！ てつだって〜！',
  best: 'じこベスト だぴよーー！ きみは てんさいシェフ！',
  good: 'おみごと！ おきゃくさん だいまんぞく ぴよ！',
  ok: 'いい ちょうし！ つぎは もっと いける ぴよ！',
  low: 'だいじょうぶ！ しっぱいは あじみの うち ぴよ。もういっかい いこ！',
  newBadge: 'ぴよっ！ あたらしい バッジ ゲットだぴよ！',
}

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`星${n}つ`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? 'star on' : 'star'}>★</span>
      ))}
    </span>
  )
}

function Mascot({ text }: { text: string }) {
  return (
    <div className="mascot">
      <span className="mascot-emoji" aria-hidden="true">{MASCOT.emoji}</span>
      <div className="mascot-bubble">
        <span className="mascot-name">{MASCOT.name}</span>
        {text}
      </div>
    </div>
  )
}

function Confetti() {
  const cols = ['#FFD23F', '#ff8f3c', '#ff6b6b', '#7be08f', '#4fc3f7', '#b06bff']
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 24 }).map((_, i) => (
        <span
          key={i}
          className="cf"
          style={{
            left: `${(i * 4.16) % 100}%`,
            background: cols[i % cols.length],
            animationDelay: `${(i % 6) * 0.08}s`,
            animationDuration: `${1.6 + (i % 5) * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}

function RankTable({ scores, highlight }: { scores: ScoreEntry[]; highlight?: number }) {
  if (scores.length === 0) {
    return <p className="rank-empty">まだ記録がありません。1ゲームあそぶと自動でのります。</p>
  }
  return (
    <ol className="rank-list">
      {scores.map((s, i) => (
        <li key={i} className={i === highlight ? 'rank-row me' : 'rank-row'}>
          <span className="rank-no">{i + 1}位</span>
          <span className="rank-score">{s.score}</span>
        </li>
      ))}
    </ol>
  )
}

function NextBadges({ items }: { items: { badge: Badge; frac: number }[] }) {
  if (items.length === 0) return null
  return (
    <div className="next-badges">
      <p className="nb2-title">つぎの バッジ</p>
      {items.map(({ badge, frac }) => (
        <div key={badge.id} className="nb2-row">
          <span className="nb2-ic">{badge.icon}</span>
          <span className="nb2-info">
            <span className="nb2-name">{badge.name}</span>
            <span className="nb2-bar"><span className="nb2-fill" style={{ width: `${Math.round(frac * 100)}%` }} /></span>
          </span>
          <span className="nb2-pct">{Math.round(frac * 100)}%</span>
        </div>
      ))}
    </div>
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
  const [newRank, setNewRank] = useState<number | null>(null)
  const [newBadges, setNewBadges] = useState<Badge[]>([])
  const [missionJustDone, setMissionJustDone] = useState(false)

  const today = useMemo(() => todayKey(), [])
  const mission = useMemo(() => missionOfDay(today), [today])
  const missionKey = `${today}:${mission.id}`
  const missionAlreadyDone = data.missionDone.includes(missionKey)

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
    const todayStr = todayKey()
    const todayMission = missionOfDay(todayStr)
    const mKey = `${todayStr}:${todayMission.id}`
    const missionNewly = todayMission.check(r) && !prev.missionDone.includes(mKey)
    let next: SaveData = {
      ...prev,
      stats,
      badges: earned,
      missionDone: missionNewly ? [...prev.missionDone, mKey].slice(-30) : prev.missionDone,
    }
    let rank = -1
    if (qualifies(prev.scores, r.score)) {
      const res = addScore(next, prev.lastName || 'あなた', r.score)
      next = res.data
      rank = res.rank
    } else {
      save(next)
    }
    setData(next)
    setMissionJustDone(missionNewly)
    setResult(r)
    setNewRank(rank >= 0 ? rank : null)
    setNewBadges(BADGES.filter((b) => newly.includes(b.id)))
    if ((r.isBestScore || newly.length > 0) && prev.sound) playFanfare()
    setScreen('result')
  }, [])

  const showBackdrop = screen === 'menu' || screen === 'tutorial' || screen === 'result' || screen === 'ranking'
  const best = data.best
  const earnedSet = useMemo(() => new Set(data.badges), [data.badges])
  const teaser = useMemo(() => nextBadges(data.stats, earnedSet, 3), [data.stats, earnedSet])

  let resultLine = SPEECH.ok
  if (result) {
    const stars = result.accuracyStars + result.speedStars
    resultLine = result.isBestScore ? SPEECH.best
      : newBadges.length > 0 ? SPEECH.newBadge
      : stars >= 5 ? SPEECH.good
      : stars >= 3 ? SPEECH.ok
      : SPEECH.low
  }
  const celebrate = !!result && (result.isBestScore || newBadges.length > 0)

  // 「あと少し」ナッジ：次の挑戦を具体的にして「もう1回」を後押しする
  let nudge = ''
  if (result) {
    if (result.speedStars < 3) {
      const need = SPEED_STAR3_PLATES - result.platesDone
      if (need > 0 && need <= 2) nudge = `あと${need}さらで 手ぎわ★3！`
    }
    if (!nudge && !result.isBestScore && best.score > 0) {
      const gap = best.score - result.score
      if (gap > 0 && gap <= 50) nudge = `自己ベストまで あと${gap}てん！`
    }
  }

  return (
    <div className={data.reducedMotion ? 'app rm' : 'app'}>
      <header className="app-head">
        <h1 className="title-pop">パニックキッチン</h1>
        <p className="tagline">きょうも おおいそがし！ とんでくる しょくざいを ぱぱっと おとどけ！</p>
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
              <Mascot text={SPEECH.menu} />
              <p className="panel-sub big">食材をドラッグして、色とアイコンの合うお皿へ。お皿がいっぱいになると「できあがり！」でボーナス。</p>
              <div className="mode-row" role="group" aria-label="むずかしさ">
                {MODES.map((m) => (
                  <button key={m} className={`mode ${data.mode === m ? 'sel' : ''}`} onClick={() => persist({ mode: m })}>
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
              <button className="cta" onClick={onStart}>はじめる</button>
              <div className="sub-links">
                <button className="rank-link" onClick={() => setScreen('ranking')}>ランキング</button>
                <button className="rank-link" onClick={() => setScreen('badges')}>バッジ図鑑 {data.badges.length}/{BADGES.length}</button>
              </div>
              <NextBadges items={teaser} />
              <div className="best">
                きょうのミッション｜{mission.text}{missionAlreadyDone ? '（きょうはクリア済み！）' : ''}
              </div>
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
                <li>食材は ほうっておくと しおれちゃうよ。はやめに はこぼう！</li>
              </ol>
              <p className="panel-sub">ときどきお皿の場所がシャッフル！ 全体をよく見てね。数字キーでも おさらに送れるよ。50秒で1ゲーム。</p>
              <button className="cta" onClick={onTutorialDone}>わかった！</button>
            </div>
          </div>
        )}

        {screen === 'result' && result && (
          <div className="overlay">
            <div className="panel">
              {celebrate && !data.reducedMotion && <Confetti />}
              {result.isBestScore && <div className="ribbon">自己ベスト更新！</div>}
              <h2 className="panel-title">スコア {result.score}</h2>
              <Mascot text={resultLine} />
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

              {missionJustDone && <p className="rank-in">きょうのミッション たっせい！「{mission.text}」</p>}
              {nudge && <p className="panel-sub big">{nudge}</p>}

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
                {newRank !== null && <p className="rank-in">ランキング {newRank + 1}位に のったよ！🎉</p>}
                <RankTable scores={data.scores} highlight={newRank ?? undefined} />
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
        鍛わるのは主に「周辺視野・全体把握・状況判断」の力。実際のバスケ／サッカーの上達を保証するものではありません。
      </footer>
    </div>
  )
}
