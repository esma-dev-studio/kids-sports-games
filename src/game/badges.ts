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
  bestGaman: number
  totalGoHit: number
  totalGaman: number
  reactionStar3: number
  discernStar3: number
  doubleStar: number
  bestReaction: number // ms（低いほど良い。未達は999999）
}

export const EMPTY_STATS: Stats = {
  playCount: 0, totalScore: 0, bestScore: 0, bestCombo: 0, bestGaman: 0,
  totalGoHit: 0, totalGaman: 0, reactionStar3: 0, discernStar3: 0, doubleStar: 0,
  bestReaction: 999999,
}

/** 1ラウンドの結果を反映して新しいスタッツを返す */
export function accumulate(p: Stats, r: RoundResult): Stats {
  return {
    playCount: p.playCount + 1,
    totalScore: p.totalScore + r.score,
    bestScore: Math.max(p.bestScore, r.score),
    bestCombo: Math.max(p.bestCombo, r.maxCombo),
    bestGaman: Math.max(p.bestGaman, r.maxGaman),
    totalGoHit: p.totalGoHit + r.goHit,
    totalGaman: p.totalGaman + r.nogoResisted,
    reactionStar3: p.reactionStar3 + (r.reactionStars === 3 ? 1 : 0),
    discernStar3: p.discernStar3 + (r.discernStars === 3 ? 1 : 0),
    doubleStar: p.doubleStar + (r.reactionStars === 3 && r.discernStars === 3 ? 1 : 0),
    bestReaction: r.goHit > 0 ? Math.min(p.bestReaction, r.avgReaction) : p.bestReaction,
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
  {"id":"sh-bestScore-50","metric":"bestScore","op":"gte","value":50,"tier":"bronze","name":"ぴかっとデビュー","desc":"1ラウンドで50てんとろう！","icon":"✨"},
  {"id":"sh-bestScore-100","metric":"bestScore","op":"gte","value":100,"tier":"bronze","name":"きらきらルーキー","desc":"1ラウンドで100てんとろう！","icon":"🌟"},
  {"id":"sh-bestScore-200","metric":"bestScore","op":"gte","value":200,"tier":"bronze","name":"すばやさキッズ","desc":"1ラウンドで200てんとろう！","icon":"⚡"},
  {"id":"sh-bestScore-300","metric":"bestScore","op":"gte","value":300,"tier":"bronze","name":"ひかりのなかま","desc":"1ラウンドで300てんとろう！","icon":"💡"},
  {"id":"sh-bestScore-500","metric":"bestScore","op":"gte","value":500,"tier":"silver","name":"がまんマスター","desc":"1ラウンドで500てんとろう！","icon":"🛡️"},
  {"id":"sh-bestScore-800","metric":"bestScore","op":"gte","value":800,"tier":"silver","name":"せんこうハンター","desc":"1ラウンドで800てんとろう！","icon":"🎯"},
  {"id":"sh-bestScore-1200","metric":"bestScore","op":"gte","value":1200,"tier":"gold","name":"かがやきエース","desc":"1ラウンドで1200てんとろう！","icon":"🏅"},
  {"id":"sh-bestScore-1800","metric":"bestScore","op":"gte","value":1800,"tier":"gold","name":"らいめいスター","desc":"1ラウンドで1800てんとろう！","icon":"🌠"},
  {"id":"sh-bestScore-2500","metric":"bestScore","op":"gte","value":2500,"tier":"gold","name":"むてきのヒーロー","desc":"1ラウンドで2500てんとろう！","icon":"🦸"},
  {"id":"sh-bestScore-4000","metric":"bestScore","op":"gte","value":4000,"tier":"rainbow","name":"でんせつのシグナル王","desc":"1ラウンドで4000てんとろう！","icon":"👑"},
  {"id":"sh-totalScore-500","metric":"totalScore","op":"gte","value":500,"tier":"bronze","name":"ピカッと はじめの一歩","desc":"あわせて500点あつめたよ！","icon":"✨"},
  {"id":"sh-totalScore-1500","metric":"totalScore","op":"gte","value":1500,"tier":"bronze","name":"きらきら 見習いヒーロー","desc":"あわせて1500点になったね！","icon":"🌟"},
  {"id":"sh-totalScore-3000","metric":"totalScore","op":"gte","value":3000,"tier":"bronze","name":"ひかりの タッチ名人","desc":"あわせて3000点とったよ！","icon":"💫"},
  {"id":"sh-totalScore-6000","metric":"totalScore","op":"gte","value":6000,"tier":"silver","name":"かがやく シグナル戦士","desc":"あわせて6000点までがんばった！","icon":"⚡"},
  {"id":"sh-totalScore-10000","metric":"totalScore","op":"gte","value":10000,"tier":"silver","name":"コートの守護者","desc":"あわせて10000点とうたつ！","icon":"🛡️"},
  {"id":"sh-totalScore-20000","metric":"totalScore","op":"gte","value":20000,"tier":"gold","name":"光速マスター","desc":"あわせて20000点のすごワザ！","icon":"🚀"},
  {"id":"sh-totalScore-40000","metric":"totalScore","op":"gte","value":40000,"tier":"gold","name":"無敵のシグナルキング","desc":"あわせて40000点だいきろく！","icon":"👑"},
  {"id":"sh-totalScore-80000","metric":"totalScore","op":"gte","value":80000,"tier":"rainbow","name":"伝説のヒカリ神","desc":"あわせて80000点！でんせつたっせい！","icon":"🌈"},
  {"id":"sh-bestCombo-3","metric":"bestCombo","op":"gte","value":3,"tier":"bronze","name":"はじめてのコンボ","desc":"3れんぞくで ○をタッチしたら もらえるよ","icon":"✨"},
  {"id":"sh-bestCombo-5","metric":"bestCombo","op":"gte","value":5,"tier":"bronze","name":"ぴかぴかリズム","desc":"5れんぞくで ○をタッチしよう","icon":"🎵"},
  {"id":"sh-bestCombo-8","metric":"bestCombo","op":"gte","value":8,"tier":"bronze","name":"とまらないタッチ","desc":"8れんぞく ○にさわりつづけよう","icon":"👆"},
  {"id":"sh-bestCombo-12","metric":"bestCombo","op":"gte","value":12,"tier":"bronze","name":"きらめきチェイン","desc":"12れんぞく つなげてみよう","icon":"🔗"},
  {"id":"sh-bestCombo-16","metric":"bestCombo","op":"gte","value":16,"tier":"silver","name":"いなずまダッシュ","desc":"16れんぞく びゅんびゅんタッチ","icon":"⚡"},
  {"id":"sh-bestCombo-20","metric":"bestCombo","op":"gte","value":20,"tier":"silver","name":"コンボマスター","desc":"20れんぞく ミスなしですごい","icon":"🎯"},
  {"id":"sh-bestCombo-25","metric":"bestCombo","op":"gte","value":25,"tier":"gold","name":"かがやきロケット","desc":"25れんぞく そらまでとんでけ","icon":"🚀"},
  {"id":"sh-bestCombo-30","metric":"bestCombo","op":"gte","value":30,"tier":"gold","name":"ほのおのコンボ","desc":"30れんぞく もえあがるスピード","icon":"🔥"},
  {"id":"sh-bestCombo-40","metric":"bestCombo","op":"gte","value":40,"tier":"gold","name":"スーパーノヴァ","desc":"40れんぞく ほしがばくはつ","icon":"💥"},
  {"id":"sh-bestCombo-50","metric":"bestCombo","op":"gte","value":50,"tier":"rainbow","name":"でんせつのシグナル王・改","desc":"50れんぞく だれもかなわない でんせつ","icon":"👑"},
  {"id":"sh-bestGaman-2","metric":"bestGaman","op":"gte","value":2,"tier":"bronze","name":"がまんの め","desc":"ニセ光を2回れんぞくでがまんできたよ！","icon":"🌱"},
  {"id":"sh-bestGaman-4","metric":"bestGaman","op":"gte","value":4,"tier":"bronze","name":"ぐっとこらえ隊","desc":"×を4回つづけて、さわらずがまん！","icon":"🙊"},
  {"id":"sh-bestGaman-6","metric":"bestGaman","op":"gte","value":6,"tier":"bronze","name":"しんぼうマスター","desc":"6回れんぞくでニセ光をスルーできた！","icon":"🛡️"},
  {"id":"sh-bestGaman-8","metric":"bestGaman","op":"gte","value":8,"tier":"bronze","name":"おちつきチャンプ","desc":"8回もあわてず、ぐっとがまん！","icon":"🧘"},
  {"id":"sh-bestGaman-10","metric":"bestGaman","op":"gte","value":10,"tier":"silver","name":"てつのこころ","desc":"10回れんぞく！こころがブレないヒーロー！","icon":"💪"},
  {"id":"sh-bestGaman-13","metric":"bestGaman","op":"gte","value":13,"tier":"silver","name":"しずかなる守護者","desc":"13回もがまんできる、しずかな強さ！","icon":"🌊"},
  {"id":"sh-bestGaman-16","metric":"bestGaman","op":"gte","value":16,"tier":"gold","name":"ぜったいブレない王","desc":"16回れんぞく！だれにもマネできない！","icon":"👑"},
  {"id":"sh-bestGaman-20","metric":"bestGaman","op":"gte","value":20,"tier":"gold","name":"がまんの げんし超え","desc":"20回れんぞく！げんかいをこえたヒーロー！","icon":"⚡"},
  {"id":"sh-bestGaman-25","metric":"bestGaman","op":"gte","value":25,"tier":"gold","name":"こおりのつよさマスター","desc":"25回れんぞく！こおりみたいにブレない心！","icon":"❄️"},
  {"id":"sh-bestGaman-30","metric":"bestGaman","op":"gte","value":30,"tier":"rainbow","name":"でんせつの不動シグナル","desc":"30回れんぞく！だれもとどかない伝説の域！","icon":"🐉"},
  {"id":"sh-playCount-1","metric":"playCount","op":"gte","value":1,"tier":"bronze","name":"はじめの ひかり","desc":"1かい あそべば もらえるよ！","icon":"✨"},
  {"id":"sh-playCount-3","metric":"playCount","op":"gte","value":3,"tier":"bronze","name":"ぴかっと 3れんぱつ","desc":"3かい あそぼう！","icon":"🌟"},
  {"id":"sh-playCount-5","metric":"playCount","op":"gte","value":5,"tier":"bronze","name":"ヒカリの たまご","desc":"5かい あそべば ゲット！","icon":"🥚"},
  {"id":"sh-playCount-10","metric":"playCount","op":"gte","value":10,"tier":"bronze","name":"きらきら たんけんたい","desc":"10かい あそんでみよう！","icon":"🔦"},
  {"id":"sh-playCount-15","metric":"playCount","op":"gte","value":15,"tier":"silver","name":"スピード ハンター","desc":"15かい あそべば もらえる！","icon":"⚡"},
  {"id":"sh-playCount-20","metric":"playCount","op":"gte","value":20,"tier":"silver","name":"がまん マスター","desc":"20かい あそんで つよくなろう！","icon":"🛡️"},
  {"id":"sh-playCount-30","metric":"playCount","op":"gte","value":30,"tier":"gold","name":"シグナルの さいだいの ちから","desc":"30かい あそんだ しょうこ！","icon":"🚀"},
  {"id":"sh-playCount-50","metric":"playCount","op":"gte","value":50,"tier":"gold","name":"ひかりの まもりびと","desc":"50かい あそべば えいゆうに！","icon":"🦸"},
  {"id":"sh-playCount-75","metric":"playCount","op":"gte","value":75,"tier":"gold","name":"コートの しはいしゃ","desc":"75かい あそんだ つわもの！","icon":"👑"},
  {"id":"sh-playCount-100","metric":"playCount","op":"gte","value":100,"tier":"rainbow","name":"でんせつの シグナル・ヒーロー","desc":"100かい あそんだ でんせつ！","icon":"🏆"},
  {"id":"sh-totalGoHit-20","metric":"totalGoHit","op":"gte","value":20,"tier":"bronze","name":"ぴかり はじめてタッチ","desc":"みかたの光を あわせて20回タッチしたよ！","icon":"✨"},
  {"id":"sh-totalGoHit-50","metric":"totalGoHit","op":"gte","value":50,"tier":"bronze","name":"きらきら おてつだい","desc":"みかたの光を あわせて50回タッチできたね！","icon":"🌟"},
  {"id":"sh-totalGoHit-100","metric":"totalGoHit","op":"gte","value":100,"tier":"bronze","name":"にこにこ タッチっこ","desc":"みかたの光を あわせて100回タッチ！すごい！","icon":"😊"},
  {"id":"sh-totalGoHit-200","metric":"totalGoHit","op":"gte","value":200,"tier":"bronze","name":"ぽかぽか なかまマスター","desc":"みかたの光を あわせて200回タッチしたよ！","icon":"🌈"},
  {"id":"sh-totalGoHit-400","metric":"totalGoHit","op":"gte","value":400,"tier":"silver","name":"びゅん！すばやヒーロー","desc":"みかたの光を あわせて400回タッチ！はやいね！","icon":"⚡"},
  {"id":"sh-totalGoHit-700","metric":"totalGoHit","op":"gte","value":700,"tier":"silver","name":"かがやく タッチ名人","desc":"みかたの光を あわせて700回タッチできたよ！","icon":"🔥"},
  {"id":"sh-totalGoHit-1000","metric":"totalGoHit","op":"gte","value":1000,"tier":"gold","name":"きらめきチャンピオン","desc":"みかたの光を あわせて1000回タッチ！チャンピオンだ！","icon":"🏆"},
  {"id":"sh-totalGoHit-1500","metric":"totalGoHit","op":"gte","value":1500,"tier":"gold","name":"光のエースヒーロー","desc":"みかたの光を あわせて1500回タッチ！エースだね！","icon":"💫"},
  {"id":"sh-totalGoHit-2500","metric":"totalGoHit","op":"gte","value":2500,"tier":"gold","name":"せんこう スーパースター","desc":"みかたの光を あわせて2500回タッチ！スターだ！","icon":"⭐"},
  {"id":"sh-totalGoHit-4000","metric":"totalGoHit","op":"gte","value":4000,"tier":"rainbow","name":"でんせつの ひかりの王","desc":"みかたの光を あわせて4000回タッチ！でんせつだ！","icon":"👑"},
  {"id":"sh-totalGaman-10","metric":"totalGaman","op":"gte","value":10,"tier":"bronze","name":"はじめてのがまん","desc":"ニセ光を あわせて 10かい がまんできた！","icon":"🌱"},
  {"id":"sh-totalGaman-25","metric":"totalGaman","op":"gte","value":25,"tier":"bronze","name":"がまんのめばえ","desc":"ニセ光を あわせて 25かい がまんできた！","icon":"🍀"},
  {"id":"sh-totalGaman-50","metric":"totalGaman","op":"gte","value":50,"tier":"bronze","name":"おちつきマスター","desc":"ニセ光を あわせて 50かい がまんできた！","icon":"😌"},
  {"id":"sh-totalGaman-100","metric":"totalGaman","op":"gte","value":100,"tier":"bronze","name":"ぐっとこらえ隊・改","desc":"ニセ光を あわせて 100かい がまんできた！","icon":"✋"},
  {"id":"sh-totalGaman-200","metric":"totalGaman","op":"gte","value":200,"tier":"silver","name":"がまんの騎士","desc":"ニセ光を あわせて 200かい がまんできた！","icon":"🛡️"},
  {"id":"sh-totalGaman-350","metric":"totalGaman","op":"gte","value":350,"tier":"silver","name":"しんぼうの達人","desc":"ニセ光を あわせて 350かい がまんできた！","icon":"🧘"},
  {"id":"sh-totalGaman-550","metric":"totalGaman","op":"gte","value":550,"tier":"gold","name":"鉄の心のヒーロー","desc":"ニセ光を あわせて 550かい がまんできた！","icon":"💪"},
  {"id":"sh-totalGaman-800","metric":"totalGaman","op":"gte","value":800,"tier":"gold","name":"動じない王さま","desc":"ニセ光を あわせて 800かい がまんできた！","icon":"👑"},
  {"id":"sh-totalGaman-1200","metric":"totalGaman","op":"gte","value":1200,"tier":"gold","name":"不動のガーディアン","desc":"ニセ光を あわせて 1200かい がまんできた！","icon":"🗿"},
  {"id":"sh-totalGaman-2000","metric":"totalGaman","op":"gte","value":2000,"tier":"rainbow","name":"伝説のがまん神","desc":"ニセ光を あわせて 2000かい がまんできた！","icon":"🌟"},
  {"id":"sh-reactionStar3-1","metric":"reactionStar3","op":"gte","value":1,"tier":"bronze","name":"ピカッとデビュー","desc":"反応の速さ★3を1回とったよ！","icon":"✨"},
  {"id":"sh-reactionStar3-3","metric":"reactionStar3","op":"gte","value":3,"tier":"bronze","name":"きらめき3れんぱつ","desc":"反応の速さ★3を3回だせたね","icon":"🌟"},
  {"id":"sh-reactionStar3-5","metric":"reactionStar3","op":"gte","value":5,"tier":"bronze","name":"はやおしマスター","desc":"反応の速さ★3を5回きめたよ","icon":"⚡"},
  {"id":"sh-reactionStar3-10","metric":"reactionStar3","op":"gte","value":10,"tier":"silver","name":"いなずまタッチ王","desc":"反応の速さ★3を10回もタッチ！","icon":"👑"},
  {"id":"sh-reactionStar3-15","metric":"reactionStar3","op":"gte","value":15,"tier":"silver","name":"ソニックフィンガー","desc":"反応の速さ★3を15回！ゆびが音速だ","icon":"💨"},
  {"id":"sh-reactionStar3-20","metric":"reactionStar3","op":"gte","value":20,"tier":"gold","name":"ひかりのしっぷう隊長","desc":"反応の速さ★3を20回！かぜのように速い","icon":"🚀"},
  {"id":"sh-reactionStar3-30","metric":"reactionStar3","op":"gte","value":30,"tier":"gold","name":"光速シグナルヒーロー","desc":"反応の速さ★3を30回！ヒーローの証","icon":"🦸"},
  {"id":"sh-reactionStar3-50","metric":"reactionStar3","op":"gte","value":50,"tier":"rainbow","name":"でんこう伝説オーラ","desc":"反応の速さ★3を50回！でんせつの反射神経","icon":"🏆"},
  {"id":"sh-discernStar3-1","metric":"discernStar3","op":"gte","value":1,"tier":"bronze","name":"はじめてのキラリ","desc":"見きわめ★3を1回とってみよう！","icon":"✨"},
  {"id":"sh-discernStar3-3","metric":"discernStar3","op":"gte","value":3,"tier":"bronze","name":"見きわめミニマスター","desc":"見きわめ★3を3回あつめよう！","icon":"🌟"},
  {"id":"sh-discernStar3-5","metric":"discernStar3","op":"gte","value":5,"tier":"bronze","name":"キラリ名人","desc":"見きわめ★3を5回あつめよう！","icon":"🔎"},
  {"id":"sh-discernStar3-10","metric":"discernStar3","op":"gte","value":10,"tier":"silver","name":"光のみはりばん","desc":"見きわめ★3を10回とったらゲット！","icon":"👁️"},
  {"id":"sh-discernStar3-15","metric":"discernStar3","op":"gte","value":15,"tier":"silver","name":"するどい目のヒーロー","desc":"見きわめ★3を15回とったらゲット！","icon":"🦅"},
  {"id":"sh-discernStar3-20","metric":"discernStar3","op":"gte","value":20,"tier":"gold","name":"見きわめマスター","desc":"見きわめ★3を20回あつめたしるし！","icon":"🏅"},
  {"id":"sh-discernStar3-30","metric":"discernStar3","op":"gte","value":30,"tier":"gold","name":"きらめきチャンピオン・改","desc":"見きわめ★3を30回あつめた王さま！","icon":"👑"},
  {"id":"sh-discernStar3-50","metric":"discernStar3","op":"gte","value":50,"tier":"rainbow","name":"伝説の見きわめの瞳","desc":"見きわめ★3を50回！でんせつのしるし！","icon":"💎"},
  {"id":"sh-doubleStar-1","metric":"doubleStar","op":"gte","value":1,"tier":"bronze","name":"ダブル☆デビュー","desc":"反応と見きわめの★3を、おなじラウンドで両方そろえたら1回でゲット！","icon":"✨"},
  {"id":"sh-doubleStar-2","metric":"doubleStar","op":"gte","value":2,"tier":"bronze","name":"きらきらペア","desc":"両方★3のラウンドを2回そろえるとキラリ！","icon":"🌟"},
  {"id":"sh-doubleStar-3","metric":"doubleStar","op":"gte","value":3,"tier":"bronze","name":"なかよしツイン","desc":"両方★3のラウンドを3回そろえたらもらえるよ","icon":"💫"},
  {"id":"sh-doubleStar-5","metric":"doubleStar","op":"gte","value":5,"tier":"silver","name":"ダブルスター☆マスター","desc":"両方★3のラウンドを5回そろえたしょうこ！","icon":"⭐"},
  {"id":"sh-doubleStar-8","metric":"doubleStar","op":"gte","value":8,"tier":"silver","name":"かがやきコンビ","desc":"両方★3のラウンドを8回もそろえた光の達人","icon":"🌠"},
  {"id":"sh-doubleStar-12","metric":"doubleStar","op":"gte","value":12,"tier":"gold","name":"きせきのWスター","desc":"両方★3のラウンドを12回そろえたすごいキミへ","icon":"🏆"},
  {"id":"sh-doubleStar-20","metric":"doubleStar","op":"gte","value":20,"tier":"gold","name":"ぜんぶ★3の星帝","desc":"両方★3のラウンドを20回そろえた星のおうさま","icon":"👑"},
  {"id":"sh-doubleStar-30","metric":"doubleStar","op":"gte","value":30,"tier":"rainbow","name":"伝説のダブルギャラクシー","desc":"両方★3のラウンドを30回そろえた伝説のヒーロー！","icon":"🌌"},
  {"id":"sh-bestReaction-800","metric":"bestReaction","op":"lte","value":800,"tier":"bronze","name":"ぴかっとルーキー","desc":"へいきん800ミリびょういかでタッチできたらもらえるよ","icon":"🌱"},
  {"id":"sh-bestReaction-700","metric":"bestReaction","op":"lte","value":700,"tier":"bronze","name":"きらりんスター","desc":"へいきん700ミリびょういか！ちょっとはやくなったね","icon":"⭐"},
  {"id":"sh-bestReaction-600","metric":"bestReaction","op":"lte","value":600,"tier":"bronze","name":"ひかりのなかよし","desc":"へいきん600ミリびょういかでみかたの光とおともだち","icon":"💛"},
  {"id":"sh-bestReaction-520","metric":"bestReaction","op":"lte","value":520,"tier":"silver","name":"でんこうクロス","desc":"へいきん520ミリびょういか！かっこよくきめよう","icon":"⚡"},
  {"id":"sh-bestReaction-460","metric":"bestReaction","op":"lte","value":460,"tier":"silver","name":"しっぷうハンター","desc":"へいきん460ミリびょういか！かぜみたいにはやい","icon":"🌪️"},
  {"id":"sh-bestReaction-400","metric":"bestReaction","op":"lte","value":400,"tier":"gold","name":"ソニックエース","desc":"へいきん400ミリびょういか！おとよりはやいかも","icon":"🚀"},
  {"id":"sh-bestReaction-360","metric":"bestReaction","op":"lte","value":360,"tier":"gold","name":"いなずまマスター","desc":"へいきん360ミリびょういか！いなずまきゅうのてさばき","icon":"🔥"},
  {"id":"sh-bestReaction-320","metric":"bestReaction","op":"lte","value":320,"tier":"rainbow","name":"でんせつのシグナル神","desc":"へいきん320ミリびょういか！だれもかなわないでんせつ","icon":"👑"}
]
