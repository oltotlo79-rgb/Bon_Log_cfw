import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PasswordVisibilityToggle } from '@/components/auth/PasswordVisibilityToggle'

describe('PasswordVisibilityToggle', () => {
  it('show=falseの時「パスワードを表示」のaria-labelを持つ', () => {
    render(<PasswordVisibilityToggle show={false} onToggle={vi.fn()} />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'パスワードを表示')
  })

  it('show=trueの時「パスワードを隠す」のaria-labelを持つ', () => {
    render(<PasswordVisibilityToggle show={true} onToggle={vi.fn()} />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'パスワードを隠す')
  })

  it('show=falseの時はEyeアイコン（瞳の円を含む）を表示する', () => {
    const { container } = render(
      <PasswordVisibilityToggle show={false} onToggle={vi.fn()} />
    )
    const svg = container.querySelector('svg')!
    // lucide-react の Eye アイコンは瞳の circle 要素を持つ
    expect(svg.querySelector('circle')).toBeTruthy()
  })

  it('show=trueの時はEyeOffアイコン（円を持たず複数pathの取り消し表現）を表示する', () => {
    const { container } = render(
      <PasswordVisibilityToggle show={true} onToggle={vi.fn()} />
    )
    const svg = container.querySelector('svg')!
    // lucide-react の EyeOff は line ではなく path のみで構成され、circle を持たない
    expect(svg.querySelector('circle')).toBeNull()
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(1)
  })

  it('クリック時にonToggleコールバックが呼ばれる', async () => {
    const onToggle = vi.fn()
    render(<PasswordVisibilityToggle show={false} onToggle={onToggle} />)

    const button = screen.getByRole('button')
    await userEvent.click(button)

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('type="button"でフォーム送信を防止する', () => {
    render(<PasswordVisibilityToggle show={false} onToggle={vi.fn()} />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'button')
  })
})
