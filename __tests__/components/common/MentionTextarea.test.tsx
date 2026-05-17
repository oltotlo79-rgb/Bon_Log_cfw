import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MentionTextarea } from '@/components/common/MentionTextarea'

// searchMentionUsersのモック
const mockSearchMentionUsers = vi.fn()
vi.mock('@/lib/actions/mention', () => ({
  searchMentionUsers: (...args: unknown[]) => mockSearchMentionUsers(...args),
}))

// next/image モック
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, width, height, className }: {
    src: string
    alt: string
    width?: number
    height?: number
    className?: string
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}))

describe('MentionTextarea', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    placeholder: 'テスト入力',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('テキストエリアを表示する', () => {
    render(<MentionTextarea {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('テスト入力')
    expect(textarea).toBeInTheDocument()
  })

  it('テキスト入力時にonChangeを呼び出す', () => {
    render(<MentionTextarea {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('テスト入力')
    fireEvent.change(textarea, { target: { value: 'こんにちは', selectionStart: 5 } })

    expect(defaultProps.onChange).toHaveBeenCalledWith('こんにちは')
  })

  it('@入力でメンション候補を検索する', async () => {
    const mockUsers = [
      { id: 'user-1', nickname: '盆栽太郎', avatarUrl: null, isFollowing: true },
      { id: 'user-2', nickname: '盆栽次郎', avatarUrl: '/avatar.jpg', isFollowing: false },
    ]
    mockSearchMentionUsers.mockResolvedValue(mockUsers)

    render(<MentionTextarea {...defaultProps} value="@" />)

    const textarea = screen.getByPlaceholderText('テスト入力')
    fireEvent.change(textarea, { target: { value: '@盆', selectionStart: 2 } })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(mockSearchMentionUsers).toHaveBeenCalledWith('盆', expect.any(Number))
    })
  })

  it('disabled状態のテキストエリアを表示する', () => {
    render(<MentionTextarea {...defaultProps} disabled={true} />)

    const textarea = screen.getByPlaceholderText('テスト入力')
    expect(textarea).toBeDisabled()
  })

  it('候補が表示されている状態でEscキーで閉じる', async () => {
    const mockUsers = [
      { id: 'user-1', nickname: '盆栽太郎', avatarUrl: null, isFollowing: false },
    ]
    mockSearchMentionUsers.mockResolvedValue(mockUsers)

    render(<MentionTextarea {...defaultProps} value="@" />)

    const textarea = screen.getByPlaceholderText('テスト入力')
    fireEvent.change(textarea, { target: { value: '@盆', selectionStart: 2 } })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(screen.getByText('@盆栽太郎')).toBeInTheDocument()
    })

    fireEvent.keyDown(textarea, { key: 'Escape' })

    expect(screen.queryByText('@盆栽太郎')).not.toBeInTheDocument()
  })
})
