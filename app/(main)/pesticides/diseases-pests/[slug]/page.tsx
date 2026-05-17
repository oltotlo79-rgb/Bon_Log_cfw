import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, BookOpen, FlaskConical } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getDiseasePestBySlug } from '@/lib/actions/pesticide'
import { prisma } from '@/lib/db'
import { loadStaticParams } from '@/lib/build/static-params'
import { PesticideDisclaimer } from '@/components/pesticide/PesticideDisclaimer'
import { EffectRatingBadge } from '@/components/pesticide/EffectRatingBadge'
import { CATEGORY_BADGE } from '@/lib/utils/pesticide-badge'
import type { EffectRating, PesticideType } from '@prisma/client'
import { DiseasePestImageLightbox } from '@/components/pesticide/DiseasePestImageLightbox'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { META_DESCRIPTION_PREVIEW_LENGTH } from '@/lib/constants/limits'
import { BASE_URL, ROUTE_PESTICIDES, ROUTE_PESTICIDES_DISEASES_PESTS } from '@/lib/constants/routes'
import { buildPesticideProductPath, buildPesticideDiseasePestPath } from '@/lib/constants/path-builders'
import { pageCanonical } from '@/lib/utils/seo'

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const dp = await getDiseasePestBySlug(slug)
  if (!dp) return { title: '病害虫が見つかりません - BON-LOG' }
  const description = dp.description?.slice(0, META_DESCRIPTION_PREVIEW_LENGTH)
    || `${dp.name}の症状・発生時期・対策薬剤など、病害虫対策の詳細情報`
  return {
    title: `${dp.name} - 病害虫・益虫図鑑 - BON-LOG`,
    description,
    alternates: { canonical: pageCanonical(`${ROUTE_PESTICIDES_DISEASES_PESTS}/${slug}`) },
  }
}

export async function generateStaticParams() {
  return loadStaticParams(async () => {
    const items = await prisma.diseasePest.findMany({ select: { slug: true } })
    return items.map((i) => ({ slug: i.slug }))
  }, '/pesticides/diseases-pests')
}

export default async function DiseasePestDetailPage({ params }: Props) {
  const { slug } = await params
  const dp = await getDiseasePestBySlug(slug)

  if (!dp) {
    notFound()
  }

  const categoryBadge = CATEGORY_BADGE[dp.category as keyof typeof CATEGORY_BADGE]
  const categoryEmoji = dp.category === 'disease' ? '🦠' : dp.category === 'beneficial_insect' ? '🐝' : '🐛'

  return (
    <div className="space-y-6">
      <BreadcrumbJsonLd items={[
        { name: 'BON-LOG', url: BASE_URL },
        { name: '農薬・病害虫', url: `${BASE_URL}${ROUTE_PESTICIDES}` },
        { name: '病害虫図鑑', url: `${BASE_URL}${ROUTE_PESTICIDES_DISEASES_PESTS}` },
        { name: dp.name, url: `${BASE_URL}${buildPesticideDiseasePestPath(slug)}` },
      ]} />

      <Link href={ROUTE_PESTICIDES_DISEASES_PESTS} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 病害虫・益虫図鑑
      </Link>

      {/* ヘッダー */}
      <div className="flex gap-4">
        {dp.imageUrl ? (
          <DiseasePestImageLightbox
            key={dp.imageUrl}
            imageUrl={dp.imageUrl}
            alt={dp.name}
            name={dp.name}
          />
        ) : (
          <div className="w-[120px] h-[120px] rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
            <span className="text-4xl">{categoryEmoji}</span>
          </div>
        )}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{dp.name}</h1>
            {categoryBadge && (
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${categoryBadge.className}`}>
                {categoryBadge.label}
              </span>
            )}
          </div>
          {dp.nameKana && (
            <p className="text-sm text-muted-foreground mt-1">{dp.nameKana}</p>
          )}
        </div>
      </div>

      {/* 概要 */}
      {dp.description && (
        <section className="rounded-lg border border-border/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-primary/10 text-primary">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-semibold">概要</h2>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed pl-9">{dp.description}</p>
        </section>
      )}

      <PesticideDisclaimer />

      {/* 効く薬剤 */}
      {dp.effects.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-primary/10 text-primary">
              <FlaskConical className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-lg font-semibold">
              {dp.category === 'beneficial_insect' ? '関連薬剤' : '効く薬剤'}
            </h2>
            <span className="text-sm text-muted-foreground">({dp.effects.length}件)</span>
          </div>

          {/* 効果評価の凡例 */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground px-1">
            <span className="font-medium text-foreground">効果評価:</span>
            <span className="inline-flex items-center gap-1"><span className="inline-flex items-center justify-center w-5 h-5 rounded border text-xs font-bold bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700">◎</span> 優秀</span>
            <span className="inline-flex items-center gap-1"><span className="inline-flex items-center justify-center w-5 h-5 rounded border text-xs font-bold bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700">○</span> 良好</span>
            <span className="inline-flex items-center gap-1"><span className="inline-flex items-center justify-center w-5 h-5 rounded border text-xs font-bold bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700">△</span> やや有効</span>
            <span className="inline-flex items-center gap-1"><span className="inline-flex items-center justify-center w-5 h-5 rounded border text-xs font-bold bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700">×</span> 効果低い</span>
          </div>

          <div className="space-y-2">
            {dp.effects.map((effect: { preventionLevel: EffectRating | null; treatmentLevel: EffectRating | null; efficacyLevel: EffectRating | null; persistenceLevel: EffectRating | null; pesticide: { id: string; slug: string; name: string; registrationNumber: string | null; pesticideType: PesticideType; formulationType: { name: string } | null; ingredients: { activeIngredient: { name: string; fracCode: string | null; iracCode: string | null } }[] } }) => {
              const p = effect.pesticide
              return (
                <Link
                  key={p.id}
                  href={buildPesticideProductPath(p.slug)}
                  className="block rounded-lg border border-border/40 p-3 hover:border-primary/40 hover:bg-accent/50 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                        {p.registrationNumber && (
                          <span className="tabular-nums">No.{p.registrationNumber}</span>
                        )}
                        {p.formulationType && <span>{p.formulationType.name}</span>}
                      </div>
                    </div>
                    {p.ingredients.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {p.ingredients.map((ing: { activeIngredient: { name: string; fracCode: string | null; iracCode: string | null } }) => (
                          <span
                            key={ing.activeIngredient.name}
                            className="rounded border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {ing.activeIngredient.name}
                            {ing.activeIngredient.fracCode && ` [FRAC:${ing.activeIngredient.fracCode}]`}
                            {ing.activeIngredient.iracCode && ` [IRAC:${ing.activeIngredient.iracCode}]`}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(p.pesticideType === 'fungicide' || p.pesticideType === 'compound') && (
                        <>
                          <EffectRatingBadge rating={effect.preventionLevel} label="予防" />
                          <EffectRatingBadge rating={effect.treatmentLevel} label="治療" />
                        </>
                      )}
                      {(p.pesticideType === 'insecticide' || p.pesticideType === 'acaricide' || p.pesticideType === 'compound') && (
                        <EffectRatingBadge rating={effect.efficacyLevel} label="効果" />
                      )}
                      <EffectRatingBadge rating={effect.persistenceLevel} label="持続" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
