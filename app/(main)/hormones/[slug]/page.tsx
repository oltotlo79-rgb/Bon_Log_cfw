import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, Beaker, TreeDeciduous, Lightbulb, MapPin, Zap, FlaskConical, Wrench } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getHormoneBySlug, getHormoneTechniquesBySlug } from '@/lib/actions/hormone'
import { BONSAI_TECHNIQUES, TECHNIQUE_EFFECT_TYPE_LABELS, TECHNIQUE_EFFECT_TYPE_COLORS, TECHNIQUE_MAGNITUDE_LABELS } from '@/lib/constants/hormone-techniques'
import { HormoneCategoryBadge } from '@/components/hormone/HormoneCategoryBadge'
import { HormoneEffectList } from '@/components/hormone/HormoneEffectList'
import { HormoneSeasonalChart } from '@/components/hormone/HormoneSeasonalChart'
import { HormoneInteractionCard } from '@/components/hormone/HormoneInteractionCard'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { ArticleJsonLd } from '@/components/seo/ArticleJsonLd'
import { BASE_URL, ROUTE_HORMONES, ROUTE_HORMONE_INTERACTIONS, ROUTE_HORMONE_TECHNIQUES } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'
import { COLUMN_OG_DESCRIPTION_LENGTH } from '@/lib/constants/limits'

