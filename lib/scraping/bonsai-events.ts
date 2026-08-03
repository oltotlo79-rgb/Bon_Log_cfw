/**
 * bonsai.co.jp イベントスクレイピングユーティリティ
 *
 * 外部サイト（bonsai.co.jp）からイベント情報を取得し、
 * アプリのイベント形式に変換する
 */

import logger from '@/lib/logger'
import {
  SCRAPING_DELAY_MS,
  MAX_EVENT_TITLE_LENGTH,
  MAX_EVENT_DESCRIPTION_LENGTH,
  MAX_EVENT_FIELD_LENGTH,
} from '@/lib/constants/limits'

/**
 * スクレイピング対象の地方とURL
 */
export const BONSAI_EVENT_SOURCES = [
  { region: '北海道', url: 'https://www.bonsai.co.jp/event/event_category/hokkaido/', prefectures: ['北海道'] },
  { region: '東北', url: 'https://www.bonsai.co.jp/event/event_category/tohoku/', prefectures: ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'] },
  { region: '関東', url: 'https://www.bonsai.co.jp/event/event_category/kanto/', prefectures: ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'] },
  { region: '信越', url: 'https://www.bonsai.co.jp/event/event_category/shinetsu/', prefectures: ['新潟県', '長野県'] },
  { region: '北陸', url: 'https://www.bonsai.co.jp/event/event_category/hokuriku/', prefectures: ['富山県', '石川県', '福井県'] },
  { region: '東海', url: 'https://www.bonsai.co.jp/event/event_category/tokai/', prefectures: ['岐阜県', '静岡県', '愛知県', '三重県'] },
  { region: '近畿', url: 'https://www.bonsai.co.jp/event/event_category/kinki/', prefectures: ['滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'] },
  { region: '中国', url: 'https://www.bonsai.co.jp/event/event_category/chugoku/', prefectures: ['鳥取県', '島根県', '岡山県', '広島県', '山口県'] },
  { region: '四国', url: 'https://www.bonsai.co.jp/event/event_category/shikoku/', prefectures: ['徳島県', '香川県', '愛媛県', '高知県'] },
  { region: '九州', url: 'https://www.bonsai.co.jp/event/event_category/kyusyu/', prefectures: ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'] },
] as const

/**
 * スクレイピングで取得したイベントの型
 */
export interface ScrapedEvent {
  /** イベント名 */
  title: string
  /** 開始日 */
  startDate: Date | null
  /** 終了日 */
  endDate: Date | null
  /** 都道府県 */
  prefecture: string | null
  /** 市区町村 */
  city: string | null
  /** 会場名 */
  venue: string | null
  /** 主催者 */
  organizer: string | null
  /** 入場料 */
  admissionFee: string | null
  /** 即売あり */
  hasSales: boolean
  /** 説明文（元のテキスト全体） */
  description: string
  /** 外部URL（詳細ページ） */
  externalUrl: string | null
  /** 取得元地方 */
  sourceRegion: string
  /** 取得元URL */
  sourceUrl: string
}

/** 文字列を指定文字数までクリップする（外部サイト由来の長文入力への保護的上限）。 */
function clipToLength(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

/** null 許容フィールド向けの {@link clipToLength}。 */
function clipNullableToLength(value: string | null, maxLength: number): string | null {
  return value === null ? null : clipToLength(value, maxLength)
}

/**
 * HTMLからイベント情報を抽出
 */
function parseEventFromHtml(html: string, sourceRegion: string, sourceUrl: string, prefectures: readonly string[]): ScrapedEvent[] {
  const events: ScrapedEvent[] = []

  // イベントブロックを抽出（event_areaクラス）
  // 実際のHTML構造: <div class="event_area"><span>タイトル</span><p>内容</p><a class="base" href="..."></a></div>
  const eventBlockRegex = /<div[^>]*class="[^"]*event_area[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
  let match

  while ((match = eventBlockRegex.exec(html)) !== null) {
    const block = match[0]

    // タイトル抽出（<span>タグ内）
    const titleMatch = block.match(/<span[^>]*>([\s\S]*?)<\/span>/)
    let title = titleMatch?.[1]?.replace(/<[^>]*>/g, '').trim() ?? ''
    // ●や◆などの記号を除去
    title = title.replace(/^[●◆◇■□▲△▼▽★☆○◎]+\s*/, '')

    if (!title) continue

    // コンテンツ抽出（<p>タグ内）
    const contentMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/)
    let content = contentMatch?.[1]?.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() ?? ''
    // 電話番号のHTMLエンティティと電話番号を除去
    content = content.replace(/&#x260e;/gi, '').replace(/☎/g, '').replace(/[\d０-９]{2,4}[－\-ー（）\(\)]*[\d０-９]{2,4}[－\-ー]*[\d０-９]{3,4}/g, '').replace(/\s+/g, ' ').trim()

    // 詳細リンク抽出（<a class="base">タグ）
    const linkMatch = block.match(/<a[^>]*class="[^"]*base[^"]*"[^>]*href="([^"]*)"/)
    const externalUrl = linkMatch?.[1] ?? null

    // 日付抽出
    const { startDate, endDate } = parseDates(content, title)

    // 都道府県抽出
    const prefecture = extractPrefecture(title, content, prefectures)

    // 会場抽出
    const venue = extractVenue(content)

    // 市区町村抽出
    const city = extractCity(content, venue)

    // 主催者抽出
    const organizer = extractOrganizer(content)

    // 入場料抽出
    const admissionFee = extractAdmissionFee(content)

    // 即売ありチェック
    const hasSales = /即売|販売|売店/.test(content)

    // 全抽出フィールドを保護的上限までクリップしてから格納する（Zod 検証以前に長大な値を排除するため）
    events.push({
      title: clipToLength(title, MAX_EVENT_TITLE_LENGTH),
      startDate,
      endDate,
      prefecture: clipNullableToLength(prefecture, MAX_EVENT_FIELD_LENGTH),
      city: clipNullableToLength(city, MAX_EVENT_FIELD_LENGTH),
      venue: clipNullableToLength(venue, MAX_EVENT_FIELD_LENGTH),
      organizer: clipNullableToLength(organizer, MAX_EVENT_FIELD_LENGTH),
      admissionFee: clipNullableToLength(admissionFee, MAX_EVENT_FIELD_LENGTH),
      hasSales,
      description: clipToLength(content, MAX_EVENT_DESCRIPTION_LENGTH),
      externalUrl: externalUrl || null,
      sourceRegion,
      sourceUrl,
    })
  }

  return events
}

/**
 * 日付を抽出・パース
 */
function parseDates(content: string, title: string): { startDate: Date | null; endDate: Date | null } {
  const text = content + ' ' + title
  const currentYear = new Date().getFullYear()

  // パターン: 「会期／３月７日～８日」「3月7日（土）～8日（日）」など
  const datePatterns = [
    // 月日～月日 形式
    /(\d{1,2})月(\d{1,2})日[^～\d]*[～〜~\-－―].*?(\d{1,2})月(\d{1,2})日/,
    // 月日～日 形式（同月）
    /(\d{1,2})月(\d{1,2})日[^～\d]*[～〜~\-－―]\s*(\d{1,2})日/,
    // 単日形式
    /(\d{1,2})月(\d{1,2})日/,
  ]

  // 全角数字を半角に変換
  const normalizedText = text.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))

  for (const pattern of datePatterns) {
    const match = normalizedText.match(pattern)
    if (!match) continue

    // RegExp の capture group は number 引数のとき string | undefined になるため、
    // パターン定義どおりの群が取れているかチェックしてから parseInt する。
    const g1 = match[1], g2 = match[2], g3 = match[3], g4 = match[4]

    if (match.length >= 5 && g1 && g2 && g3 && g4) {
      // 月日～月日 形式
      const startMonth = parseInt(g1)
      const startDay = parseInt(g2)
      const endMonth = parseInt(g3)
      const endDay = parseInt(g4)

      // 年を推定（過去の日付なら来年）
      let year = currentYear
      const testDate = new Date(year, startMonth - 1, startDay)
      if (testDate < new Date()) {
        year = currentYear + 1
      }

      return {
        startDate: new Date(year, startMonth - 1, startDay),
        endDate: new Date(year, endMonth - 1, endDay),
      }
    } else if (match.length >= 4 && g1 && g2 && g3) {
      // 月日～日 形式
      const month = parseInt(g1)
      const startDay = parseInt(g2)
      const endDay = parseInt(g3)

      let year = currentYear
      const testDate = new Date(year, month - 1, startDay)
      if (testDate < new Date()) {
        year = currentYear + 1
      }

      return {
        startDate: new Date(year, month - 1, startDay),
        endDate: new Date(year, month - 1, endDay),
      }
    } else if (match.length >= 3 && g1 && g2) {
      // 単日形式
      const month = parseInt(g1)
      const day = parseInt(g2)

      let year = currentYear
      const testDate = new Date(year, month - 1, day)
      if (testDate < new Date()) {
        year = currentYear + 1
      }

      return {
        startDate: new Date(year, month - 1, day),
        endDate: null,
      }
    }
  }

  return { startDate: null, endDate: null }
}

/**
 * 都道府県を抽出
 */
function extractPrefecture(title: string, content: string, prefectures: readonly string[]): string | null {
  const text = title + ' ' + content

  for (const pref of prefectures) {
    if (text.includes(pref)) {
      return pref
    }
  }

  // タイトルから（県名）形式を抽出
  const match = title.match(/（([^）]+[都道府県])）/)
  if (match?.[1]) {
    return match[1]
  }

  return prefectures[0] ?? null
}

/**
 * 会場を抽出
 */
function extractVenue(content: string): string | null {
  // 「会場／」の後のテキストを抽出
  const match = content.match(/会場[／\/：:]\s*([^（\(主催連絡☎]+)/)
  if (match?.[1]) {
    return match[1].trim()
  }
  return null
}

/**
 * 市区町村を抽出
 */
function extractCity(content: string, venue: string | null): string | null {
  const text = venue || content

  // （市区町村名）形式を抽出
  const match = text.match(/（([^）]+[市区町村])）/)
  if (match?.[1]) {
    return match[1]
  }

  // 「市」「区」「町」「村」で終わる部分を抽出
  const cityMatch = text.match(/([^\s（）]+[市区町村])/)
  if (cityMatch?.[1]) {
    return cityMatch[1]
  }

  return null
}

/**
 * 「主催」に続けて「主管／協賛／後援／入場／問合せ」等の後続セクション見出しが
 * 同じ行に列記されるケースがあり、素朴な正規表現だと説明文の末尾まで丸ごと
 * 主催者として捕捉してしまう。これらの見出し語のうち最も早く出現する位置で打ち切る。
 */
const ORGANIZER_STOP_WORDS = ['主管', '協賛', '後援', '入場', '問合', '問い合', '連絡', '☎']

/**
 * 主催者を抽出
 */
function extractOrganizer(content: string): string | null {
  const match = content.match(/主催[／\/：:]\s*([^\n]+)/)
  const captured = match?.[1]
  if (!captured) return null

  const stopIndex = ORGANIZER_STOP_WORDS.reduce((earliest, word) => {
    const index = captured.indexOf(word)
    if (index === -1) return earliest
    return earliest === -1 ? index : Math.min(earliest, index)
  }, -1)

  const organizer = stopIndex === -1 ? captured : captured.slice(0, stopIndex)
  const trimmed = organizer.trim()
  return trimmed || null
}

/**
 * 入場料を抽出
 */
function extractAdmissionFee(content: string): string | null {
  // 「入場無料」「入場料○○円」などを抽出
  const patterns = [
    /入場無料/,
    /入場料[：:／\/]?\s*([^\s、。]+)/,
    /入園料[：:／\/]?\s*([^\s、。]+)/,
    /無料/,
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      return match[0]
    }
  }

  return null
}

/**
 * 指定された地方のイベントをスクレイピング
 */
export async function scrapeEventsFromRegion(
  regionUrl: string,
  regionName: string,
  prefectures: readonly string[]
): Promise<ScrapedEvent[]> {
  try {
    const response = await fetch(regionUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BON-LOG/1.0; +https://www.bon-log.com)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
    })

    if (!response.ok) {
      logger.error(`Failed to fetch ${regionUrl}: ${response.status}`)
      return []
    }

    const html = await response.text()
    return parseEventFromHtml(html, regionName, regionUrl, prefectures)
  } catch (error) {
    logger.error(`Error scraping ${regionUrl}:`, error)
    return []
  }
}

/**
 * 全地方のイベントをスクレイピング
 */
export async function scrapeAllEvents(): Promise<ScrapedEvent[]> {
  const allEvents: ScrapedEvent[] = []

  for (const source of BONSAI_EVENT_SOURCES) {
    const events = await scrapeEventsFromRegion(source.url, source.region, source.prefectures)
    allEvents.push(...events)

    // レート制限対策として少し待機
    await new Promise((resolve) => setTimeout(resolve, SCRAPING_DELAY_MS))
  }

  return allEvents
}
