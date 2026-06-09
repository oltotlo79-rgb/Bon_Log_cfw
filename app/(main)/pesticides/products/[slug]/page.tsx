import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Info, Beaker, AlertTriangle, Bug } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getPesticideBySlug } from '@/lib/actions/pesticide'
import { getMaffUrl, getResistanceRiskLabel, RESISTANCE_RISK_ORDER } from '@/lib/utils/pesticide'
import { PesticideDisclaimer } from '@/components/pesticide/PesticideDisclaimer'
import { MaffUnverifiedBadge } from '@/components/pesticide/MaffUnverifiedBadge'
import { CATEGORY_BADGE, PESTICIDE_TYPE_BADGE, type DiseasePestCategory } from '@/lib/utils/pesticide-badge'
import type { ResistanceRisk, EffectRating } from '@prisma/client'
import { EffectRatingBadge } from '@/components/pesticide/EffectRatingBadge'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { ProductJsonLd } from '@/components/seo/ProductJsonLd'
import { META_DESCRIPTION_PREVIEW_LENGTH } from '@/lib/constants/limits'
import { BASE_URL, ROUTE_PESTICIDES } from '@/lib/constants/routes'
import {
  buildPesticideIngredientPath,
  buildPesticideProductPath,
  buildPesticideDiseasePestPath,
  buildPesticideFormulationsPath,
  buildPesticideSpreaderFilterPath,
} from '@/lib/constants/path-builders'
import { pageCanonical } from '@/lib/utils/seo'

