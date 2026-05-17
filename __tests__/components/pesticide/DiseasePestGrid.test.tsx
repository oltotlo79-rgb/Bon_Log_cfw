import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { DiseasePestGrid } from '@/app/(main)/pesticides/DiseasePestGrid'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const mockDiseasePests = [
  {
    id: 'dp1',
    name: 'うどんこ病',
    nameKana: 'うどんこびょう',
    category: 'disease' as const,
    slug: 'udonko-byo',
    _count: { effects: 5 },
  },
  {
    id: 'dp2',
    name: 'アブラムシ',
    nameKana: 'あぶらむし',
    category: 'pest' as const,
    slug: 'aphid',
    _count: { effects: 12 },
  },
  {
    id: 'dp3',
    name: '灰色かび病',
    nameKana: null,
    category: 'disease' as const,
    slug: 'gray-mold',
    _count: { effects: 0 },
  },
]

describe('DiseasePestGrid', () => {
  it('0件のとき「データはまだ登録されていません」を表示する', () => {
    render(<DiseasePestGrid diseasePests={[]} filterByCategory="all" />)

    expect(
      screen.getByText('データはまだ登録されていません。管理画面から登録してください。')
    ).toBeInTheDocument()
  })

  it('filterByCategory=all で全病害虫を表示する', () => {
    render(<DiseasePestGrid diseasePests={mockDiseasePests} filterByCategory="all" />)

    expect(screen.getByText('うどんこ病')).toBeInTheDocument()
    expect(screen.getByText('アブラムシ')).toBeInTheDocument()
    expect(screen.getByText('灰色かび病')).toBeInTheDocument()
    expect(screen.getAllByText('病害').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('害虫').length).toBeGreaterThanOrEqual(1)
  })

  it('filterByCategory=disease で病害のみ表示する', () => {
    render(<DiseasePestGrid diseasePests={mockDiseasePests} filterByCategory="disease" />)

    expect(screen.getByText('うどんこ病')).toBeInTheDocument()
    expect(screen.getByText('灰色かび病')).toBeInTheDocument()
    expect(screen.queryByText('アブラムシ')).not.toBeInTheDocument()
  })

  it('filterByCategory=pest で害虫のみ表示する', () => {
    render(<DiseasePestGrid diseasePests={mockDiseasePests} filterByCategory="pest" />)

    expect(screen.getByText('アブラムシ')).toBeInTheDocument()
    expect(screen.queryByText('うどんこ病')).not.toBeInTheDocument()
    expect(screen.queryByText('灰色かび病')).not.toBeInTheDocument()
  })

  it('効果件数が1以上の場合に「対応薬剤 N件」を表示する', () => {
    render(<DiseasePestGrid diseasePests={mockDiseasePests} filterByCategory="all" />)

    expect(screen.getByText('対応薬剤 5件')).toBeInTheDocument()
    expect(screen.getByText('対応薬剤 12件')).toBeInTheDocument()
    expect(screen.queryByText('対応薬剤 0件')).not.toBeInTheDocument()
  })

  it('各病害虫からdiseasePestクエリ付きのリンクを持つ', () => {
    render(<DiseasePestGrid diseasePests={mockDiseasePests} filterByCategory="all" />)

    const link1 = screen.getByRole('link', { name: /うどんこ病/ })
    expect(link1).toHaveAttribute('href', '/pesticides?diseasePest=dp1')

    const link2 = screen.getByRole('link', { name: /アブラムシ/ })
    expect(link2).toHaveAttribute('href', '/pesticides?diseasePest=dp2')
  })
})
