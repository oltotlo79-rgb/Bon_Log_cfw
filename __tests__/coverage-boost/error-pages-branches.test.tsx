import { vi } from 'vitest'
import * as Sentry from '@sentry/nextjs'
/**
 * エラーページのブランチカバレッジ向上テスト
 *
 * 全15個のerror.tsxファイルの未カバーブランチをテスト。
 * 主な対象ブランチ:
 * - processEnv.NODE_ENV === 'development' && error.message の両分岐
 * - error.stack && の分岐 (global-error.tsx)
 * - digest プロパティの有無
 */
import { render, screen } from '../utils/test-utils'
import { render as rtlRender } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Next.js のモック
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Sentry のモック (global-error.tsx 用)
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

// 各 error.tsx コンポーネントのインポート
import FeedError from '@/app/(main)/feed/error'
import EventsError from '@/app/(main)/events/error'
import EventDetailError from '@/app/(main)/events/[id]/error'
import PostError from '@/app/(main)/posts/[id]/error'
import SearchError from '@/app/(main)/search/error'
import SettingsError from '@/app/(main)/settings/error'
import ShopsError from '@/app/(main)/shops/error'
import ShopDetailError from '@/app/(main)/shops/[id]/error'
import UserError from '@/app/(main)/users/[id]/error'
import NotificationsError from '@/app/(main)/notifications/error'
import MessagesError from '@/app/(main)/messages/error'
import BookmarksError from '@/app/(main)/bookmarks/error'
import AnalyticsError from '@/app/(main)/analytics/error'
import BonsaiError from '@/app/(main)/bonsai/error'
import GlobalError from '@/app/global-error'

// ヘルパー: error オブジェクト作成
function createError(message: string, opts?: { digest?: string; stack?: string }): Error & { digest?: string } {
  const error = new Error(message) as Error & { digest?: string }
  if (opts?.digest !== undefined) {
    error.digest = opts.digest
  }
  if (opts?.stack !== undefined) {
    error.stack = opts.stack
  }
  return error
}

// =====================================================
// 通常エラーページのブランチカバレッジテスト
// =====================================================

const errorPages: Array<{
  Component: React.ComponentType<{ error: Error & { digest?: string }; reset: () => void }>
  name: string
  headingText: string
}> = [
  { Component: FeedError, name: 'FeedError', headingText: 'タイムラインを読み込めません' },
  { Component: EventsError, name: 'EventsError', headingText: 'イベント一覧を読み込めません' },
  { Component: EventDetailError, name: 'EventDetailError', headingText: 'イベント情報を表示できません' },
  { Component: PostError, name: 'PostError', headingText: '投稿を表示できません' },
  { Component: SearchError, name: 'SearchError', headingText: '検索結果を読み込めません' },
  { Component: SettingsError, name: 'SettingsError', headingText: '設定を読み込めません' },
  { Component: ShopsError, name: 'ShopsError', headingText: '盆栽園マップを読み込めません' },
  { Component: ShopDetailError, name: 'ShopDetailError', headingText: '盆栽園情報を表示できません' },
  { Component: UserError, name: 'UserError', headingText: 'プロフィールを表示できません' },
  { Component: NotificationsError, name: 'NotificationsError', headingText: '通知を読み込めません' },
  { Component: MessagesError, name: 'MessagesError', headingText: 'メッセージを読み込めません' },
  { Component: BookmarksError, name: 'BookmarksError', headingText: 'ブックマークを読み込めません' },
  { Component: AnalyticsError, name: 'AnalyticsError', headingText: '分析データを読み込めません' },
  { Component: BonsaiError, name: 'BonsaiError', headingText: '盆栽情報を読み込めません' },
]

describe('エラーページ ブランチカバレッジ', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const processEnv = process.env as Record<string, string | undefined>

  afterEach(() => {
    processEnv.NODE_ENV = originalNodeEnv
  })

  describe.each(errorPages)('$name', ({ Component, headingText }) => {
    it('development環境でerror.messageありの場合、エラーメッセージを表示する', () => {
      processEnv.NODE_ENV = 'development'
      const error = createError('テストエラーメッセージ')
      const reset = vi.fn()

      render(<Component error={error} reset={reset} />)

      expect(screen.getByText(headingText)).toBeInTheDocument()
      expect(screen.getByText('テストエラーメッセージ')).toBeInTheDocument()
    })

    it('development環境でerror.messageが空文字の場合、エラー詳細を表示しない', () => {
      processEnv.NODE_ENV = 'development'
      const error = createError('')
      const reset = vi.fn()

      render(<Component error={error} reset={reset} />)

      expect(screen.getByText(headingText)).toBeInTheDocument()
    })

    it('production環境ではエラーメッセージを非表示にする', () => {
      processEnv.NODE_ENV = 'production'
      const error = createError('本番では見えないエラー')
      const reset = vi.fn()

      render(<Component error={error} reset={reset} />)

      expect(screen.getByText(headingText)).toBeInTheDocument()
      expect(screen.queryByText('本番では見えないエラー')).not.toBeInTheDocument()
    })

    it('digestプロパティありのエラーを正常に表示する', () => {
      processEnv.NODE_ENV = 'development'
      const error = createError('digest付きエラー', { digest: 'abc123' })
      const reset = vi.fn()

      render(<Component error={error} reset={reset} />)

      expect(screen.getByText(headingText)).toBeInTheDocument()
      expect(screen.getByText('digest付きエラー')).toBeInTheDocument()
    })

    it('digestプロパティなしのエラーを正常に表示する', () => {
      processEnv.NODE_ENV = 'development'
      const error = createError('digestなしエラー')
      const reset = vi.fn()

      render(<Component error={error} reset={reset} />)

      expect(screen.getByText(headingText)).toBeInTheDocument()
      expect(screen.getByText('digestなしエラー')).toBeInTheDocument()
    })

    it('再試行ボタンのクリックでreset関数が呼ばれる', async () => {
      const error = createError('エラー')
      const reset = vi.fn()

      render(<Component error={error} reset={reset} />)

      const retryButton = screen.getByText('再試行')
      await userEvent.click(retryButton)

      expect(reset).toHaveBeenCalledTimes(1)
    })

    it('test環境(デフォルト)ではエラーメッセージを非表示にする', () => {
      processEnv.NODE_ENV = 'test'
      const error = createError('テスト環境のエラー')
      const reset = vi.fn()

      render(<Component error={error} reset={reset} />)

      expect(screen.getByText(headingText)).toBeInTheDocument()
      expect(screen.queryByText('テスト環境のエラー')).not.toBeInTheDocument()
    })
  })
})

