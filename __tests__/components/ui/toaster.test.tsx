import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Toaster } from '@/components/ui/toaster'

// useToast フックをモック
const mockToasts: Array<{
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}> = []

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toasts: mockToasts,
    toast: vi.fn(),
  }),
}))

describe('Toaster', () => {
  beforeEach(() => {
    // モックをリセット
    mockToasts.length = 0
  })

  it('トーストがない場合は空のコンテナを表示する', () => {
    const { container } = render(<Toaster />)

    const toasterContainer = container.firstChild
    expect(toasterContainer).toBeInTheDocument()
    expect(toasterContainer).toHaveClass('fixed')
    expect(toasterContainer).toHaveClass('bottom-4')
    expect(toasterContainer).toHaveClass('right-4')
    expect(toasterContainer).toHaveClass('z-50')
  })

  it('トーストを表示する', () => {
    mockToasts.push({
      id: '1',
      title: 'テストタイトル',
      description: 'テスト説明文',
    })

    render(<Toaster />)

    expect(screen.getByText('テストタイトル')).toBeInTheDocument()
    expect(screen.getByText('テスト説明文')).toBeInTheDocument()
  })

  it('複数のトーストを表示する', () => {
    mockToasts.push({
      id: '1',
      title: '通知1',
    })
    mockToasts.push({
      id: '2',
      title: '通知2',
    })

    render(<Toaster />)

    expect(screen.getByText('通知1')).toBeInTheDocument()
    expect(screen.getByText('通知2')).toBeInTheDocument()
  })

  it('タイトルのみのトーストを表示する', () => {
    mockToasts.push({
      id: '1',
      title: 'タイトルのみ',
    })

    render(<Toaster />)

    expect(screen.getByText('タイトルのみ')).toBeInTheDocument()
  })

  it('説明文のみのトーストを表示する', () => {
    mockToasts.push({
      id: '1',
      description: '説明文のみ',
    })

    render(<Toaster />)

    expect(screen.getByText('説明文のみ')).toBeInTheDocument()
  })

  it('destructiveバリアントのスタイルを適用する', () => {
    mockToasts.push({
      id: '1',
      title: 'エラー',
      variant: 'destructive',
    })

    render(<Toaster />)

    const toast = screen.getByText('エラー').parentElement
    expect(toast).toHaveClass('bg-destructive/10')
    expect(toast).toHaveClass('border-destructive/20')
    expect(toast).toHaveClass('text-destructive')
  })

  it('デフォルトバリアントのスタイルを適用する', () => {
    mockToasts.push({
      id: '1',
      title: '成功',
      variant: 'default',
    })

    render(<Toaster />)

    const toast = screen.getByText('成功').parentElement
    expect(toast).toHaveClass('bg-white')
    expect(toast).toHaveClass('border-gray-200')
    expect(toast).toHaveClass('text-gray-900')
  })

  it('バリアント未指定の場合はデフォルトスタイルを適用する', () => {
    mockToasts.push({
      id: '1',
      title: '通知',
    })

    render(<Toaster />)

    const toast = screen.getByText('通知').parentElement
    expect(toast).toHaveClass('bg-white')
    expect(toast).toHaveClass('border-gray-200')
  })

  it('トーストに基本的なスタイルを適用する', () => {
    mockToasts.push({
      id: '1',
      title: 'テスト',
    })

    render(<Toaster />)

    const toast = screen.getByText('テスト').parentElement
    expect(toast).toHaveClass('rounded-lg')
    expect(toast).toHaveClass('border')
    expect(toast).toHaveClass('px-4')
    expect(toast).toHaveClass('py-3')
    expect(toast).toHaveClass('shadow-lg')
  })

  it('タイトルにフォントスタイルを適用する', () => {
    mockToasts.push({
      id: '1',
      title: 'タイトル',
    })

    render(<Toaster />)

    const title = screen.getByText('タイトル')
    expect(title).toHaveClass('font-semibold')
    expect(title).toHaveClass('text-sm')
  })

  it('説明文にスタイルを適用する', () => {
    mockToasts.push({
      id: '1',
      description: '説明文',
    })

    render(<Toaster />)

    const description = screen.getByText('説明文')
    expect(description).toHaveClass('text-sm')
    expect(description).toHaveClass('opacity-90')
  })

  it('コンテナにflex-colクラスを適用する', () => {
    const { container } = render(<Toaster />)

    const toasterContainer = container.firstChild
    expect(toasterContainer).toHaveClass('flex')
    expect(toasterContainer).toHaveClass('flex-col')
    expect(toasterContainer).toHaveClass('gap-2')
  })
})
