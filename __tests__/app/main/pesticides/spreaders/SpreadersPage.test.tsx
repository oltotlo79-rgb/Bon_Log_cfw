import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/actions/pesticide', () => ({
  getSpreaderTypes: vi.fn(),
  getSpreaderTypeBySlug: vi.fn(),
}))
vi.mock('@/components/pesticide/PesticideDisclaimer', () => ({
  PesticideDisclaimer: () => <div data-testid="disclaimer" />,
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

import { getSpreaderTypes, getSpreaderTypeBySlug } from '@/lib/actions/pesticide'

const mockGetSpreaderTypes = getSpreaderTypes as ReturnType<typeof vi.fn>
const mockGetSpreaderTypeBySlug = getSpreaderTypeBySlug as ReturnType<typeof vi.fn>

describe('SpreadersPage', async () => {
  let Page: typeof import('@/app/(main)/pesticides/spreaders/page').default
  let generateMetadata: typeof import('@/app/(main)/pesticides/spreaders/page').generateMetadata

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/pesticides/spreaders/page')
    Page = mod.default
    generateMetadata = mod.generateMetadata
  }, 20000)

  it('展着剤型一覧を表示する', async () => {
    mockGetSpreaderTypes.mockResolvedValue({
      spreaders: [
        { id: 's1', slug: 'non-ionic', name: '非イオン性', description: '浸透力が高い' },
      ],
    })
    mockGetSpreaderTypeBySlug.mockResolvedValue(null)

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByText('展着剤')).toBeInTheDocument()
    expect(screen.getByText('非イオン性')).toBeInTheDocument()
    expect(screen.getByTestId('disclaimer')).toBeInTheDocument()
  }, 20000)

  it('typeパラメータ指定時に該当する展着剤を表示する', async () => {
    mockGetSpreaderTypes.mockResolvedValue({ spreaders: [] })
    mockGetSpreaderTypeBySlug.mockResolvedValue({
      name: '非イオン性',
      description: '浸透力が高い展着剤',
      pesticides: [
        { pesticide: { id: 'p1', slug: 'spreader-1', name: '製品A', description: '説明A' } },
      ],
    })

    const result = await Page({ searchParams: Promise.resolve({ type: 'non-ionic' }) })
    render(result)

    expect(screen.getByText('非イオン性の展着剤一覧')).toBeInTheDocument()
    expect(screen.getByText('製品A')).toBeInTheDocument()
  }, 20000)

  it('展着剤が0件の場合はメッセージを表示する', async () => {
    mockGetSpreaderTypes.mockResolvedValue({ spreaders: [] })
    mockGetSpreaderTypeBySlug.mockResolvedValue(null)

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByText('展着剤データはまだ登録されていません')).toBeInTheDocument()
  }, 20000)

  it('選択した型に製品がない場合はメッセージを表示する', async () => {
    mockGetSpreaderTypes.mockResolvedValue({ spreaders: [] })
    mockGetSpreaderTypeBySlug.mockResolvedValue({
      name: '陰イオン性',
      description: '説明',
      pesticides: [],
    })

    const result = await Page({ searchParams: Promise.resolve({ type: 'anionic' }) })
    render(result)

    expect(screen.getByText('この型の製品はまだ登録されていません')).toBeInTheDocument()
  }, 20000)

  it('generateMetadata: typeなしの場合デフォルトタイトル', async () => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({}) })
    expect(metadata.title).toBe('展着剤一覧 - 農薬・病害虫')
  })

  it('generateMetadata: type指定時にタイトルに型名が含まれる', async () => {
    mockGetSpreaderTypeBySlug.mockResolvedValue({ name: '非イオン性' })

    const metadata = await generateMetadata({ searchParams: Promise.resolve({ type: 'non-ionic' }) })
    expect(metadata.title).toBe('非イオン性の展着剤 - 農薬・病害虫')
  })
})
