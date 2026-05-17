/**
 * 生成済み挿絵・イラストの定数
 *
 * `docs/plans/illustration-generation-plan-2026-04-16.md` 計画により生成された
 * 74枚（37ペア）のライト/ダーク画像のパス・属性・代替テキストを集約する。
 *
 * CLAUDE.md ルール#7（マジックナンバー禁止）および ルール#8（any禁止）に準拠。
 * すべての値は `as const` で固定し、動的文字列連結を行わない。
 *
 * @module lib/constants/images
 */

/** ライト/ダーク画像のペア */
export type ThemedImagePair = {
  readonly light: string
  readonly dark: string
}

/** 生成済み画像の配置ルート（`public/` 配下） */
export const GENERATED_IMAGE_ROOT = '/images/generated' as const

/**
 * コンテナの aspect-ratio ユーティリティクラス。
 * 画像の物理アスペクト比と必ず一致させること（引き延ばし・空白帯防止）。
 */
export const IMAGE_ASPECT = {
  /** 21:9（1260x540） — ページヘッダー帯 */
  HEADER: 'aspect-[21/9]',
  /** 16:9（1280x720） — セクション挿絵 */
  SECTION: 'aspect-video',
  /** 1:1（800x800） — カードサムネイル */
  CARD: 'aspect-square',
} as const

/** IMAGE_ASPECT の値型 */
export type ImageAspectClass = (typeof IMAGE_ASPECT)[keyof typeof IMAGE_ASPECT]

/**
 * 画像の実解像度。
 * `metadata.openGraph.images[].width/height` で使用。
 */
export const IMAGE_DIMENSIONS = {
  HEADER: { width: 1260, height: 540 },
  SECTION: { width: 1280, height: 720 },
  CARD: { width: 800, height: 800 },
} as const

/** `next/image` の sizes 属性（ブラウザへのヒント） */
export const IMAGE_SIZES = {
  HEADER: '(max-width: 768px) 100vw, 1200px',
  SECTION: '(max-width: 768px) 100vw, 800px',
  CARD: '(max-width: 768px) 50vw, 300px',
} as const

/** IMAGE_SIZES の値型 */
export type ImageSizesValue = (typeof IMAGE_SIZES)[keyof typeof IMAGE_SIZES]

/**
 * サブディレクトリとベース名からライト/ダークペアを生成。
 * 外部公開せず、このファイル内の定義でのみ利用する。
 */
const pair = (subdir: string, basename: string): ThemedImagePair => ({
  light: `${GENERATED_IMAGE_ROOT}/${subdir}/${basename}.webp`,
  dark: `${GENERATED_IMAGE_ROOT}/${subdir}/${basename}-dark.webp`,
})

/** 肥料ページ（/fertilizers）系統のライト/ダーク画像ペア */
export const FERTILIZER_IMAGES = {
  header: pair('fertilizers', 'header-fertilizer'),
  seasonalSpring: pair('fertilizers', 'seasonal-spring'),
  seasonalSummer: pair('fertilizers', 'seasonal-summer'),
  seasonalAutumn: pair('fertilizers', 'seasonal-autumn'),
  seasonalWinter: pair('fertilizers', 'seasonal-winter'),
  nutrientNpk: pair('fertilizers', 'nutrient-npk'),
  nutrientSecondary: pair('fertilizers', 'nutrient-secondary'),
  categoryOrganic: pair('fertilizers', 'category-organic'),
  categoryChemical: pair('fertilizers', 'category-chemical'),
  categoryLiquid: pair('fertilizers', 'category-liquid'),
  scheduleConifer: pair('fertilizers', 'schedule-conifer'),
  scheduleDeciduous: pair('fertilizers', 'schedule-deciduous'),
} as const

/** ホルモンページ（/hormones）系統のライト/ダーク画像ペア */
export const HORMONE_IMAGES = {
  header: pair('hormones', 'header-hormone'),
  hormoneAuxin: pair('hormones', 'hormone-auxin'),
  hormoneGibberellin: pair('hormones', 'hormone-gibberellin'),
  hormoneCytokinin: pair('hormones', 'hormone-cytokinin'),
  hormoneAbscisic: pair('hormones', 'hormone-abscisic'),
  hormoneEthylene: pair('hormones', 'hormone-ethylene'),
  techniquePinching: pair('hormones', 'technique-pinching'),
  techniquePruning: pair('hormones', 'technique-pruning'),
  techniqueWiring: pair('hormones', 'technique-wiring'),
  interactionNetwork: pair('hormones', 'interaction-network'),
  calendarSeasons: pair('hormones', 'calendar-seasons'),
} as const

