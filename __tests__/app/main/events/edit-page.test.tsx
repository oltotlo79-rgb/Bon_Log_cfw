import { vi } from 'vitest'
/**
 * イベント編集ページのテスト
 */
import React from 'react'

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// イベント取得モック
const mockGetEvent = vi.fn()
vi.mock('@/lib/actions/event', () => ({
  getEvent: (id: string) => mockGetEvent(id),
  updateEvent: vi.fn(),
}))

// Next.jsナビゲーションモック
const mockRedirect = vi.fn()
const mockNotFound = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { mockRedirect(url); throw new Error('REDIRECT') },
  notFound: () => { mockNotFound(); throw new Error('NOT_FOUND') },
}))

// EventFormモック
vi.mock('@/components/event/EventForm', () => ({
  EventForm: ({ mode, initialData }: { mode: string; initialData: Record<string, unknown> }) => (
    <div data-testid="event-form" data-mode={mode}>
      {JSON.stringify(initialData)}
    </div>
  ),
}))

describe('イベント編集ページ', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateMetadata', async () => {
    it('イベントが存在する場合、タイトルを生成する', async () => {
      mockGetEvent.mockResolvedValue({
        success: true,
        data: { event: { id: 'event-1', title: '盆栽展示会' } },
      })

      const { generateMetadata } = await import('@/app/(main)/events/[id]/edit/page')
      const metadata = await generateMetadata({ params: Promise.resolve({ id: 'event-1' }) })

      expect(metadata.title).toBe('盆栽展示会を編集')
    })

    it('イベントが存在しない場合、フォールバックタイトルを返す', async () => {
      mockGetEvent.mockResolvedValue({
        success: false,
        error: 'Not found',
      })

      const { generateMetadata } = await import('@/app/(main)/events/[id]/edit/page')
      const metadata = await generateMetadata({ params: Promise.resolve({ id: 'invalid' }) })

      expect(metadata.title).toBe('イベントが見つかりません')
    })
  })

  describe('ページコンポーネント', async () => {
    it('未ログインの場合、ログインページにリダイレクトする', async () => {
      mockAuth.mockResolvedValue(null)

      const { default: EditEventPage } = await import('@/app/(main)/events/[id]/edit/page')

      await expect(
        EditEventPage({ params: Promise.resolve({ id: 'event-1' }) })
      ).rejects.toThrow('REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith('/login')
    })

    it('イベントが見つからない場合、404を表示する', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
      mockGetEvent.mockResolvedValue({ success: false, error: 'Not found' })

      const { default: EditEventPage } = await import('@/app/(main)/events/[id]/edit/page')

      await expect(
        EditEventPage({ params: Promise.resolve({ id: 'invalid' }) })
      ).rejects.toThrow('NOT_FOUND')

      expect(mockNotFound).toHaveBeenCalled()
    })

    it('所有者でない場合、詳細ページにリダイレクトする', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
      mockGetEvent.mockResolvedValue({
        success: true,
        data: {
          event: {
            id: 'event-1',
            title: '盆栽展示会',
            isOwner: false,
          },
        },
      })

      const { default: EditEventPage } = await import('@/app/(main)/events/[id]/edit/page')

      await expect(
        EditEventPage({ params: Promise.resolve({ id: 'event-1' }) })
      ).rejects.toThrow('REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith('/events/event-1')
    })

    it('所有者の場合、編集フォームを表示する', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
      mockGetEvent.mockResolvedValue({
        success: true,
        data: {
          event: {
            id: 'event-1',
            title: '盆栽展示会',
            startDate: new Date('2025-06-01'),
            endDate: new Date('2025-06-03'),
            prefecture: '東京都',
            city: '千代田区',
            venue: '東京国際フォーラム',
            organizer: '盆栽協会',
            admissionFee: '無料',
            hasSales: true,
            description: '年に一度の大展示会',
            externalUrl: 'https://example.com',
            isOwner: true,
          },
        },
      })

      const { default: EditEventPage } = await import('@/app/(main)/events/[id]/edit/page')

      // エラーが投げられないことを確認（正常にレンダリングされる）
      const result = await EditEventPage({ params: Promise.resolve({ id: 'event-1' }) })
      expect(result).toBeTruthy()
    })
  })
})
