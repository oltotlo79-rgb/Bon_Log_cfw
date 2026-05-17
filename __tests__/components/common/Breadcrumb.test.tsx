import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/components/seo/JsonLd', () => ({
  BreadcrumbJsonLd: (_props: Record<string, unknown>) => <div data-testid="json-ld" />,
}))

import { Breadcrumb } from '@/components/common/Breadcrumb'

describe('Breadcrumb', () => {
  it('renders nothing when items array is empty', () => {
    const { container } = render(<Breadcrumb items={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders breadcrumb items with correct names', () => {
    render(
      <Breadcrumb
        items={[
          { name: 'ホーム', href: '/' },
          { name: '盆栽園マップ', href: '/shops' },
          { name: '〇〇盆栽園' },
        ]}
      />
    )
    expect(screen.getByText('ホーム')).toBeInTheDocument()
    expect(screen.getByText('盆栽園マップ')).toBeInTheDocument()
    expect(screen.getByText('〇〇盆栽園')).toBeInTheDocument()
  })

  it('renders links for items with href', () => {
    render(
      <Breadcrumb
        items={[
          { name: 'ホーム', href: '/' },
          { name: '盆栽園マップ', href: '/shops' },
          { name: '〇〇盆栽園' },
        ]}
      />
    )
    const homeLink = screen.getByTitle('ホーム')
    expect(homeLink.tagName).toBe('A')
    expect(homeLink).toHaveAttribute('href', '/')

    const shopsLink = screen.getByTitle('盆栽園マップ')
    expect(shopsLink.tagName).toBe('A')
    expect(shopsLink).toHaveAttribute('href', '/shops')
  })

  it('shows aria-current="page" on last item', () => {
    render(
      <Breadcrumb
        items={[
          { name: 'ホーム', href: '/' },
          { name: '現在のページ' },
        ]}
      />
    )
    const lastItem = screen.getByText('現在のページ')
    expect(lastItem).toHaveAttribute('aria-current', 'page')
  })

  it('shows home icon for first item named ホーム', () => {
    render(
      <Breadcrumb
        items={[
          { name: 'ホーム', href: '/' },
          { name: '次のページ' },
        ]}
      />
    )
    const homeLink = screen.getByTitle('ホーム')
    const svg = homeLink.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('shows chevron separator between items', () => {
    const { container } = render(
      <Breadcrumb
        items={[
          { name: 'ホーム', href: '/' },
          { name: '盆栽園マップ', href: '/shops' },
          { name: '〇〇盆栽園' },
        ]}
      />
    )
    // Chevrons are SVGs with aria-hidden="true" within li elements (except the first)
    const chevrons = container.querySelectorAll('li:not(:first-child) svg')
    expect(chevrons.length).toBeGreaterThanOrEqual(2)
  })

  it('has nav with aria-label="パンくずリスト"', () => {
    render(
      <Breadcrumb items={[{ name: 'ホーム', href: '/' }]} />
    )
    const nav = screen.getByRole('navigation', { name: 'パンくずリスト' })
    expect(nav).toBeInTheDocument()
  })

  it('includeJsonLd=false disables JSON-LD output', () => {
    render(
      <Breadcrumb
        items={[{ name: 'ホーム', href: '/' }]}
        includeJsonLd={false}
      />
    )
    expect(screen.queryByTestId('json-ld')).not.toBeInTheDocument()
  })

  it('renders JSON-LD by default', () => {
    render(
      <Breadcrumb items={[{ name: 'ホーム', href: '/' }]} />
    )
    expect(screen.getByTestId('json-ld')).toBeInTheDocument()
  })
})
