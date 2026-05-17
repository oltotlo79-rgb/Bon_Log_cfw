import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { ShareButtons } from '@/components/post/ShareButtons'

// Button モック不要（shadcn/uiのButtonはそのまま利用）

describe('ShareButtons', () => {
  const defaultProps = {
    url: 'https://example.com/posts/123',
    title: '素敵な盆栽の投稿',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // clipboard API モック
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
    // window.open モック
    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  it('シェアラベルと全ボタンを表示する', () => {
    render(<ShareButtons {...defaultProps} />)

    expect(screen.getByText('シェア:')).toBeInTheDocument()
    expect(screen.getByLabelText('X(Twitter)でシェア')).toBeInTheDocument()
    expect(screen.getByLabelText('Facebookでシェア')).toBeInTheDocument()
    expect(screen.getByLabelText('LINEでシェア')).toBeInTheDocument()
    expect(screen.getByLabelText('リンクをコピー')).toBeInTheDocument()
  })

  it('Xシェアボタンをクリックするとシェアウィンドウを開く', () => {
    render(<ShareButtons {...defaultProps} />)

    fireEvent.click(screen.getByLabelText('X(Twitter)でシェア'))

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('twitter.com/intent/tweet'),
      '_blank',
      expect.any(String)
    )
  })

  it('リンクコピーボタンをクリックするとURLをクリップボードにコピーする', async () => {
    render(<ShareButtons {...defaultProps} />)

    fireEvent.click(screen.getByLabelText('リンクをコピー'))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(defaultProps.url)
    })
  })

  it('コピー成功後にコピー済表示に切り替わる', async () => {
    render(<ShareButtons {...defaultProps} />)

    fireEvent.click(screen.getByLabelText('リンクをコピー'))

    await waitFor(() => {
      expect(screen.getByText('コピー済')).toBeInTheDocument()
      expect(screen.getByLabelText('リンクをコピーしました')).toBeInTheDocument()
    })
  })

  it('textが指定されている場合はそのテキストをシェアに使用する', () => {
    render(<ShareButtons {...defaultProps} text="カスタムテキスト" />)

    fireEvent.click(screen.getByLabelText('X(Twitter)でシェア'))

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('カスタムテキスト')),
      '_blank',
      expect.any(String)
    )
  })
})
