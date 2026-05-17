import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { ThemeToggle, ThemeSelect } from '@/components/theme/ThemeToggle'

// useTheme モック
const mockSetTheme = vi.fn()
let mockTheme = 'light'

vi.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
  }),
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTheme = 'light'
  })

  it('トグルボタンを表示する', () => {
    render(<ThemeToggle />)

    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('ライトモードで太陽アイコンを表示する', () => {
    mockTheme = 'light'
    const { container } = render(<ThemeToggle />)

    // SVGアイコンが表示される
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('ダークモードで月アイコンを表示する', () => {
    mockTheme = 'dark'
    const { container } = render(<ThemeToggle />)

    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('システムモードでモニターアイコンを表示する', () => {
    mockTheme = 'system'
    const { container } = render(<ThemeToggle />)

    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('クリックでライトからダークに切り替える', () => {
    mockTheme = 'light'
    render(<ThemeToggle />)

    fireEvent.click(screen.getByRole('button'))

    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('クリックでダークからシステムに切り替える', () => {
    mockTheme = 'dark'
    render(<ThemeToggle />)

    fireEvent.click(screen.getByRole('button'))

    expect(mockSetTheme).toHaveBeenCalledWith('system')
  })

  it('クリックでシステムからライトに切り替える', () => {
    mockTheme = 'system'
    render(<ThemeToggle />)

    fireEvent.click(screen.getByRole('button'))

    expect(mockSetTheme).toHaveBeenCalledWith('light')
  })

  it('showLabelがtrueの場合ラベルを表示する', () => {
    mockTheme = 'light'
    render(<ThemeToggle showLabel />)

    expect(screen.getByText('ライト')).toBeInTheDocument()
  })

  it('showLabelがfalseの場合ラベルを表示しない', () => {
    mockTheme = 'light'
    render(<ThemeToggle showLabel={false} />)

    expect(screen.queryByText('ライト')).not.toBeInTheDocument()
  })

  it('デフォルトでラベルを表示しない', () => {
    mockTheme = 'light'
    render(<ThemeToggle />)

    expect(screen.queryByText('ライト')).not.toBeInTheDocument()
  })

  it('ダークモードでラベルを表示する', () => {
    mockTheme = 'dark'
    render(<ThemeToggle showLabel />)

    expect(screen.getByText('ダーク')).toBeInTheDocument()
  })

  it('システムモードでラベルを表示する', () => {
    mockTheme = 'system'
    render(<ThemeToggle showLabel />)

    expect(screen.getByText('システム')).toBeInTheDocument()
  })

  it('カスタムクラスを適用する', () => {
    render(<ThemeToggle className="ml-4" />)

    expect(screen.getByRole('button')).toHaveClass('ml-4')
  })

  it('titleにモード情報を表示する', () => {
    mockTheme = 'light'
    render(<ThemeToggle />)

    expect(screen.getByRole('button')).toHaveAttribute('title', '現在: ライトモード')
  })

  it('aria-labelにモード情報を表示する', () => {
    mockTheme = 'dark'
    render(<ThemeToggle />)

    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'テーマを切り替える（現在: ダークモード）'
    )
  })
})

describe('ThemeSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTheme = 'light'
  })

  it('3つのテーマボタンを表示する', () => {
    render(<ThemeSelect />)

    expect(screen.getByText('ライト')).toBeInTheDocument()
    expect(screen.getByText('ダーク')).toBeInTheDocument()
    expect(screen.getByText('自動')).toBeInTheDocument()
  })

  it('「テーマ」ラベルを表示する', () => {
    render(<ThemeSelect />)

    expect(screen.getByText('テーマ')).toBeInTheDocument()
  })

  it('ライトボタンをクリックするとライトモードに設定する', () => {
    render(<ThemeSelect />)

    fireEvent.click(screen.getByText('ライト'))

    expect(mockSetTheme).toHaveBeenCalledWith('light')
  })

  it('ダークボタンをクリックするとダークモードに設定する', () => {
    render(<ThemeSelect />)

    fireEvent.click(screen.getByText('ダーク'))

    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('自動ボタンをクリックするとシステムモードに設定する', () => {
    render(<ThemeSelect />)

    fireEvent.click(screen.getByText('自動'))

    expect(mockSetTheme).toHaveBeenCalledWith('system')
  })

  it('選択中のボタンにprimaryスタイルを適用する', () => {
    mockTheme = 'light'
    render(<ThemeSelect />)

    const lightButton = screen.getByText('ライト').closest('button')
    expect(lightButton).toHaveClass('bg-primary')
  })

  it('未選択のボタンにmutedスタイルを適用する', () => {
    mockTheme = 'light'
    render(<ThemeSelect />)

    const darkButton = screen.getByText('ダーク').closest('button')
    expect(darkButton).toHaveClass('bg-muted')
  })

  it('カスタムクラスを適用する', () => {
    const { container } = render(<ThemeSelect className="mt-4" />)

    expect(container.firstChild).toHaveClass('mt-4')
  })

  it('ライトボタンにaria-pressed属性を設定する', () => {
    mockTheme = 'light'
    render(<ThemeSelect />)

    const lightButton = screen.getByText('ライト').closest('button')
    expect(lightButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('未選択ボタンにaria-pressed=falseを設定する', () => {
    mockTheme = 'light'
    render(<ThemeSelect />)

    const darkButton = screen.getByText('ダーク').closest('button')
    expect(darkButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('ボタンにaria-label属性を設定する', () => {
    render(<ThemeSelect />)

    const lightButton = screen.getByText('ライト').closest('button')
    expect(lightButton).toHaveAttribute('aria-label', 'ライトモードに設定')
  })

  it('各ボタンにアイコンを表示する', () => {
    const { container } = render(<ThemeSelect />)

    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(3)
  })
})
