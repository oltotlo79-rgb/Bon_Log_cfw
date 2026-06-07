import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, BookOpen, Sprout, AlertTriangle, ShieldAlert, Package } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getNutrientBySlug, getNutrients } from '@/lib/actions/fertilizer'
import { NutrientCategoryBadge } from '@/components/fertilizer/NutrientCategoryBadge'
import { NutrientCard } from '@/components/fertilizer/NutrientCard'
import { ROUTE_FERTILIZERS_NUTRIENTS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'
export const dynamic = 'force-dynamic' // (main) レイアウト/PremiumProvider が auth() を呼ぶため静的生成不可。SSR で配信しデータは unstable_cache でキャッシュ。

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const nutrient = await getNutrientBySlug(slug)
  if (!nutrient) return { title: '栄養素が見つかりません' }
  return {
    title: `${nutrient.name}（${nutrient.symbol}） - 栄養素`,
    alternates: { canonical: pageCanonical(`${ROUTE_FERTILIZERS_NUTRIENTS}/${slug}`) },
  }
}

/** セクションコンポーネント */
function InfoSection({
  icon: Icon,
  title,
  children,
  variant = 'default',
}: {
  icon: typeof BookOpen
  title: string
  children: React.ReactNode
  variant?: 'default' | 'warning' | 'danger'
}) {
  const borderColors = {
    default: 'border-border/40',
    warning: 'border-amber-200 dark:border-amber-800/40',
    danger: 'border-red-200 dark:border-red-800/40',
  }
  const iconColors = {
    default: 'text-primary bg-primary/10',
    warning: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
    danger: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
  }

  return (
    <section className={`rounded-lg border ${borderColors[variant]} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${iconColors[variant]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed pl-9">
        {children}
      </div>
    </section>
  )
}

export default async function NutrientDetailPage({ params }: Props) {
  const { slug } = await params
  const [nutrient, { nutrients: allNutrients }] = await Promise.all([
    getNutrientBySlug(slug),
    getNutrients({ category: undefined }),
  ])

  if (!nutrient) {
    notFound()
  }

  // 同カテゴリの他の栄養素（自分を除く）
  const relatedNutrients = allNutrients
    .filter((n) => n.category === nutrient.category && n.id !== nutrient.id)
    .slice(0, 3)

  return (
    <div className="space-y-6">
      <Link href="/fertilizers/nutrients" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 栄養素一覧
      </Link>

      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="text-3xl font-bold text-primary">{nutrient.symbol}</span>
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{nutrient.name}</h1>
            <NutrientCategoryBadge category={nutrient.category} />
          </div>
          {nutrient.nameEn && (
            <p className="text-sm text-muted-foreground mt-0.5">{nutrient.nameEn}</p>
          )}
        </div>
      </div>

      {nutrient.description && (
        <InfoSection icon={BookOpen} title="概要">
          {nutrient.description}
        </InfoSection>
      )}

      {nutrient.bonsaiRole && (
        <InfoSection icon={Sprout} title="盆栽での役割">
          {nutrient.bonsaiRole}
        </InfoSection>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {nutrient.deficiencySymptoms && (
          <InfoSection icon={AlertTriangle} title="欠乏症状" variant="warning">
            {nutrient.deficiencySymptoms}
          </InfoSection>
        )}

        {nutrient.excessSymptoms && (
          <InfoSection icon={ShieldAlert} title="過剰症状" variant="danger">
            {nutrient.excessSymptoms}
          </InfoSection>
        )}
      </div>

      {nutrient.foodSources && (
        <InfoSection icon={Package} title="主な供給源">
          {nutrient.foodSources}
        </InfoSection>
      )}

      {relatedNutrients.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-sm font-semibold text-muted-foreground">同じカテゴリの栄養素</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {relatedNutrients.map((n) => (
              <NutrientCard key={n.id} nutrient={n} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
