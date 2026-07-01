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

/** 実績判定に使う累積・記録スタッツ（すべて単調＝一度満たしたら戻らない） */
export interface Stats {
  playCount: number
  totalScore: number
  bestScore: number
  bestCombo: number
  bestPlates: number
  totalPlates: number
  totalCorrect: number
  perfectRounds: number
  speedStar3: number
  accuracyStar3: number
  bothStar3: number
}

export const EMPTY_STATS: Stats = {
  playCount: 0, totalScore: 0, bestScore: 0, bestCombo: 0, bestPlates: 0,
  totalPlates: 0, totalCorrect: 0, perfectRounds: 0, speedStar3: 0, accuracyStar3: 0, bothStar3: 0,
}

/** 1ラウンドの結果を反映して新しいスタッツを返す */
export function accumulate(p: Stats, r: RoundResult): Stats {
  return {
    playCount: p.playCount + 1,
    totalScore: p.totalScore + r.score,
    bestScore: Math.max(p.bestScore, r.score),
    bestCombo: Math.max(p.bestCombo, r.maxCombo),
    bestPlates: Math.max(p.bestPlates, r.platesDone),
    totalPlates: p.totalPlates + r.platesDone,
    totalCorrect: p.totalCorrect + r.correct,
    perfectRounds: p.perfectRounds + (r.mistakes === 0 && r.correct > 0 ? 1 : 0),
    speedStar3: p.speedStar3 + (r.speedStars === 3 ? 1 : 0),
    accuracyStar3: p.accuracyStar3 + (r.accuracyStars === 3 ? 1 : 0),
    bothStar3: p.bothStar3 + (r.speedStars === 3 && r.accuracyStars === 3 ? 1 : 0),
  }
}

export function meets(stats: Stats, b: Badge): boolean {
  const v = (stats as unknown as Record<string, number>)[b.metric]
  if (typeof v !== 'number') return false
  return b.op === 'gte' ? v >= b.value : v <= b.value
}

/** 現在のスタッツで獲得済みの全バッジidを返す */
export function earnedIds(stats: Stats): string[] {
  return BADGES.filter((b) => meets(stats, b)).map((b) => b.id)
}

