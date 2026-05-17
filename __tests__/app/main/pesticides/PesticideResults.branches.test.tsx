/**
 * PesticideResults - 未カバー分岐のテスト
 *
 * 対象: beneficial insect empty state, no selectedDiseasePestId,
 * effect badges for different pesticide types, slug link display
 */

import { render, screen } from '../../../utils/test-utils'
import { PesticideResults } from '@/app/(main)/pesticides/PesticideResults'

vi.mock('@/components/pesticide/EffectRatingBadge', () => ({
  EffectRatingBadge: ({ rating, label }: { rating: string | null; label: string }) => (
    <span data-testid={`badge-${label}`}>{label}: {rating ?? 'N/A'}</span>
  ),
}))

const basePesticide = {
  id: 'p-1',
  name: 'テスト薬剤',
  registrationNumber: '12345',
  slug: 'test-pesticide',
  formulationType: { name: '水和剤' },
  ingredients: [],
  effects: [],
}

describe('PesticideResults - 未カバー分岐', () => {
  // ----------------------------------------------------------------
  // Empty state: beneficial insect
  // ----------------------------------------------------------------
  it('益虫の場合に専用メッセージを表示する', () => {
    render(
      <PesticideResults
        pesticides={[]}
        selectedDiseasePestId="dp-1"
        diseasePests={[
          { id: 'dp-1', name: 'テントウムシ', slug: 'tentou', category: 'beneficial_insect' },
        ]}
      />
    )

    expect(screen.getByText(/益虫は農薬防除の対象ではありません/)).toBeInTheDocument()
    expect(screen.getByText(/テントウムシ の図鑑ページを見る/)).toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // Empty state: beneficial insect without slug
  // ----------------------------------------------------------------
  it('益虫でslugがない場合に図鑑リンクを表示しない', () => {
    render(
      <PesticideResults
        pesticides={[]}
        selectedDiseasePestId="dp-1"
        diseasePests={[
          { id: 'dp-1', name: 'テントウムシ', category: 'beneficial_insect' },
        ]}
      />
    )

    expect(screen.getByText(/益虫は農薬防除の対象ではありません/)).toBeInTheDocument()
    expect(screen.queryByText(/図鑑ページを見る/)).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // Empty state: regular pest (not beneficial insect)
  // ----------------------------------------------------------------
  it('通常の病害虫で結果が空の場合にデフォルトメッセージを表示する', () => {
    render(
      <PesticideResults
        pesticides={[]}
        selectedDiseasePestId="dp-1"
        diseasePests={[
          { id: 'dp-1', name: 'アブラムシ', slug: 'aburamushi', category: 'pest' },
        ]}
      />
    )

    expect(screen.getByText('該当する薬剤が見つかりませんでした')).toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // No selectedDiseasePestId -> title says "検索結果"
  // ----------------------------------------------------------------
  it('selectedDiseasePestIdがない場合に「検索結果」と表示する', () => {
    render(
      <PesticideResults
        pesticides={[{ ...basePesticide, pesticideType: 'fungicide' as const }]}
      />
    )

    expect(screen.getByText('検索結果')).toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // selectedDiseasePestId with name -> title says "X に効く薬剤"
  // ----------------------------------------------------------------
  it('selectedDiseasePestIdがある場合に病害虫名を表示する', () => {
    render(
      <PesticideResults
        pesticides={[{ ...basePesticide, pesticideType: 'fungicide' as const }]}
        selectedDiseasePestId="dp-1"
        diseasePests={[{ id: 'dp-1', name: 'うどんこ病', slug: 'udonko' }]}
      />
    )

    expect(screen.getByText('うどんこ病 に効く薬剤')).toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // Disease pest detail link (slug present)
  // ----------------------------------------------------------------
  it('selectedDiseasePestにslugがある場合に詳細リンクを表示する', () => {
    render(
      <PesticideResults
        pesticides={[{ ...basePesticide, pesticideType: 'fungicide' as const }]}
        selectedDiseasePestId="dp-1"
        diseasePests={[{ id: 'dp-1', name: 'うどんこ病', slug: 'udonko' }]}
      />
    )

    const link = screen.getByText('この病害虫の詳細 →')
    expect(link).toHaveAttribute('href', '/pesticides/diseases-pests/udonko')
  })

  // ----------------------------------------------------------------
  // No slug -> no detail link
  // ----------------------------------------------------------------
  it('selectedDiseasePestにslugがない場合に詳細リンクを表示しない', () => {
    render(
      <PesticideResults
        pesticides={[{ ...basePesticide, pesticideType: 'fungicide' as const }]}
        selectedDiseasePestId="dp-1"
        diseasePests={[{ id: 'dp-1', name: 'うどんこ病' }]}
      />
    )

    expect(screen.queryByText('この病害虫の詳細 →')).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // fungicide: shows prevention + treatment + persistence badges
  // ----------------------------------------------------------------
  it('殺菌剤の場合に予防・治療・持続バッジを表示する', () => {
    render(
      <PesticideResults
        pesticides={[{
          ...basePesticide,
          pesticideType: 'fungicide' as const,
          effects: [{
            diseasePestId: 'dp-1',
            preventionLevel: 'A' as const,
            treatmentLevel: 'B' as const,
            efficacyLevel: null,
            persistenceLevel: 'C' as const,
            diseasePest: { name: 'うどんこ病', category: 'disease' },
          }],
        }]}
        selectedDiseasePestId="dp-1"
        diseasePests={[{ id: 'dp-1', name: 'うどんこ病' }]}
      />
    )

    expect(screen.getByTestId('badge-予防')).toBeInTheDocument()
    expect(screen.getByTestId('badge-治療')).toBeInTheDocument()
    expect(screen.getByTestId('badge-持続')).toBeInTheDocument()
    // Insecticide badge should NOT be shown for fungicide
    expect(screen.queryByTestId('badge-効果')).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // insecticide: shows efficacy + persistence badges (no prevention/treatment)
  // ----------------------------------------------------------------
  it('殺虫剤の場合に効果・持続バッジを表示する', () => {
    render(
      <PesticideResults
        pesticides={[{
          ...basePesticide,
          pesticideType: 'insecticide' as const,
          effects: [{
            diseasePestId: 'dp-1',
            preventionLevel: null,
            treatmentLevel: null,
            efficacyLevel: 'A' as const,
            persistenceLevel: 'B' as const,
            diseasePest: { name: 'アブラムシ', category: 'pest' },
          }],
        }]}
        selectedDiseasePestId="dp-1"
        diseasePests={[{ id: 'dp-1', name: 'アブラムシ' }]}
      />
    )

    expect(screen.getByTestId('badge-効果')).toBeInTheDocument()
    expect(screen.getByTestId('badge-持続')).toBeInTheDocument()
    expect(screen.queryByTestId('badge-予防')).not.toBeInTheDocument()
    expect(screen.queryByTestId('badge-治療')).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // acaricide: shows efficacy + persistence badges
  // ----------------------------------------------------------------
  it('殺ダニ剤の場合に効果・持続バッジを表示する', () => {
    render(
      <PesticideResults
        pesticides={[{
          ...basePesticide,
          pesticideType: 'acaricide' as const,
          effects: [{
            diseasePestId: 'dp-1',
            preventionLevel: null,
            treatmentLevel: null,
            efficacyLevel: 'S' as const,
            persistenceLevel: 'A' as const,
            diseasePest: { name: 'ハダニ', category: 'pest' },
          }],
        }]}
        selectedDiseasePestId="dp-1"
        diseasePests={[{ id: 'dp-1', name: 'ハダニ' }]}
      />
    )

    expect(screen.getByTestId('badge-効果')).toBeInTheDocument()
    expect(screen.getByTestId('badge-持続')).toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // compound: shows all badges (prevention, treatment, efficacy, persistence)
  // ----------------------------------------------------------------
  it('複合剤の場合に全バッジを表示する', () => {
    render(
      <PesticideResults
        pesticides={[{
          ...basePesticide,
          pesticideType: 'compound' as const,
          effects: [{
            diseasePestId: 'dp-1',
            preventionLevel: 'A' as const,
            treatmentLevel: 'B' as const,
            efficacyLevel: 'A' as const,
            persistenceLevel: 'C' as const,
            diseasePest: { name: 'うどんこ病', category: 'disease' },
          }],
        }]}
        selectedDiseasePestId="dp-1"
        diseasePests={[{ id: 'dp-1', name: 'うどんこ病' }]}
      />
    )

    expect(screen.getByTestId('badge-予防')).toBeInTheDocument()
    expect(screen.getByTestId('badge-治療')).toBeInTheDocument()
    expect(screen.getByTestId('badge-効果')).toBeInTheDocument()
    expect(screen.getByTestId('badge-持続')).toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // 'other' type: no effect badges at all (only persistence)
  // ----------------------------------------------------------------
  it('その他タイプの場合は持続バッジのみ表示する', () => {
    render(
      <PesticideResults
        pesticides={[{
          ...basePesticide,
          pesticideType: 'other' as const,
          effects: [{
            diseasePestId: 'dp-1',
            preventionLevel: null,
            treatmentLevel: null,
            efficacyLevel: null,
            persistenceLevel: 'B' as const,
            diseasePest: { name: 'その他', category: 'disease' },
          }],
        }]}
        selectedDiseasePestId="dp-1"
        diseasePests={[{ id: 'dp-1', name: 'その他' }]}
      />
    )

    expect(screen.getByTestId('badge-持続')).toBeInTheDocument()
    expect(screen.queryByTestId('badge-予防')).not.toBeInTheDocument()
    expect(screen.queryByTestId('badge-効果')).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // No relevant effect (selectedDiseasePestId doesn't match any effect)
  // ----------------------------------------------------------------
  it('選択された病害虫に対応するeffectがない場合にバッジを表示しない', () => {
    render(
      <PesticideResults
        pesticides={[{
          ...basePesticide,
          pesticideType: 'fungicide' as const,
          effects: [{
            diseasePestId: 'dp-other',
            preventionLevel: 'A' as const,
            treatmentLevel: 'B' as const,
            efficacyLevel: null,
            persistenceLevel: 'C' as const,
            diseasePest: { name: '別の病気', category: 'disease' },
          }],
        }]}
        selectedDiseasePestId="dp-1"
        diseasePests={[{ id: 'dp-1', name: 'うどんこ病' }]}
      />
    )

    expect(screen.queryByTestId('badge-予防')).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // Ingredients display with codes
  // ----------------------------------------------------------------
  it('有効成分のFRAC/IRACコードを表示する', () => {
    render(
      <PesticideResults
        pesticides={[{
          ...basePesticide,
          pesticideType: 'fungicide' as const,
          ingredients: [{
            contentLabel: '50%',
            activeIngredient: {
              name: 'テスト成分',
              fracCode: '11',
              iracCode: null,
            },
          }],
        }]}
      />
    )

    expect(screen.getByText(/テスト成分/)).toBeInTheDocument()
    expect(screen.getByText(/50%/)).toBeInTheDocument()
    expect(screen.getByText(/\[FRAC:11\]/)).toBeInTheDocument()
  })

  it('有効成分のIRACコードを表示する', () => {
    render(
      <PesticideResults
        pesticides={[{
          ...basePesticide,
          pesticideType: 'insecticide' as const,
          ingredients: [{
            contentLabel: null,
            activeIngredient: {
              name: '殺虫成分',
              fracCode: null,
              iracCode: '4A',
            },
          }],
        }]}
      />
    )

    expect(screen.getByText(/殺虫成分/)).toBeInTheDocument()
    expect(screen.getByText(/\[IRAC:4A\]/)).toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // Registration number display
  // ----------------------------------------------------------------
  it('登録番号を表示する', () => {
    render(
      <PesticideResults
        pesticides={[{
          ...basePesticide,
          pesticideType: 'fungicide' as const,
          registrationNumber: '第12345号',
        }]}
      />
    )

    expect(screen.getByText(/登録番号: 第12345号/)).toBeInTheDocument()
  })

  it('登録番号がnullの場合に表示しない', () => {
    render(
      <PesticideResults
        pesticides={[{
          ...basePesticide,
          pesticideType: 'fungicide' as const,
          registrationNumber: null,
        }]}
      />
    )

    expect(screen.queryByText(/登録番号:/)).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // Formulation type display
  // ----------------------------------------------------------------
  it('剤型を表示する', () => {
    render(
      <PesticideResults
        pesticides={[{
          ...basePesticide,
          pesticideType: 'fungicide' as const,
        }]}
      />
    )

    expect(screen.getByText(/剤型: 水和剤/)).toBeInTheDocument()
  })

  it('剤型がnullの場合に表示しない', () => {
    render(
      <PesticideResults
        pesticides={[{
          ...basePesticide,
          pesticideType: 'fungicide' as const,
          formulationType: null,
        }]}
      />
    )

    expect(screen.queryByText(/剤型:/)).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // Pesticide type labels
  // ----------------------------------------------------------------
  it('各農薬タイプのラベルを正しく表示する', () => {
    const types = [
      { type: 'fungicide' as const, label: '殺菌剤' },
      { type: 'insecticide' as const, label: '殺虫剤' },
      { type: 'acaricide' as const, label: '殺ダニ剤' },
      { type: 'compound' as const, label: '複合剤' },
      { type: 'other' as const, label: 'その他' },
    ]

    for (const { type, label } of types) {
      const { unmount } = render(
        <PesticideResults
          pesticides={[{
            ...basePesticide,
            id: `p-${type}`,
            pesticideType: type,
          }]}
        />
      )

      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })

  // ----------------------------------------------------------------
  // Count display
  // ----------------------------------------------------------------
  it('結果件数を表示する', () => {
    render(
      <PesticideResults
        pesticides={[
          { ...basePesticide, id: 'p-1', pesticideType: 'fungicide' as const },
          { ...basePesticide, id: 'p-2', name: '薬剤2', pesticideType: 'insecticide' as const },
        ]}
      />
    )

    expect(screen.getByText('2件')).toBeInTheDocument()
  })

  it('0件の場合に0件と表示する', () => {
    render(
      <PesticideResults pesticides={[]} />
    )

    expect(screen.getByText('0件')).toBeInTheDocument()
  })
})
