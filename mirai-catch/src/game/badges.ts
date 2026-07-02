import type { RoundResult } from './types'

export type Tier = 'bronze' | 'silver' | 'gold' | 'rainbow'

export interface Badge {
  id: string
  name: string
  desc: string
  icon: string
  tier: Tier
  metric: string
  op: 'gte' | 'lte'
  value: number
}

export interface Stats {
  playCount: number
  totalScore: number
  bestScore: number
  bestCombo: number
  totalIntercept: number
  earlyTotal: number
  curveTotal: number
  predictStar3: number
  accuracyStar3: number
  doubleStar: number
  perfectRounds: number
}

export const EMPTY_STATS: Stats = {
  playCount: 0, totalScore: 0, bestScore: 0, bestCombo: 0,
  totalIntercept: 0, earlyTotal: 0, curveTotal: 0,
  predictStar3: 0, accuracyStar3: 0, doubleStar: 0, perfectRounds: 0,
}

export function accumulate(p: Stats, r: RoundResult): Stats {
  return {
    playCount: p.playCount + 1,
    totalScore: p.totalScore + r.score,
    bestScore: Math.max(p.bestScore, r.score),
    bestCombo: Math.max(p.bestCombo, r.maxCombo),
    totalIntercept: p.totalIntercept + r.intercepts,
    earlyTotal: p.earlyTotal + r.earlyIntercepts,
    curveTotal: p.curveTotal + r.curveIntercepts,
    predictStar3: p.predictStar3 + (r.predictStars === 3 ? 1 : 0),
    accuracyStar3: p.accuracyStar3 + (r.accuracyStars === 3 ? 1 : 0),
    doubleStar: p.doubleStar + (r.predictStars === 3 && r.accuracyStars === 3 ? 1 : 0),
    perfectRounds: p.perfectRounds + (r.conceded === 0 && r.intercepts > 0 ? 1 : 0),
  }
}

export function meets(stats: Stats, b: Badge): boolean {
  const v = (stats as unknown as Record<string, number>)[b.metric]
  if (typeof v !== 'number') return false
  return b.op === 'gte' ? v >= b.value : v <= b.value
}

export function earnedIds(stats: Stats): string[] {
  return BADGES.filter((b) => meets(stats, b)).map((b) => b.id)
}

export function nextBadges(stats: Stats, earned: Set<string>, n = 3): { badge: Badge; frac: number }[] {
  const out: { badge: Badge; frac: number }[] = []
  const rec = stats as unknown as Record<string, number>
  for (const b of BADGES) {
    if (earned.has(b.id)) continue
    const v = rec[b.metric]
    if (typeof v !== 'number') continue
    let frac = b.op === 'gte' ? (b.value > 0 ? v / b.value : 1) : (v > 0 ? b.value / v : 0)
    if (!isFinite(frac)) frac = 0
    frac = Math.max(0, Math.min(0.999, frac))
    out.push({ badge: b, frac })
  }
  out.sort((a, b) => b.frac - a.frac)
  return out.slice(0, n)
}

