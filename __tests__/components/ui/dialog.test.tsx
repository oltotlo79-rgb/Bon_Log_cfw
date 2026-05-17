import { render, screen, fireEvent } from '@testing-library/react'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog'

describe('Dialog', () => {
  describe('Dialog (ルートコンポーネント)', () => {
    it('子要素を表示する', () => {
      render(
        <Dialog>
          <span data-testid="child">Child</span>
        </Dialog>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
    })
  })

  describe('DialogTrigger', () => {
    it('トリガーボタンを表示する', () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
        </Dialog>
      )

      expect(screen.getByText('Open Dialog')).toBeInTheDocument()
    })

    it('data-slot属性をdialog-triggerに設定する', () => {
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
        </Dialog>
      )

      expect(screen.getByText('Open')).toHaveAttribute('data-slot', 'dialog-trigger')
    })

    it('asChildでカスタム要素をトリガーにできる', () => {
      render(
        <Dialog>
          <DialogTrigger asChild>
            <button data-testid="custom-trigger">Custom Button</button>
          </DialogTrigger>
        </Dialog>
      )

      expect(screen.getByTestId('custom-trigger')).toBeInTheDocument()
    })
  })

  describe('DialogContent', () => {
    it('開いているときにコンテンツを表示する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <div>Dialog Content</div>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Dialog Content')).toBeInTheDocument()
    })

    it('data-slot属性をdialog-contentに設定する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <span>Content</span>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Content').closest('[data-slot="dialog-content"]')).toBeInTheDocument()
    })

    it('閉じるボタンをデフォルトで表示する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <span>Content</span>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument()
    })

    it('showCloseButton=falseで閉じるボタンを非表示にする', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent showCloseButton={false}>
            <DialogTitle>Title</DialogTitle>
            <span>Content</span>
          </DialogContent>
        </Dialog>
      )

      expect(screen.queryByRole('button', { name: '閉じる' })).not.toBeInTheDocument()
    })

    it('追加のクラスを適用する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent className="custom-class">
            <DialogTitle>Title</DialogTitle>
            <span>Content</span>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Content').closest('[data-slot="dialog-content"]')).toHaveClass('custom-class')
    })
  })

  describe('DialogHeader', () => {
    it('ヘッダーコンテンツを表示する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogHeader>
              <span data-testid="header-content">Header</span>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByTestId('header-content')).toBeInTheDocument()
    })

    it('data-slot属性をdialog-headerに設定する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogHeader data-testid="header">Header</DialogHeader>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByTestId('header')).toHaveAttribute('data-slot', 'dialog-header')
    })

    it('スタイルクラスを適用する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogHeader data-testid="header">Header</DialogHeader>
          </DialogContent>
        </Dialog>
      )

      const header = screen.getByTestId('header')
      expect(header).toHaveClass('flex')
      expect(header).toHaveClass('flex-col')
      expect(header).toHaveClass('gap-2')
    })

    it('追加のクラスを適用する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogHeader data-testid="header" className="custom-class">Header</DialogHeader>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByTestId('header')).toHaveClass('custom-class')
    })
  })

  describe('DialogFooter', () => {
    it('フッターコンテンツを表示する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogFooter>
              <button>Cancel</button>
              <button>Save</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Save')).toBeInTheDocument()
    })

    it('data-slot属性をdialog-footerに設定する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogFooter data-testid="footer">Footer</DialogFooter>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByTestId('footer')).toHaveAttribute('data-slot', 'dialog-footer')
    })

    it('スタイルクラスを適用する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogFooter data-testid="footer">Footer</DialogFooter>
          </DialogContent>
        </Dialog>
      )

      const footer = screen.getByTestId('footer')
      expect(footer).toHaveClass('flex')
      expect(footer).toHaveClass('flex-col-reverse')
      expect(footer).toHaveClass('gap-2')
    })

    it('追加のクラスを適用する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogFooter data-testid="footer" className="custom-class">Footer</DialogFooter>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByTestId('footer')).toHaveClass('custom-class')
    })
  })

  describe('DialogTitle', () => {
    it('タイトルを表示する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    })

    it('data-slot属性をdialog-titleに設定する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Title')).toHaveAttribute('data-slot', 'dialog-title')
    })

    it('スタイルクラスを適用する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      const title = screen.getByText('Title')
      expect(title).toHaveClass('text-lg')
      expect(title).toHaveClass('font-semibold')
    })

    it('追加のクラスを適用する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle className="custom-class">Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Title')).toHaveClass('custom-class')
    })
  })

  describe('DialogDescription', () => {
    it('説明文を表示する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogDescription>This is a description</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('This is a description')).toBeInTheDocument()
    })

    it('data-slot属性をdialog-descriptionに設定する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogDescription>Description</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Description')).toHaveAttribute('data-slot', 'dialog-description')
    })

    it('スタイルクラスを適用する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogDescription>Description</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      const desc = screen.getByText('Description')
      expect(desc).toHaveClass('text-muted-foreground')
      expect(desc).toHaveClass('text-sm')
    })

    it('追加のクラスを適用する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogDescription className="custom-class">Description</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Description')).toHaveClass('custom-class')
    })
  })

  describe('DialogClose', () => {
    it('閉じるボタンを表示する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogClose>Close Dialog</DialogClose>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Close Dialog')).toBeInTheDocument()
    })

    it('data-slot属性をdialog-closeに設定する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogClose data-testid="close-btn">Close</DialogClose>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByTestId('close-btn')).toHaveAttribute('data-slot', 'dialog-close')
    })
  })

  describe('DialogOverlay', () => {
    it('オーバーレイを表示する', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <span>Content</span>
          </DialogContent>
        </Dialog>
      )

      // オーバーレイはDialogContentの中で自動的にレンダリングされる
      expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeInTheDocument()
    })

    it('追加のクラスを適用する', () => {
      render(
        <Dialog defaultOpen>
          <DialogPortal>
            <DialogOverlay className="custom-overlay" data-testid="overlay" />
          </DialogPortal>
        </Dialog>
      )

      const overlay = document.querySelector('[data-testid="overlay"]')
      expect(overlay).toHaveClass('custom-overlay')
    })
  })

  describe('完全な構成', () => {
    it('すべてのパーツを組み合わせて表示する', () => {
      render(
        <Dialog defaultOpen>
          <DialogTrigger asChild>
            <button>開く</button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>プロフィール編集</DialogTitle>
              <DialogDescription>
                プロフィール情報を編集できます。
              </DialogDescription>
            </DialogHeader>
            <div>フォームコンテンツ</div>
            <DialogFooter>
              <DialogClose asChild>
                <button>キャンセル</button>
              </DialogClose>
              <button>保存</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('プロフィール編集')).toBeInTheDocument()
      expect(screen.getByText('プロフィール情報を編集できます。')).toBeInTheDocument()
      expect(screen.getByText('フォームコンテンツ')).toBeInTheDocument()
      expect(screen.getByText('キャンセル')).toBeInTheDocument()
      expect(screen.getByText('保存')).toBeInTheDocument()
    })

    it('トリガーをクリックするとダイアログが開く', () => {
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Content</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      // 初期状態ではダイアログは閉じている
      expect(screen.queryByText('Dialog Content')).not.toBeInTheDocument()

      // トリガーをクリック
      fireEvent.click(screen.getByText('Open'))

      // ダイアログが開く
      expect(screen.getByText('Dialog Content')).toBeInTheDocument()
    })

    it('閉じるボタンをクリックするとダイアログが閉じる', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>ダイアログタイトル</DialogTitle>
            <span>ダイアログコンテンツ</span>
          </DialogContent>
        </Dialog>
      )

      // ダイアログが開いている
      expect(screen.getByText('ダイアログコンテンツ')).toBeInTheDocument()

      // 閉じるボタンをクリック
      fireEvent.click(screen.getByRole('button', { name: '閉じる' }))

      // ダイアログが閉じる
      expect(screen.queryByText('ダイアログコンテンツ')).not.toBeInTheDocument()
    })
  })
})
