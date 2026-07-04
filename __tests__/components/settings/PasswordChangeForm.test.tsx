/**
 * PasswordChangeForm コンポーネントのテスト
 */
import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

const mockChangePassword = vi.fn()
vi.mock('@/lib/actions/account-security', () => ({
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
}))

import { PasswordChangeForm } from '@/components/settings/PasswordChangeForm'
import { MSG_PASSWORD_FIELDS_REQUIRED } from '@/lib/constants/messages'

function getCurrentPasswordInput() {
  return screen.getByLabelText('現在のパスワード')
}
function getNewPasswordInput() {
  return screen.getByLabelText('新しいパスワード')
}
function getConfirmPasswordInput() {
  return screen.getByLabelText('新しいパスワード（確認）')
}
function getSubmitButton() {
  return screen.getByRole('button', { name: 'パスワードを変更' })
}

describe('PasswordChangeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('レンダリング', () => {
    it('3つの入力フィールドを表示する', () => {
      render(<PasswordChangeForm />)

      expect(getCurrentPasswordInput()).toBeInTheDocument()
      expect(getNewPasswordInput()).toBeInTheDocument()
      expect(getConfirmPasswordInput()).toBeInTheDocument()
    })

    it('入力フィールドの初期タイプが password である', () => {
      render(<PasswordChangeForm />)

      expect(getCurrentPasswordInput()).toHaveAttribute('type', 'password')
      expect(getNewPasswordInput()).toHaveAttribute('type', 'password')
      expect(getConfirmPasswordInput()).toHaveAttribute('type', 'password')
    })

    it('送信ボタンを表示する', () => {
      render(<PasswordChangeForm />)

      expect(getSubmitButton()).toBeInTheDocument()
      expect(getSubmitButton()).not.toBeDisabled()
    })
  })

  describe('クライアント側検証', () => {
    it('未入力のまま送信するとサーバーへ送らずエラーを表示する', async () => {
      const { container } = render(<PasswordChangeForm />)

      const form = container.querySelector('form')
      expect(form).toBeTruthy()
      fireEvent.submit(form!)

      await waitFor(() => {
        expect(screen.getByText(MSG_PASSWORD_FIELDS_REQUIRED)).toBeInTheDocument()
      })
      expect(mockChangePassword).not.toHaveBeenCalled()
    })

    it('確認用パスワードのみ未入力の場合サーバーへ送らずエラーを表示する', async () => {
      const user = userEvent.setup()
      const { container } = render(<PasswordChangeForm />)

      await user.type(getCurrentPasswordInput(), 'currentPass1')
      await user.type(getNewPasswordInput(), 'newPassword1')

      const form = container.querySelector('form')
      expect(form).toBeTruthy()
      fireEvent.submit(form!)

      await waitFor(() => {
        expect(screen.getByText(MSG_PASSWORD_FIELDS_REQUIRED)).toBeInTheDocument()
      })
      expect(mockChangePassword).not.toHaveBeenCalled()
    })

    it('新しいパスワードと確認が不一致の場合サーバーへ送らずエラーを表示する', async () => {
      const user = userEvent.setup()
      render(<PasswordChangeForm />)

      await user.type(getCurrentPasswordInput(), 'currentPass1')
      await user.type(getNewPasswordInput(), 'newPassword1')
      await user.type(getConfirmPasswordInput(), 'differentPassword1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(screen.getByText('パスワードが一致しません')).toBeInTheDocument()
      })
      expect(mockChangePassword).not.toHaveBeenCalled()
    })

    it('新しいパスワードの強度が不足している場合サーバーへ送らずエラーを表示する', async () => {
      const user = userEvent.setup()
      render(<PasswordChangeForm />)

      await user.type(getCurrentPasswordInput(), 'currentPass1')
      await user.type(getNewPasswordInput(), 'nonumberpass')
      await user.type(getConfirmPasswordInput(), 'nonumberpass')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(screen.getByText(/パスワードは数字を含めてください/)).toBeInTheDocument()
      })
      expect(mockChangePassword).not.toHaveBeenCalled()
    })

    it('新しいパスワードが8文字未満の場合サーバーへ送らずエラーを表示する', async () => {
      const user = userEvent.setup()
      render(<PasswordChangeForm />)

      await user.type(getCurrentPasswordInput(), 'currentPass1')
      await user.type(getNewPasswordInput(), 'ab1')
      await user.type(getConfirmPasswordInput(), 'ab1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(screen.getByText(/パスワードは8文字以上で入力してください/)).toBeInTheDocument()
      })
      expect(mockChangePassword).not.toHaveBeenCalled()
    })
  })

  describe('送信処理', () => {
    it('正常入力で changePassword が正しい引数で呼ばれる', async () => {
      mockChangePassword.mockResolvedValue({ success: true })
      const user = userEvent.setup()
      render(<PasswordChangeForm />)

      await user.type(getCurrentPasswordInput(), 'currentPass1')
      await user.type(getNewPasswordInput(), 'newPassword1')
      await user.type(getConfirmPasswordInput(), 'newPassword1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(mockChangePassword).toHaveBeenCalledWith({
          currentPassword: 'currentPass1',
          newPassword: 'newPassword1',
        })
      })
    })

    it('成功時にトーストを表示しフォームをリセットする', async () => {
      mockChangePassword.mockResolvedValue({ success: true })
      const user = userEvent.setup()
      render(<PasswordChangeForm />)

      await user.type(getCurrentPasswordInput(), 'currentPass1')
      await user.type(getNewPasswordInput(), 'newPassword1')
      await user.type(getConfirmPasswordInput(), 'newPassword1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: 'パスワードを変更しました' })
      })
      await waitFor(() => {
        expect(getCurrentPasswordInput()).toHaveValue('')
        expect(getNewPasswordInput()).toHaveValue('')
        expect(getConfirmPasswordInput()).toHaveValue('')
      })
    })

    it('失敗時に result.error をフォームに表示する', async () => {
      mockChangePassword.mockResolvedValue({ success: false, error: 'パスワードが正しくありません' })
      const user = userEvent.setup()
      render(<PasswordChangeForm />)

      await user.type(getCurrentPasswordInput(), 'wrongCurrentPass1')
      await user.type(getNewPasswordInput(), 'newPassword1')
      await user.type(getConfirmPasswordInput(), 'newPassword1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(screen.getByText('パスワードが正しくありません')).toBeInTheDocument()
      })
      expect(mockToast).not.toHaveBeenCalled()
    })

    it('失敗時にエラーメッセージが無い場合フォールバックメッセージを表示する', async () => {
      mockChangePassword.mockResolvedValue({ success: false })
      const user = userEvent.setup()
      render(<PasswordChangeForm />)

      await user.type(getCurrentPasswordInput(), 'currentPass1')
      await user.type(getNewPasswordInput(), 'newPassword1')
      await user.type(getConfirmPasswordInput(), 'newPassword1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(screen.getByText('エラー')).toBeInTheDocument()
      })
    })

    it('送信中は「変更中...」ボタン表示になり二重送信を防止する', async () => {
      mockChangePassword.mockImplementation(() => new Promise(() => {}))
      const user = userEvent.setup()
      render(<PasswordChangeForm />)

      await user.type(getCurrentPasswordInput(), 'currentPass1')
      await user.type(getNewPasswordInput(), 'newPassword1')
      await user.type(getConfirmPasswordInput(), 'newPassword1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '変更中...' })).toBeDisabled()
      })
      expect(mockChangePassword).toHaveBeenCalledTimes(1)
    })

    it('送信中に再度フォーム送信されても changePassword は再度呼ばれない', async () => {
      mockChangePassword.mockImplementation(() => new Promise(() => {}))
      const user = userEvent.setup()
      const { container } = render(<PasswordChangeForm />)

      await user.type(getCurrentPasswordInput(), 'currentPass1')
      await user.type(getNewPasswordInput(), 'newPassword1')
      await user.type(getConfirmPasswordInput(), 'newPassword1')
      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '変更中...' })).toBeInTheDocument()
      })

      const form = container.querySelector('form')
      expect(form).toBeTruthy()
      fireEvent.submit(form!)

      expect(mockChangePassword).toHaveBeenCalledTimes(1)
    })
  })

  describe('パスワード表示切替', () => {
    it('現在のパスワードの表示トグルが機能する', async () => {
      const user = userEvent.setup()
      render(<PasswordChangeForm />)

      const input = getCurrentPasswordInput()
      expect(input).toHaveAttribute('type', 'password')

      const toggleButton = screen.getAllByRole('button', { name: 'パスワードを表示' })[0]!
      await user.click(toggleButton)

      expect(input).toHaveAttribute('type', 'text')
    })

    it('新しいパスワードの表示トグルが機能する', async () => {
      const user = userEvent.setup()
      render(<PasswordChangeForm />)

      const input = getNewPasswordInput()
      expect(input).toHaveAttribute('type', 'password')

      const toggleButton = screen.getAllByRole('button', { name: 'パスワードを表示' })[1]!
      await user.click(toggleButton)

      expect(input).toHaveAttribute('type', 'text')

      const hideButton = screen.getAllByRole('button', { name: 'パスワードを隠す' })[0]!
      await user.click(hideButton)

      expect(input).toHaveAttribute('type', 'password')
    })

    it('新しいパスワード（確認）の表示トグルが機能する', async () => {
      const user = userEvent.setup()
      render(<PasswordChangeForm />)

      const input = getConfirmPasswordInput()
      expect(input).toHaveAttribute('type', 'password')

      const toggleButton = screen.getAllByRole('button', { name: 'パスワードを表示' })[2]!
      await user.click(toggleButton)

      expect(input).toHaveAttribute('type', 'text')
    })
  })
})
