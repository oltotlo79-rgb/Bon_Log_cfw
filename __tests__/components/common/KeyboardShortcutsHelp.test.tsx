import { vi } from 'vitest'
/**
 * キーボードショートカットヘルプのテスト
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { KeyboardShortcutsHelp } from '@/components/common/KeyboardShortcutsHelp'

// KEYBOARD_SHORTCUTSをモック
vi.mock('@/hooks/use-keyboard-shortcuts', () => ({
  KEYBOARD_SHORTCUTS: [
    { keys: 'g f', description: 'フィードへ移動', category: 'navigation' },
    { keys: 'g n', description: '通知へ移動', category: 'navigation' },
    { keys: 'n', description: '新規投稿', category: 'actions' },
    { keys: '?', description: 'ヘルプを表示', category: 'general' },
  ],
}))

describe('KeyboardShortcutsHelp', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基本レンダリング', () => {
    it('isOpen=trueの場合にモーダルが表示される', () => {
      render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('キーボードショートカット')).toBeInTheDocument()
    })

    it('isOpen=falseの場合は何も表示されない', () => {
      render(<KeyboardShortcutsHelp isOpen={false} onClose={mockOnClose} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('カテゴリごとにグループ化されて表示される', () => {
      render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />)
      expect(screen.getByText('ナビゲーション')).toBeInTheDocument()
      expect(screen.getByText('アクション')).toBeInTheDocument()
      expect(screen.getByText('一般')).toBeInTheDocument()
    })

    it('ショートカットの説明が表示される', () => {
      render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />)
      expect(screen.getByText('フィードへ移動')).toBeInTheDocument()
      expect(screen.getByText('通知へ移動')).toBeInTheDocument()
      expect(screen.getByText('新規投稿')).toBeInTheDocument()
    })

    it('ヒントが表示される', () => {
      render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />)
      expect(screen.getByText(/ヒント:/)).toBeInTheDocument()
    })
  })

  describe('インタラクション', () => {
    it('閉じるボタンをクリックするとonCloseが呼ばれる', () => {
      render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />)

      const closeButton = screen.getByRole('button', { name: '閉じる' })
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('背景をクリックするとonCloseが呼ばれる', () => {
      render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />)

      const backdrop = screen.getByRole('dialog')
      fireEvent.click(backdrop)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('モーダル内部をクリックしてもonCloseは呼ばれない', () => {
      render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />)

      const modalContent = screen.getByText('キーボードショートカット')
      fireEvent.click(modalContent)

      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('Escapeキーを押すとonCloseが呼ばれる', () => {
      render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />)

      const dialog = screen.getByRole('dialog')
      fireEvent.keyDown(dialog, { key: 'Escape' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('他のキーを押してもonCloseは呼ばれない', () => {
      render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />)

      const dialog = screen.getByRole('dialog')
      fireEvent.keyDown(dialog, { key: 'Enter' })

      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('アクセシビリティ', () => {
    it('role="dialog"が設定されている', () => {
      render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('aria-modal="true"が設定されている', () => {
      render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />)
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    })

    it('aria-labelledbyが設定されている', () => {
      render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />)
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby', 'keyboard-shortcuts-title')
    })
  })

  describe('ShortcutKeys表示', () => {
    it('複数キーの場合は+で結合して表示される', () => {
      render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />)
      // "g f"などの複数キーが表示される
      expect(screen.getAllByText('g').length).toBeGreaterThan(0)
      expect(screen.getAllByText('f').length).toBeGreaterThan(0)
    })
  })
})