// __BADGES__ 生成データはビルド時に差し込む
export const BADGES: Badge[] = [
  {"id":"mc-bestScore-50","metric":"bestScore","op":"gte","value":50,"tier":"bronze","name":"はじめてのキャッチ","desc":"1ラウンドで50てんをとろう","icon":"🧤"},
  {"id":"mc-bestScore-100","metric":"bestScore","op":"gte","value":100,"tier":"bronze","name":"よみのめざめ","desc":"1ラウンドで100てんをとろう","icon":"👀"},
  {"id":"mc-bestScore-200","metric":"bestScore","op":"gte","value":200,"tier":"bronze","name":"さきよみルーキー","desc":"1ラウンドで200てんをとろう","icon":"⭐"},
  {"id":"mc-bestScore-300","metric":"bestScore","op":"gte","value":300,"tier":"bronze","name":"よこどりの達人","desc":"1ラウンドで300てんをとろう","icon":"✋"},
  {"id":"mc-bestScore-500","metric":"bestScore","op":"gte","value":500,"tier":"silver","name":"カーブみやぶり","desc":"1ラウンドで500てんをとろう","icon":"🌀"},
  {"id":"mc-bestScore-800","metric":"bestScore","op":"gte","value":800,"tier":"silver","name":"よるのコートの主","desc":"1ラウンドで800てんをとろう","icon":"🌙"},
  {"id":"mc-bestScore-1200","metric":"bestScore","op":"gte","value":1200,"tier":"gold","name":"みらいを見るひとみ","desc":"1ラウンドで1200てんをとろう","icon":"🔮"},
  {"id":"mc-bestScore-1800","metric":"bestScore","op":"gte","value":1800,"tier":"gold","name":"せんかいディフェンダー","desc":"1ラウンドで1800てんをとろう","icon":"🛡️"},
  {"id":"mc-bestScore-2500","metric":"bestScore","op":"gte","value":2500,"tier":"gold","name":"かがやくインターセプター","desc":"1ラウンドで2500てんをとろう","icon":"💫"},
  {"id":"mc-bestScore-4000","metric":"bestScore","op":"gte","value":4000,"tier":"rainbow","name":"でんせつのさきよみ王","desc":"1ラウンドで4000てんをとろう","icon":"👑"},
  {"id":"mc-totalScore-500","metric":"totalScore","op":"gte","value":500,"tier":"bronze","name":"はじめてのキャッチ・改","desc":"まずは500点!ボールを1つずつつかもう","icon":"🧤"},
  {"id":"mc-totalScore-1500","metric":"totalScore","op":"gte","value":1500,"tier":"bronze","name":"よみのめばえ","desc":"1500点とっぱ!通り道が見えてきたね","icon":"🌱"},
  {"id":"mc-totalScore-3000","metric":"totalScore","op":"gte","value":3000,"tier":"bronze","name":"さきよみビギナー","desc":"3000点!先回りのコツをつかんだ証","icon":"🔵"},
  {"id":"mc-totalScore-6000","metric":"totalScore","op":"gte","value":6000,"tier":"silver","name":"カーブをよむ者","desc":"6000点!曲がる球も見ぬいてゲット","icon":"🌀"},
  {"id":"mc-totalScore-10000","metric":"totalScore","op":"gte","value":10000,"tier":"silver","name":"よぞらのハンター","desc":"10000点!夜のコートを守りきったね","icon":"🌙"},
  {"id":"mc-totalScore-20000","metric":"totalScore","op":"gte","value":20000,"tier":"gold","name":"みらいの目","desc":"20000点!未来がどんどん見えてくる","icon":"👁️"},
  {"id":"mc-totalScore-40000","metric":"totalScore","op":"gte","value":40000,"tier":"gold","name":"インターセプトの達人","desc":"40000点!先回りマスターに大しょうしん","icon":"⚡"},
  {"id":"mc-totalScore-80000","metric":"totalScore","op":"gte","value":80000,"tier":"rainbow","name":"でんせつのさきよみ王・改","desc":"80000点!すべてを見ぬく伝説のキャッチャー","icon":"👑"},
  {"id":"mc-bestCombo-3","metric":"bestCombo","op":"gte","value":3,"tier":"bronze","name":"はじめてのつながり","desc":"3回つづけてキャッチしてみよう！","icon":"✨"},
  {"id":"mc-bestCombo-5","metric":"bestCombo","op":"gte","value":5,"tier":"bronze","name":"リズムにのって","desc":"5回れんぞくでキャッチだ！","icon":"🎵"},
  {"id":"mc-bestCombo-8","metric":"bestCombo","op":"gte","value":8,"tier":"bronze","name":"よみのめばえ・改","desc":"8回つづけて未来をよみきろう！","icon":"🌱"},
  {"id":"mc-bestCombo-12","metric":"bestCombo","op":"gte","value":12,"tier":"bronze","name":"つなげるチカラ","desc":"12回れんぞくで先回りしよう！","icon":"🔗"},
  {"id":"mc-bestCombo-16","metric":"bestCombo","op":"gte","value":16,"tier":"silver","name":"よみびとの目","desc":"16回つづけてカーブも見ぬこう！","icon":"👁️"},
  {"id":"mc-bestCombo-20","metric":"bestCombo","op":"gte","value":20,"tier":"silver","name":"かがやくキャッチャー","desc":"20回れんぞくで夜のコートを照らせ！","icon":"🌟"},
  {"id":"mc-bestCombo-25","metric":"bestCombo","op":"gte","value":25,"tier":"gold","name":"みらいマスター","desc":"25回つづけて通り道を先読みしよう！","icon":"🎯"},
  {"id":"mc-bestCombo-30","metric":"bestCombo","op":"gte","value":30,"tier":"gold","name":"むてきのさきよみ","desc":"30回れんぞく！だれにも止められない！","icon":"🔥"},
  {"id":"mc-bestCombo-40","metric":"bestCombo","op":"gte","value":40,"tier":"gold","name":"あおよるの支配者","desc":"40回つづけて青い夜を手中に！","icon":"🌌"},
  {"id":"mc-bestCombo-50","metric":"bestCombo","op":"gte","value":50,"tier":"rainbow","name":"でんせつのよみびと","desc":"50回れんぞく！伝説のさきよみ達人だ！","icon":"👑"},
  {"id":"mc-playCount-1","metric":"playCount","op":"gte","value":1,"tier":"bronze","name":"はじめてのさきよみ","desc":"1回あそぶともらえるよ！","icon":"🌱"},
  {"id":"mc-playCount-3","metric":"playCount","op":"gte","value":3,"tier":"bronze","name":"みらいのめばえ","desc":"3回あそんでみよう！","icon":"✨"},
  {"id":"mc-playCount-5","metric":"playCount","op":"gte","value":5,"tier":"bronze","name":"さきよみキャッチャー","desc":"5回あそんだしるし！","icon":"🧤"},
  {"id":"mc-playCount-10","metric":"playCount","op":"gte","value":10,"tier":"bronze","name":"よそくの名人","desc":"10回あそんだ証だよ！","icon":"🎯"},
  {"id":"mc-playCount-15","metric":"playCount","op":"gte","value":15,"tier":"silver","name":"カーブみやぶり隊","desc":"15回あそんでゲット！","icon":"🌀"},
  {"id":"mc-playCount-20","metric":"playCount","op":"gte","value":20,"tier":"silver","name":"先回りマスター","desc":"20回あそんだ勲章！","icon":"⚡"},
  {"id":"mc-playCount-30","metric":"playCount","op":"gte","value":30,"tier":"gold","name":"夜のコートの守護者","desc":"30回あそんだ強者へ！","icon":"🌙"},
  {"id":"mc-playCount-50","metric":"playCount","op":"gte","value":50,"tier":"gold","name":"みらいディフェンス王","desc":"50回あそんだ王様に！","icon":"👑"},
  {"id":"mc-playCount-75","metric":"playCount","op":"gte","value":75,"tier":"gold","name":"予知の超新星","desc":"75回あそんだ天才だ！","icon":"💫"},
  {"id":"mc-playCount-100","metric":"playCount","op":"gte","value":100,"tier":"rainbow","name":"伝説のみらいキャッチャー","desc":"100回あそんだ伝説だ！","icon":"🏆"},
  {"id":"mc-totalIntercept-20","metric":"totalIntercept","op":"gte","value":20,"tier":"bronze","name":"はじめてのキャッチ・改2","desc":"合計20回とめたらもらえるよ。まずは1つずつつかまえよう！","icon":"🧤"},
  {"id":"mc-totalIntercept-50","metric":"totalIntercept","op":"gte","value":50,"tier":"bronze","name":"さきよみの芽","desc":"合計50回！ボールの通り道が見えてきたね。","icon":"🌱"},
  {"id":"mc-totalIntercept-100","metric":"totalIntercept","op":"gte","value":100,"tier":"bronze","name":"よみきりマスター","desc":"合計100回とめたしるし。先回りがじょうずになってきた！","icon":"🎯"},
  {"id":"mc-totalIntercept-200","metric":"totalIntercept","op":"gte","value":200,"tier":"bronze","name":"よるコートの守り手","desc":"合計200回！青い夜のコートをしっかりガード。","icon":"🌙"},
  {"id":"mc-totalIntercept-400","metric":"totalIntercept","op":"gte","value":400,"tier":"silver","name":"カーブ球ハンター","desc":"合計400回。まがる球も見ぬいてキャッチ！","icon":"🌀"},
  {"id":"mc-totalIntercept-700","metric":"totalIntercept","op":"gte","value":700,"tier":"silver","name":"みらい先読みエース","desc":"合計700回とめた達人。着く前に先回り完ぺき！","icon":"⚡"},
  {"id":"mc-totalIntercept-1000","metric":"totalIntercept","op":"gte","value":1000,"tier":"gold","name":"インターセプト王","desc":"合計1000回！みんながおどろく守りの王さま。","icon":"👑"},
  {"id":"mc-totalIntercept-1500","metric":"totalIntercept","op":"gte","value":1500,"tier":"gold","name":"予知のディフェンダー","desc":"合計1500回。未来が見えてるみたいな守り！","icon":"🔮"},
  {"id":"mc-totalIntercept-2500","metric":"totalIntercept","op":"gte","value":2500,"tier":"gold","name":"きせきの通せんぼ","desc":"合計2500回とめた自慢の記録。どんな球もとおさない！","icon":"💫"},
  {"id":"mc-totalIntercept-4000","metric":"totalIntercept","op":"gte","value":4000,"tier":"rainbow","name":"伝説のみらいキャッチャー・改","desc":"合計4000回！だれもこえられない伝説になったよ。","icon":"🏆"},
  {"id":"mc-earlyTotal-10","metric":"earlyTotal","op":"gte","value":10,"tier":"bronze","name":"さきよみのめばえ","desc":"先回りせいこうを10回あつめよう","icon":"🌱"},
  {"id":"mc-earlyTotal-25","metric":"earlyTotal","op":"gte","value":25,"tier":"bronze","name":"よみのひらめき","desc":"先回りせいこうを25回あつめよう","icon":"💡"},
  {"id":"mc-earlyTotal-50","metric":"earlyTotal","op":"gte","value":50,"tier":"bronze","name":"みらいのしっぽつかみ","desc":"先回りせいこうを50回あつめよう","icon":"🪄"},
  {"id":"mc-earlyTotal-100","metric":"earlyTotal","op":"gte","value":100,"tier":"bronze","name":"せんまわりの名人","desc":"先回りせいこうを100回あつめよう","icon":"🎯"},
  {"id":"mc-earlyTotal-200","metric":"earlyTotal","op":"gte","value":200,"tier":"silver","name":"よみきりマスター・改","desc":"先回りせいこうを200回あつめよう","icon":"🧭"},
  {"id":"mc-earlyTotal-350","metric":"earlyTotal","op":"gte","value":350,"tier":"silver","name":"みらいみえるアイ","desc":"先回りせいこうを350回あつめよう","icon":"👁️"},
  {"id":"mc-earlyTotal-550","metric":"earlyTotal","op":"gte","value":550,"tier":"gold","name":"きせきのさきよみ","desc":"先回りせいこうを550回あつめよう","icon":"✨"},
  {"id":"mc-earlyTotal-800","metric":"earlyTotal","op":"gte","value":800,"tier":"gold","name":"コートのよげんしゃ","desc":"先回りせいこうを800回あつめよう","icon":"🔮"},
  {"id":"mc-earlyTotal-1200","metric":"earlyTotal","op":"gte","value":1200,"tier":"gold","name":"よぞらのしはいしゃ","desc":"先回りせいこうを1200回あつめよう","icon":"🌌"},
  {"id":"mc-earlyTotal-2000","metric":"earlyTotal","op":"gte","value":2000,"tier":"rainbow","name":"でんせつのみらいびと","desc":"先回りせいこうを2000回あつめよう","icon":"👑"},
  {"id":"mc-curveTotal-5","metric":"curveTotal","op":"gte","value":5,"tier":"bronze","name":"はじめてのカーブ","desc":"曲がる球を5回キャッチしてゲット！","icon":"🌱"},
  {"id":"mc-curveTotal-15","metric":"curveTotal","op":"gte","value":15,"tier":"bronze","name":"まがりみちマスター","desc":"曲がる球を15回とったらもらえるよ","icon":"🌀"},
  {"id":"mc-curveTotal-30","metric":"curveTotal","op":"gte","value":30,"tier":"bronze","name":"よみのめばえ・改2","desc":"曲がる球を30回さきよみしてキャッチ","icon":"👀"},
  {"id":"mc-curveTotal-60","metric":"curveTotal","op":"gte","value":60,"tier":"bronze","name":"カーブハンター","desc":"曲がる球を60回つかまえたしるし","icon":"🎯"},
  {"id":"mc-curveTotal-100","metric":"curveTotal","op":"gte","value":100,"tier":"silver","name":"ひゃっぱつキャッチ","desc":"曲がる球を100回とった証！","icon":"💯"},
  {"id":"mc-curveTotal-180","metric":"curveTotal","op":"gte","value":180,"tier":"silver","name":"よみのたつじん","desc":"曲がる球を180回さきよみして達成","icon":"🔮"},
  {"id":"mc-curveTotal-300","metric":"curveTotal","op":"gte","value":300,"tier":"gold","name":"カーブのゆうしゃ","desc":"曲がる球を300回とったゆうしゃ","icon":"⚡"},
  {"id":"mc-curveTotal-500","metric":"curveTotal","op":"gte","value":500,"tier":"gold","name":"まがりのしはいしゃ","desc":"曲がる球を500回あやつるしはいしゃ","icon":"🌪️"},
  {"id":"mc-curveTotal-800","metric":"curveTotal","op":"gte","value":800,"tier":"gold","name":"あおよるのてんさい","desc":"曲がる球を800回とった天才キャッチャー","icon":"🌟"},
  {"id":"mc-curveTotal-1200","metric":"curveTotal","op":"gte","value":1200,"tier":"rainbow","name":"でんせつのさきよみ王・改2","desc":"曲がる球を1200回！伝説のさきよみ王","icon":"👑"},
  {"id":"mc-predictStar3-1","metric":"predictStar3","op":"gte","value":1,"tier":"bronze","name":"はじめての先読み","desc":"ボールがつく前に予測★3を1回だそう","icon":"🔮"},
  {"id":"mc-predictStar3-3","metric":"predictStar3","op":"gte","value":3,"tier":"bronze","name":"さきよみルーキー・改","desc":"予測★3を3回きめてみよう","icon":"👣"},
  {"id":"mc-predictStar3-5","metric":"predictStar3","op":"gte","value":5,"tier":"bronze","name":"みらいの通り道マスター","desc":"予測★3を5回そろえよう","icon":"🛤️"},
  {"id":"mc-predictStar3-10","metric":"predictStar3","op":"gte","value":10,"tier":"silver","name":"カーブ球ハンター・改","desc":"まがる球も先読みして★3を10回","icon":"🎯"},
  {"id":"mc-predictStar3-15","metric":"predictStar3","op":"gte","value":15,"tier":"silver","name":"先回りキャッチャー","desc":"ボールより早く動いて★3を15回","icon":"⚡"},
  {"id":"mc-predictStar3-20","metric":"predictStar3","op":"gte","value":20,"tier":"gold","name":"夜のコートの支配者","desc":"青い夜のコートで★3を20回きめよう","icon":"🌙"},
  {"id":"mc-predictStar3-30","metric":"predictStar3","op":"gte","value":30,"tier":"gold","name":"未来を見ぬく者","desc":"球のゆくえを読んで★3を30回","icon":"👁️"},
  {"id":"mc-predictStar3-50","metric":"predictStar3","op":"gte","value":50,"tier":"rainbow","name":"伝説のさきよみ王","desc":"予測★3を50回だして伝説になろう","icon":"👑"},
  {"id":"mc-accuracyStar3-1","metric":"accuracyStar3","op":"gte","value":1,"tier":"bronze","name":"はじめの先読み","desc":"読みの正確さ★3を1回だそう","icon":"👀"},
  {"id":"mc-accuracyStar3-3","metric":"accuracyStar3","op":"gte","value":3,"tier":"bronze","name":"見ぬく目のたまご","desc":"★3の読みを3回きめよう","icon":"🥚"},
  {"id":"mc-accuracyStar3-5","metric":"accuracyStar3","op":"gte","value":5,"tier":"bronze","name":"みらい見えたよ","desc":"★3の読みを5回そろえよう","icon":"🔮"},
  {"id":"mc-accuracyStar3-10","metric":"accuracyStar3","op":"gte","value":10,"tier":"silver","name":"先回りの達人","desc":"★3の読みを10回きめよう","icon":"🎯"},
  {"id":"mc-accuracyStar3-15","metric":"accuracyStar3","op":"gte","value":15,"tier":"silver","name":"よみカゲキャッチ","desc":"★3の読みを15回つづけよう","icon":"🌟"},
  {"id":"mc-accuracyStar3-20","metric":"accuracyStar3","op":"gte","value":20,"tier":"gold","name":"未来を先どりマスター","desc":"★3の読みを20回きめよう","icon":"🏆"},
  {"id":"mc-accuracyStar3-30","metric":"accuracyStar3","op":"gte","value":30,"tier":"gold","name":"時をこえるまなざし","desc":"★3の読みを30回そろえよう","icon":"💫"},
  {"id":"mc-accuracyStar3-50","metric":"accuracyStar3","op":"gte","value":50,"tier":"rainbow","name":"伝説のさきよみ王・改","desc":"★3の読みを50回きめた証","icon":"👑"},
  {"id":"mc-doubleStar-1","metric":"doubleStar","op":"gte","value":1,"tier":"bronze","name":"はじめての先読み・改","desc":"予測と読みの★3を、1回のラウンドで両方そろえよう","icon":"🌟"},
  {"id":"mc-doubleStar-2","metric":"doubleStar","op":"gte","value":2,"tier":"bronze","name":"ダブル先取りコンビ","desc":"予測と読みの★3ダブルを、ぜんぶで2回きめよう","icon":"✨"},
  {"id":"mc-doubleStar-3","metric":"doubleStar","op":"gte","value":3,"tier":"bronze","name":"三日月ディフェンダー","desc":"★3ダブルのラウンドを3回たっせいしよう","icon":"🌙"},
  {"id":"mc-doubleStar-5","metric":"doubleStar","op":"gte","value":5,"tier":"silver","name":"よみきりインターセプト","desc":"★3ダブルを5回、まちがえずにきめきろう","icon":"🧤"},
  {"id":"mc-doubleStar-8","metric":"doubleStar","op":"gte","value":8,"tier":"silver","name":"夜空のさきよみエース","desc":"★3ダブルを8回きめて、コートのエースになろう","icon":"⭐"},
  {"id":"mc-doubleStar-12","metric":"doubleStar","op":"gte","value":12,"tier":"gold","name":"みらいを見ぬくキャッチャー","desc":"★3ダブルを12回、球の通り道を先回りしてつかもう","icon":"🎯"},
  {"id":"mc-doubleStar-20","metric":"doubleStar","op":"gte","value":20,"tier":"gold","name":"カーブもよめるマスター","desc":"カーブ球もふくめ★3ダブルを20回きめきろう","icon":"🌀"},
  {"id":"mc-doubleStar-30","metric":"doubleStar","op":"gte","value":30,"tier":"rainbow","name":"伝説のさきよみ王・改2","desc":"★3ダブルを30回きめて、みらいキャッチの伝説になろう","icon":"👑"},
  {"id":"mc-perfectRounds-1","metric":"perfectRounds","op":"gte","value":1,"tier":"bronze","name":"はじめてのゼロしっし","desc":"1ラウンドを失点0でまもりきろう！","icon":"🛡️"},
  {"id":"mc-perfectRounds-3","metric":"perfectRounds","op":"gte","value":3,"tier":"bronze","name":"みらいの目ざめ","desc":"失点0を3ラウンド。先読みがさえてきた！","icon":"👀"},
  {"id":"mc-perfectRounds-5","metric":"perfectRounds","op":"gte","value":5,"tier":"bronze","name":"さきよみキャッチャー・改","desc":"失点0を5ラウンド。通り道が見えてきた！","icon":"🧤"},
  {"id":"mc-perfectRounds-10","metric":"perfectRounds","op":"gte","value":10,"tier":"silver","name":"よるコートの番人","desc":"失点0を10ラウンド。青い夜をまもりぬけ！","icon":"🌙"},
  {"id":"mc-perfectRounds-15","metric":"perfectRounds","op":"gte","value":15,"tier":"silver","name":"カーブくだきの名手","desc":"失点0を15ラウンド。曲がる球も先回り！","icon":"🌀"},
  {"id":"mc-perfectRounds-20","metric":"perfectRounds","op":"gte","value":20,"tier":"gold","name":"ノーゴールの守護神","desc":"失点0を20ラウンド。ゴールをぜんぶふせいだ！","icon":"⚡"},
  {"id":"mc-perfectRounds-30","metric":"perfectRounds","op":"gte","value":30,"tier":"gold","name":"みらいをあやつる者","desc":"失点0を30ラウンド。未来がぜんぶ読めてる！","icon":"🔮"},
  {"id":"mc-perfectRounds-50","metric":"perfectRounds","op":"gte","value":50,"tier":"rainbow","name":"でんせつのさきよみ王・改3","desc":"失点0を50ラウンド。だれもこえられない伝説だ！","icon":"👑"}
]