export const dynamic = 'force-dynamic' // (main) レイアウト/PremiumProvider が auth() を呼ぶため静的生成不可。SSR で配信しデータは unstable_cache でキャッシュ。

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const pesticide = await getPesticideBySlug(slug)
  if (!pesticide) return { title: '薬剤が見つかりません' }
  const description = pesticide.description?.slice(0, META_DESCRIPTION_PREVIEW_LENGTH)
    || `${pesticide.name}の成分・効果・使用上の注意・FRAC/IRACコードなど詳細情報`
  const title = `${pesticide.name} - 薬剤詳細`
  const canonical = pageCanonical(`${ROUTE_PESTICIDES}/products/${slug}`)
  const ogImageUrl = `/api/og?title=${encodeURIComponent(pesticide.name)}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: pesticide.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

function getMaxResistanceRiskFromIngredients(ingredients: { activeIngredient: { resistanceRisk: ResistanceRisk | null } }[]): ResistanceRisk | null {
  let max: ResistanceRisk | null = null
  for (const { activeIngredient } of ingredients) {
    const r = activeIngredient.resistanceRisk
    if (r == null) continue
    if (max == null || RESISTANCE_RISK_ORDER[r] > RESISTANCE_RISK_ORDER[max]) max = r
  }
  return max
}

export default async function PesticideDetailPage({ params }: Props) {
  const { slug } = await params
  const pesticide = await getPesticideBySlug(slug)

  if (!pesticide) {
    notFound()
  }

  const resistanceRisk = getMaxResistanceRiskFromIngredients(pesticide.ingredients)
  const resistanceLabel = resistanceRisk ? getResistanceRiskLabel(resistanceRisk) : null
  const isSpreaderOnly = (pesticide.spreaderTypes?.length ?? 0) > 0

  const productUrl = `${BASE_URL}${buildPesticideProductPath(slug)}`
  const productCategory = PESTICIDE_TYPE_BADGE[pesticide.pesticideType].label
  const ingredientNames = pesticide.ingredients
    .map((ing: { activeIngredient: { name: string } }) => ing.activeIngredient.name)
    .join(', ')
  const productAdditionalProperties = [
    ...(pesticide.formulationType ? [{ name: '剤型', value: pesticide.formulationType.name }] : []),
    ...(ingredientNames ? [{ name: '有効成分', value: ingredientNames }] : []),
    ...(resistanceLabel ? [{ name: '耐性リスク', value: resistanceLabel }] : []),
  ]

  return (
    <div className="space-y-6">
      <BreadcrumbJsonLd items={[
        { name: 'BON-LOG', url: BASE_URL },
        { name: '農薬・病害虫', url: `${BASE_URL}${ROUTE_PESTICIDES}` },
        { name: '薬剤一覧', url: `${BASE_URL}${ROUTE_PESTICIDES}/products` },
        { name: pesticide.name, url: productUrl },
      ]} />
      <ProductJsonLd
        name={pesticide.name}
        description={pesticide.description ?? undefined}
        url={productUrl}
        category={productCategory}
        productID={pesticide.registrationNumber ?? undefined}
        additionalProperties={productAdditionalProperties}
      />

      <div className="flex items-center justify-between">
        <Link
          href={ROUTE_PESTICIDES}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0 whitespace-nowrap"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 農薬・病害虫トップ
        </Link>
      </div>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold">{pesticide.name}</h1>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${PESTICIDE_TYPE_BADGE[pesticide.pesticideType].className}`}>
            {PESTICIDE_TYPE_BADGE[pesticide.pesticideType].label}
          </span>
        </div>
        {pesticide.description && (
          <p className="text-sm text-muted-foreground mt-2">{pesticide.description}</p>
        )}
      </div>

      <MaffUnverifiedBadge show={pesticide.registrationNumber == null} />

      <PesticideDisclaimer />

      <section className="rounded-lg border border-border/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-primary/10 text-primary">
            <Info className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-semibold">基本情報</h2>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {pesticide.registrationNumber && (
            <>
              <dt className="text-muted-foreground">登録番号</dt>
              <dd>
                <a
                  href={getMaffUrl(pesticide.registrationNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {pesticide.registrationNumber}（農林水産省）↗
                </a>
              </dd>
            </>
          )}
          {pesticide.formulationType && (
            <>
              <dt className="text-muted-foreground">剤型</dt>
              <dd className="space-y-1">
                <Link
                  href={buildPesticideFormulationsPath(pesticide.formulationType.code)}
                  className="text-primary hover:underline"
                >
                  {pesticide.formulationType.name}
                </Link>
                <span className="text-muted-foreground mx-2 text-xs">·</span>
                <Link
                  href={buildPesticideFormulationsPath(pesticide.formulationType.code)}
                  className="text-xs text-primary hover:underline"
                >
                  同じ剤型の薬剤を見る
                </Link>
              </dd>
            </>
          )}
          {!isSpreaderOnly && (
            <>
              <dt className="text-muted-foreground">耐性がつきやすいか</dt>
              <dd>
                {(() => {
                  const risk = getMaxResistanceRiskFromIngredients(pesticide.ingredients)
                  if (risk == null) return <span className="text-muted-foreground">—</span>
                  const label = getResistanceRiskLabel(risk)
                  if (!label) return <span className="text-muted-foreground">—</span>
                  return (
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      risk === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                      risk === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    }`}>
                      {label}
                    </span>
                  )
                })()}
              </dd>
            </>
          )}
          {isSpreaderOnly && (pesticide.spreaderTypes ?? []).length > 0 && (
            <>
              <dt className="text-muted-foreground">展着剤の分類</dt>
              <dd className="flex flex-wrap gap-1.5">
                {(pesticide.spreaderTypes ?? []).map(({ spreaderType }: { spreaderType: { id: string; slug: string; name: string } }) => (
                  <Link
                    key={spreaderType.id}
                    href={buildPesticideSpreaderFilterPath(spreaderType.slug)}
                    className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted/80"
                  >
                    {spreaderType.name}
                  </Link>
                ))}
              </dd>
            </>
          )}
        </dl>
      </section>

      {pesticide.ingredients.length > 0 && (
        <section className="rounded-lg border border-border/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-primary/10 text-primary">
              <Beaker className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-semibold">成分（原体）</h2>
          </div>
          <div className="space-y-2">
            {pesticide.ingredients.map((ing: { contentLabel: string | null; activeIngredient: { slug: string; name: string; fracCode: string | null; iracCode: string | null; resistanceRisk: ResistanceRisk | null } }) => (
              <Link
                key={ing.activeIngredient.slug}
                href={buildPesticideIngredientPath(ing.activeIngredient.slug)}
                className="flex items-center justify-between rounded-md border border-border/30 p-2.5 hover:bg-muted/30 transition-colors"
              >
                <div>
                  <span className="text-sm font-medium">{ing.activeIngredient.name}</span>
                  {ing.contentLabel && (
                    <span className="text-xs text-muted-foreground ml-2">{ing.contentLabel}</span>
                  )}
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  {ing.activeIngredient.fracCode && (
                    <span className="rounded bg-muted text-muted-foreground px-1.5 py-0.5">
                      FRAC: {ing.activeIngredient.fracCode}
                    </span>
                  )}
                  {ing.activeIngredient.iracCode && (
                    <span className="rounded bg-muted text-muted-foreground px-1.5 py-0.5">
                      IRAC: {ing.activeIngredient.iracCode}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            各成分ページでは同じ成分を含む薬剤の一覧を確認できます。
          </p>
        </section>
      )}

      <section className={`rounded-lg border p-4 space-y-3 ${
        pesticide.incompatibleWith && pesticide.incompatibleWith.length > 0 
          ? 'border-destructive/30 bg-destructive/5' 
          : 'border-border/40'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
            pesticide.incompatibleWith && pesticide.incompatibleWith.length > 0
              ? 'bg-destructive/10 text-destructive'
              : 'bg-primary/10 text-primary'
          }`}>
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <h2 className={`text-sm font-semibold ${
            pesticide.incompatibleWith && pesticide.incompatibleWith.length > 0 ? 'text-destructive' : ''
          }`}>混用不可の農薬（代表例）</h2>
        </div>
        
        {pesticide.incompatibleWith && pesticide.incompatibleWith.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-destructive/90 mb-2 leading-relaxed">
              ⚠️ 【重要】このリストは、一般的な物理・化学的性質に基づく代表的な組み合わせを示しています。これ以外にも混用によって思わぬ薬害や効果の低下を招く恐れがあるため、実際の散布や混用の前には<strong>必ず製品ラベル・説明書の注意書きをご確認ください</strong>。
            </p>
            {pesticide.incompatibleWith.map((rel: { incompatibleWithId: string; incompatibleWith: { slug: string; name: string; formulationType?: { name: string } | null } }) => (
              <Link
                key={rel.incompatibleWithId}
                href={buildPesticideProductPath(rel.incompatibleWith.slug)}
                className="flex items-center justify-between rounded-md border border-destructive/20 bg-background p-2.5 hover:bg-destructive/10 transition-colors"
              >
                <div>
                  <span className="text-sm font-medium">{rel.incompatibleWith.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {rel.incompatibleWith.formulationType?.name || ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            特に登録・記載されている混用不可情報はありません。
          </p>
        )}
      </section>

      {!isSpreaderOnly && (
        <section className="rounded-lg border border-border/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-primary/10 text-primary">
              <Bug className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-semibold">効果のある病害虫</h2>
          </div>
          {pesticide.effects.length > 0 ? (
            <>
              <p className="text-xs text-muted-foreground">病害虫をクリックすると病害虫図鑑の詳細ページへ移動します</p>
              <div className="space-y-2">
                {pesticide.effects.map((effect: { id: string; preventionLevel: EffectRating | null; treatmentLevel: EffectRating | null; efficacyLevel: EffectRating | null; persistenceLevel: EffectRating | null; diseasePest: { slug: string; name: string; category: DiseasePestCategory } }) => (
                  <Link
                    key={effect.id}
                    href={buildPesticideDiseasePestPath(effect.diseasePest.slug)}
                    className="block rounded-md border border-border/30 p-2.5 hover:border-primary/40 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{effect.diseasePest.name}</span>
                        <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[effect.diseasePest.category].className}`}>
                          {CATEGORY_BADGE[effect.diseasePest.category].label}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {(pesticide.pesticideType === 'fungicide' || pesticide.pesticideType === 'compound') && (
                        <>
                          <EffectRatingBadge rating={effect.preventionLevel} label="予防" />
                          <EffectRatingBadge rating={effect.treatmentLevel} label="治療" />
                        </>
                      )}
                      {(pesticide.pesticideType === 'insecticide' || pesticide.pesticideType === 'acaricide' || pesticide.pesticideType === 'compound') && (
                        <EffectRatingBadge rating={effect.efficacyLevel} label="効果" />
                      )}
                      <EffectRatingBadge rating={effect.persistenceLevel} label="持続" />
                      <span className="inline-flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">耐性</span>
                        {resistanceLabel ? (
                          <span className="rounded bg-muted text-muted-foreground px-1.5 py-0.5 text-[10px] font-medium">
                            {resistanceLabel}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              現在、この薬剤に対する効果のある病害虫のデータは登録されていません。
            </p>
          )}
        </section>
      )}
    </div>
  )
}