// __BADGES__ 生成データはビルド時に差し込む
export const BADGES: Badge[] = [
  {"id":"pk-bestScore-50","metric":"bestScore","op":"gte","value":50,"tier":"bronze","name":"はじめての一皿","desc":"1ラウンドで50てんをとろう！","icon":"🍳"},
  {"id":"pk-bestScore-100","metric":"bestScore","op":"gte","value":100,"tier":"bronze","name":"ぴったり見習いコック","desc":"1ラウンドで100てんをとろう！","icon":"🥄"},
  {"id":"pk-bestScore-200","metric":"bestScore","op":"gte","value":200,"tier":"bronze","name":"お皿さばきの達人","desc":"1ラウンドで200てんをとろう！","icon":"🍽️"},
  {"id":"pk-bestScore-300","metric":"bestScore","op":"gte","value":300,"tier":"bronze","name":"キッチンの人気者","desc":"1ラウンドで300てんをとろう！","icon":"😋"},
  {"id":"pk-bestScore-500","metric":"bestScore","op":"gte","value":500,"tier":"silver","name":"スピード仕分けマスター","desc":"1ラウンドで500てんをとろう！","icon":"⚡"},
  {"id":"pk-bestScore-800","metric":"bestScore","op":"gte","value":800,"tier":"silver","name":"厨房のエースコック","desc":"1ラウンドで800てんをとろう！","icon":"👨‍🍳"},
  {"id":"pk-bestScore-1200","metric":"bestScore","op":"gte","value":1200,"tier":"gold","name":"まかせろ！鉄板シェフ","desc":"1ラウンドで1200てんをとろう！","icon":"🔥"},
  {"id":"pk-bestScore-1800","metric":"bestScore","op":"gte","value":1800,"tier":"gold","name":"きらめく金の玉じゃくし","desc":"1ラウンドで1800てんをとろう！","icon":"🥇"},
  {"id":"pk-bestScore-2500","metric":"bestScore","op":"gte","value":2500,"tier":"gold","name":"パニックキッチンの帝王","desc":"1ラウンドで2500てんをとろう！","icon":"👑"},
  {"id":"pk-bestScore-4000","metric":"bestScore","op":"gte","value":4000,"tier":"rainbow","name":"伝説の五つ星グランシェフ","desc":"1ラウンドで4000てんをとろう！","icon":"🌟"},
  {"id":"pk-totalScore-500","metric":"totalScore","op":"gte","value":500,"tier":"bronze","name":"はじめての一皿・改","desc":"あわせて500てんためよう","icon":"🍳"},
  {"id":"pk-totalScore-1500","metric":"totalScore","op":"gte","value":1500,"tier":"bronze","name":"わくわく見習いコック","desc":"あわせて1500てんためよう","icon":"🥄"},
  {"id":"pk-totalScore-3000","metric":"totalScore","op":"gte","value":3000,"tier":"bronze","name":"元気もりもりキッチン","desc":"あわせて3000てんためよう","icon":"🍲"},
  {"id":"pk-totalScore-6000","metric":"totalScore","op":"gte","value":6000,"tier":"silver","name":"かっこいい仕分けマスター","desc":"あわせて6000てんためよう","icon":"🔥"},
  {"id":"pk-totalScore-10000","metric":"totalScore","op":"gte","value":10000,"tier":"silver","name":"スピード厨房エース","desc":"あわせて10000てんためよう","icon":"⚡"},
  {"id":"pk-totalScore-20000","metric":"totalScore","op":"gte","value":20000,"tier":"gold","name":"きらめきグランドシェフ","desc":"あわせて20000てんためよう","icon":"⭐"},
  {"id":"pk-totalScore-40000","metric":"totalScore","op":"gte","value":40000,"tier":"gold","name":"きわめし料理の達人","desc":"あわせて40000てんためよう","icon":"👑"},
  {"id":"pk-totalScore-80000","metric":"totalScore","op":"gte","value":80000,"tier":"rainbow","name":"伝説のキッチンレジェンド","desc":"あわせて80000てんためよう","icon":"🏆"},
  {"id":"pk-bestCombo-3","metric":"bestCombo","op":"gte","value":3,"tier":"bronze","name":"コンボのたまご","desc":"3かい つづけて せいかい したら もらえるよ！","icon":"🥚"},
  {"id":"pk-bestCombo-5","metric":"bestCombo","op":"gte","value":5,"tier":"bronze","name":"とんとんリズム","desc":"5かい つづけて お皿に ぴったり しんこう！","icon":"🎵"},
  {"id":"pk-bestCombo-8","metric":"bestCombo","op":"gte","value":8,"tier":"bronze","name":"なかよしシェフ","desc":"8かい ミスなしで しあげたよ！","icon":"👩‍🍳"},
  {"id":"pk-bestCombo-12","metric":"bestCombo","op":"gte","value":12,"tier":"bronze","name":"きらきらコンボ","desc":"12かい つづけて ぴったり しあけ！すごい！","icon":"✨"},
  {"id":"pk-bestCombo-16","metric":"bestCombo","op":"gte","value":16,"tier":"silver","name":"ほのおのフライパン","desc":"16かい つづけて せいこう！あついぞ！","icon":"🔥"},
  {"id":"pk-bestCombo-20","metric":"bestCombo","op":"gte","value":20,"tier":"silver","name":"スピードキッチン","desc":"20かい ノーミスで びゅんびゅん さばいた！","icon":"⚡"},
  {"id":"pk-bestCombo-25","metric":"bestCombo","op":"gte","value":25,"tier":"gold","name":"まほうの手さばき","desc":"25かい つづけて ぴったり！まほうみたい！","icon":"🌟"},
  {"id":"pk-bestCombo-30","metric":"bestCombo","op":"gte","value":30,"tier":"gold","name":"キッチンのおうさま","desc":"30かい つづけて せいこう！おうさまきぶん！","icon":"👑"},
  {"id":"pk-bestCombo-40","metric":"bestCombo","op":"gte","value":40,"tier":"gold","name":"ちょうぜつシェフ","desc":"40かい ミスなしで さばいた！しんじられない！","icon":"🏆"},
  {"id":"pk-bestCombo-50","metric":"bestCombo","op":"gte","value":50,"tier":"rainbow","name":"でんせつのコンボ竜","desc":"50かい つづけて せいこう！でんせつに なったよ！","icon":"🐉"},
  {"id":"pk-bestPlates-1","metric":"bestPlates","op":"gte","value":1,"tier":"bronze","name":"はじめてのおさら","desc":"1ラウンドで1皿できあがり！さいしょの1まい","icon":"🍽️"},
  {"id":"pk-bestPlates-2","metric":"bestPlates","op":"gte","value":2,"tier":"bronze","name":"ふたりまえコンビ","desc":"1ラウンドで2皿できあがり！2まいそろった","icon":"🍳"},
  {"id":"pk-bestPlates-3","metric":"bestPlates","op":"gte","value":3,"tier":"bronze","name":"みつぼしランチ","desc":"1ラウンドで3皿できあがり！3まいそろえた","icon":"🥗"},
  {"id":"pk-bestPlates-5","metric":"bestPlates","op":"gte","value":5,"tier":"bronze","name":"もりもり5プレート","desc":"1ラウンドで5皿できあがり！5まいもすごい","icon":"🍛"},
  {"id":"pk-bestPlates-7","metric":"bestPlates","op":"gte","value":7,"tier":"silver","name":"ラッキー7シェフ","desc":"1ラウンドで7皿できあがり！7まいはかっこいい","icon":"🍜"},
  {"id":"pk-bestPlates-10","metric":"bestPlates","op":"gte","value":10,"tier":"silver","name":"テンテコまいマスター","desc":"1ラウンドで10皿できあがり！10まい大かつやく","icon":"🔟"},
  {"id":"pk-bestPlates-13","metric":"bestPlates","op":"gte","value":13,"tier":"gold","name":"スーパーキッチン隊長","desc":"1ラウンドで13皿できあがり！13まいはすごい","icon":"👨‍🍳"},
  {"id":"pk-bestPlates-16","metric":"bestPlates","op":"gte","value":16,"tier":"gold","name":"だいばんじょうエース","desc":"1ラウンドで16皿できあがり！16まいで自まんできる","icon":"🏆"},
  {"id":"pk-bestPlates-20","metric":"bestPlates","op":"gte","value":20,"tier":"gold","name":"キング・オブ・キッチン","desc":"1ラウンドで20皿できあがり！20まいの王さま","icon":"👑"},
  {"id":"pk-bestPlates-25","metric":"bestPlates","op":"gte","value":25,"tier":"rainbow","name":"でんせつのまかないマエストロ","desc":"1ラウンドで25皿できあがり！25まいはでんせつ級","icon":"🌟"},
  {"id":"pk-totalPlates-5","metric":"totalPlates","op":"gte","value":5,"tier":"bronze","name":"はじめてのおさら・改","desc":"あわせて5さらできたらゲット！","icon":"🍽️"},
  {"id":"pk-totalPlates-15","metric":"totalPlates","op":"gte","value":15,"tier":"bronze","name":"できたてホカホカ","desc":"あわせて15さらできたらゲット！","icon":"🍲"},
  {"id":"pk-totalPlates-30","metric":"totalPlates","op":"gte","value":30,"tier":"bronze","name":"みならいコックさん","desc":"あわせて30さらできたらゲット！","icon":"👦"},
  {"id":"pk-totalPlates-60","metric":"totalPlates","op":"gte","value":60,"tier":"bronze","name":"キッチンなかよし","desc":"あわせて60さらできたらゲット！","icon":"🥄"},
  {"id":"pk-totalPlates-100","metric":"totalPlates","op":"gte","value":100,"tier":"silver","name":"はやわざシェフ","desc":"あわせて100さらできたらゲット！","icon":"👨‍🍳"},
  {"id":"pk-totalPlates-180","metric":"totalPlates","op":"gte","value":180,"tier":"silver","name":"もりもり大せいさん","desc":"あわせて180さらできたらゲット！","icon":"🍛"},
  {"id":"pk-totalPlates-300","metric":"totalPlates","op":"gte","value":300,"tier":"gold","name":"キッチンの王さま","desc":"あわせて300さらできたらゲット！","icon":"👑"},
  {"id":"pk-totalPlates-500","metric":"totalPlates","op":"gte","value":500,"tier":"gold","name":"ごうか大ばんじょう","desc":"あわせて500さらできたらゲット！","icon":"🍱"},
  {"id":"pk-totalPlates-800","metric":"totalPlates","op":"gte","value":800,"tier":"gold","name":"ゴールデンシェフ","desc":"あわせて800さらできたらゲット！","icon":"🏆"},
  {"id":"pk-totalPlates-1200","metric":"totalPlates","op":"gte","value":1200,"tier":"rainbow","name":"でんせつのりょうりにん","desc":"あわせて1200さらできたらゲット！","icon":"🌟"},
  {"id":"pk-totalCorrect-20","metric":"totalCorrect","op":"gte","value":20,"tier":"bronze","name":"はじめてのお皿","desc":"あわせて20こ ただしく なかまわけできたよ！","icon":"🍽️"},
  {"id":"pk-totalCorrect-50","metric":"totalCorrect","op":"gte","value":50,"tier":"bronze","name":"ぴったり名人","desc":"あわせて50こ ただしく なかまわけしよう！","icon":"🥕"},
  {"id":"pk-totalCorrect-100","metric":"totalCorrect","op":"gte","value":100,"tier":"bronze","name":"キッチンの人気者・改","desc":"あわせて100こ ただしく なかまわけしよう！","icon":"🍳"},
  {"id":"pk-totalCorrect-250","metric":"totalCorrect","op":"gte","value":250,"tier":"bronze","name":"しあげのプロ見習い","desc":"あわせて250こ ただしく なかまわけしよう！","icon":"🧑‍🍳"},
  {"id":"pk-totalCorrect-500","metric":"totalCorrect","op":"gte","value":500,"tier":"silver","name":"スピード調理長","desc":"あわせて500こ ただしく なかまわけしよう！","icon":"⚡"},
  {"id":"pk-totalCorrect-900","metric":"totalCorrect","op":"gte","value":900,"tier":"silver","name":"キッチンの司令塔","desc":"あわせて900こ ただしく なかまわけしよう！","icon":"🎯"},
  {"id":"pk-totalCorrect-1400","metric":"totalCorrect","op":"gte","value":1400,"tier":"gold","name":"厨房の達人シェフ","desc":"あわせて1400こ ただしく なかまわけしよう！","icon":"👨‍🍳"},
  {"id":"pk-totalCorrect-2200","metric":"totalCorrect","op":"gte","value":2200,"tier":"gold","name":"黄金の仕分けマスター","desc":"あわせて2200こ ただしく なかまわけしよう！","icon":"🏆"},
  {"id":"pk-totalCorrect-3500","metric":"totalCorrect","op":"gte","value":3500,"tier":"gold","name":"無敵のキッチンキング","desc":"あわせて3500こ ただしく なかまわけしよう！","icon":"👑"},
  {"id":"pk-totalCorrect-5000","metric":"totalCorrect","op":"gte","value":5000,"tier":"rainbow","name":"伝説のパニックレジェンド","desc":"あわせて5000こ ただしく なかまわけしよう！","icon":"🌟"},
  {"id":"pk-playCount-1","metric":"playCount","op":"gte","value":1,"tier":"bronze","name":"はじめてのまかない","desc":"1回あそんだらもらえるよ","icon":"🍳"},
  {"id":"pk-playCount-3","metric":"playCount","op":"gte","value":3,"tier":"bronze","name":"みならいコック","desc":"3回あそんだらゲット！","icon":"🥄"},
  {"id":"pk-playCount-5","metric":"playCount","op":"gte","value":5,"tier":"bronze","name":"キッチンデビュー","desc":"5回あそんだしるし","icon":"🍽️"},
  {"id":"pk-playCount-10","metric":"playCount","op":"gte","value":10,"tier":"bronze","name":"おさらマスター見習い","desc":"10回あそんだらもらえる","icon":"🧑‍🍳"},
  {"id":"pk-playCount-15","metric":"playCount","op":"gte","value":15,"tier":"silver","name":"スピードシェフ","desc":"15回あそんだしょうこ","icon":"🔥"},
  {"id":"pk-playCount-20","metric":"playCount","op":"gte","value":20,"tier":"silver","name":"厨房のエース","desc":"20回あそんだらゲット！","icon":"⚡"},
  {"id":"pk-playCount-30","metric":"playCount","op":"gte","value":30,"tier":"gold","name":"仕分けの達人","desc":"30回あそんだすごいしるし","icon":"🏅"},
  {"id":"pk-playCount-50","metric":"playCount","op":"gte","value":50,"tier":"gold","name":"パニックキング","desc":"50回あそんだしょうこ","icon":"👑"},
  {"id":"pk-playCount-75","metric":"playCount","op":"gte","value":75,"tier":"gold","name":"無双の料理長","desc":"75回もあそんだ！","icon":"🌟"},
  {"id":"pk-playCount-100","metric":"playCount","op":"gte","value":100,"tier":"rainbow","name":"伝説のグランシェフ","desc":"100回あそんだ伝説のあかし","icon":"🏆"},
  {"id":"pk-perfectRounds-1","metric":"perfectRounds","op":"gte","value":1,"tier":"bronze","name":"ピカピカ皿デビュー","desc":"ミスなしで1ラウンドクリアしたよ！","icon":"🍽️"},
  {"id":"pk-perfectRounds-3","metric":"perfectRounds","op":"gte","value":3,"tier":"bronze","name":"きらきら3れんぱ","desc":"ミスなしラウンドを3回きめたよ！","icon":"✨"},
  {"id":"pk-perfectRounds-5","metric":"perfectRounds","op":"gte","value":5,"tier":"bronze","name":"なかよし5ラウンド","desc":"ミスなしラウンドを5回つづけたよ！","icon":"🥄"},
  {"id":"pk-perfectRounds-10","metric":"perfectRounds","op":"gte","value":10,"tier":"silver","name":"ぴったり仕分けマスター","desc":"ミスなしラウンドを10回もクリア！","icon":"🎯"},
  {"id":"pk-perfectRounds-15","metric":"perfectRounds","op":"gte","value":15,"tier":"silver","name":"無敵のキッチンヒーロー","desc":"ミスなしラウンドを15回もきめたよ！","icon":"⚡"},
  {"id":"pk-perfectRounds-20","metric":"perfectRounds","op":"gte","value":20,"tier":"gold","name":"パーフェクト厨房長","desc":"ミスなしラウンドを20回！すごすぎ！","icon":"👑"},
  {"id":"pk-perfectRounds-30","metric":"perfectRounds","op":"gte","value":30,"tier":"gold","name":"ノーミス・スーパースター","desc":"ミスなしラウンドを30回もたっせい！","icon":"🌟"},
  {"id":"pk-perfectRounds-50","metric":"perfectRounds","op":"gte","value":50,"tier":"rainbow","name":"伝説のゴールデンシェフ","desc":"ミスなしラウンド50回！でんせつだ！","icon":"🏆"},
  {"id":"pk-speedStar3-1","metric":"speedStar3","op":"gte","value":1,"tier":"bronze","name":"はじめての手ぎわ","desc":"手ぎわ★3を1回とったらもらえるよ！","icon":"🥄"},
  {"id":"pk-speedStar3-3","metric":"speedStar3","op":"gte","value":3,"tier":"bronze","name":"きらきらコック見習い","desc":"手ぎわ★3を3回とろう！","icon":"🧑‍🍳"},
  {"id":"pk-speedStar3-5","metric":"speedStar3","op":"gte","value":5,"tier":"bronze","name":"てきぱきキッチン係","desc":"手ぎわ★3を5回とろう！","icon":"🍳"},
  {"id":"pk-speedStar3-10","metric":"speedStar3","op":"gte","value":10,"tier":"silver","name":"かがやくスピードシェフ","desc":"手ぎわ★3を10回とったらゲットだ！","icon":"⭐"},
  {"id":"pk-speedStar3-15","metric":"speedStar3","op":"gte","value":15,"tier":"silver","name":"金メダル☆盛りつけ名人","desc":"手ぎわ★3を15回とろう！","icon":"🏅"},
  {"id":"pk-speedStar3-20","metric":"speedStar3","op":"gte","value":20,"tier":"gold","name":"パニックキッチンの達人","desc":"手ぎわ★3を20回もとれたらすごい！","icon":"🔥"},
  {"id":"pk-speedStar3-30","metric":"speedStar3","op":"gte","value":30,"tier":"gold","name":"キッチンの王さまシェフ","desc":"手ぎわ★3を30回とった証だよ！","icon":"👑"},
  {"id":"pk-speedStar3-50","metric":"speedStar3","op":"gte","value":50,"tier":"rainbow","name":"伝説のゴールデンシェフ・改","desc":"手ぎわ★3を50回！みんなのあこがれ！","icon":"🏆"},
  {"id":"pk-accuracyStar3-1","metric":"accuracyStar3","op":"gte","value":1,"tier":"bronze","name":"ピカピカお皿デビュー","desc":"正確さ★3を1回とったらもらえるよ！","icon":"🍽️"},
  {"id":"pk-accuracyStar3-3","metric":"accuracyStar3","op":"gte","value":3,"tier":"bronze","name":"きらきら3れんぱつ","desc":"正確さ★3を3回とってみよう！","icon":"✨"},
  {"id":"pk-accuracyStar3-5","metric":"accuracyStar3","op":"gte","value":5,"tier":"bronze","name":"なかよし仕分けマスター","desc":"正確さ★3を5回とったらゲット！","icon":"🥄"},
  {"id":"pk-accuracyStar3-10","metric":"accuracyStar3","op":"gte","value":10,"tier":"silver","name":"ぴったりキッチンエース","desc":"正確さ★3を10回そろえよう！","icon":"🎯"},
  {"id":"pk-accuracyStar3-15","metric":"accuracyStar3","op":"gte","value":15,"tier":"silver","name":"まんてん厨房ヒーロー","desc":"正確さ★3を15回とった名人だ！","icon":"🍳"},
  {"id":"pk-accuracyStar3-20","metric":"accuracyStar3","op":"gte","value":20,"tier":"gold","name":"かがやく金のフライパン","desc":"正確さ★3を20回！すごすぎる！","icon":"🥇"},
  {"id":"pk-accuracyStar3-30","metric":"accuracyStar3","op":"gte","value":30,"tier":"gold","name":"スーパー仕分け王","desc":"正確さ★3を30回とった王さまだ！","icon":"👑"},
  {"id":"pk-accuracyStar3-50","metric":"accuracyStar3","op":"gte","value":50,"tier":"rainbow","name":"伝説のパーフェクトシェフ","desc":"正確さ★3を50回！でんせつのシェフ！","icon":"🌟"},
  {"id":"pk-bothStar3-1","metric":"bothStar3","op":"gte","value":1,"tier":"bronze","name":"ピカピカ皿デビュー・改","desc":"手ぎわと正確さの★3を1回そろえたよ！","icon":"🍽️"},
  {"id":"pk-bothStar3-2","metric":"bothStar3","op":"gte","value":2,"tier":"bronze","name":"ダブル★3コンビ","desc":"★3ダブルを2回そろえた仕分け名人！","icon":"✨"},
  {"id":"pk-bothStar3-3","metric":"bothStar3","op":"gte","value":3,"tier":"bronze","name":"きらめきトリオシェフ","desc":"★3ダブルを3回もそろえたよ！","icon":"🌟"},
  {"id":"pk-bothStar3-5","metric":"bothStar3","op":"gte","value":5,"tier":"silver","name":"スピード名人バッジ","desc":"★3ダブルを5回もキメたかっこいいコック！","icon":"⚡"},
  {"id":"pk-bothStar3-8","metric":"bothStar3","op":"gte","value":8,"tier":"silver","name":"神わざ厨房マスター","desc":"★3ダブルを8回そろえた達人シェフ！","icon":"🔥"},
  {"id":"pk-bothStar3-12","metric":"bothStar3","op":"gte","value":12,"tier":"gold","name":"きらめきスターシェフ","desc":"★3ダブルを12回そろえたすごいシェフ！","icon":"👨‍🍳"},
  {"id":"pk-bothStar3-20","metric":"bothStar3","op":"gte","value":20,"tier":"gold","name":"パニックキッチン王者","desc":"★3ダブルを20回もそろえた自慢の王者！","icon":"👑"},
  {"id":"pk-bothStar3-30","metric":"bothStar3","op":"gte","value":30,"tier":"rainbow","name":"伝説のダブルレジェンド","desc":"★3ダブルを30回そろえた伝説のシェフ！","icon":"🏆"}
]
