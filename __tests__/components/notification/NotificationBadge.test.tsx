import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'

// useQueryモック（QueryClientは実際の実装を保持）
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: vi.fn(),
  }
})

// Server Action モック（Prisma依存を回避）
vi.mock('@/lib/actions/notification', () => ({
  getUnreadCount: vi.fn(),
}))
vi.mock('@/lib/services/notification-core', () => ({
  getUnreadCount: vi.fn(),
}))

import { NotificationBadge } from '@/components/notification/NotificationBadge'
import { useQuery } from '@tanstack/react-query'

const mockUseQuery = useQuery as ReturnType<typeof vi.fn>

describe('NotificationBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未読数が0の場合は何も表示しない', () => {
    mockUseQuery.mockReturnValue({ data: { count: 0 } })

    const { container } = render(<NotificationBadge />)

    expect(container.querySelector('span')).not.toBeInTheDocument()
  })

  it('未読数を表示する', () => {
    mockUseQuery.mockReturnValue({ data: { count: 5 } })

    render(<NotificationBadge />)

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('未読数が100以上の場合は99+と表示する', () => {
    mockUseQuery.mockReturnValue({ data: { count: 150 } })

    render(<NotificationBadge />)

    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('未読数がちょうど99の場合は99と表示する', () => {
    mockUseQuery.mockReturnValue({ data: { count: 99 } })

    render(<NotificationBadge />)

    expect(screen.getByText('99')).toBeInTheDocument()
  })

  it('classNameを適用できる', () => {
    mockUseQuery.mockReturnValue({ data: { count: 5 } })

    render(<NotificationBadge className="custom-class" />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('custom-class')
  })

  it('バッジは背景色を持つ', () => {
    mockUseQuery.mockReturnValue({ data: { count: 5 } })

    render(<NotificationBadge />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('bg-foreground')
  })

  it('バッジは丸みを持つ', () => {
    mockUseQuery.mockReturnValue({ data: { count: 5 } })

    render(<NotificationBadge />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('rounded-full')
  })

  it('データ取得失敗時は0として扱い何も表示しない', () => {
    mockUseQuery.mockReturnValue({ data: {} })

    const { container } = render(<NotificationBadge />)

    expect(container.querySelector('span')).not.toBeInTheDocument()
  })

  // ============================================================
  // 追加テスト
  // ============================================================

  it('未読数が1の場合1を表示する', () => {
    mockUseQuery.mockReturnValue({ data: { count: 1 } })

    render(<NotificationBadge />)

    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('未読数が10の場合10を表示する', () => {
    mockUseQuery.mockReturnValue({ data: { count: 10 } })

    render(<NotificationBadge />)

    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('未読数が50の場合50を表示する', () => {
    mockUseQuery.mockReturnValue({ data: { count: 50 } })

    render(<NotificationBadge />)

    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('未読数がちょうど100の場合99+と表示する', () => {
    mockUseQuery.mockReturnValue({ data: { count: 100 } })

    render(<NotificationBadge />)

    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('30秒間隔でリフェッチ設定されている', () => {
    mockUseQuery.mockReturnValue({ data: { count: 3 } })

    render(<NotificationBadge />)

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        refetchInterval: 30000,
      })
    )
  })

  it('queryKeyがunreadCountである', () => {
    mockUseQuery.mockReturnValue({ data: { count: 0 } })

    render(<NotificationBadge />)

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['unreadCount'],
      })
    )
  })

  it('dataがnullの場合は何も表示しない', () => {
    mockUseQuery.mockReturnValue({ data: null })

    const { container } = render(<NotificationBadge />)

    expect(container.querySelector('span')).not.toBeInTheDocument()
  })

  it('dataがundefinedの場合は何も表示しない', () => {
    mockUseQuery.mockReturnValue({ data: undefined })

    const { container } = render(<NotificationBadge />)

    expect(container.querySelector('span')).not.toBeInTheDocument()
  })

  it('ローディング中はカウント0として何も表示しない', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true })

    const { container } = render(<NotificationBadge />)

    expect(container.querySelector('span')).not.toBeInTheDocument()
  })

  it('エラー状態でもdataがなければ何も表示しない', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isError: true, error: new Error('fail') })

    const { container } = render(<NotificationBadge />)

    expect(container.querySelector('span')).not.toBeInTheDocument()
  })

  it('バッジはspan要素でレンダリングされる', () => {
    mockUseQuery.mockReturnValue({ data: { count: 5 } })

    render(<NotificationBadge />)

    const badge = screen.getByText('5')
    expect(badge.tagName).toBe('SPAN')
  })

  it('バッジはテキスト色を持つ', () => {
    mockUseQuery.mockReturnValue({ data: { count: 5 } })

    render(<NotificationBadge />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('text-background')
  })

  it('バッジはインラインフレックスを持つ', () => {
    mockUseQuery.mockReturnValue({ data: { count: 5 } })

    render(<NotificationBadge />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('inline-flex')
  })

  it('バッジは最小幅18pxを持つ', () => {
    mockUseQuery.mockReturnValue({ data: { count: 5 } })

    render(<NotificationBadge />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('min-w-[18px]')
  })

  it('classNameが指定されない場合もエラーにならない', () => {
    mockUseQuery.mockReturnValue({ data: { count: 3 } })

    const { container } = render(<NotificationBadge />)

    expect(container.querySelector('span')).toBeInTheDocument()
  })

  // ============================================================
  // アクセシビリティ
  // ============================================================

  describe('アクセシビリティ', () => {
    it('バッジにaria-label="未読通知N件"があること', () => {
      mockUseQuery.mockReturnValue({ data: { count: 5 } })

      render(<NotificationBadge />)

      const badge = screen.getByText('5')
      expect(badge).toHaveAttribute('aria-label', '未読通知5件')
    })

    it('通知数が変わるとaria-labelも変わること', () => {
      mockUseQuery.mockReturnValue({ data: { count: 3 } })
      const { rerender } = render(<NotificationBadge />)

      expect(screen.getByText('3')).toHaveAttribute('aria-label', '未読通知3件')

      mockUseQuery.mockReturnValue({ data: { count: 42 } })
      rerender(<NotificationBadge />)

      expect(screen.getByText('42')).toHaveAttribute('aria-label', '未読通知42件')
    })
  })
})
