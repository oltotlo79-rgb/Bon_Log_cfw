import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Switch } from '@/components/ui/switch'

describe('Switch', () => {
  it('スイッチを表示する', () => {
    render(<Switch />)

    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('data-slot属性をswitchに設定する', () => {
    render(<Switch />)

    expect(screen.getByRole('switch')).toHaveAttribute('data-slot', 'switch')
  })

  describe('状態管理', () => {
    it('初期状態はオフ', () => {
      render(<Switch />)

      expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'unchecked')
    })

    it('checked=trueでオン状態になる', () => {
      render(<Switch checked />)

      expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked')
    })

    it('クリックで状態が切り替わる', () => {
      const handleChange = vi.fn()
      render(<Switch onCheckedChange={handleChange} />)

      fireEvent.click(screen.getByRole('switch'))

      expect(handleChange).toHaveBeenCalledWith(true)
    })

    it('制御コンポーネントとして動作する', () => {
      const handleChange = vi.fn()
      const { rerender } = render(<Switch checked={false} onCheckedChange={handleChange} />)

      expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'unchecked')

      rerender(<Switch checked={true} onCheckedChange={handleChange} />)

      expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked')
    })
  })

  describe('disabled状態', () => {
    it('disabledの場合は無効化する', () => {
      render(<Switch disabled />)

      expect(screen.getByRole('switch')).toBeDisabled()
    })

    it('disabledの場合はクリックしても反応しない', () => {
      const handleChange = vi.fn()
      render(<Switch disabled onCheckedChange={handleChange} />)

      fireEvent.click(screen.getByRole('switch'))

      expect(handleChange).not.toHaveBeenCalled()
    })

    it('disabled時のスタイルクラスを持つ', () => {
      render(<Switch />)

      const switchElement = screen.getByRole('switch')
      expect(switchElement).toHaveClass('disabled:cursor-not-allowed')
      expect(switchElement).toHaveClass('disabled:opacity-50')
    })
  })

  describe('スタイル', () => {
    it('基本的なスタイルクラスを適用する', () => {
      render(<Switch />)

      const switchElement = screen.getByRole('switch')
      expect(switchElement).toHaveClass('peer')
      expect(switchElement).toHaveClass('inline-flex')
      expect(switchElement).toHaveClass('items-center')
      expect(switchElement).toHaveClass('rounded-full')
    })

    it('追加のクラスを適用する', () => {
      render(<Switch className="custom-class" />)

      expect(screen.getByRole('switch')).toHaveClass('custom-class')
    })
  })

  describe('Thumb（つまみ）', () => {
    it('Thumb要素を含む', () => {
      const { container } = render(<Switch />)

      const thumb = container.querySelector('[data-slot="switch-thumb"]')
      expect(thumb).toBeInTheDocument()
    })

    it('Thumbにスタイルクラスを適用する', () => {
      const { container } = render(<Switch />)

      const thumb = container.querySelector('[data-slot="switch-thumb"]')
      expect(thumb).toHaveClass('block')
      expect(thumb).toHaveClass('size-4')
      expect(thumb).toHaveClass('rounded-full')
    })
  })

  describe('属性', () => {
    it('id属性を適用する', () => {
      render(<Switch id="my-switch" />)

      expect(screen.getByRole('switch')).toHaveAttribute('id', 'my-switch')
    })

    it('aria-label属性を適用する', () => {
      render(<Switch aria-label="通知を有効にする" />)

      expect(screen.getByRole('switch', { name: '通知を有効にする' })).toBeInTheDocument()
    })
  })
})
