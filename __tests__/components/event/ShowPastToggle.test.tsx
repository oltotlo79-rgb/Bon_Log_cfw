import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { ShowPastToggle } from '@/components/event/ShowPastToggle'

// useSearchParams モック
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

describe('ShowPastToggle', () => {
  beforeEach(() => {
    mockSearchParams.delete('showPast')
    mockSearchParams.delete('region')
  })

  it('ラベルを表示する', () => {
    render(<ShowPastToggle showPast={false} />)

    expect(screen.getByText('終了イベントも表示')).toBeInTheDocument()
  })

  it('チェックボックスを表示する', () => {
    render(<ShowPastToggle showPast={false} />)

    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('非表示時はチェックボックスがオフ', () => {
    render(<ShowPastToggle showPast={false} />)

    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('表示時はチェックボックスがオン', () => {
    render(<ShowPastToggle showPast={true} />)

    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('リンクを持つ', () => {
    render(<ShowPastToggle showPast={false} />)

    expect(screen.getByRole('link')).toBeInTheDocument()
  })

  it('非表示→表示時のリンクにshowPastパラメータを追加', () => {
    render(<ShowPastToggle showPast={false} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/events?showPast=true')
  })

  it('表示→非表示時のリンクからshowPastパラメータを削除', () => {
    mockSearchParams.set('showPast', 'true')
    render(<ShowPastToggle showPast={true} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/events?')
  })

  it('他のパラメータを維持しながらshowPastを追加', () => {
    mockSearchParams.set('region', 'kanto')
    render(<ShowPastToggle showPast={false} />)

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toContain('region=kanto')
    expect(link.getAttribute('href')).toContain('showPast=true')
  })

  it('他のパラメータを維持しながらshowPastを削除', () => {
    mockSearchParams.set('region', 'kanto')
    mockSearchParams.set('showPast', 'true')
    render(<ShowPastToggle showPast={true} />)

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toContain('region=kanto')
    expect(link.getAttribute('href')).not.toContain('showPast=true')
  })

  it('チェックボックスは読み取り専用', () => {
    render(<ShowPastToggle showPast={false} />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('readonly')
  })
})
