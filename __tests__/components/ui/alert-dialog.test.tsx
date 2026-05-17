import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogPortal,
  AlertDialogOverlay,
} from '@/components/ui/alert-dialog'

// ============================================================
// テスト
// ============================================================

describe('AlertDialog', () => {
  // ============================================================
  // 基本レンダリング
  // ============================================================

  describe('基本レンダリング', () => {
    it('トリガーボタンがレンダリングされる', () => {
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      )
      expect(screen.getByText('開く')).toBeInTheDocument()
    })

    it('初期状態ではコンテンツが非表示', () => {
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      )
      expect(screen.queryByText('タイトル')).not.toBeInTheDocument()
    })

    it('open propsで制御可能', () => {
      render(
        <AlertDialog open={true}>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      )
      expect(screen.getByText('タイトル')).toBeInTheDocument()
    })
  })

  // ============================================================
  // ダイアログの開閉
  // ============================================================

  describe('ダイアログの開閉', () => {
    it('トリガーをクリックするとダイアログが開く', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(screen.getByText('タイトル')).toBeInTheDocument()
    })

    it('キャンセルボタンでダイアログが閉じる', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(screen.getByText('タイトル')).toBeInTheDocument()

      await user.click(screen.getByText('キャンセル'))
      await waitFor(() => {
        expect(screen.queryByText('タイトル')).not.toBeInTheDocument()
      })
    })

    it('アクションボタンでダイアログが閉じる', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
            <AlertDialogAction>確認</AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(screen.getByText('タイトル')).toBeInTheDocument()

      await user.click(screen.getByText('確認'))
      await waitFor(() => {
        expect(screen.queryByText('タイトル')).not.toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // コールバック
  // ============================================================

  describe('コールバック', () => {
    it('アクションボタンのonClickが呼ばれる', async () => {
      const handleAction = vi.fn()
      const user = userEvent.setup()

      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
            <AlertDialogAction onClick={handleAction}>確認</AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      await user.click(screen.getByText('確認'))
      expect(handleAction).toHaveBeenCalledTimes(1)
    })

    it('キャンセルボタンのonClickが呼ばれる', async () => {
      const handleCancel = vi.fn()
      const user = userEvent.setup()

      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
            <AlertDialogCancel onClick={handleCancel}>キャンセル</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      await user.click(screen.getByText('キャンセル'))
      expect(handleCancel).toHaveBeenCalledTimes(1)
    })

    it('onOpenChangeが呼ばれる', async () => {
      const handleOpenChange = vi.fn()
      const user = userEvent.setup()

      render(
        <AlertDialog onOpenChange={handleOpenChange}>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(handleOpenChange).toHaveBeenCalledWith(true)

      await user.click(screen.getByText('キャンセル'))
      expect(handleOpenChange).toHaveBeenCalledWith(false)
    })
  })

  // ============================================================
  // コンテンツ構造
  // ============================================================

  describe('コンテンツ構造', () => {
    it('ヘッダーがレンダリングされる', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>タイトル</AlertDialogTitle>
              <AlertDialogDescription>説明文</AlertDialogDescription>
            </AlertDialogHeader>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(screen.getByText('タイトル')).toBeInTheDocument()
      expect(screen.getByText('説明文')).toBeInTheDocument()
    })

    it('フッターがレンダリングされる', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction>確認</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(screen.getByText('キャンセル')).toBeInTheDocument()
      expect(screen.getByText('確認')).toBeInTheDocument()
    })

    it('タイトルがレンダリングされる', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>削除の確認</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(screen.getByText('削除の確認')).toBeInTheDocument()
    })

    it('説明文がレンダリングされる', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(screen.getByText('この操作は取り消せません。')).toBeInTheDocument()
    })
  })

  // ============================================================
  // スタイリング
  // ============================================================

  describe('スタイリング', () => {
    it('カスタムclassNameが適用される（Content）', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent className="custom-content-class">
            <AlertDialogTitle>タイトル</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      const content = screen.getByRole('alertdialog')
      expect(content).toHaveClass('custom-content-class')
    })

    it('カスタムclassNameが適用される（Header）', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader className="custom-header-class" data-testid="header">
              <AlertDialogTitle>タイトル</AlertDialogTitle>
            </AlertDialogHeader>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(screen.getByTestId('header')).toHaveClass('custom-header-class')
    })

    it('カスタムclassNameが適用される（Footer）', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
            <AlertDialogFooter className="custom-footer-class" data-testid="footer">
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(screen.getByTestId('footer')).toHaveClass('custom-footer-class')
    })

    it('カスタムclassNameが適用される（Title）', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle className="custom-title-class">タイトル</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(screen.getByText('タイトル')).toHaveClass('custom-title-class')
    })

    it('カスタムclassNameが適用される（Description）', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
            <AlertDialogDescription className="custom-description-class">
              説明
            </AlertDialogDescription>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(screen.getByText('説明')).toHaveClass('custom-description-class')
    })

    it('カスタムclassNameが適用される（Action）', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
            <AlertDialogAction className="custom-action-class">確認</AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(screen.getByText('確認')).toHaveClass('custom-action-class')
    })

    it('カスタムclassNameが適用される（Cancel）', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
            <AlertDialogCancel className="custom-cancel-class">キャンセル</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(screen.getByText('キャンセル')).toHaveClass('custom-cancel-class')
    })
  })

  // ============================================================
  // アクセシビリティ
  // ============================================================

  describe('アクセシビリティ', () => {
    it('alertdialogロールが設定される', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    it('data-slot属性が設定される', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByText('開く'))
      const dialog = screen.getByRole('alertdialog')
      expect(dialog).toHaveAttribute('data-slot', 'alert-dialog-content')
    })
  })

  // ============================================================
  // 実用的なユースケース
  // ============================================================

  describe('実用的なユースケース', () => {
    it('削除確認ダイアログのパターン', async () => {
      const handleDelete = vi.fn()
      const user = userEvent.setup()

      render(
        <AlertDialog>
          <AlertDialogTrigger>削除</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                この操作は取り消せません。投稿は完全に削除されます。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>削除</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )

      await user.click(screen.getByRole('button', { name: '削除' }))
      expect(screen.getByText('本当に削除しますか？')).toBeInTheDocument()
      expect(screen.getByText('この操作は取り消せません。投稿は完全に削除されます。')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '削除' }))
      expect(handleDelete).toHaveBeenCalledTimes(1)
    })

    it('asChildを使用したトリガー', async () => {
      const user = userEvent.setup()
      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="custom-button">カスタムボタン</button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>タイトル</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      )

      const trigger = screen.getByText('カスタムボタン')
      expect(trigger).toHaveClass('custom-button')

      await user.click(trigger)
      expect(screen.getByText('タイトル')).toBeInTheDocument()
    })
  })

  // ============================================================
  // Overlay と Portal
  // ============================================================

  describe('Overlay と Portal', () => {
    it('AlertDialogOverlayが単独でレンダリングできる', () => {
      render(
        <AlertDialog open={true}>
          <AlertDialogPortal>
            <AlertDialogOverlay data-testid="overlay" />
          </AlertDialogPortal>
        </AlertDialog>
      )
      expect(screen.getByTestId('overlay')).toBeInTheDocument()
    })

    it('AlertDialogOverlayにカスタムclassNameが適用される', () => {
      render(
        <AlertDialog open={true}>
          <AlertDialogPortal>
            <AlertDialogOverlay className="custom-overlay" data-testid="overlay" />
          </AlertDialogPortal>
        </AlertDialog>
      )
      expect(screen.getByTestId('overlay')).toHaveClass('custom-overlay')
    })
  })

  // ============================================================
  // エッジケース
  // ============================================================

  describe('エッジケース', () => {
    it('子要素なしでもエラーにならない', () => {
      render(<AlertDialog />)
      // エラーが発生しないことを確認
      expect(document.body).toBeInTheDocument()
    })

    it('defaultOpenで初期状態を制御', () => {
      render(
        <AlertDialog defaultOpen={true}>
          <AlertDialogTrigger>開く</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>初期表示</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      )
      expect(screen.getByText('初期表示')).toBeInTheDocument()
    })
  })
})
