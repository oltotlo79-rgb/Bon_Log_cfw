import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { PageError } from '@/components/common/PageError'

describe('PageError', () => {
  const defaultProps = {
    error: new Error('Test error') as Error & { digest?: string },
    reset: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows default title "エラーが発生しました"', () => {
    render(<PageError {...defaultProps} />)
    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
  })

  it('shows custom title', () => {
    render(<PageError {...defaultProps} title="カスタムエラー" />)
    expect(screen.getByText('カスタムエラー')).toBeInTheDocument()
  })

  it('shows default description', () => {
    render(<PageError {...defaultProps} />)
    expect(
      screen.getByText('一時的な問題が発生しています。しばらく待ってから再試行してください。')
    ).toBeInTheDocument()
  })

  it('shows custom description', () => {
    render(<PageError {...defaultProps} description="カスタム説明文" />)
    expect(screen.getByText('カスタム説明文')).toBeInTheDocument()
  })

  it('calls reset when "再試行" button clicked', () => {
    render(<PageError {...defaultProps} />)
    fireEvent.click(screen.getByText('再試行'))
    expect(defaultProps.reset).toHaveBeenCalledTimes(1)
  })

  it('shows link when linkHref and linkLabel provided', () => {
    render(
      <PageError {...defaultProps} linkHref="/feed" linkLabel="タイムラインへ" />
    )
    const link = screen.getByText('タイムラインへ')
    expect(link).toBeInTheDocument()
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/feed')
  })

  it('does not show link when linkHref not provided', () => {
    render(<PageError {...defaultProps} linkLabel="タイムラインへ" />)
    expect(screen.queryByText('タイムラインへ')).not.toBeInTheDocument()
  })

  it('shows icon when provided', () => {
    render(
      <PageError
        {...defaultProps}
        icon={<span data-testid="custom-icon">!</span>}
      />
    )
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })

  it('shows error message in development', () => {
    vi.stubEnv('NODE_ENV', 'development')

    render(<PageError {...defaultProps} />)
    expect(screen.getByText('Test error')).toBeInTheDocument()

    vi.unstubAllEnvs()
  })
})
