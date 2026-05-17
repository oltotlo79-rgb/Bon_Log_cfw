import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/badge'

describe('Badge', () => {
  it('テキストを表示する', () => {
    render(<Badge>新着</Badge>)

    expect(screen.getByText('新着')).toBeInTheDocument()
  })

  it('デフォルトでspan要素としてレンダリングする', () => {
    render(<Badge>ステータス</Badge>)

    const badge = screen.getByText('ステータス')
    expect(badge.tagName).toBe('SPAN')
  })

  it('asChildで子要素のHTML要素としてレンダリングする', () => {
    render(
      <Badge asChild>
        <a href="/test">リンクバッジ</a>
      </Badge>
    )

    const link = screen.getByRole('link', { name: 'リンクバッジ' })
    expect(link).toHaveAttribute('href', '/test')
    expect(link.tagName).toBe('A')
  })

  it('カスタムclassNameが適用される', () => {
    render(<Badge className="my-custom">カスタム</Badge>)

    expect(screen.getByText('カスタム')).toHaveClass('my-custom')
  })

  it('data-slot="badge"が設定される', () => {
    render(<Badge>バッジ</Badge>)

    expect(screen.getByText('バッジ')).toHaveAttribute('data-slot', 'badge')
  })

  it.each([
    'default',
    'secondary',
    'destructive',
    'outline',
  ] as const)('variant="%s" が正しくレンダリングされる', (variant) => {
    render(<Badge variant={variant}>{variant}</Badge>)

    expect(screen.getByText(variant)).toBeInTheDocument()
  })

  it('variantを省略するとdefaultが適用される', () => {
    const { container: withDefault } = render(<Badge variant="default">A</Badge>)
    const { container: withoutVariant } = render(<Badge>B</Badge>)

    const classesWithDefault = withDefault.firstChild as HTMLElement
    const classesWithout = withoutVariant.firstChild as HTMLElement
    expect(classesWithDefault.className).toBe(classesWithout.className)
  })

  it('アイコンとテキストを含む複合コンテンツを表示する', () => {
    render(
      <Badge>
        <svg data-testid="icon" />
        <span>テスト</span>
      </Badge>
    )

    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('テスト')).toBeInTheDocument()
  })

  it('aria属性を透過する', () => {
    render(<Badge aria-label="未読3件">3</Badge>)

    expect(screen.getByText('3')).toHaveAttribute('aria-label', '未読3件')
  })
})
