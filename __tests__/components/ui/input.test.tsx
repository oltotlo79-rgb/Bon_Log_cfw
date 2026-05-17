import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from '@/components/ui/input'

describe('Input', () => {
  it('input要素をレンダリングする', () => {
    render(<Input placeholder="テスト入力" />)

    expect(screen.getByPlaceholderText('テスト入力')).toBeInTheDocument()
  })

  it('data-slot属性をinputに設定する', () => {
    render(<Input placeholder="テスト" />)

    expect(screen.getByPlaceholderText('テスト')).toHaveAttribute('data-slot', 'input')
  })

  it('カスタムclassNameをマージする', () => {
    render(<Input className="custom-class" placeholder="テスト" />)

    expect(screen.getByPlaceholderText('テスト')).toHaveClass('custom-class')
  })

  describe('type属性', () => {
    it.each([
      ['email', 'email'],
      ['password', 'password'],
      ['number', 'number'],
      ['search', 'search'],
    ] as const)('type="%s"を適用する', (type, expected) => {
      render(<Input type={type} placeholder="テスト" />)

      expect(screen.getByPlaceholderText('テスト')).toHaveAttribute('type', expected)
    })
  })

  describe('disabled状態', () => {
    it('disabled属性で無効化される', () => {
      render(<Input disabled placeholder="無効" />)

      expect(screen.getByPlaceholderText('無効')).toBeDisabled()
    })
  })

  describe('入力操作', () => {
    it('テキストを入力できる', () => {
      render(<Input placeholder="入力欄" />)

      const input = screen.getByPlaceholderText('入力欄')
      fireEvent.change(input, { target: { value: 'テスト入力値' } })

      expect(input).toHaveValue('テスト入力値')
    })

    it('onChangeコールバックを呼び出す', () => {
      const handleChange = vi.fn()
      render(<Input onChange={handleChange} placeholder="入力欄" />)

      fireEvent.change(screen.getByPlaceholderText('入力欄'), { target: { value: 'test' } })

      expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it('制御コンポーネントとしてvalueを保持する', () => {
      render(<Input value="制御値" onChange={() => {}} placeholder="入力欄" />)

      expect(screen.getByPlaceholderText('入力欄')).toHaveValue('制御値')
    })
  })

  describe('HTML属性の透過', () => {
    it.each([
      ['name', 'email', 'name', 'email'],
      ['id', 'my-input', 'id', 'my-input'],
      ['autoComplete', 'email', 'autoComplete', 'email'],
    ] as const)('%s属性を適用する', (_label, value, attr, expected) => {
      render(<Input {...{ [attr]: value }} placeholder="テスト" />)

      expect(screen.getByPlaceholderText('テスト')).toHaveAttribute(attr, expected)
    })

    it('maxLength属性を適用する', () => {
      render(<Input maxLength={100} placeholder="テスト" />)

      expect(screen.getByPlaceholderText('テスト')).toHaveAttribute('maxLength', '100')
    })
  })

  describe('バリデーション・アクセシビリティ', () => {
    it('aria-invalid属性を適用する', () => {
      render(<Input aria-invalid="true" placeholder="エラー" />)

      expect(screen.getByPlaceholderText('エラー')).toHaveAttribute('aria-invalid', 'true')
    })

    it('required属性を適用する', () => {
      render(<Input required placeholder="必須" />)

      expect(screen.getByPlaceholderText('必須')).toBeRequired()
    })
  })
})