export const dynamic = 'force-dynamic' // (main) レイアウト/PremiumProvider が auth() を呼ぶため静的生成不可。SSR で配信しデータは unstable_cache でキャッシュ。

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const hormone = await getHormoneBySlug(slug)
  if (!hormone) return { title: 'ホルモンが見つかりません' }
  const title = `${hormone.name}${hormone.nameEn ? `（${hormone.nameEn}）` : ''} - 植物ホルモン`
  const description = (
    hormone.description ?? `植物ホルモン「${hormone.name}」の働き・季節変動・相互作用を解説します。`
  ).slice(0, COLUMN_OG_DESCRIPTION_LENGTH)
  const canonical = pageCanonical(`${ROUTE_HORMONES}/${slug}`)
  const ogImageUrl = `/api/og?title=${encodeURIComponent(hormone.name)}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: hormone.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

/** セクションコンポーネント */
function InfoSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Beaker
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </section>
  )
}

export default async function HormoneDetailPage({ params }: Props) {
  const { slug } = await params
  const [hormone, { techniques }] = await Promise.all([
    getHormoneBySlug(slug),
    getHormoneTechniquesBySlug(slug),
  ])

  if (!hormone) {
    notFound()
  }

  const allInteractions = [
    ...hormone.interactionsA.map((i) => ({
      partnerName: i.hormoneB.name,
      type: i.type,
      description: i.description,
      bonsaiRelevance: i.bonsaiRelevance,
    })),
    ...hormone.interactionsB.map((i) => ({
      partnerName: i.hormoneA.name,
      type: i.type,
      description: i.description,
      bonsaiRelevance: i.bonsaiRelevance,
    })),
  ]

  const hormoneUrl = `${BASE_URL}${ROUTE_HORMONES}/${slug}`
  const hormoneDescription = (hormone.description ?? hormone.bonsaiRole ?? '')
    .slice(0, COLUMN_OG_DESCRIPTION_LENGTH) || `${hormone.name}は盆栽に関わる植物ホルモンです。`

  return (
    <div className="space-y-6">
      <BreadcrumbJsonLd
        items={[
          { name: '植物ホルモン', url: `${BASE_URL}${ROUTE_HORMONES}` },
          { name: hormone.name, url: hormoneUrl },
        ]}
      />
      <ArticleJsonLd
        headline={`${hormone.name}${hormone.nameEn ? `（${hormone.nameEn}）` : ''} - 植物ホルモン`}
        datePublished={hormone.createdAt.toISOString()}
        dateModified={hormone.updatedAt.toISOString()}
        author={{ name: 'BON-LOG', url: BASE_URL }}
        url={hormoneUrl}
        description={hormoneDescription}
      />

      <Link href={ROUTE_HORMONES} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 植物ホルモン一覧
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{hormone.name}</h1>
          <HormoneCategoryBadge category={hormone.category} />
        </div>
        {hormone.nameEn && (
          <p className="text-sm text-muted-foreground mt-0.5">{hormone.nameEn}</p>
        )}
        {hormone.chemicalFormula && (
          <p className="text-xs text-muted-foreground mt-1 font-mono">{hormone.chemicalFormula}</p>
        )}
      </div>

      {hormone.description && (
        <InfoSection icon={Beaker} title="概要">
          <p className="whitespace-pre-wrap">{hormone.description}</p>
        </InfoSection>
      )}

      {hormone.bonsaiRole && (
        <InfoSection icon={TreeDeciduous} title="盆栽での役割">
          <p className="whitespace-pre-wrap">{hormone.bonsaiRole}</p>
        </InfoSection>
      )}

      {hormone.productionSite && (
        <InfoSection icon={MapPin} title="生成部位">
          <p className="whitespace-pre-wrap">{hormone.productionSite}</p>
        </InfoSection>
      )}

      {hormone.activationMethod && (
        <InfoSection icon={Zap} title="活性化・調節方法">
          <p className="whitespace-pre-wrap">{hormone.activationMethod}</p>
        </InfoSection>
      )}

      {hormone.practicalTips && (
        <InfoSection icon={Lightbulb} title="実践的なヒント">
          <p className="whitespace-pre-wrap">{hormone.practicalTips}</p>
        </InfoSection>
      )}

      {hormone.effects.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">効果</h2>
          <HormoneEffectList effects={hormone.effects} />
        </section>
      )}

      {hormone.seasonalLevels.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">月別活性レベル</h2>
          <div className="rounded-lg border p-4">
            <HormoneSeasonalChart seasonalLevels={hormone.seasonalLevels} />
          </div>
        </section>
      )}

      {allInteractions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">相互作用</h2>
            <Link
              href={ROUTE_HORMONE_INTERACTIONS}
              className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
            >
              すべて見る <FlaskConical className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <div className="space-y-3">
            {allInteractions.map((interaction, index) => (
              <HormoneInteractionCard
                key={index}
                hormoneAName={hormone.name}
                hormoneBName={interaction.partnerName}
                type={interaction.type}
                description={interaction.description}
                bonsaiRelevance={interaction.bonsaiRelevance}
              />
            ))}
          </div>
        </section>
      )}

      {techniques.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">関連する盆栽技法</h2>
            <Link
              href={ROUTE_HORMONE_TECHNIQUES}
              className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
            >
              すべて見る <Wrench className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <div className="space-y-2">
            {techniques.map((t) => {
              const technique = BONSAI_TECHNIQUES.find((b) => b.slug === t.techniqueSlug)
              const effectLabel = TECHNIQUE_EFFECT_TYPE_LABELS[t.effectType] ?? t.effectType
              const effectColors = TECHNIQUE_EFFECT_TYPE_COLORS[t.effectType]
              const magnitudeLabel = TECHNIQUE_MAGNITUDE_LABELS[t.magnitude] ?? t.magnitude
              // 色未定義（未知の effectType）でもバッジ自体は出す。表示可否は色ではなく effectType の有無で判断する
              const badgeClassName = effectColors
                ? `${effectColors.bg} ${effectColors.text} ${effectColors.darkBg}`
                : 'bg-muted-foreground/20 text-muted-foreground'
              return (
                <div key={t.id} className="rounded-md bg-muted/50 p-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{technique?.name ?? t.techniqueName}</span>
                    {t.effectType && (
                      <span className={`${badgeClassName} px-2 py-0.5 text-xs rounded-full font-medium`}>
                        {effectLabel}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">（影響度: {magnitudeLabel}）</span>
                  </div>
                  {t.mechanism && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.mechanism}</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
