import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('テキストを表示する', () => {
    render(<Button>クリック</Button>)

    expect(screen.getByRole('button', { name: 'クリック' })).toBeInTheDocument()
  })

  it('クリックイベントを処理する', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>クリック</Button>)

    fireEvent.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('disabled状態ではクリックイベントが発火しない', () => {
    const handleClick = vi.fn()
    render(<Button disabled onClick={handleClick}>無効</Button>)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('type属性を設定する', () => {
    render(<Button type="submit">送信</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('asChildで子要素のHTML要素としてレンダリングする', () => {
    render(
      <Button asChild>
        <a href="/test">リンクボタン</a>
      </Button>
    )

    const link = screen.getByRole('link', { name: 'リンクボタン' })
    expect(link).toHaveAttribute('href', '/test')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('カスタムclassNameが適用される', () => {
    render(<Button className="my-custom">カスタム</Button>)

    expect(screen.getByRole('button')).toHaveClass('my-custom')
  })

  it.each([
    'default',
    'destructive',
    'outline',
    'secondary',
    'ghost',
    'link',
    'bonsai',
  ] as const)('variant="%s" がdata-variant属性に反映される', (variant) => {
    render(<Button variant={variant}>{variant}</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('data-variant', variant)
  })

  // bonsai variant: 投稿系 CTA で使用。ダークモードでテキストが読めなくなる
  // 不具合を防ぐため、`bg-bonsai-green` と `text-white` が常にセットで適用される
  // ことを変数化された前提として固定する。
  describe('bonsai variant', () => {
    it('bg-bonsai-green と text-white を必ず併せ持つ（dark theme で text-primary-foreground 依存に戻らない）', () => {
      render(<Button variant="bonsai">投稿する</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-bonsai-green')
      expect(button).toHaveClass('text-white')
    })

    it('hover 時のスタイルが bg-bonsai-green/90 で定義される', () => {
      render(<Button variant="bonsai">投稿する</Button>)
      const button = screen.getByRole('button')
      // tailwind の hover variant はクラス文字列として残る
      expect(button.className).toContain('hover:bg-bonsai-green/90')
    })
  })

  it.each([
    'default',
    'sm',
    'lg',
    'icon',
    'icon-sm',
    'icon-lg',
  ] as const)('size="%s" がdata-size属性に反映される', (size) => {
    render(<Button size={size}>{size}</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('data-size', size)
  })

  it('variantとsizeを省略するとデフォルト値が適用される', () => {
    render(<Button>デフォルト</Button>)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('data-variant', 'default')
    expect(button).toHaveAttribute('data-size', 'default')
  })

  it('data-slot="button"が設定される', () => {
    render(<Button>ボタン</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('data-slot', 'button')
  })

  it('aria-label等のアクセシビリティ属性を透過する', () => {
    render(<Button aria-label="閉じる" aria-pressed="true">×</Button>)

    const button = screen.getByRole('button', { name: '閉じる' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })
})
