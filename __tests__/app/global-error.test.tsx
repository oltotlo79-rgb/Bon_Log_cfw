import { vi } from 'vitest'
/**
 * グローバルエラーバウンダリのテスト
 */

import { render, screen, fireEvent } from '@testing-library/react'

// Sentryをモック
const mockCaptureException = vi.fn()
vi.mock('@/lib/sentry-shim', () => ({
  captureException: (error: Error) => mockCaptureException(error),
}))

// コンポーネントをインポート
import GlobalError from '@/app/global-error'

describe('GlobalError', () => {
  const mockReset = vi.fn()
  const testError = new Error('テストエラー')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基本レンダリング', () => {
    it('エラータイトルを表示する', () => {
      render(<GlobalError error={testError} reset={mockReset} />)
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })

    it('エラー説明文を表示する', () => {
      render(<GlobalError error={testError} reset={mockReset} />)
      expect(screen.getByText(/申し訳ございません。予期しないエラーが発生しました/)).toBeInTheDocument()
    })

    it('再試行ボタンを表示する', () => {
      render(<GlobalError error={testError} reset={mockReset} />)
      expect(screen.getByRole('button', { name: '再試行する' })).toBeInTheDocument()
    })

    it('ホームに戻るリンクを表示する', () => {
      render(<GlobalError error={testError} reset={mockReset} />)
      // global-error.tsx はルートレイアウト外で実行されるため、<a href> でフルリロード遷移する。
      expect(screen.getByRole('link', { name: 'ホームに戻る' })).toHaveAttribute('href', '/')
    })
  })

  describe('Sentry連携', () => {
    it('マウント時にSentryにエラーを報告する', () => {
      render(<GlobalError error={testError} reset={mockReset} />)
      expect(mockCaptureException).toHaveBeenCalledWith(testError)
    })

    it('エラーが変更されたら再報告する', () => {
      const { rerender } = render(<GlobalError error={testError} reset={mockReset} />)
      expect(mockCaptureException).toHaveBeenCalledTimes(1)

      const newError = new Error('新しいエラー')
      rerender(<GlobalError error={newError} reset={mockReset} />)
      expect(mockCaptureException).toHaveBeenCalledTimes(2)
      expect(mockCaptureException).toHaveBeenLastCalledWith(newError)
    })
  })

  describe('インタラクション', () => {
    it('再試行ボタンをクリックするとreset関数が呼ばれる', () => {
      render(<GlobalError error={testError} reset={mockReset} />)

      fireEvent.click(screen.getByRole('button', { name: '再試行する' }))

      expect(mockReset).toHaveBeenCalledTimes(1)
    })

    it('ホームに戻るリンクが / を指す', () => {
      render(<GlobalError error={testError} reset={mockReset} />)
      const homeLink = screen.getByRole('link', { name: 'ホームに戻る' })
      expect(homeLink).toHaveAttribute('href', '/')
    })
  })

  describe('開発環境でのエラー詳細', () => {
    // NODE_ENVはVitest実行時にtestに設定されるため、
    // 開発環境のエラー詳細表示は別途E2Eでテストする

    it('エラーメッセージを適切に処理する', () => {
      render(<GlobalError error={testError} reset={mockReset} />)
      // 基本的なレンダリングが成功することを確認
      expect(screen.getByRole('button', { name: '再試行する' })).toBeInTheDocument()
    })

    it('スタック付きエラーも処理できる', () => {
      const errorWithStack = new Error('スタック付きエラー')
      errorWithStack.stack = 'Error: スタック付きエラー\n    at test.js:1:1'

      render(<GlobalError error={errorWithStack} reset={mockReset} />)
      // エラーにスタックがあっても正常にレンダリングされる
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })
  })

  describe('digestプロパティ', () => {
    it('digestプロパティ付きエラーも正常に処理される', () => {
      const errorWithDigest = Object.assign(new Error('Digest付きエラー'), { digest: 'abc123' })

      render(<GlobalError error={errorWithDigest} reset={mockReset} />)

      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
      expect(mockCaptureException).toHaveBeenCalledWith(errorWithDigest)
    })
  })

  describe('HTML構造', () => {
    it('コンテンツがレンダリングされる', () => {
      render(<GlobalError error={testError} reset={mockReset} />)
      // タイトルが表示されることを確認
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })

    it('再試行ボタンとホームへのリンクが1つずつ存在する', () => {
      render(<GlobalError error={testError} reset={mockReset} />)
      // 再試行は button、ホーム遷移はフルリロード前提の <a> で表現される。
      expect(screen.getAllByRole('button')).toHaveLength(1)
      expect(screen.getAllByRole('link')).toHaveLength(1)
    })
  })
})
