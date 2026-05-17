/**
 * OptimizedImage - uncovered branch tests
 *
 * Targets:
 * - Error fallback in fill mode (style={position: absolute, inset: 0})
 * - Error fallback without fill (style={width, height})
 * - priority=true makes loading=undefined (not 'lazy')
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
    fill,
    width,
    height,
    sizes,
    loading,
  }: {
    src: string
    alt: string
    onLoad?: () => void
    onError?: () => void
    onClick?: (e: React.MouseEvent) => void
    className?: string
    priority?: boolean
    fill?: boolean
    width?: number
    height?: number
    sizes?: string
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
      data-fill={fill}
      data-width={width}
      data-height={height}
      data-sizes={sizes}
      data-loading={loading}
    />
  ),
}))

describe('OptimizedImage - uncovered branches', () => {
  it('fill mode error fallback uses position absolute style', () => {
    const { container } = render(<OptimizedImage src="/broken.jpg" alt="broken" fill />)

    const img = screen.getByRole('img')
    fireEvent.error(img)

    const fallback = container.querySelector('.bg-muted')
    expect(fallback).toBeInTheDocument()
    expect(fallback).toHaveStyle({ position: 'absolute', inset: '0' })
  })

  it('non-fill error fallback uses explicit width and height style', () => {
    const { container } = render(
      <OptimizedImage src="/broken.jpg" alt="broken" width={200} height={150} />
    )

    const img = screen.getByRole('img')
    fireEvent.error(img)

    const fallback = container.querySelector('.bg-muted')
    expect(fallback).toBeInTheDocument()
    expect(fallback).toHaveStyle({ width: '200px', height: '150px' })
  })

  it('priority=true sets loading to undefined (not lazy)', () => {
    render(<OptimizedImage src="/test.jpg" alt="test" width={100} height={100} priority />)

    const img = screen.getByRole('img')
    expect(img).not.toHaveAttribute('data-loading', 'lazy')
  })

  it('fill mode wrapper does not set inline width/height', () => {
    const { container } = render(<OptimizedImage src="/test.jpg" alt="test" fill />)

    const wrapper = container.firstElementChild
    expect(wrapper).not.toHaveStyle({ width: '100px' })
  })

  it('non-fill wrapper has inline width and height from props', () => {
    const { container } = render(
      <OptimizedImage src="/test.jpg" alt="test" width={250} height={180} />
    )

    const wrapper = container.firstElementChild
    expect(wrapper).toHaveStyle({ width: '250px', height: '180px' })
    expect(wrapper).toHaveClass('inline-block')
  })
})
