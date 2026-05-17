import { vi } from 'vitest'
/**
 * キーボードショートカットプロバイダーのテスト
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { KeyboardShortcutsProvider } from '@/components/common/KeyboardShortcutsProvider'

// useKeyboardShortcutsをモック
const mockSetShowHelp = vi.fn()
type UseKeyboardShortcutsOptions = {
  userId: string
  onNewPost?: () => void
}
type UseKeyboardShortcutsReturn = {
  showHelp: boolean
  setShowHelp: (value: boolean) => void
  gKeyPressed: boolean
}

const mockUseKeyboardShortcuts = vi.fn<(options: UseKeyboardShortcutsOptions) => UseKeyboardShortcutsReturn>(() => ({
  showHelp: false,
  setShowHelp: mockSetShowHelp,
  gKeyPressed: false,
}))

vi.mock('@/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: (options: UseKeyboardShortcutsOptions) => mockUseKeyboardShortcuts(options),
  KEYBOARD_SHORTCUTS: [],
}))

// KeyboardShortcutsHelpをモック
vi.mock('@/components/common/KeyboardShortcutsHelp', () => ({
  KeyboardShortcutsHelp: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="help-modal" onClick={onClose}>
        Help Modal
      </div>
    ) : null,
}))

describe('KeyboardShortcutsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseKeyboardShortcuts.mockReturnValue({
      showHelp: false,
      setShowHelp: mockSetShowHelp,
      gKeyPressed: false,
    })
  })

  it('基本的にレンダリングできる', () => {
    render(<KeyboardShortcutsProvider userId="user-1" />)
    // showHelp=falseなのでモーダルは表示されない
    expect(screen.queryByTestId('help-modal')).not.toBeInTheDocument()
  })

  it('showHelp=trueの場合はヘルプモーダルが表示される', () => {
    mockUseKeyboardShortcuts.mockReturnValue({
      showHelp: true,
      setShowHelp: mockSetShowHelp,
      gKeyPressed: false,
    })

    render(<KeyboardShortcutsProvider userId="user-1" />)
    expect(screen.getByTestId('help-modal')).toBeInTheDocument()
  })

  it('gKeyPressed=trueの場合はインジケーターが表示される', () => {
    mockUseKeyboardShortcuts.mockReturnValue({
      showHelp: false,
      setShowHelp: mockSetShowHelp,
      gKeyPressed: true,
    })

    render(<KeyboardShortcutsProvider userId="user-1" />)
    expect(screen.getByText(/の後にキーを押してください/)).toBeInTheDocument()
  })

  it('ヘルプモーダルを閉じるとsetShowHelp(false)が呼ばれる', () => {
    mockUseKeyboardShortcuts.mockReturnValue({
      showHelp: true,
      setShowHelp: mockSetShowHelp,
      gKeyPressed: false,
    })

    render(<KeyboardShortcutsProvider userId="user-1" />)

    fireEvent.click(screen.getByTestId('help-modal'))
    expect(mockSetShowHelp).toHaveBeenCalledWith(false)
  })

  describe('onNewPost', () => {
    it('コンポーズボタンが存在する場合はクリックする', () => {
      const mockClick = vi.fn()
      const composeButton = document.createElement('button')
      composeButton.setAttribute('data-compose-button', 'true')
      composeButton.onclick = mockClick
      document.body.appendChild(composeButton)

      // onNewPostコールバックをキャプチャ
      let capturedOnNewPost: (() => void) | undefined
      mockUseKeyboardShortcuts.mockImplementation((options: UseKeyboardShortcutsOptions) => {
        capturedOnNewPost = options.onNewPost
        return {
          showHelp: false,
          setShowHelp: mockSetShowHelp,
          gKeyPressed: false,
        }
      })

      render(<KeyboardShortcutsProvider userId="user-1" />)

      // onNewPostを呼び出す
      if (capturedOnNewPost) {
        capturedOnNewPost()
      }

      expect(mockClick).toHaveBeenCalled()

      // クリーンアップ
      document.body.removeChild(composeButton)
    })

    it('コンポーズボタンが存在しない場合は何もしない', () => {
      let capturedOnNewPost: (() => void) | undefined
      mockUseKeyboardShortcuts.mockImplementation((options: UseKeyboardShortcutsOptions) => {
        capturedOnNewPost = options.onNewPost
        return {
          showHelp: false,
          setShowHelp: mockSetShowHelp,
          gKeyPressed: false,
        }
      })

      render(<KeyboardShortcutsProvider userId="user-1" />)

      // エラーなく実行できることを確認
      expect(() => {
        if (capturedOnNewPost) {
          capturedOnNewPost()
        }
      }).not.toThrow()
    })
  })

  describe('アクセシビリティ', () => {
    it('gKeyPressedインジケーターにrole="status"が設定されている', () => {
      mockUseKeyboardShortcuts.mockReturnValue({
        showHelp: false,
        setShowHelp: mockSetShowHelp,
        gKeyPressed: true,
      })

      render(<KeyboardShortcutsProvider userId="user-1" />)
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('gKeyPressedインジケーターにaria-live="polite"が設定されている', () => {
      mockUseKeyboardShortcuts.mockReturnValue({
        showHelp: false,
        setShowHelp: mockSetShowHelp,
        gKeyPressed: true,
      })

      render(<KeyboardShortcutsProvider userId="user-1" />)
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    })
  })
})
