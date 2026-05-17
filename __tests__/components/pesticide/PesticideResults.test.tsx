import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { PesticideResults } from '@/app/(main)/pesticides/PesticideResults'

vi.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))

const basePesticide = {
  id: 'p1',
  name: 'トリフミン乳剤',
  registrationNumber: '19842',
  pesticideType: 'fungicide' as const,
  slug: 'trifumin-ec',
  formulationType: { name: '乳剤' },
  ingredients: [
    {
      contentLabel: '20%',
      activeIngredient: { name: 'トリフミゾール', fracCode: '3', iracCode: null },
    },
  ],
  effects: [],
}

const diseasePests = [
  { id: 'dp1', name: 'うどんこ病' },
  { id: 'dp2', name: 'アブラムシ' },
]

describe('PesticideResults', () => {
  it('検索結果0件のとき「該当する薬剤が見つかりませんでした」を表示する', () => {
    render(<PesticideResults pesticides={[]} diseasePests={[]} />)

    expect(screen.getByText('該当する薬剤が見つかりませんでした')).toBeInTheDocument()
    expect(screen.getByText('検索結果')).toBeInTheDocument()
  })

  it('薬剤一覧と件数を表示する', () => {
    render(<PesticideResults pesticides={[basePesticide]} diseasePests={[]} />)

    expect(screen.getByText('トリフミン乳剤')).toBeInTheDocument()
    expect(screen.getByText('1件')).toBeInTheDocument()
    expect(screen.getByText('殺菌剤')).toBeInTheDocument()
  })

  it('selectedDiseasePestIdがあるとき「〇〇に効く薬剤」タイトルを表示する', () => {
    render(
      <PesticideResults
        pesticides={[basePesticide]}
        selectedDiseasePestId="dp1"
        diseasePests={diseasePests}
      />
    )

    expect(screen.getByText('うどんこ病 に効く薬剤')).toBeInTheDocument()
  })

  it('selectedDiseasePest に slug があるとき「この病害虫の詳細」リンクを表示する', () => {
    const diseasePestsWithSlug = [
      { id: 'dp1', name: 'うどんこ病', slug: 'udonko-byo' },
      { id: 'dp2', name: 'アブラムシ', slug: 'aphid' },
    ]
    render(
      <PesticideResults
        pesticides={[basePesticide]}
        selectedDiseasePestId="dp1"
        diseasePests={diseasePestsWithSlug}
      />
    )

    const detailLink = screen.getByRole('link', { name: /この病害虫の詳細/ })
    expect(detailLink).toHaveAttribute('href', '/pesticides/diseases-pests/udonko-byo')
  })

  it('selectedDiseasePest に slug がないとき「この病害虫の詳細」リンクを表示しない', () => {
    render(
      <PesticideResults
        pesticides={[basePesticide]}
        selectedDiseasePestId="dp1"
        diseasePests={diseasePests}
      />
    )

    expect(screen.queryByRole('link', { name: /この病害虫の詳細/ })).not.toBeInTheDocument()
  })

  it('薬剤タイプに応じたラベルを表示する（殺菌剤・殺虫剤・殺ダニ剤・その他）', () => {
    const pesticides = [
      { ...basePesticide, id: 'p1', pesticideType: 'fungicide' as const },
      { ...basePesticide, id: 'p2', name: 'スミチオン', pesticideType: 'insecticide' as const, slug: 'sumithion' },
      { ...basePesticide, id: 'p3', name: 'ダニ太郎', pesticideType: 'acaricide' as const, slug: 'dani-taro' },
      { ...basePesticide, id: 'p4', name: 'その他剤', pesticideType: 'other' as const, slug: 'other' },
    ]
    render(<PesticideResults pesticides={pesticides} diseasePests={[]} />)

    expect(screen.getByText('殺菌剤')).toBeInTheDocument()
    expect(screen.getByText('殺虫剤')).toBeInTheDocument()
    expect(screen.getByText('殺ダニ剤')).toBeInTheDocument()
    expect(screen.getByText('その他')).toBeInTheDocument()
  })

  it('薬剤カードから製品詳細へのリンクを持つ', () => {
    render(<PesticideResults pesticides={[basePesticide]} diseasePests={[]} />)

    const link = screen.getByRole('link', { name: /トリフミン乳剤/ })
    expect(link).toHaveAttribute('href', '/pesticides/products/trifumin-ec')
  })

  it('登録番号・剤型を表示する', () => {
    render(<PesticideResults pesticides={[basePesticide]} diseasePests={[]} />)

    expect(screen.getByText(/登録番号: 19842/)).toBeInTheDocument()
    expect(screen.getByText(/剤型: 乳剤/)).toBeInTheDocument()
  })
})
