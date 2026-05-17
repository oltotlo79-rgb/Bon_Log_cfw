/**
 * 日本の地方・都道府県データ
 *
 * 盆栽園の絞り込み検索で使用
 */

/**
 * 地方の型定義
 */
export interface Region {
  id: string
  name: string
  prefectures: string[]
}

/**
 * 都道府県一覧（北から南の順）
 */
export const PREFECTURES = [
  '北海道',
  '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県',
  '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
] as const

/**
 * 地方データ（北から南の順）
 */
export const REGIONS: Region[] = [
  {
    id: 'hokkaido-tohoku',
    name: '北海道・東北',
    prefectures: ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
  },
  {
    id: 'kanto',
    name: '関東',
    prefectures: ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'],
  },
  {
    id: 'chubu',
    name: '中部',
    prefectures: ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'],
  },
  {
    id: 'kinki',
    name: '近畿',
    prefectures: ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
  },
  {
    id: 'chugoku',
    name: '中国',
    prefectures: ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
  },
  {
    id: 'shikoku',
    name: '四国',
    prefectures: ['徳島県', '香川県', '愛媛県', '高知県'],
  },
  {
    id: 'kyushu-okinawa',
    name: '九州・沖縄',
    prefectures: ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'],
  },
]

/**
 * 住所から都道府県を抽出
 * @param address - 住所文字列
 * @returns 都道府県名、見つからない場合はnull
 */
export function extractPrefecture(address: string): string | null {
  for (const pref of PREFECTURES) {
    if (address.startsWith(pref)) {
      return pref
    }
  }
  return null
}

/**
 * 都道府県から地方を取得
 * @param prefecture - 都道府県名
 * @returns 地方オブジェクト、見つからない場合はnull
 */
export function getRegionByPrefecture(prefecture: string): Region | null {
  return REGIONS.find(region => region.prefectures.includes(prefecture)) || null
}

/**
 * 地方IDから地方を取得
 * @param regionId - 地方ID
 * @returns 地方オブジェクト、見つからない場合はnull
 */
export function getRegionById(regionId: string): Region | null {
  return REGIONS.find(region => region.id === regionId) || null
}

/**
 * 都道府県の型（リテラル型）
 */
export type Prefecture = typeof PREFECTURES[number]

/**
 * 地方ブロックと所属都道府県のマッピング（イベント検索用）
 */
export const REGION_MAP = {
  '北海道': ['北海道'],
  '東北': ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
  '関東': ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'],
  '中部': ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'],
  '近畿': ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
  '中国': ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
  '四国': ['徳島県', '香川県', '愛媛県', '高知県'],
  '九州・沖縄': ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'],
} as const

/**
 * 地方ブロック名の型
 */
export type RegionName = keyof typeof REGION_MAP

/**
 * 任意の文字列が {@link RegionName} かを判定する型ガード。
 * フォーム入力など untrusted な値を安全に絞り込むために使用する。
 */
export function isRegionName(value: unknown): value is RegionName {
  return typeof value === 'string' && value in REGION_MAP
}

/**
 * 地方ブロック名の配列。
 * `Object.keys` の戻り値は `string[]` なので、`isRegionName` 型ガードで narrowing する。
 */
export const REGION_NAME_LIST: readonly RegionName[] = Object.keys(REGION_MAP).filter(isRegionName)

/**
 * 地方ブロックから都道府県リストを取得
 */
export function getPrefecturesByRegion(region: RegionName): string[] {
  const prefectures = REGION_MAP[region]
  return prefectures ? [...prefectures] : []
}

/**
 * 都道府県から地方ブロック名を取得
 */
export function getRegionNameByPrefecture(prefecture: string): RegionName | null {
  for (const [region, prefectures] of Object.entries(REGION_MAP)) {
    // `as const` 由来の tuple 型は includes 引数を tuple 要素型に絞り込むため、
    // 任意 string を検索するには readonly string[] にウィデンする必要がある。
    const list: readonly string[] = prefectures
    if (list.includes(prefecture) && isRegionName(region)) {
      return region
    }
  }
  return null
}
