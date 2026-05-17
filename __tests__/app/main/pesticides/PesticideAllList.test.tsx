import { vi } from 'vitest'
import { render, screen } from '../../../utils/test-utils'
import { PesticideAllList } from '@/app/(main)/pesticides/PesticideAllList'

// next/navigation モック
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const makeDiseasePest = (overrides: Partial<Parameters<typeof PesticideAllList>[0]['diseasePests'][number]> = {}) => ({
  id: 'dp-1',
  name: 'うどんこ病',
  nameKana: 'うどんこびょう',
  category: 'disease' as const,
  slug: 'udonko',
  _count: { effects: 3 },
  ...overrides,
})

const makeProduct = (overrides: Partial<Parameters<typeof PesticideAllList>[0]['products'][number]> = {}) => ({
  id: 'p-1',
  name: 'ダコニール1000',
  slug: 'dakoniru-1000',
  pesticideType: 'fungicide' as const,
  ...overrides,
})

describe('PesticideAllList', () => {
  it('データがない場合に空メッセージを表示する', () => {
    render(
      <PesticideAllList
        diseasePests={[]}
        products={[]}
        spreaderIds={new Set()}
      />
    )
    expect(screen.getByText('表示するデータがありません')).toBeInTheDocument()
  })

  it('病害虫アイテムを表示する', () => {
    render(
      <PesticideAllList
        diseasePests={[makeDiseasePest()]}
        products={[]}
        spreaderIds={new Set()}
      />
    )
    expect(screen.getByText('うどんこ病')).toBeInTheDocument()
    expect(screen.getByText('病害')).toBeInTheDocument()
  })

  it('薬剤アイテムを表示する', () => {
    render(
      <PesticideAllList
        diseasePests={[]}
        products={[makeProduct()]}
        spreaderIds={new Set()}
      />
    )
    expect(screen.getByText('ダコニール1000')).toBeInTheDocument()
    expect(screen.getByText('殺菌剤')).toBeInTheDocument()
  })

  it('対応薬剤件数が0より大きい場合に表示する', () => {
    render(
      <PesticideAllList
        diseasePests={[makeDiseasePest({ _count: { effects: 7 } })]}
        products={[]}
        spreaderIds={new Set()}
      />
    )
    expect(screen.getByText('対応薬剤 7件')).toBeInTheDocument()
  })

  it('対応薬剤件数が0の場合は表示しない', () => {
    render(
      <PesticideAllList
        diseasePests={[makeDiseasePest({ _count: { effects: 0 } })]}
        products={[]}
        spreaderIds={new Set()}
      />
    )
    expect(screen.queryByText(/対応薬剤/)).not.toBeInTheDocument()
  })

  it('展着剤IDに含まれる薬剤は展着剤ラベルで表示する', () => {
    const product = makeProduct({ id: 'spreader-1', pesticideType: 'other' as const })
    render(
      <PesticideAllList
        diseasePests={[]}
        products={[product]}
        spreaderIds={new Set(['spreader-1'])}
      />
    )
    expect(screen.getByText('展着剤')).toBeInTheDocument()
  })

  it('展着剤IDに含まれない薬剤は元の種別ラベルで表示する', () => {
    const product = makeProduct({ pesticideType: 'insecticide' as const })
    render(
      <PesticideAllList
        diseasePests={[]}
        products={[product]}
        spreaderIds={new Set()}
      />
    )
    expect(screen.getByText('殺虫剤')).toBeInTheDocument()
  })

  it('病害虫のリンク先が正しい', () => {
    render(
      <PesticideAllList
        diseasePests={[makeDiseasePest({ id: 'dp-x' })]}
        products={[]}
        spreaderIds={new Set()}
      />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/pesticides?diseasePest=dp-x')
  })

  it('薬剤のリンク先が正しい', () => {
    render(
      <PesticideAllList
        diseasePests={[]}
        products={[makeProduct({ slug: 'test-slug' })]}
        spreaderIds={new Set()}
      />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/pesticides/products/test-slug')
  })

  it('selectedDiseasePestId に一致するアイテムがハイライトされる', () => {
    render(
      <PesticideAllList
        diseasePests={[makeDiseasePest({ id: 'dp-selected' })]}
        products={[]}
        spreaderIds={new Set()}
        selectedDiseasePestId="dp-selected"
      />
    )
    const link = screen.getByRole('link')
    expect(link.className).toContain('border-primary')
    expect(link.className).toContain('bg-primary/10')
  })

  it('selectedDiseasePestId に一致しないアイテムはハイライトされない', () => {
    render(
      <PesticideAllList
        diseasePests={[makeDiseasePest({ id: 'dp-other' })]}
        products={[]}
        spreaderIds={new Set()}
        selectedDiseasePestId="dp-selected"
      />
    )
    const link = screen.getByRole('link')
    expect(link.className).not.toContain('bg-primary/10')
  })

  it('病害虫と薬剤が混在する場合にあいうえお順でソートされる', () => {
    const items = {
      diseasePests: [
        makeDiseasePest({ id: 'dp-1', name: 'カイガラムシ', nameKana: 'かいがらむし', category: 'pest' }),
      ],
      products: [
        makeProduct({ id: 'p-1', name: 'アースジェット', slug: 'earth-jet' }),
      ],
    }
    render(
      <PesticideAllList
        diseasePests={items.diseasePests}
        products={items.products}
        spreaderIds={new Set()}
      />
    )
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    // アースジェット (あ) が カイガラムシ (か) より前
    expect(links[0]).toHaveTextContent('アースジェット')
    expect(links[1]).toHaveTextContent('カイガラムシ')
  })

  it('各カテゴリバッジが正しく表示される', () => {
    render(
      <PesticideAllList
        diseasePests={[
          makeDiseasePest({ id: '1', name: 'A病', category: 'disease', nameKana: 'あ' }),
          makeDiseasePest({ id: '2', name: 'B虫', category: 'pest', nameKana: 'い' }),
          makeDiseasePest({ id: '3', name: 'C虫', category: 'beneficial_insect', nameKana: 'う' }),
        ]}
        products={[]}
        spreaderIds={new Set()}
      />
    )
    expect(screen.getByText('病害')).toBeInTheDocument()
    expect(screen.getByText('害虫')).toBeInTheDocument()
    expect(screen.getByText('益虫')).toBeInTheDocument()
  })
})
