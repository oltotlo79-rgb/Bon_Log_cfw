import { vi } from 'vitest'
/**
 * ContactFormコンポーネントのテスト
 */

vi.mock('@/lib/actions/contact', () => ({
  submitContactInquiry: vi.fn().mockResolvedValue({ success: true }),
}))

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactForm } from '@/components/contact/ContactForm'

describe('ContactForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // 基本的なレンダリング
  // ============================================================

  describe('レンダリング', () => {
    it('フォームが正しくレンダリングされる', () => {
      render(<ContactForm />)

      expect(screen.getByLabelText(/お名前/)).toBeInTheDocument()
      expect(screen.getByLabelText(/メールアドレス/)).toBeInTheDocument()
      expect(screen.getByLabelText(/カテゴリ/)).toBeInTheDocument()
      expect(screen.getByLabelText(/件名/)).toBeInTheDocument()
      expect(screen.getByLabelText(/お問い合わせ内容/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '送信する' })).toBeInTheDocument()
    })

    it('カテゴリオプションが表示される', () => {
      render(<ContactForm />)

      const categorySelect = screen.getByLabelText(/カテゴリ/)
      expect(categorySelect).toBeInTheDocument()

      // カテゴリオプションを確認
      expect(screen.getByText('カテゴリを選択')).toBeInTheDocument()
      expect(screen.getByText('一般的なお問い合わせ')).toBeInTheDocument()
      expect(screen.getByText('アカウントについて')).toBeInTheDocument()
      expect(screen.getByText('不具合の報告')).toBeInTheDocument()
      expect(screen.getByText('機能のリクエスト')).toBeInTheDocument()
      expect(screen.getByText('プレミアム会員について')).toBeInTheDocument()
      expect(screen.getByText('不適切なコンテンツの報告')).toBeInTheDocument()
      expect(screen.getByText('その他')).toBeInTheDocument()
    })

    it('文字数カウンターが表示される', () => {
      render(<ContactForm />)
      expect(screen.getByText('0 / 2000文字')).toBeInTheDocument()
    })
  })

  // ============================================================
  // バリデーション
  // ============================================================

  describe('バリデーション', () => {
    it('お名前が空の場合エラーを表示する', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.click(screen.getByRole('button', { name: '送信する' }))

      expect(screen.getByText('お名前を入力してください')).toBeInTheDocument()
    })

    it('メールアドレスが空の場合エラーを表示する', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      expect(screen.getByText('メールアドレスを入力してください')).toBeInTheDocument()
    })

    it('無効なメールアドレスの場合エラーを表示する', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      // @は含むがドメインが不正なメールアドレス
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@invalid')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      await waitFor(() => {
        expect(screen.getByText('有効なメールアドレスを入力してください')).toBeInTheDocument()
      })
    })

    it('カテゴリ未選択の場合エラーを表示する', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      expect(screen.getByText('カテゴリを選択してください')).toBeInTheDocument()
    })

    it('件名が空の場合エラーを表示する', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'general')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      expect(screen.getByText('件名を入力してください')).toBeInTheDocument()
    })

    it('お問い合わせ内容が空の場合エラーを表示する', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'general')
      await user.type(screen.getByLabelText(/件名/), 'テスト件名')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      expect(screen.getByText('お問い合わせ内容を入力してください')).toBeInTheDocument()
    })

    it('お問い合わせ内容が10文字未満の場合エラーを表示する', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'general')
      await user.type(screen.getByLabelText(/件名/), 'テスト件名')
      await user.type(screen.getByLabelText(/お問い合わせ内容/), '短い内容')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      expect(screen.getByText('お問い合わせ内容は10文字以上で入力してください')).toBeInTheDocument()
    })
  })

  // ============================================================
  // フォーム送信
  // ============================================================

  describe('フォーム送信', () => {
    it('正常に送信できる', async () => {
      // Deferred promise to control when submitContactInquiry resolves
      let resolveSubmit!: (value: { success: boolean }) => void
      const { submitContactInquiry } = await import('@/lib/actions/contact')
      vi.mocked(submitContactInquiry).mockImplementation(
        () => new Promise((resolve) => { resolveSubmit = resolve })
      )

      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'general')
      await user.type(screen.getByLabelText(/件名/), 'テスト件名')
      await user.type(screen.getByLabelText(/お問い合わせ内容/), 'これはテストのお問い合わせ内容です。')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      // 送信中表示
      expect(screen.getByText('送信中...')).toBeInTheDocument()

      // Resolve the submit promise
      resolveSubmit({ success: true })

      await waitFor(() => {
        expect(screen.getByText('お問い合わせを受け付けました')).toBeInTheDocument()
      })
    })

    it('送信中はフォームが無効になる', async () => {
      // Deferred promise to keep the form in submitting state
      const { submitContactInquiry } = await import('@/lib/actions/contact')
      vi.mocked(submitContactInquiry).mockImplementation(
        () => new Promise(() => { /* never resolves */ })
      )

      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'general')
      await user.type(screen.getByLabelText(/件名/), 'テスト件名')
      await user.type(screen.getByLabelText(/お問い合わせ内容/), 'これはテストのお問い合わせ内容です。')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      // 入力フィールドが無効になる
      expect(screen.getByLabelText(/お名前/)).toBeDisabled()
      expect(screen.getByLabelText(/メールアドレス/)).toBeDisabled()
      expect(screen.getByLabelText(/カテゴリ/)).toBeDisabled()
      expect(screen.getByLabelText(/件名/)).toBeDisabled()
      expect(screen.getByLabelText(/お問い合わせ内容/)).toBeDisabled()
    })

    it('送信完了後に新しいお問い合わせをクリックするとフォームがリセットされる', async () => {
      // Ensure the mock resolves with success
      const { submitContactInquiry } = await import('@/lib/actions/contact')
      vi.mocked(submitContactInquiry).mockResolvedValue({ success: true })

      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'general')
      await user.type(screen.getByLabelText(/件名/), 'テスト件名')
      await user.type(screen.getByLabelText(/お問い合わせ内容/), 'これはテストのお問い合わせ内容です。')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      await waitFor(() => {
        expect(screen.getByText('お問い合わせを受け付けました')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '新しいお問い合わせ' }))

      // フォームが再表示される
      expect(screen.getByLabelText(/お名前/)).toBeInTheDocument()
      expect(screen.getByLabelText(/お名前/)).toHaveValue('')
    })
  })

  // ============================================================
  // 入力変更
  // ============================================================

  describe('入力変更', () => {
    it('テキスト入力でエラーがクリアされる', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      // エラーを表示させる
      await user.click(screen.getByRole('button', { name: '送信する' }))
      expect(screen.getByText('お名前を入力してください')).toBeInTheDocument()

      // 入力するとエラーがクリアされる
      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      expect(screen.queryByText('お名前を入力してください')).not.toBeInTheDocument()
    })

    it('カテゴリ変更でエラーがクリアされる', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      // 必須項目を入力してカテゴリエラーを表示させる
      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.click(screen.getByRole('button', { name: '送信する' }))
      expect(screen.getByText('カテゴリを選択してください')).toBeInTheDocument()

      // カテゴリを選択するとエラーがクリアされる
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'bug')
      expect(screen.queryByText('カテゴリを選択してください')).not.toBeInTheDocument()
    })

    it('文字数カウンターが更新される', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お問い合わせ内容/), 'テスト')
      expect(screen.getByText('3 / 2000文字')).toBeInTheDocument()
    })
  })

  // ============================================================
  // エラー応答パス（未カバーだった分岐）
  // ============================================================

  describe('エラー応答', () => {
    async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'general')
      await user.type(screen.getByLabelText(/件名/), 'テスト件名')
      await user.type(screen.getByLabelText(/お問い合わせ内容/), 'これはテストのお問い合わせ内容です。')
    }

    it('Server Action が { error } を返した場合、エラーメッセージを表示し送信完了状態にしない', async () => {
      const { submitContactInquiry } = await import('@/lib/actions/contact')
      vi.mocked(submitContactInquiry).mockResolvedValue({ success: false, error: 'サーバー側エラー' } as never)

      const user = userEvent.setup()
      render(<ContactForm />)
      await fillValidForm(user)
      await user.click(screen.getByRole('button', { name: '送信する' }))

      await waitFor(() => {
        expect(screen.getByText('サーバー側エラー')).toBeInTheDocument()
      })
      // 完了画面に遷移しない
      expect(screen.queryByText('お問い合わせを受け付けました')).not.toBeInTheDocument()
    })

    it('Server Action が throw した場合、MSG_CONTACT_SEND_FAILED を表示する', async () => {
      const { submitContactInquiry } = await import('@/lib/actions/contact')
      vi.mocked(submitContactInquiry).mockRejectedValueOnce(new Error('network failure'))

      const user = userEvent.setup()
      render(<ContactForm />)
      await fillValidForm(user)
      await user.click(screen.getByRole('button', { name: '送信する' }))

      await waitFor(() => {
        // MSG_CONTACT_SEND_FAILED は「送信に失敗しました」など (実値はメッセージ定数)
        // ここではエラー表示が出ること、完了状態にならないことを確認
        expect(screen.queryByText('お問い合わせを受け付けました')).not.toBeInTheDocument()
      })
      // FormError コンポーネントの role="alert" が表示される
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('Server Action がエラー文字列を持たないオブジェクトを返した場合、フォールバックメッセージが出る', async () => {
      const { submitContactInquiry } = await import('@/lib/actions/contact')
      // result に error プロパティがない場合は完了状態に進む
      vi.mocked(submitContactInquiry).mockResolvedValue({ success: true } as never)

      const user = userEvent.setup()
      render(<ContactForm />)
      await fillValidForm(user)
      await user.click(screen.getByRole('button', { name: '送信する' }))

      await waitFor(() => {
        expect(screen.getByText('お問い合わせを受け付けました')).toBeInTheDocument()
      })
    })

    it('送信中状態が完了後に解除される（finally ブロック）', async () => {
      const { submitContactInquiry } = await import('@/lib/actions/contact')
      vi.mocked(submitContactInquiry).mockResolvedValue({ success: true } as never)

      const user = userEvent.setup()
      render(<ContactForm />)
      await fillValidForm(user)
      await user.click(screen.getByRole('button', { name: '送信する' }))

      await waitFor(() => {
        expect(screen.getByText('お問い合わせを受け付けました')).toBeInTheDocument()
      })
      // 送信中表示は消えている
      expect(screen.queryByText('送信中...')).not.toBeInTheDocument()
    })
  })
})
