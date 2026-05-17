import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/components/post/PostFormModal', () => ({
  PostFormModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="post-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}))

import { ComposeButton } from '@/components/feed/ComposeButton'

describe('ComposeButton', () => {
  const defaultProps = {
    genres: {} as Record<string, { id: string; name: string; category: string }[]>,
    limits: {
      maxPostLength: 500,
      maxImages: 4,
      maxVideos: 1,
      canSchedulePost: false,
      canViewAnalytics: false,
    },
  }

  it('renders floating action button with aria-label="投稿を作成"', () => {
    render(<ComposeButton {...defaultProps} />)
    const button = screen.getByRole('button', { name: '投稿を作成' })
    expect(button).toBeInTheDocument()
  })

  it('opens modal when button is clicked', () => {
    render(<ComposeButton {...defaultProps} />)
    expect(screen.queryByTestId('post-modal')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '投稿を作成' }))
    expect(screen.getByTestId('post-modal')).toBeInTheDocument()
  })

  it('has data-compose-button attribute', () => {
    render(<ComposeButton {...defaultProps} />)
    const button = screen.getByRole('button', { name: '投稿を作成' })
    expect(button).toHaveAttribute('data-compose-button')
  })

  it('closes modal when onClose is called', () => {
    render(<ComposeButton {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: '投稿を作成' }))
    expect(screen.getByTestId('post-modal')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByTestId('post-modal')).not.toBeInTheDocument()
  })
})