/** 薬剤ページ（/pesticides）系統のライト/ダーク画像ペア */
export const PESTICIDE_IMAGES = {
  header: pair('pesticides', 'header-pesticide'),
  formulationEmulsion: pair('pesticides', 'formulation-emulsion'),
  formulationPowder: pair('pesticides', 'formulation-powder'),
  formulationGranule: pair('pesticides', 'formulation-granule'),
  applicationSpray: pair('pesticides', 'application-spray'),
  applicationSoil: pair('pesticides', 'application-soil'),
  ingredientOverview: pair('pesticides', 'ingredient-overview'),
  spreaderOverview: pair('pesticides', 'spreader-overview'),
} as const

/** 病害虫ページ（/pesticides/diseases-pests）系統のライト/ダーク画像ペア */
export const DISEASES_PESTS_IMAGES = {
  header: pair('diseases-pests', 'header-diseases-pests'),
  lifecycleInsect: pair('diseases-pests', 'lifecycle-insect'),
  symptomFungal: pair('diseases-pests', 'symptom-fungal'),
  symptomBacterial: pair('diseases-pests', 'symptom-bacterial'),
  beneficialInsects: pair('diseases-pests', 'beneficial-insects'),
  preventionOverview: pair('diseases-pests', 'prevention-overview'),
} as const

/**
 * 挿絵の代替テキスト（将来の i18n 対応を見据えて集約）。
 * - 空文字 alt は禁止（計画の全画像は意味を持つ）
 * - スクリーンリーダーで読み上げて自然な日本語を使う
 */
export const IMAGE_ALT = {
  // 肥料
  fertilizerHeader: '施肥ガイド — 盆栽と施肥道具の墨絵イラスト',
  seasonalSpring: '春の施肥 — 新芽と有機肥料ペレット',
  seasonalSummer: '夏の施肥 — 夏の直射日光を受ける盆栽',
  seasonalAutumn: '秋の施肥 — 紅葉する楓と置き肥',
  seasonalWinter: '冬の施肥 — 休眠期の裸木と雪景色',
  nutrientNpk: '三大栄養素 — 窒素・リン酸・カリウムを象徴する盆栽',
  nutrientSecondary: '二次栄養素 — 盆栽の根と土壌断面',
  categoryOrganic: '有機肥料 — 油かす・骨粉・魚粉',
  categoryChemical: '化成肥料 — 整然と並んだ化学肥料の粒',
  categoryLiquid: '液体肥料 — 如雨露から注がれる液肥',
  scheduleConifer: '松柏類の施肥スケジュール — 黒松盆栽',
  scheduleDeciduous: '雑木類の施肥スケジュール — 欅の箒立ち',
  // ホルモン
  hormoneHeader: '植物ホルモンの概要 — 盆栽に流れる成長エネルギー',
  hormoneAuxin: 'オーキシン — 光に向かって成長する芽',
  hormoneGibberellin: 'ジベレリン — 節間伸長と開花の象徴',
  hormoneCytokinin: 'サイトカイニン — 摘芯後の側芽分化',
  hormoneAbscisic: 'アブシジン酸 — 落葉と休眠',
  hormoneEthylene: 'エチレン — 果実の成熟',
  techniquePinching: '摘芯 — 芽摘みの瞬間と側芽分化',
  techniquePruning: '剪定 — 鋏による精密な切断',
  techniqueWiring: '針金掛け — 銅線で整形される枝',
  interactionNetwork: '植物ホルモン相互作用ネットワーク',
  calendarSeasons: '年間ホルモン活性カレンダー — 四季の盆栽',
  // 薬剤
  pesticideHeader: '薬剤ガイド — 健康な盆栽と噴霧器',
  formulationEmulsion: '乳剤・液剤 — 計量カップで希釈',
  formulationPowder: '水和剤・粉剤 — 白い粉末と計量スプーン',
  formulationGranule: '粒剤 — 土に散布される粒',
  applicationSpray: '葉面散布 — 葉に霧がかかる瞬間',
  applicationSoil: '土壌灌注 — 鉢土への薬剤浸透',
  ingredientOverview: '有効成分 — 化学構造と植物生理',
  spreaderOverview: '展着剤 — 葉面への均一展開',
  // 病害虫
  diseasesPestsHeader: '病害虫図鑑 — ルーペで観察する盆栽',
  lifecycleInsect: '害虫のライフサイクル — カイガラムシの発育段階',
  symptomFungal: '糸状菌病害 — 葉の変色の進行',
  symptomBacterial: '細菌性病害 — 水浸状病斑と維管束変色',
  beneficialInsects: '益虫 — 天敵となる昆虫たち',
  preventionOverview: '予防と総合管理 — 整頓された盆栽棚',
} as const

/** IMAGE_ALT のキー型 */
export type ImageAltKey = keyof typeof IMAGE_ALT
