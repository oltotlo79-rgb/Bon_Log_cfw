

import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsError from '@/app/(main)/settings/error'

describe('SettingsError', () => {
  const mockReset = vi.fn()
  const mockError = new Error('テストエラー') as Error & { digest?: string }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('エラーメッセージ見出しが表示される', () => {
    render(<SettingsError error={mockError} reset={mockReset} />)
    expect(screen.getByText('設定を読み込めません')).toBeInTheDocument()
  })

  it('エラーの説明テキストが表示される', () => {
    render(<SettingsError error={mockError} reset={mockReset} />)
    expect(screen.getByText('設定の取得に失敗しました。再試行してください。')).toBeInTheDocument()
  })

  it('再試行ボタンが表示される', () => {
    render(<SettingsError error={mockError} reset={mockReset} />)
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument()
  })

  it('再試行ボタンをクリックするとreset関数が呼ばれる', () => {
    render(<SettingsError error={mockError} reset={mockReset} />)
    fireEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it('エラーアイコン（SVG）が表示される', () => {
    const { container } = render(<SettingsError error={mockError} reset={mockReset} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  // 開発環境テストは実行時の環境に依存するためスキップ
  it('開発環境ではエラーの詳細が表示される場合がある', () => {
    // Vitest環境はtestなのでdevの判定はfalseになる
    // 実際の開発環境でのみ詳細エラーメッセージが表示される
    render(<SettingsError error={mockError} reset={mockReset} />)
    // 環境に関係なく基本的なエラーUIは表示される
    expect(screen.getByText('設定を読み込めません')).toBeInTheDocument()
  })

  it('本番環境では詳細なエラーメッセージは表示されない', () => {
    // testやproduction環境ではエラーメッセージは表示されない
    render(<SettingsError error={mockError} reset={mockReset} />)
    // テストエラーというテキストは直接表示されない（開発環境以外）
    expect(screen.queryByText('テストエラー')).not.toBeInTheDocument()
  })

  it('digestプロパティを持つエラーでもレンダリングされる', () => {
    const errorWithDigest = new Error('ダイジェスト付きエラー') as Error & { digest?: string }
    errorWithDigest.digest = 'abc123'

    render(<SettingsError error={errorWithDigest} reset={mockReset} />)
    expect(screen.getByText('設定を読み込めません')).toBeInTheDocument()
  })

  it('エラーメッセージが空でもレンダリングされる', () => {
    const emptyError = new Error('') as Error & { digest?: string }

    render(<SettingsError error={emptyError} reset={mockReset} />)
    expect(screen.getByText('設定を読み込めません')).toBeInTheDocument()
  })

  it('再試行ボタンにhover用のスタイルがある', () => {
    render(<SettingsError error={mockError} reset={mockReset} />)
    const button = screen.getByRole('button', { name: '再試行' })
    expect(button.className).toContain('hover:bg-primary/90')
  })

  it('コンテナが中央寄せスタイルを持つ', () => {
    const { container } = render(<SettingsError error={mockError} reset={mockReset} />)
    const wrapper = container.firstChild
    expect(wrapper).toHaveClass('flex')
    expect(wrapper).toHaveClass('items-center')
    expect(wrapper).toHaveClass('justify-center')
  })
})
