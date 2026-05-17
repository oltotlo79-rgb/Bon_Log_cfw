import { render, screen } from '../../utils/test-utils'
import { LoadingScreen, LoadingSpinner, PageLoading } from '@/components/common/LoadingScreen'

describe('LoadingScreen', () => {
  it('フルスクリーンモードでロゴを表示する', () => {
    render(<LoadingScreen />)

    expect(screen.getByAltText('BON-LOG')).toBeInTheDocument()
  })

  it('メッセージを表示する', () => {
    render(<LoadingScreen message="データを読み込んでいます..." />)

    expect(screen.getByText('データを読み込んでいます...')).toBeInTheDocument()
  })

  it('メッセージがない場合は表示しない', () => {
    render(<LoadingScreen />)

    expect(screen.queryByText('データを読み込んでいます...')).not.toBeInTheDocument()
  })

  it('フルスクリーンモードで固定位置のコンテナを使用する', () => {
    const { container } = render(<LoadingScreen fullScreen={true} />)

    const overlay = container.querySelector('.fixed.inset-0')
    expect(overlay).toBeInTheDocument()
  })

  it('インラインモードでは固定位置を使用しない', () => {
    const { container } = render(<LoadingScreen fullScreen={false} />)

    expect(container.querySelector('.fixed')).not.toBeInTheDocument()
  })

  it('小サイズでレンダリングする', () => {
    render(<LoadingScreen size="sm" fullScreen={false} />)

    const logo = screen.getByAltText('BON-LOG')
    expect(logo).toHaveAttribute('width', '80')
  })

  it('中サイズでレンダリングする', () => {
    render(<LoadingScreen size="md" fullScreen={false} />)

    const logo = screen.getByAltText('BON-LOG')
    expect(logo).toHaveAttribute('width', '120')
  })

  it('大サイズでレンダリングする', () => {
    render(<LoadingScreen size="lg" fullScreen={false} />)

    const logo = screen.getByAltText('BON-LOG')
    expect(logo).toHaveAttribute('width', '160')
  })

  it('ローディングドットを表示する', () => {
    const { container } = render(<LoadingScreen fullScreen={false} />)

    const dots = container.querySelectorAll('.animate-bounce')
    expect(dots.length).toBe(3)
  })

  it('パルスアニメーションを持つ背景を表示する', () => {
    const { container } = render(<LoadingScreen fullScreen={false} />)

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('メッセージにパルスアニメーションを適用する', () => {
    render(<LoadingScreen message="データを処理中..." />)

    const messageEl = screen.getByText('データを処理中...')
    expect(messageEl).toHaveClass('animate-pulse')
  })

  it('ローディングテキストを指定すると表示される', () => {
    render(<LoadingScreen message="しばらくお待ちください" />)

    expect(screen.getByText('しばらくお待ちください')).toBeInTheDocument()
  })

  it('ローディングテキスト未指定時はテキストが表示されない', () => {
    const { container } = render(<LoadingScreen />)

    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(0)
  })

  it('ロゴ画像にdark:invertクラスを適用する', () => {
    render(<LoadingScreen fullScreen={false} />)

    const logo = screen.getByAltText('BON-LOG')
    expect(logo).toHaveClass('dark:invert')
  })

  it('デフォルトでフルスクリーンモードを使用する', () => {
    const { container } = render(<LoadingScreen />)

    expect(container.querySelector('.fixed.inset-0')).toBeInTheDocument()
  })
})

describe('LoadingSpinner', () => {
  it('スピナーを表示する', () => {
    const { container } = render(<LoadingSpinner />)

    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('カスタムクラスを適用する', () => {
    const { container } = render(<LoadingSpinner className="w-12 h-12" />)

    const spinner = container.firstChild as HTMLElement
    expect(spinner).toHaveClass('w-12', 'h-12')
  })

  it('円形のトラックを表示する', () => {
    const { container } = render(<LoadingSpinner />)

    expect(container.querySelector('.rounded-full.border-primary\\/20')).toBeInTheDocument()
  })
})

describe('PageLoading', () => {
  it('ロゴを表示する', () => {
    render(<PageLoading />)

    expect(screen.getByAltText('BON-LOG')).toBeInTheDocument()
  })

  it('最小高さのコンテナを使用する', () => {
    const { container } = render(<PageLoading />)

    expect(container.querySelector('.min-h-\\[50vh\\]')).toBeInTheDocument()
  })

  it('インラインモードで表示する', () => {
    const { container } = render(<PageLoading />)

    expect(container.querySelector('.fixed')).not.toBeInTheDocument()
  })
})

describe('アクセシビリティ', () => {
  it('role="status"があること', () => {
    render(<LoadingScreen fullScreen={false} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('aria-live="polite"があること', () => {
    render(<LoadingScreen fullScreen={false} />)

    const statusElement = screen.getByRole('status')
    expect(statusElement).toHaveAttribute('aria-live', 'polite')
  })

  it('sr-onlyのテキスト"読み込み中..."があること', () => {
    render(<LoadingScreen fullScreen={false} />)

    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    expect(screen.getByText('読み込み中...')).toHaveClass('sr-only')
  })
})
