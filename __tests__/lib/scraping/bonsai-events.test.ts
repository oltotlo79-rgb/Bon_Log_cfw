// @vitest-environment node

import { vi } from 'vitest'
import {
  BONSAI_EVENT_SOURCES,
  scrapeEventsFromRegion,
  scrapeAllEvents,
} from '@/lib/scraping/bonsai-events'

// グローバルfetchのモック
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Bonsai Events Scraping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('BONSAI_EVENT_SOURCES', () => {
    it('全地方のソースが定義されている', () => {
      expect(BONSAI_EVENT_SOURCES).toHaveLength(10)
      expect(BONSAI_EVENT_SOURCES.map(s => s.region)).toEqual([
        '北海道', '東北', '関東', '信越', '北陸',
        '東海', '近畿', '中国', '四国', '九州'
      ])
    })

    it('各ソースにURL、地方名、都道府県リストがある', () => {
      for (const source of BONSAI_EVENT_SOURCES) {
        expect(source.url).toMatch(/^https:\/\/www\.bonsai\.co\.jp\/event\//)
        expect(source.region).toBeTruthy()
        expect(source.prefectures.length).toBeGreaterThan(0)
      }
    })
  })

  describe('scrapeEventsFromRegion', () => {
    it('HTMLからイベントを抽出する', async () => {
      const mockHtml = `
        <html>
          <div class="event_area">
            <span>●第10回盆栽展（東京都）</span>
            <p>会期／3月7日～8日 会場／上野公園 主催／日本盆栽協会 入場無料</p>
            <a class="base" href="https://example.com/event1">詳細</a>
          </div>
          <div class="event_area">
            <span>◆春の盆栽展示会</span>
            <p>4月10日 会場／横浜市民ギャラリー 即売あり</p>
          </div>
        </html>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      })

      const events = await scrapeEventsFromRegion(
        'https://www.bonsai.co.jp/event/event_category/kanto/',
        '関東',
        ['東京都', '神奈川県']
      )

      expect(events).toHaveLength(2)

      // 最初のイベント
      expect(events[0]!.title).toBe('第10回盆栽展（東京都）')
      expect(events[0]!.prefecture).toBe('東京都')
      expect(events[0]!.venue).toBe('上野公園')
      expect(events[0]!.organizer).toContain('日本盆栽協会')
      expect(events[0]!.admissionFee).toContain('入場無料')
      expect(events[0]!.externalUrl).toBe('https://example.com/event1')
      expect(events[0]!.startDate).toBeInstanceOf(Date)
      expect(events[0]!.endDate).toBeInstanceOf(Date)

      // 2番目のイベント
      expect(events[1]!.title).toBe('春の盆栽展示会')
      expect(events[1]!.hasSales).toBe(true)
    })

    it('fetch失敗時は空配列を返す', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const events = await scrapeEventsFromRegion(
        'https://www.bonsai.co.jp/event/event_category/kanto/',
        '関東',
        ['東京都']
      )

      expect(events).toEqual([])
    })

    it('ネットワークエラー時は空配列を返す', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const events = await scrapeEventsFromRegion(
        'https://www.bonsai.co.jp/event/event_category/kanto/',
        '関東',
        ['東京都']
      )

      expect(events).toEqual([])
    })

    it('電話番号を除去する', async () => {
      const mockHtml = `
        <div class="event_area">
          <span>盆栽展</span>
          <p>連絡先 &#x260e; 03-1234-5678 会場／東京</p>
        </div>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      })

      const events = await scrapeEventsFromRegion(
        'https://example.com',
        '関東',
        ['東京都']
      )

      expect(events[0]!.description).not.toContain('&#x260e;')
      expect(events[0]!.description).not.toContain('03-1234-5678')
    })

    it('空のタイトルはスキップする', async () => {
      const mockHtml = `
        <div class="event_area">
          <span></span>
          <p>内容のみ</p>
        </div>
        <div class="event_area">
          <span>有効なイベント</span>
          <p>内容</p>
        </div>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      })

      const events = await scrapeEventsFromRegion(
        'https://example.com',
        '関東',
        ['東京都']
      )

      expect(events).toHaveLength(1)
      expect(events[0]!.title).toBe('有効なイベント')
    })
  })

  describe('日付パース', () => {
    it('月日～月日形式をパースする', async () => {
      const mockHtml = `
        <div class="event_area">
          <span>展示会</span>
          <p>3月7日～4月8日</p>
        </div>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      })

      const events = await scrapeEventsFromRegion(
        'https://example.com',
        '関東',
        ['東京都']
      )

      expect(events[0]!.startDate?.getMonth()).toBe(2) // 3月
      expect(events[0]!.startDate?.getDate()).toBe(7)
      expect(events[0]!.endDate?.getMonth()).toBe(3) // 4月
      expect(events[0]!.endDate?.getDate()).toBe(8)
    })

    it('月日～日形式（同月）をパースする', async () => {
      const mockHtml = `
        <div class="event_area">
          <span>展示会</span>
          <p>5月10日～15日</p>
        </div>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      })

      const events = await scrapeEventsFromRegion(
        'https://example.com',
        '関東',
        ['東京都']
      )

      expect(events[0]!.startDate?.getMonth()).toBe(4) // 5月
      expect(events[0]!.startDate?.getDate()).toBe(10)
      expect(events[0]!.endDate?.getMonth()).toBe(4) // 5月
      expect(events[0]!.endDate?.getDate()).toBe(15)
    })

    it('単日形式をパースする', async () => {
      const mockHtml = `
        <div class="event_area">
          <span>展示会</span>
          <p>6月20日（土）開催</p>
        </div>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      })

      const events = await scrapeEventsFromRegion(
        'https://example.com',
        '関東',
        ['東京都']
      )

      expect(events[0]!.startDate?.getMonth()).toBe(5) // 6月
      expect(events[0]!.startDate?.getDate()).toBe(20)
      expect(events[0]!.endDate).toBeNull()
    })

    it('全角数字を半角に変換する', async () => {
      const mockHtml = `
        <div class="event_area">
          <span>展示会</span>
          <p>会期／１２月１５日</p>
        </div>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      })

      const events = await scrapeEventsFromRegion(
        'https://example.com',
        '関東',
        ['東京都']
      )

      expect(events[0]!.startDate?.getMonth()).toBe(11) // 12月
      expect(events[0]!.startDate?.getDate()).toBe(15)
    })
  })

  describe('都道府県抽出', () => {
    it('タイトルから都道府県を抽出する', async () => {
      const mockHtml = `
        <div class="event_area">
          <span>展示会（神奈川県）</span>
          <p>内容</p>
        </div>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      })

      const events = await scrapeEventsFromRegion(
        'https://example.com',
        '関東',
        ['東京都', '神奈川県']
      )

      expect(events[0]!.prefecture).toBe('神奈川県')
    })

    it('コンテンツから都道府県を抽出する', async () => {
      const mockHtml = `
        <div class="event_area">
          <span>展示会</span>
          <p>埼玉県さいたま市で開催</p>
        </div>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      })

      const events = await scrapeEventsFromRegion(
        'https://example.com',
        '関東',
        ['東京都', '埼玉県']
      )

      expect(events[0]!.prefecture).toBe('埼玉県')
    })

    it('見つからない場合はデフォルト都道府県を返す', async () => {
      const mockHtml = `
        <div class="event_area">
          <span>展示会</span>
          <p>どこかで開催</p>
        </div>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      })

      const events = await scrapeEventsFromRegion(
        'https://example.com',
        '関東',
        ['東京都', '神奈川県']
      )

      expect(events[0]!.prefecture).toBe('東京都')
    })
  })

  describe('その他の抽出', () => {
    it('市区町村を抽出する', async () => {
      const mockHtml = `
        <div class="event_area">
          <span>展示会</span>
          <p>会場／（横浜市）で開催</p>
        </div>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      })

      const events = await scrapeEventsFromRegion(
        'https://example.com',
        '関東',
        ['神奈川県']
      )

      expect(events[0]!.city).toBe('横浜市')
    })

    it('入場料を抽出する', async () => {
      const mockHtml = `
        <div class="event_area">
          <span>展示会A</span>
          <p>入場料：500円</p>
        </div>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      })

      const events = await scrapeEventsFromRegion(
        'https://example.com',
        '関東',
        ['東京都']
      )

      expect(events[0]!.admissionFee).toContain('入場料')
    })
  })

  describe('scrapeAllEvents', () => {
    it('全地方からイベントを取得する', async () => {
      // 各地方に対してモックを設定
      for (let i = 0; i < BONSAI_EVENT_SOURCES.length; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(`
            <div class="event_area">
              <span>イベント${i}</span>
              <p>内容${i}</p>
            </div>
          `),
        })
      }

      const events = await scrapeAllEvents()

      expect(events.length).toBe(10)
      expect(mockFetch).toHaveBeenCalledTimes(10)
    }, 30000) // タイムアウトを延長（レート制限対策の待機があるため）
  })
})
