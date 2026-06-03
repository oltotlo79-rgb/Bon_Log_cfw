import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { OnboardingComplete } from '@/components/onboarding/OnboardingComplete'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

const mockComplete = vi.fn()
vi.mock('@/lib/actions/onboarding', () => ({
  completeOnboarding: () => mockComplete(),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))

describe('OnboardingComplete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockComplete.mockResolvedValue({ success: true })
  })

  it('クリックで完了を記録しフィードへ遷移する', async () => {
    render(<OnboardingComplete />)
    fireEvent.click(screen.getByRole('button', { name: 'はじめる' }))

    await waitFor(() => {
      expect(mockComplete).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })
  })

  it('失敗時はエラートーストを出し遷移しない', async () => {
    mockComplete.mockResolvedValue({ success: false, error: '失敗' })
    render(<OnboardingComplete />)
    fireEvent.click(screen.getByRole('button', { name: 'はじめる' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})
