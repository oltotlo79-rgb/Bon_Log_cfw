import { render, screen } from '@testing-library/react'
import { SkipLink } from '@/components/common/SkipLink'

describe('SkipLink', () => {
  it('renders link with text "メインコンテンツへスキップ"', () => {
    render(<SkipLink />)
    expect(screen.getByText('メインコンテンツへスキップ')).toBeInTheDocument()
  })

  it('has href="#main-content"', () => {
    render(<SkipLink />)
    const link = screen.getByText('メインコンテンツへスキップ')
    expect(link).toHaveAttribute('href', '#main-content')
  })

  it('has sr-only class (initially hidden)', () => {
    render(<SkipLink />)
    const link = screen.getByText('メインコンテンツへスキップ')
    expect(link.className).toContain('sr-only')
  })
})
