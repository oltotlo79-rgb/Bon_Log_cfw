/**
 * EmailChangeForm コンポーネントのテスト
 */
import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

const mockRequestEmailChange = vi.fn()
vi.mock('@/lib/actions/account-security', () => ({
  requestEmailChange: (...args: unknown[]) => mockRequestEmailChange(...args),
}))

import { EmailChangeForm } from '@/components/settings/EmailChangeForm'
import { MSG_EMAIL_REQUIRED, MSG_CONTACT_EMAIL_INVALID } from '@/lib/constants/messages'
import { ERR_INCORRECT_PASSWORD, ERR_NO_PASSWORD_SET } from '@/lib/constants/errors'

const MSG_EMAIL_CHANGE_REQUEST_SENT =
  '確認メールを送信しました。新しいメールアドレス宛のリンクから変更を完了してください。'

const CURRENT_EMAIL = 'current@example.com'

function getNewEmailInput() {
  return screen.getByLabelText('新しいメールアドレス')
}
function getCurrentPasswordInput() {
  return screen.getByLabelText('現在のパスワード')
}
function getSubmitButton() {
  return screen.getByRole('button', { name: '確認メールを送信' })
}

describe('EmailChangeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('レンダリング', () => {
    it('現在のメールアドレスと入力フィールドを表示する', () => {
      render(<EmailChangeForm currentEmail={CURRENT_EMAIL} />)

      expect(screen.getByText(CURRENT_EMAIL)).toBeInTheDocument()
      expect(getNewEmailInput()).toBeInTheDocument()
      expect(getCurrentPasswordInput()).toBeInTheDocument()
    })

    it('現在のパスワード入力の初期タイプが password である', () => {
      render(<EmailChangeForm currentEmail={CURRENT_EMAIL} />)

      expect(getCurrentPasswordInput()).toHaveAttribute('type', 'password')
    })

    it('送信ボタンを表示する', () => {
      render(<EmailChangeForm currentEmail={CURRENT_EMAIL} />)

      expect(getSubmitButton()).toBeInTheDocument()
      expect(getSubmitButton()).not.toBeDisabled()
    })
  })

  describe('クライアント側検証', () => {
    it('未入力のまま送信するとサーバーへ送らずエラーを表示する', async () => {
      const { container } = render(<EmailChangeForm currentEmail={CURRENT_EMAIL} />)

      const form = container.querySelector('form')
      expect(form).toBeTruthy()
      fireEvent.submit(form!)

      await waitFor(() => {
        expect(screen.getByText(MSG_EMAIL_REQUIRED)).toBeInTheDocument()
      })
      expect(mockRequestEmailChange).not.toHaveBeenCalled()
    })

    it('パスワードのみ未入力の場合サーバーへ送らずエラーを表示する', async () => {
      const user = userEvent.setup()
      const { container } = render(<EmailChangeForm currentEmail={CURRENT_EMAIL} />)

      await user.type(getNewEmailInput(), 'new@example.com')

      // currentPassword が required のため native constraint validation で
      // click() 経由の submit がブロックされる。fireEvent.submit で直接発火させる。
      const form = container.querySelector('form')
      expect(form).toBeTruthy()
      fireEvent.submit(form!)

      await waitFor(() => {
        expect(screen.getByText(MSG_EMAIL_REQUIRED)).toBeInTheDocument()
      })
      expect(mockRequestEmailChange).not.toHaveBeenCalled()
    })

    it('メール形式が不正な場合サーバーへ送らずエラーを表示する', async () => {
      const user = userEvent.setup()
      const { container } = render(<EmailChangeForm currentEmail={CURRENT_EMAIL} />)

      await user.type(getNewEmailInput(), 'not-an-email')
      await user.type(getCurrentPasswordInput(), 'currentPass1')

      // type="email" の native constraint validation で click() 経由の submit が
      // ブロックされる（jsdom も HTML5 バリデーションを実装している）ため直接発火させる。
      const form = container.querySelector('form')
      expect(form).toBeTruthy()
      fireEvent.submit(form!)

      await waitFor(() => {
        expect(screen.getByText(MSG_CONTACT_EMAIL_INVALID)).toBeInTheDocument()
      })
      expect(mockRequestEmailChange).not.toHaveBeenCalled()
    })
  })

  describe('送信処理', () => {
    it('正常入力で requestEmailChange が正しい引数で呼ばれる', async () => {
      mockRequestEmailChange.mockResolvedValue({ success: true })
      const user = userEvent.setup()
      render(<EmailChangeForm currentEmail={CURRENT_EMAIL} />)

      await user.type(getNewEmailInput(), 'new@example.com')
      await user.type(getCurrentPasswordInput(), 'currentPass1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(mockRequestEmailChange).toHaveBeenCalledWith({
          newEmail: 'new@example.com',
          currentPassword: 'currentPass1',
        })
      })
    })

    it('成功時は汎用メッセージのみ表示しフォームをリセットする（列挙攻撃対策）', async () => {
      mockRequestEmailChange.mockResolvedValue({ success: true })
      const user = userEvent.setup()
      render(<EmailChangeForm currentEmail={CURRENT_EMAIL} />)

      await user.type(getNewEmailInput(), 'new@example.com')
      await user.type(getCurrentPasswordInput(), 'currentPass1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(screen.getAllByText(MSG_EMAIL_CHANGE_REQUEST_SENT).length).toBeGreaterThan(0)
      })
      expect(mockToast).toHaveBeenCalledWith({ title: MSG_EMAIL_CHANGE_REQUEST_SENT })

      await waitFor(() => {
        expect(getNewEmailInput()).toHaveValue('')
        expect(getCurrentPasswordInput()).toHaveValue('')
      })

      // newEmail の使用状況（既存/未使用）を一切示唆する文言が出ていないこと
      expect(screen.queryByText(/既に使用されています/)).not.toBeInTheDocument()
    })

    it('現パスワード不一致の場合 result.error をそのまま表示する', async () => {
      mockRequestEmailChange.mockResolvedValue({ success: false, error: ERR_INCORRECT_PASSWORD })
      const user = userEvent.setup()
      render(<EmailChangeForm currentEmail={CURRENT_EMAIL} />)

      await user.type(getNewEmailInput(), 'new@example.com')
      await user.type(getCurrentPasswordInput(), 'wrongPass1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(screen.getByText(ERR_INCORRECT_PASSWORD)).toBeInTheDocument()
      })
      expect(mockToast).not.toHaveBeenCalled()
    })

    it('OAuth 専用アカウント（パスワード未設定）の場合 result.error をそのまま表示する', async () => {
      mockRequestEmailChange.mockResolvedValue({ success: false, error: ERR_NO_PASSWORD_SET })
      const user = userEvent.setup()
      render(<EmailChangeForm currentEmail={CURRENT_EMAIL} />)

      await user.type(getNewEmailInput(), 'new@example.com')
      await user.type(getCurrentPasswordInput(), 'somePass1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(screen.getByText(ERR_NO_PASSWORD_SET)).toBeInTheDocument()
      })
    })

    it('失敗時にエラーメッセージが無い場合フォールバックメッセージを表示する', async () => {
      mockRequestEmailChange.mockResolvedValue({ success: false })
      const user = userEvent.setup()
      render(<EmailChangeForm currentEmail={CURRENT_EMAIL} />)

      await user.type(getNewEmailInput(), 'new@example.com')
      await user.type(getCurrentPasswordInput(), 'somePass1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(screen.getByText('エラー')).toBeInTheDocument()
      })
    })

    it('送信中は「送信中...」ボタン表示になり二重送信を防止する', async () => {
      mockRequestEmailChange.mockImplementation(() => new Promise(() => {}))
      const user = userEvent.setup()
      render(<EmailChangeForm currentEmail={CURRENT_EMAIL} />)

      await user.type(getNewEmailInput(), 'new@example.com')
      await user.type(getCurrentPasswordInput(), 'currentPass1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '送信中...' })).toBeDisabled()
      })
      expect(mockRequestEmailChange).toHaveBeenCalledTimes(1)
    })

    it('送信中に再度フォーム送信されても requestEmailChange は再度呼ばれない', async () => {
      mockRequestEmailChange.mockImplementation(() => new Promise(() => {}))
      const user = userEvent.setup()
      const { container } = render(<EmailChangeForm currentEmail={CURRENT_EMAIL} />)

      await user.type(getNewEmailInput(), 'new@example.com')
      await user.type(getCurrentPasswordInput(), 'currentPass1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '送信中...' })).toBeInTheDocument()
      })

      const form = container.querySelector('form')
      expect(form).toBeTruthy()
      fireEvent.submit(form!)

      expect(mockRequestEmailChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('パスワード表示切替', () => {
    it('現在のパスワードの表示トグルが機能する', async () => {
      const user = userEvent.setup()
      render(<EmailChangeForm currentEmail={CURRENT_EMAIL} />)

      const input = getCurrentPasswordInput()
      expect(input).toHaveAttribute('type', 'password')

      const toggleButton = screen.getByRole('button', { name: 'パスワードを表示' })
      await user.click(toggleButton)

      expect(input).toHaveAttribute('type', 'text')

      const hideButton = screen.getByRole('button', { name: 'パスワードを隠す' })
      await user.click(hideButton)

      expect(input).toHaveAttribute('type', 'password')
    })
  })
})
