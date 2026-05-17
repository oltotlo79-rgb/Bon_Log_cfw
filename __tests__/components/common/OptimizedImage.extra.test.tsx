/**
 * OptimizedImage - extra branch coverage
 *
 * Targets:
 * - objectFit='contain' maps to object-contain class
 * - objectFit='fill' maps to object-fill class
 * - objectFit='none' maps to object-none class
 * - onClick handler is passed through
 * - onLoad transitions from loading to loaded state
 * - sizes prop is forwarded
 */

import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { OptimizedImage } from '@/components/common/OptimizedImage'

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    onLoad,
    onError,
    onClick,
    className,
    priority,
    loading,
  }: {
    src: string
    alt: string
    onLoad?: () => void
    onError?: () => void
    onClick?: (e: React.MouseEvent) => void
    className?: string
    priority?: boolean
    loading?: string
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onClick={onClick}
      onLoad={onLoad}
      onError={onError}
      data-priority={priority}
      data-loading={loading}
    />
  ),
}))

describe('OptimizedImage - extra branches', () => {
  it('objectFit=contain sets object-contain class', () => {
    render(
      <OptimizedImage src="/test.jpg" alt="test" width={100} height={100} objectFit="contain" />
    )
    expect(screen.getByRole('img')).toHaveClass('object-contain')
  })

  it('objectFit=fill sets object-fill class', () => {
    render(
      <OptimizedImage src="/test.jpg" alt="test" width={100} height={100} objectFit="fill" />
    )
    expect(screen.getByRole('img')).toHaveClass('object-fill')
  })

  it('objectFit=none sets object-none class', () => {
    render(
      <OptimizedImage src="/test.jpg" alt="test" width={100} height={100} objectFit="none" />
    )
    expect(screen.getByRole('img')).toHaveClass('object-none')
  })

  it('onClick handler is passed through and called', () => {
    const onClick = vi.fn()
    render(
      <OptimizedImage src="/test.jpg" alt="test" width={100} height={100} onClick={onClick} />
    )
    fireEvent.click(screen.getByRole('img'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('onLoad transitions from opacity-0 to opacity-100', () => {
    render(
      <OptimizedImage src="/test.jpg" alt="test" width={100} height={100} />
    )
    const img = screen.getByRole('img')

    // Initially in loading state
    expect(img).toHaveClass('opacity-0')

    // Trigger onLoad
    fireEvent.load(img)

    // After load, should be visible
    expect(img).toHaveClass('opacity-100')
  })

  it('loading placeholder is shown during loading and removed after', () => {
    const { container } = render(
      <OptimizedImage src="/test.jpg" alt="test" width={100} height={100} />
    )

    // Placeholder should be visible during loading
    const placeholder = container.querySelector('.animate-pulse')
    expect(placeholder).toBeInTheDocument()

    // Trigger onLoad
    fireEvent.load(screen.getByRole('img'))

    // Placeholder should be gone
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
  })
})
