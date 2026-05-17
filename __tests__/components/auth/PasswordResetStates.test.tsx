import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  VerifyingState,
  TokenInvalidState,
  ResetSuccessState,
} from '@/components/auth/PasswordResetStates'

describe('VerifyingState', () => {
  it('「リンクを検証中」テキストを表示する', () => {
    render(<VerifyingState />)
    expect(screen.getByText('リンクを検証中...')).toBeInTheDocument()
  })

  it('ローディングスピナー（animate-spin）を表示する', () => {
    const { container } = render(<VerifyingState />)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })
})

describe('TokenInvalidState', () => {
  it('「リンクが無効です」エラーメッセージを表示する', () => {
    render(<TokenInvalidState />)
    expect(screen.getByText('リンクが無効です')).toBeInTheDocument()
  })

  it('リセットリンクの期限切れ説明を表示する', () => {
    render(<TokenInvalidState />)
    expect(
      screen.getByText(/リセットリンクが無効または期限切れです/)
    ).toBeInTheDocument()
  })

  it('パスワードリセット再リクエストリンクが正しいルートを指す', () => {
    render(<TokenInvalidState />)
    const link = screen.getByText('パスワードリセットを再度リクエスト')
    expect(link).toHaveAttribute('href', '/password-reset')
  })

  it('ログインページへのリンクが正しいルートを指す', () => {
    render(<TokenInvalidState />)
    const link = screen.getByText('ログインページへ戻る')
    expect(link).toHaveAttribute('href', '/login')
  })
})

describe('ResetSuccessState', () => {
  it('「パスワードを更新しました」成功メッセージを表示する', () => {
    render(<ResetSuccessState />)
    expect(screen.getByText('パスワードを更新しました')).toBeInTheDocument()
  })

  it('新しいパスワードでログインできる旨を表示する', () => {
    render(<ResetSuccessState />)
    expect(
      screen.getByText(/新しいパスワードでログインできます/)
    ).toBeInTheDocument()
  })

  it('「今すぐログインする」リンクがログインページを指す', () => {
    render(<ResetSuccessState />)
    const link = screen.getByText('今すぐログインする')
    expect(link).toHaveAttribute('href', '/login')
  })

  it('自動リダイレクトの案内テキストを表示する', () => {
    render(<ResetSuccessState />)
    expect(
      screen.getByText(/ログインページへ移動します/)
    ).toBeInTheDocument()
  })
})