// =====================================================
// GlobalError 固有のブランチカバレッジテスト
// GlobalError は <html><body> を含むため、rtlRender を直接使用
// =====================================================

describe('GlobalError ブランチカバレッジ', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const processEnv = process.env as Record<string, string | undefined>

  afterEach(() => {
    processEnv.NODE_ENV = originalNodeEnv
  })

  it('development環境でerror.messageとerror.stackの両方がある場合、詳細を表示する', () => {
    processEnv.NODE_ENV = 'development'
    const error = createError('グローバルエラー', { stack: 'Error: グローバルエラー\n    at test.tsx:1:1' })
    const reset = vi.fn()

    const { container } = rtlRender(<GlobalError error={error} reset={reset} />)

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    const preElement = container.querySelector('pre')
    expect(preElement).toBeInTheDocument()
    expect(preElement!.textContent).toContain('グローバルエラー')
    expect(preElement!.textContent).toContain('at test.tsx:1:1')
  })

  it('development環境でerror.stackがない場合、メッセージのみ表示する', () => {
    processEnv.NODE_ENV = 'development'
    const error = createError('スタックなしエラー')
    error.stack = undefined
    const reset = vi.fn()

    const { container } = rtlRender(<GlobalError error={error} reset={reset} />)

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    const preElement = container.querySelector('pre')
    expect(preElement).toBeInTheDocument()
    expect(preElement!.textContent).toContain('スタックなしエラー')
    // error.stack が undefined なのでスタック部分は表示されない
  })

  it('production環境ではエラー詳細セクションが非表示になる', () => {
    processEnv.NODE_ENV = 'production'
    const error = createError('本番エラー', { stack: 'Error stack trace' })
    const reset = vi.fn()

    const { container } = rtlRender(<GlobalError error={error} reset={reset} />)

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    expect(container.querySelector('details')).not.toBeInTheDocument()
    expect(container.querySelector('pre')).not.toBeInTheDocument()
  })

  it('digestプロパティありで正常にレンダリングされる', () => {
    processEnv.NODE_ENV = 'development'
    const error = createError('digest付きグローバルエラー', { digest: 'xyz789' })
    const reset = vi.fn()

    rtlRender(<GlobalError error={error} reset={reset} />)

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
  })

  it('digestプロパティなしで正常にレンダリングされる', () => {
    processEnv.NODE_ENV = 'development'
    const error = createError('digestなしグローバルエラー')
    const reset = vi.fn()

    rtlRender(<GlobalError error={error} reset={reset} />)

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
  })

  it('再試行するボタンでreset関数が呼ばれる', async () => {
    const error = createError('エラー')
    const reset = vi.fn()

    rtlRender(<GlobalError error={error} reset={reset} />)

    const retryButton = screen.getByText('再試行する')
    await userEvent.click(retryButton)

    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('ホームに戻るボタンをクリックできる', async () => {
    const error = createError('エラー')
    const reset = vi.fn()

    rtlRender(<GlobalError error={error} reset={reset} />)

    const homeButton = screen.getByText('ホームに戻る')
    // ボタンが存在し、クリック可能であることを確認
    expect(homeButton).toBeInTheDocument()
    await userEvent.click(homeButton)
  })

  it('Sentryにエラーが報告される', () => {
    const error = createError('Sentry報告テスト')
    const reset = vi.fn()

    rtlRender(<GlobalError error={error} reset={reset} />)

    expect(Sentry.captureException).toHaveBeenCalledWith(error)
  })

  it('test環境ではエラー詳細が非表示になる', () => {
    processEnv.NODE_ENV = 'test'
    const error = createError('テスト環境のグローバルエラー', { stack: 'stack trace here' })
    const reset = vi.fn()

    const { container } = rtlRender(<GlobalError error={error} reset={reset} />)

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    expect(container.querySelector('details')).not.toBeInTheDocument()
  })
})
