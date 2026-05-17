/**
 * PopularTags - branch coverage tests
 * Covers uncovered branches:
 * - tags.length === 0 returns null
 * - Non-empty tags render correctly
 */

import { render, screen } from '../../utils/test-utils'
import { PopularTags } from '@/components/search/SearchResults'

describe('PopularTags - branch coverage', () => {
  it('returns null when tags array is empty', () => {
    const { container } = render(<PopularTags tags={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders tags with counts and links', () => {
    const tags = [
      { tag: '松柏類', count: 100 },
      { tag: '雑木類', count: 50 },
    ]
    render(<PopularTags tags={tags} />)

    expect(screen.getByText('人気のタグ')).toBeInTheDocument()
    expect(screen.getByText('#松柏類')).toBeInTheDocument()
    expect(screen.getByText('#雑木類')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('tag links have correct href', () => {
    const tags = [{ tag: '松柏類', count: 10 }]
    render(<PopularTags tags={tags} />)

    const link = screen.getByText('#松柏類').closest('a')
    expect(link).toHaveAttribute('href', '/search?tab=tags&q=%E6%9D%BE%E6%9F%8F%E9%A1%9E')
  })
})
