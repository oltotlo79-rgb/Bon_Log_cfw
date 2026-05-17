import Link from 'next/link'
import { EffectRatingBadge } from '@/components/pesticide/EffectRatingBadge'
import type { EffectRating, PesticideType } from '@prisma/client'

type PesticideItem = {
  id: string
  name: string
  registrationNumber: string | null
  pesticideType: PesticideType
  slug: string
  formulationType: { name: string } | null
  ingredients: Array<{
    contentLabel: string | null
    activeIngredient: {
      name: string
      fracCode: string | null
      iracCode: string | null
    }
  }>
  effects: Array<{
    diseasePestId: string
    preventionLevel: EffectRating | null
    treatmentLevel: EffectRating | null
    efficacyLevel: EffectRating | null
    persistenceLevel: EffectRating | null
    diseasePest: { name: string; category: string }
  }>
}

type DiseasePestItem = {
  id: string
  name: string
  slug?: string
  category?: 'disease' | 'pest' | 'beneficial_insect'
}

type Props = {
  pesticides: PesticideItem[]
  selectedDiseasePestId?: string
  /** 病害虫一覧（検索結果ページでフィルタ表示用）。単品表示時は省略可 */
  diseasePests?: DiseasePestItem[]
}

const TYPE_LABELS: Record<PesticideType, string> = {
  fungicide: '殺菌剤',
  insecticide: '殺虫剤',
  acaricide: '殺ダニ剤',
  compound: '複合剤',
  other: 'その他',
}

export function PesticideResults({ pesticides, selectedDiseasePestId, diseasePests = [] }: Props) {
  const selectedDiseasePest = diseasePests.find((dp) => dp.id === selectedDiseasePestId)
  const selectedName = selectedDiseasePest?.name

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">
            {selectedName ? `${selectedName} に効く薬剤` : '検索結果'}
          </h2>
          {selectedDiseasePest?.slug && (
            <Link
              href={`/pesticides/diseases-pests/${selectedDiseasePest.slug}`}
              className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              この病害虫の詳細 →
            </Link>
          )}
        </div>
        <span className="text-sm text-muted-foreground">{pesticides.length}件</span>
      </div>

      {pesticides.length === 0 ? (
        selectedDiseasePest?.category === 'beneficial_insect' ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              益虫は農薬防除の対象ではありません。<br className="sm:hidden" />生態・見分け方は図鑑ページをご覧ください。
            </p>
            {selectedDiseasePest.slug && (
              <Link
                href={`/pesticides/diseases-pests/${selectedDiseasePest.slug}`}
                className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                {selectedDiseasePest.name} の図鑑ページを見る →
              </Link>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            該当する薬剤が見つかりませんでした
          </p>
        )
      ) : (
        <div className="space-y-3">
          {pesticides.map((p) => {
            const relevantEffect = selectedDiseasePestId
              ? p.effects.find((e) => e.diseasePestId === selectedDiseasePestId)
              : null

            return (
              <Link
                key={p.id}
                href={`/pesticides/products/${p.slug}`}
                className="block rounded-lg border border-border/40 p-4 hover:border-primary/40 hover:bg-muted/20 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                        {TYPE_LABELS[p.pesticideType]}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      {p.registrationNumber && (
                        <span>登録番号: {p.registrationNumber}</span>
                      )}
                      {p.formulationType && <span>剤型: {p.formulationType.name}</span>}
                    </div>
                    {p.ingredients.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {p.ingredients.map((ing) => (
                          <span
                            key={ing.activeIngredient.name}
                            className="rounded border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {ing.activeIngredient.name}
                            {ing.contentLabel && ` ${ing.contentLabel}`}
                            {ing.activeIngredient.fracCode && ` [FRAC:${ing.activeIngredient.fracCode}]`}
                            {ing.activeIngredient.iracCode && ` [IRAC:${ing.activeIngredient.iracCode}]`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {relevantEffect && (
                  <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border/30">
                    {(p.pesticideType === 'fungicide' || p.pesticideType === 'compound') && (
                      <>
                        <EffectRatingBadge rating={relevantEffect.preventionLevel} label="予防" />
                        <EffectRatingBadge rating={relevantEffect.treatmentLevel} label="治療" />
                      </>
                    )}
                    {(p.pesticideType === 'insecticide' || p.pesticideType === 'acaricide' || p.pesticideType === 'compound') && (
                      <EffectRatingBadge rating={relevantEffect.efficacyLevel} label="効果" />
                    )}
                    <EffectRatingBadge rating={relevantEffect.persistenceLevel} label="持続" />
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
