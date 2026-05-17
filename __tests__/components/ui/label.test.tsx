import { render, screen } from '@testing-library/react'
import { Label } from '@/components/ui/label'

describe('Label', () => {
  it('ラベルテキストを表示する', () => {
    render(<Label>メールアドレス</Label>)

    expect(screen.getByText('メールアドレス')).toBeInTheDocument()
  })

  it('data-slot属性をlabelに設定する', () => {
    render(<Label>テスト</Label>)

    expect(screen.getByText('テスト')).toHaveAttribute('data-slot', 'label')
  })

  it('カスタムclassNameをマージする', () => {
    render(<Label className="custom-class">テスト</Label>)

    expect(screen.getByText('テスト')).toHaveClass('custom-class')
  })

  it('htmlFor属性でフォーム要素と関連付ける', () => {
    render(<Label htmlFor="email">メールアドレス</Label>)

    expect(screen.getByText('メールアドレス')).toHaveAttribute('for', 'email')
  })

  it('子要素としてアイコンとテキストを表示する', () => {
    render(
      <Label>
        <svg data-testid="icon" />
        <span>パスワード</span>
      </Label>
    )

    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('パスワード')).toBeInTheDocument()
  })

  it('任意のHTML属性を透過する', () => {
    render(<Label id="my-label" aria-describedby="hint">テスト</Label>)

    const label = screen.getByText('テスト')
    expect(label).toHaveAttribute('id', 'my-label')
    expect(label).toHaveAttribute('aria-describedby', 'hint')
  })
})
