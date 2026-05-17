import { render, screen } from '@testing-library/react'
import VerifyEmailSentPage from '@/app/(auth)/register/verify-email-sent/page'

describe('VerifyEmailSentPage', () => {
  it('確認メールを送った旨のメッセージを表示する', () => {
    render(<VerifyEmailSentPage />)

    expect(screen.getByText('確認メールを送りました')).toBeInTheDocument()
    expect(
      screen.getByText(/ご登録のメールアドレスに確認用のリンクを送信しました/)
    ).toBeInTheDocument()
  })

  it('ログインページへのリンクを表示する', () => {
    render(<VerifyEmailSentPage />)

    const link = screen.getByRole('link', { name: /ログインページへ/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/login')
  })
})
