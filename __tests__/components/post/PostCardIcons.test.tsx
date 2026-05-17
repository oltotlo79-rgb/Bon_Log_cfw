import { render } from '@testing-library/react'
import {
  HeartIcon,
  BookmarkIcon,
  MessageCircleIcon,
  RepeatIcon,
  MoreHorizontalIcon,
} from '@/components/post/PostCardIcons'

describe('PostCardIcons', () => {
  it('HeartIcon をレンダリングする', () => {
    const { container } = render(<HeartIcon />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('HeartIcon に filled を渡すと fill が currentColor になる', () => {
    const { container } = render(<HeartIcon filled />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('fill', 'currentColor')
  })

  it('BookmarkIcon をレンダリングする', () => {
    const { container } = render(<BookmarkIcon />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('BookmarkIcon に filled を渡すと fill が currentColor になる', () => {
    const { container } = render(<BookmarkIcon filled />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('fill', 'currentColor')
  })

  it('MessageCircleIcon をレンダリングする', () => {
    const { container } = render(<MessageCircleIcon />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('RepeatIcon をレンダリングする', () => {
    const { container } = render(<RepeatIcon />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('MoreHorizontalIcon をレンダリングする', () => {
    const { container } = render(<MoreHorizontalIcon />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('className が SVG に適用される', () => {
    const { container } = render(<HeartIcon className="w-4 h-4" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('w-4', 'h-4')
  })
})
