import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'

// Most cases use a synchronous stub. The "Suspense fallback" case overrides this
// per-test so the LoadingFallback function (otherwise dead-code under sync render)
// gets exercised.
vi.mock('@/components/auth/PasswordResetConfirmForm', () => ({
  PasswordResetConfirmForm: () => <div data-testid="password-reset-confirm-form">MockForm</div>,
}))

import PasswordResetConfirmPage from '@/app/(auth)/password-reset/confirm/page'

describe('PasswordResetConfirmPage', () => {
  it('renders the card with title', () => {
    render(<PasswordResetConfirmPage />)
    expect(screen.getByText('新しいパスワードを設定')).toBeInTheDocument()
  })

  it('renders the PasswordResetConfirmForm', () => {
    render(<PasswordResetConfirmPage />)
    expect(screen.getByTestId('password-reset-confirm-form')).toBeInTheDocument()
  })

  it('exposes robots metadata = noindex for token-only flow', async () => {
    const mod = await import('@/app/(auth)/password-reset/confirm/page')
    expect(mod.metadata.title).toBe('パスワード再設定')
    expect(mod.metadata.robots).toEqual({ index: false, follow: false })
  })

  it('renders the LoadingFallback inside <Suspense> while the form is pending', async () => {
    // Force the form to suspend by throwing a never-resolving promise.
    // This is the documented React Suspense protocol; React then renders the
    // fallback. We re-mock the module + reset its cache so the page picks up
    // the suspending child.
    vi.resetModules()
    vi.doMock('@/components/auth/PasswordResetConfirmForm', () => ({
      PasswordResetConfirmForm: () => {
        throw new Promise(() => {
          /* never resolves — keeps Suspense in the fallback state */
        })
      },
    }))
    const { default: Page } = await import('@/app/(auth)/password-reset/confirm/page')
    const { container } = render(<Page />)
    // Spinner element + 読み込み中 text from LoadingFallback
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).not.toBeNull()
    vi.doUnmock('@/components/auth/PasswordResetConfirmForm')
  })
})
