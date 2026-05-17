import { render, screen } from '@testing-library/react'
import { FormError } from '@/components/common/FormError'

describe('FormError', () => {
  it('returns null when message is undefined', () => {
    const { container } = render(<FormError />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when message is null', () => {
    const { container } = render(<FormError message={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when message is empty string', () => {
    const { container } = render(<FormError message="" />)
    expect(container.innerHTML).toBe('')
  })

  it('shows error message text', () => {
    render(<FormError message="入力エラーがあります" />)
    expect(screen.getByText('入力エラーがあります')).toBeInTheDocument()
  })

  it('has role="alert" attribute', () => {
    render(<FormError message="エラー" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<FormError message="エラー" className="mt-2" />)
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('mt-2')
  })

  it('has destructive styling classes', () => {
    render(<FormError message="エラー" />)
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('bg-destructive/10')
    expect(alert.className).toContain('text-destructive')
  })
})
