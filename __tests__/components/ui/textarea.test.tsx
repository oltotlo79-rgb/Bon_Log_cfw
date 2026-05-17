import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Textarea } from '@/components/ui/textarea'

describe('Textarea', () => {
  it('textarea要素をレンダリングする', () => {
    render(<Textarea placeholder="コメントを入力..." />)

    expect(screen.getByPlaceholderText('コメントを入力...')).toBeInTheDocument()
  })

  it('data-slot属性をtextareaに設定する', () => {
    render(<Textarea placeholder="テスト" />)

    expect(screen.getByPlaceholderText('テスト')).toHaveAttribute('data-slot', 'textarea')
  })

  it('カスタムclassNameをマージする', () => {
    render(<Textarea className="min-h-32" placeholder="テスト" />)

    expect(screen.getByPlaceholderText('テスト')).toHaveClass('min-h-32')
  })

  describe('disabled状態', () => {
    it('disabled属性で無効化される', () => {
      render(<Textarea disabled placeholder="無効" />)

      expect(screen.getByPlaceholderText('無効')).toBeDisabled()
    })
  })

  describe('入力操作', () => {
    it('複数行テキストを入力できる', () => {
      render(<Textarea placeholder="入力欄" />)

      const textarea = screen.getByPlaceholderText('入力欄')
      fireEvent.change(textarea, { target: { value: '複数行の\nテスト入力' } })

      expect(textarea).toHaveValue('複数行の\nテスト入力')
    })

    it('onChangeコールバックを呼び出す', () => {
      const handleChange = vi.fn()
      render(<Textarea onChange={handleChange} placeholder="入力欄" />)

      fireEvent.change(screen.getByPlaceholderText('入力欄'), { target: { value: 'test' } })

      expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it('制御コンポーネントとしてvalueを保持する', () => {
      render(<Textarea value="制御値" onChange={() => {}} placeholder="入力欄" />)

      expect(screen.getByPlaceholderText('入力欄')).toHaveValue('制御値')
    })
  })

  describe('HTML属性の透過', () => {
    it.each([
      ['rows', '5'],
      ['maxLength', '500'],
      ['name', 'content'],
    ] as const)('%s属性を適用する', (attr, value) => {
      const numericAttrs = ['rows', 'maxLength']
      const propValue = numericAttrs.includes(attr) ? Number(value) : value
      render(<Textarea {...{ [attr]: propValue }} placeholder="テスト" />)

      expect(screen.getByPlaceholderText('テスト')).toHaveAttribute(attr, value)
    })
  })

  describe('バリデーション・アクセシビリティ', () => {
    it('aria-invalid属性を適用する', () => {
      render(<Textarea aria-invalid="true" placeholder="エラー" />)

      expect(screen.getByPlaceholderText('エラー')).toHaveAttribute('aria-invalid', 'true')
    })

    it('required属性を適用する', () => {
      render(<Textarea required placeholder="必須" />)

      expect(screen.getByPlaceholderText('必須')).toBeRequired()
    })
  })
})
