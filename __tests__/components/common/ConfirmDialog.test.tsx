import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

describe('ConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('trigger props で controlled', () => {
    it('trigger をクリックするとダイアログが開く', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn().mockResolvedValue(undefined)

      render(
        <ConfirmDialog
          trigger={<button>削除</button>}
          title="削除確認"
          description="本当に削除しますか？"
          onConfirm={onConfirm}
        />
      )

      await user.click(screen.getByRole('button', { name: '削除' }))

      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      expect(screen.getByText('削除確認')).toBeInTheDocument()
      expect(screen.getByText('本当に削除しますか？')).toBeInTheDocument()
    })

    it('確認ボタンを押すと onConfirm が呼ばれ、ダイアログが閉じる', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn().mockResolvedValue(undefined)
      const onOpenChange = vi.fn()

      render(
        <ConfirmDialog
          open
          onOpenChange={onOpenChange}
          title="削除確認"
          description="本当に削除しますか？"
          onConfirm={onConfirm}
        />
      )

      await user.click(screen.getByRole('button', { name: '削除する' }))

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledOnce()
        expect(onOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('キャンセルボタンを押すと onConfirm が呼ばれない', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <ConfirmDialog
          open
          onOpenChange={vi.fn()}
          title="削除確認"
          description="本当に削除しますか？"
          onConfirm={onConfirm}
        />
      )

      await user.click(screen.getByRole('button', { name: 'キャンセル' }))

      expect(onConfirm).not.toHaveBeenCalled()
    })
  })

  describe('variant', () => {
    it('destructive variant は「削除する」ラベルを表示する', () => {
      render(
        <ConfirmDialog
          open
          onOpenChange={vi.fn()}
          title="削除"
          description="削除しますか？"
          variant="destructive"
          onConfirm={vi.fn()}
        />
      )

      expect(screen.getByRole('button', { name: '削除する' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument()
    })

    it('warning variant は「実行する」ラベルを表示する', () => {
      render(
        <ConfirmDialog
          open
          onOpenChange={vi.fn()}
          title="警告"
          description="実行しますか？"
          variant="warning"
          onConfirm={vi.fn()}
        />
      )

      expect(screen.getByRole('button', { name: '実行する' })).toBeInTheDocument()
    })

    it('discard variant は「破棄する」ラベルと「続けて編集」キャンセルを表示する', () => {
      render(
        <ConfirmDialog
          open
          onOpenChange={vi.fn()}
          title="変更の破棄"
          description="変更を破棄しますか？"
          variant="discard"
          onConfirm={vi.fn()}
        />
      )

      expect(screen.getByRole('button', { name: '破棄する' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '続けて編集' })).toBeInTheDocument()
    })

    it('カスタム confirmLabel/cancelLabel を適用する', () => {
      render(
        <ConfirmDialog
          open
          onOpenChange={vi.fn()}
          title="確認"
          description="よろしいですか？"
          confirmLabel="はい、実行"
          cancelLabel="やめる"
          onConfirm={vi.fn()}
        />
      )

      expect(screen.getByRole('button', { name: 'はい、実行' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'やめる' })).toBeInTheDocument()
    })
  })

  describe('async onConfirm の loading / error 制御', () => {
    it('非同期 onConfirm 中はボタンが無効化され「処理中」が表示される', async () => {
      const user = userEvent.setup()
      let resolveConfirm!: () => void
      const onConfirm = vi.fn(
        () => new Promise<void>((resolve) => { resolveConfirm = resolve })
      )
      const onOpenChange = vi.fn()

      render(
        <ConfirmDialog
          open
          onOpenChange={onOpenChange}
          title="確認"
          description="実行しますか？"
          onConfirm={onConfirm}
        />
      )

      await user.click(screen.getByRole('button', { name: '削除する' }))

      expect(screen.getByRole('button', { name: '処理中' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled()

      resolveConfirm()
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('onConfirm が例外を throw した場合にインラインエラーを表示し、ダイアログを開いたままにする', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn().mockRejectedValue(new Error('削除に失敗しました'))
      const onOpenChange = vi.fn()

      render(
        <ConfirmDialog
          open
          onOpenChange={onOpenChange}
          title="削除確認"
          description="削除しますか？"
          showInlineError
          onConfirm={onConfirm}
        />
      )

      await user.click(screen.getByRole('button', { name: '削除する' }))

      await waitFor(() => {
        expect(screen.getByText('削除に失敗しました')).toBeInTheDocument()
      })

      expect(onOpenChange).not.toHaveBeenCalled()
    })

    it('showInlineError=false の場合はエラーを表示しない', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn().mockRejectedValue(new Error('エラー'))

      render(
        <ConfirmDialog
          open
          onOpenChange={vi.fn()}
          title="確認"
          description="実行しますか？"
          showInlineError={false}
          onConfirm={onConfirm}
        />
      )

      await user.click(screen.getByRole('button', { name: '削除する' }))

      await waitFor(() => {
        expect(screen.queryByText('エラー')).not.toBeInTheDocument()
      })
    })

    it('同期 onConfirm（void）はすぐに閉じる', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      const onOpenChange = vi.fn()

      render(
        <ConfirmDialog
          open
          onOpenChange={onOpenChange}
          title="確認"
          description="実行しますか？"
          onConfirm={onConfirm}
        />
      )

      await user.click(screen.getByRole('button', { name: '削除する' }))

      expect(onConfirm).toHaveBeenCalledOnce()
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
