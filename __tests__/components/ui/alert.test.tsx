import { render, screen } from '@testing-library/react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

describe('Alert', () => {
  describe('Alert (ルートコンポーネント)', () => {
    it('子要素を表示する', () => {
      render(
        <Alert>
          <span data-testid="child">Child</span>
        </Alert>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('data-slot属性をalertに設定する', () => {
      render(<Alert>Content</Alert>)

      expect(screen.getByRole('alert')).toHaveAttribute('data-slot', 'alert')
    })

    it('role="alert"を設定する', () => {
      render(<Alert>Content</Alert>)

      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('基本的なスタイルクラスを適用する', () => {
      render(<Alert>Content</Alert>)

      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('relative')
      expect(alert).toHaveClass('w-full')
      expect(alert).toHaveClass('rounded-lg')
      expect(alert).toHaveClass('border')
      expect(alert).toHaveClass('px-4')
      expect(alert).toHaveClass('py-3')
    })

    describe('variant', () => {
      it('default variantを適用する', () => {
        render(<Alert variant="default">Default</Alert>)

        expect(screen.getByRole('alert')).toHaveClass('bg-card')
        expect(screen.getByRole('alert')).toHaveClass('text-card-foreground')
      })

      it('destructive variantを適用する', () => {
        render(<Alert variant="destructive">Error</Alert>)

        expect(screen.getByRole('alert')).toHaveClass('text-destructive')
        expect(screen.getByRole('alert')).toHaveClass('bg-card')
      })

      it('デフォルトでdefault variantを使用する', () => {
        render(<Alert>Default</Alert>)

        expect(screen.getByRole('alert')).toHaveClass('bg-card')
      })
    })

    it('追加のクラスを適用する', () => {
      render(<Alert className="custom-class">Content</Alert>)

      expect(screen.getByRole('alert')).toHaveClass('custom-class')
    })
  })

  describe('AlertTitle', () => {
    it('タイトルテキストを表示する', () => {
      render(<AlertTitle>お知らせ</AlertTitle>)

      expect(screen.getByText('お知らせ')).toBeInTheDocument()
    })

    it('data-slot属性をalert-titleに設定する', () => {
      render(<AlertTitle>Title</AlertTitle>)

      expect(screen.getByText('Title')).toHaveAttribute('data-slot', 'alert-title')
    })

    it('スタイルクラスを適用する', () => {
      render(<AlertTitle>Title</AlertTitle>)

      const title = screen.getByText('Title')
      expect(title).toHaveClass('col-start-2')
      expect(title).toHaveClass('font-medium')
      expect(title).toHaveClass('tracking-tight')
    })

    it('追加のクラスを適用する', () => {
      render(<AlertTitle className="custom-class">Title</AlertTitle>)

      expect(screen.getByText('Title')).toHaveClass('custom-class')
    })
  })

  describe('AlertDescription', () => {
    it('説明テキストを表示する', () => {
      render(<AlertDescription>これは説明文です。</AlertDescription>)

      expect(screen.getByText('これは説明文です。')).toBeInTheDocument()
    })

    it('data-slot属性をalert-descriptionに設定する', () => {
      render(<AlertDescription>Description</AlertDescription>)

      expect(screen.getByText('Description')).toHaveAttribute('data-slot', 'alert-description')
    })

    it('スタイルクラスを適用する', () => {
      render(<AlertDescription>Description</AlertDescription>)

      const description = screen.getByText('Description')
      expect(description).toHaveClass('text-muted-foreground')
      expect(description).toHaveClass('col-start-2')
      expect(description).toHaveClass('text-sm')
    })

    it('追加のクラスを適用する', () => {
      render(<AlertDescription className="custom-class">Description</AlertDescription>)

      expect(screen.getByText('Description')).toHaveClass('custom-class')
    })
  })

  describe('完全な構成', () => {
    it('すべてのパーツを組み合わせて表示する', () => {
      render(
        <Alert>
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>
            投稿の削除に失敗しました。
          </AlertDescription>
        </Alert>
      )

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('エラー')).toBeInTheDocument()
      expect(screen.getByText('投稿の削除に失敗しました。')).toBeInTheDocument()
    })

    it('アイコン付きアラートを表示する', () => {
      render(
        <Alert variant="destructive">
          <svg data-testid="icon" className="h-4 w-4" />
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>問題が発生しました。</AlertDescription>
        </Alert>
      )

      expect(screen.getByTestId('icon')).toBeInTheDocument()
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })
  })
})
