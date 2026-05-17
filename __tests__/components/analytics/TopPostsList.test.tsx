import { vi, describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { TopPostsList } from '@/components/analytics/TopPostsList'

describe('TopPostsList', () => {
  const mockPosts = [
    { id: 'p1', content: '1位の投稿です', createdAt: new Date('2026-03-01'), likeCount: 30, commentCount: 10 },
    { id: 'p2', content: '2位の投稿です', createdAt: new Date('2026-03-02'), likeCount: 20, commentCount: 5 },
    { id: 'p3', content: '3位の投稿です', createdAt: new Date('2026-03-03'), likeCount: 10, commentCount: 3 },
    { id: 'p4', content: '4位の投稿です', createdAt: new Date('2026-03-04'), likeCount: 5, commentCount: 1 },
  ]

  it('renders all posts in the list', () => {
    render(<TopPostsList posts={mockPosts} />)
    expect(screen.getByText('1位の投稿です')).toBeInTheDocument()
    expect(screen.getByText('2位の投稿です')).toBeInTheDocument()
    expect(screen.getByText('3位の投稿です')).toBeInTheDocument()
    expect(screen.getByText('4位の投稿です')).toBeInTheDocument()
  })

  it('shows rank number for posts after top 3', () => {
    render(<TopPostsList posts={mockPosts} />)
    // Post at index 3 (4th) shows numeric rank "4"
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('shows engagement counts (likes + comments total)', () => {
    render(<TopPostsList posts={mockPosts} />)
    // First post: 30 likes + 10 comments = 40
    expect(screen.getByText('40')).toBeInTheDocument()
    // Second post: 20 + 5 = 25
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('links to post detail page', () => {
    render(<TopPostsList posts={mockPosts} />)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/posts/p1')
    expect(links[1]).toHaveAttribute('href', '/posts/p2')
  })

  it('handles empty post list', () => {
    render(<TopPostsList posts={[]} />)
    expect(screen.getByText('投稿がありません')).toBeInTheDocument()
  })

  it('shows "(メディア投稿)" for posts with null content', () => {
    const postsWithNull = [
      { id: 'p1', content: null, createdAt: new Date('2026-03-01'), likeCount: 10, commentCount: 2 },
    ]
    render(<TopPostsList posts={postsWithNull} />)
    expect(screen.getByText('(メディア投稿)')).toBeInTheDocument()
  })
})
