

import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// React Queryモック
const mockQueryClient = {
  mount: vi.fn(),
  unmount: vi.fn(),
  clear: vi.fn(),
  getDefaultOptions: vi.fn().mockReturnValue({
    queries: {
      staleTime: 60000,
      refetchOnWindowFocus: false,
    },
  }),
}
vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn().mockImplementation(function() { return mockQueryClient }),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-client-provider">{children}</div>
  ),
}))

// ThemeProviderモック
vi.mock('@/components/theme/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}))

import { QueryClient as _QueryClient } from '@tanstack/react-query'
const MockQueryClient = _QueryClient as unknown as ReturnType<typeof vi.fn>
import { Providers } from '@/app/providers'

describe('Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('子コンポーネントをレンダリングする', () => {
    render(
      <Providers>
        <div data-testid="child">テストコンテンツ</div>
      </Providers>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('テストコンテンツ')).toBeInTheDocument()
  })

  it('QueryClientProviderでラップされている', () => {
    render(
      <Providers>
        <div>テスト</div>
      </Providers>
    )
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument()
  })

  it('ThemeProviderでラップされている', () => {
    render(
      <Providers>
        <div>テスト</div>
      </Providers>
    )
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument()
  })

  it('プロバイダーが正しい順序でネストされている', () => {
    render(
      <Providers>
        <div>テスト</div>
      </Providers>
    )
    const queryProvider = screen.getByTestId('query-client-provider')
    const themeProvider = screen.getByTestId('theme-provider')
    expect(queryProvider).toContainElement(themeProvider)
  })

  it('複数の子要素をレンダリングできる', () => {
    render(
      <Providers>
        <div data-testid="child1">子1</div>
        <div data-testid="child2">子2</div>
      </Providers>
    )
    expect(screen.getByTestId('child1')).toBeInTheDocument()
    expect(screen.getByTestId('child2')).toBeInTheDocument()
  })

  it('空の子要素でもエラーなくレンダリングされる', () => {
    const { container } = render(
      <Providers>
        {null}
      </Providers>
    )
    expect(container).toBeInTheDocument()
  })

  it('フラグメントを子要素として受け付ける', () => {
    render(
      <Providers>
        <>
          <span data-testid="fragment-child">フラグメント子要素</span>
        </>
      </Providers>
    )
    expect(screen.getByTestId('fragment-child')).toBeInTheDocument()
  })

  it('QueryClientが適切なデフォルトオプションで作成される', () => {
    render(
      <Providers>
        <div>テスト</div>
      </Providers>
    )
    expect(MockQueryClient).toHaveBeenCalledWith({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          refetchOnWindowFocus: false,
        },
      },
    })
  })

  it('再レンダリング時にQueryClientが再作成されない', () => {
    const { rerender } = render(
      <Providers>
        <div>テスト1</div>
      </Providers>
    )
    const callCount = MockQueryClient.mock.calls.length

    rerender(
      <Providers>
        <div>テスト2</div>
      </Providers>
    )
    // 再レンダリングしてもQueryClientの作成回数は増えない
    expect(MockQueryClient.mock.calls.length).toBe(callCount)
  })

  it('ネストされたコンポーネントがレンダリングされる', () => {
    render(
      <Providers>
        <div data-testid="parent">
          <div data-testid="nested-child">ネスト子要素</div>
        </div>
      </Providers>
    )
    expect(screen.getByTestId('parent')).toBeInTheDocument()
    expect(screen.getByTestId('nested-child')).toBeInTheDocument()
  })
})
