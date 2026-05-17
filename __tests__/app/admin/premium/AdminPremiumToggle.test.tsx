/**
 * AdminPremiumToggle component tests
 *
 * Targets: handleToggle function, error branch, and state updates.
 * The component was previously only rendered as a mock stub.
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../../utils/test-utils'
import { AdminPremiumToggle } from '@/app/admin/premium/AdminPremiumToggle'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mockToggleAdminPremium = vi.fn()
vi.mock('@/lib/actions/admin/premium', () => ({
  toggleAdminPremium: (...args: unknown[]) => mockToggleAdminPremium(...args),
}))

vi.mock('lucide-react', () => ({
  Crown: ({ className }: { className?: string }) => (
    <span data-testid="crown-icon" className={className} />
  ),
}))

describe('AdminPremiumToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders OFF state when isPremium is false', () => {
    render(<AdminPremiumToggle isPremium={false} />)

    expect(screen.getByText('管理者プレミアム確認モード')).toBeInTheDocument()
    expect(screen.getByText(/無効/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ONにする' })).toBeInTheDocument()
  })

  it('renders ON state when isPremium is true', () => {
    render(<AdminPremiumToggle isPremium={true} />)

    expect(screen.getByText(/有効/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'OFFにする' })).toBeInTheDocument()
  })

  it('toggles premium state on successful API call', async () => {
    mockToggleAdminPremium.mockResolvedValueOnce({ success: true, data: { isPremium: true } })

    render(<AdminPremiumToggle isPremium={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'ONにする' }))

    await waitFor(() => {
      expect(mockToggleAdminPremium).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
    // State should have updated to ON
    expect(screen.getByRole('button', { name: 'OFFにする' })).toBeInTheDocument()
  })

  it('reverts state when toggling OFF successfully', async () => {
    mockToggleAdminPremium.mockResolvedValueOnce({ success: true, data: { isPremium: false } })

    render(<AdminPremiumToggle isPremium={true} />)
    fireEvent.click(screen.getByRole('button', { name: 'OFFにする' }))

    await waitFor(() => {
      expect(mockToggleAdminPremium).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ONにする' })).toBeInTheDocument()
    })
  })

  it('does not update state when API returns error', async () => {
    mockToggleAdminPremium.mockResolvedValueOnce({ success: false, error: 'Not authorized' })

    render(<AdminPremiumToggle isPremium={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'ONにする' }))

    await waitFor(() => {
      expect(mockToggleAdminPremium).toHaveBeenCalled()
    })
    // State should remain OFF because of the error
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ONにする' })).toBeInTheDocument()
    })
    // router.refresh should NOT have been called on error
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('shows loading text while toggling', async () => {
    // Make the promise hang to observe loading state
    let resolve: (v: unknown) => void
    mockToggleAdminPremium.mockReturnValueOnce(
      new Promise((r) => { resolve = r })
    )

    render(<AdminPremiumToggle isPremium={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'ONにする' }))

    // Should show loading
    expect(screen.getByRole('button', { name: '切替中...' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '切替中...' })).toBeDisabled()

    // Resolve to finish
    resolve!({ success: true, data: { isPremium: true } })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'OFFにする' })).toBeInTheDocument()
    })
  })

  it('applies yellow crown color when premium is active', () => {
    render(<AdminPremiumToggle isPremium={true} />)
    const crown = screen.getByTestId('crown-icon')
    expect(crown.className).toContain('text-yellow-500')
  })

  it('applies muted crown color when premium is inactive', () => {
    render(<AdminPremiumToggle isPremium={false} />)
    const crown = screen.getByTestId('crown-icon')
    expect(crown.className).toContain('text-muted-foreground')
  })
})
