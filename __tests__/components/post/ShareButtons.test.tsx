import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ShareButtons } from '@/components/post/ShareButtons'

// window.openをモック
const mockWindowOpen = vi.fn()
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
})

// clipboardをモック（フォールバック用にexecCommandも）
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
  configurable: true,
})

describe('ShareButtons', () => {
  const defaultProps = {
    url: 'https://example.com/posts/123',
    title: 'テスト投稿タイトル',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('シェアラベルを表示する', () => {
    render(<ShareButtons {...defaultProps} />)
    expect(screen.getByText('シェア:')).toBeInTheDocument()
  })

  it('すべてのシェアボタンを表示する', () => {
    render(<ShareButtons {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'X(Twitter)でシェア' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Facebookでシェア' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LINEでシェア' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'リンクをコピー' })).toBeInTheDocument()
  })

  it('Xボタンをクリックするとシェアウィンドウを開く', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'X(Twitter)でシェア' }))

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('twitter.com/intent/tweet'),
      '_blank',
      expect.any(String)
    )
  })

  it('Facebookボタンをクリックするとシェアウィンドウを開く', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Facebookでシェア' }))

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('facebook.com/sharer'),
      '_blank',
      expect.any(String)
    )
  })

  it('LINEボタンをクリックするとシェアウィンドウを開く', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'LINEでシェア' }))

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('line.me'),
      '_blank',
      expect.any(String)
    )
  })

  it('リンクボタンをクリックするとコピー完了状態になる', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    // コピー前は「リンク」テキストが表示されている
    expect(screen.getByText('リンク')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'リンクをコピー' }))

    // コピー後は「コピー済」が表示される
    await waitFor(() => {
      expect(screen.getByText('コピー済')).toBeInTheDocument()
    })
  })

  it('textプロパティが指定されていない場合はtitleを使用する', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'X(Twitter)でシェア' }))

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(defaultProps.title)),
      '_blank',
      expect.any(String)
    )
  })

  it('textプロパティが指定されている場合はそれを使用する', async () => {
    const customText = 'カスタムシェアテキスト'
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} text={customText} />)

    await user.click(screen.getByRole('button', { name: 'X(Twitter)でシェア' }))

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(customText)),
      '_blank',
      expect.any(String)
    )
  })

  it('URLが正しくエンコードされる', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'X(Twitter)でシェア' }))

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(defaultProps.url)),
      '_blank',
      expect.any(String)
    )
  })

  it('navigator.clipboardが使えない場合はフォールバックでコピーする', async () => {
    // clipboardを一時的にundefinedにする
    const originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    // document.execCommandをモック
    const mockExecCommand = vi.fn().mockReturnValue(true)
    document.execCommand = mockExecCommand

    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'リンクをコピー' }))

    await waitFor(() => {
      expect(screen.getByText('コピー済')).toBeInTheDocument()
    })

    // 元に戻す
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    })
  })

  it('コピー後2秒で元のテキストに戻る', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'リンクをコピー' }))

    await waitFor(() => {
      expect(screen.getByText('コピー済')).toBeInTheDocument()
    })

    // 2秒経過
    vi.advanceTimersByTime(2000)

    await waitFor(() => {
      expect(screen.getByText('リンク')).toBeInTheDocument()
    })

    vi.useRealTimers()
  })

  it('XシェアURLにurl及びtextパラメータが含まれる', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'X(Twitter)でシェア' }))

    const calledUrl = mockWindowOpen.mock.calls[0][0] as string
    expect(calledUrl).toContain('url=')
    expect(calledUrl).toContain('text=')
    expect(calledUrl).toContain('twitter.com/intent/tweet')
  })

  it('FacebookシェアURLにuパラメータが含まれる', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Facebookでシェア' }))

    const calledUrl = mockWindowOpen.mock.calls[0][0] as string
    expect(calledUrl).toContain('u=')
    expect(calledUrl).toContain('facebook.com/sharer/sharer.php')
  })

  it('LINEシェアURLにurlパラメータが含まれる', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'LINEでシェア' }))

    const calledUrl = mockWindowOpen.mock.calls[0][0] as string
    expect(calledUrl).toContain('url=')
    expect(calledUrl).toContain('line.me')
  })

  it('window.openが正しいウィンドウサイズで呼ばれる', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'X(Twitter)でシェア' }))

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.any(String),
      '_blank',
      'width=600,height=400,noopener,noreferrer'
    )
  })

  it('タイトルの特殊文字がエンコードされる', async () => {
    const specialTitle = 'テスト&投稿<タイトル>'
    const user = userEvent.setup()
    render(<ShareButtons url={defaultProps.url} title={specialTitle} />)

    await user.click(screen.getByRole('button', { name: 'X(Twitter)でシェア' }))

    const calledUrl = mockWindowOpen.mock.calls[0][0] as string
    expect(calledUrl).toContain(encodeURIComponent(specialTitle))
    expect(calledUrl).not.toContain('&投稿')
  })

  it('URLの特殊文字がエンコードされる', async () => {
    const specialUrl = 'https://example.com/posts/123?q=盆栽&page=1'
    const user = userEvent.setup()
    render(<ShareButtons url={specialUrl} title={defaultProps.title} />)

    await user.click(screen.getByRole('button', { name: 'X(Twitter)でシェア' }))

    const calledUrl = mockWindowOpen.mock.calls[0][0] as string
    expect(calledUrl).toContain(encodeURIComponent(specialUrl))
  })
})
