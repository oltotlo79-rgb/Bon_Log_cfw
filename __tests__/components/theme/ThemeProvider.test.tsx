import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider, useTheme } from '@/components/theme/ThemeProvider'
import { act } from 'react'

// localStorageモック
type MockLocalStorage = {
  store: Record<string, string>
  getItem: ReturnType<typeof vi.fn>
  setItem: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
}

const mockLocalStorage: MockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string): string | null => mockLocalStorage.store[key] || null),
  setItem: vi.fn((key: string, value: string): void => {
    mockLocalStorage.store[key] = value
  }),
  clear: vi.fn((): void => {
    mockLocalStorage.store = {}
  }),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

// matchMediaモック
let mockDarkMode = false
const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: query === '(prefers-color-scheme: dark)' && mockDarkMode,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

Object.defineProperty(window, 'matchMedia', {
  value: mockMatchMedia,
  writable: true,
})

// テスト用コンポーネント
function TestComponent() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <button onClick={() => setTheme('light')}>Light</button>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('system')}>System</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()
    mockDarkMode = false
    // document.documentElementのクラスをクリア
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.style.colorScheme = ''
  })

  it('子コンポーネントをレンダリングする', async () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Child</div>
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })
  })

  it('デフォルトでsystemテーマを使用する', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    // マウント前はsystemがデフォルト
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
  })

  it('localStorageからテーマを読み込む', async () => {
    mockLocalStorage.setItem('theme', 'dark')

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    })
  })

  it('テーマを変更するとlocalStorageに保存する', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toBeInTheDocument()
    })

    act(() => {
      screen.getByText('Dark').click()
    })

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark')
    })
  })

  it('テーマをlightに変更できる', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toBeInTheDocument()
    })

    act(() => {
      screen.getByText('Light').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('light')
    })
  })

  it('テーマをdarkに変更できる', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toBeInTheDocument()
    })

    act(() => {
      screen.getByText('Dark').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    })
  })

  it('テーマをsystemに変更できる', async () => {
    mockLocalStorage.setItem('theme', 'light')

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toBeInTheDocument()
    })

    act(() => {
      screen.getByText('System').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('system')
    })
  })

  it('darkテーマの場合resolvedThemeがdarkになる', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toBeInTheDocument()
    })

    act(() => {
      screen.getByText('Dark').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark')
    })
  })

  it('lightテーマの場合resolvedThemeがlightになる', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toBeInTheDocument()
    })

    act(() => {
      screen.getByText('Light').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light')
    })
  })

  it('systemテーマでOSがダークモードの場合resolvedThemeがdarkになる', async () => {
    mockDarkMode = true

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toBeInTheDocument()
    })

    act(() => {
      screen.getByText('System').click()
    })

    await waitFor(() => {
      // OSがダークモードなのでdarkになる
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark')
    })
  })
})

describe('useTheme', () => {
  it('ThemeProvider外で使用するとエラーをスローする', () => {
    // コンソールエラーを抑制
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useTheme must be used within a ThemeProvider')

    consoleSpy.mockRestore()
  })
})
