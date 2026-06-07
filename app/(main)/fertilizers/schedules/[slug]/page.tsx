import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getFertilizationSchedule } from '@/lib/actions/fertilizer'
import { TREE_CATEGORY_BADGE, FERTILIZER_ACTION_BADGE } from '@/lib/utils/fertilizer'
import { FertilizationCalendar } from '@/components/fertilizer/FertilizationCalendar'
import { FertilizationTimeline } from '@/components/fertilizer/FertilizationTimeline'
import { FertilizerDisclaimer } from '@/components/fertilizer/FertilizerDisclaimer'
import type { FertilizerAction } from '@prisma/client'
import { ROUTE_FERTILIZERS_SCHEDULES } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'
export const dynamic = 'force-dynamic' // (main) レイアウト/PremiumProvider が auth() を呼ぶため静的生成不可。SSR で配信しデータは unstable_cache でキャッシュ。

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const species = await getFertilizationSchedule(slug)
  if (!species) return { title: '樹種が見つかりません' }
  return {
    title: `${species.name} 施肥スケジュール - 施肥ガイド`,
    alternates: { canonical: pageCanonical(`${ROUTE_FERTILIZERS_SCHEDULES}/${slug}`) },
  }
}

/** 季節サマリーを計算 */
function computeSeasonSummary(plans: { month: number; action: FertilizerAction }[]) {
  const seasons = [
    { label: '春', emoji: '🌱', months: [3, 4, 5] },
    { label: '夏', emoji: '☀️', months: [6, 7, 8] },
    { label: '秋', emoji: '🍂', months: [9, 10, 11] },
    { label: '冬', emoji: '❄️', months: [12, 1, 2] },
  ]

  return seasons.map((season) => {
    const seasonPlans = plans.filter((p) => season.months.includes(p.month))
    // 最も多いアクションを代表値とする
    const actionCounts = new Map<FertilizerAction, number>()
    for (const plan of seasonPlans) {
      actionCounts.set(plan.action, (actionCounts.get(plan.action) ?? 0) + 1)
    }

    let dominant: FertilizerAction | undefined
    let dominantCount = 0
    for (const [action, count] of actionCounts) {
      if (count > dominantCount) {
        dominant = action
        dominantCount = count
      }
    }

    const fallback: FertilizerAction = 'none'
    return {
      ...season,
      dominantAction: dominant ?? fallback,
    }
  })
}

export default async function ScheduleDetailPage({ params }: Props) {
  const { slug } = await params
  const species = await getFertilizationSchedule(slug)

  if (!species) {
    notFound()
  }

  const badge = TREE_CATEGORY_BADGE[species.category]
  const seasonSummary = computeSeasonSummary(species.plans)

  return (
    <div className="space-y-6">
      <Link href="/fertilizers/schedules" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 樹種一覧
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{species.name}</h1>
          <span className={badge.className + ' px-2 py-0.5 text-xs rounded-full font-medium'}>
            {badge.label}
          </span>
        </div>
        {species.nameEn && (
          <p className="text-sm text-muted-foreground mt-0.5">{species.nameEn}</p>
        )}
      </div>

      {species.description && (
        <section className="rounded-lg border border-border/40 p-4">
          <h2 className="text-sm font-semibold mb-2">概要</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{species.description}</p>
        </section>
      )}

      {species.fertilizingPolicy && (
        <section className="rounded-lg border border-border/40 p-4">
          <h2 className="text-sm font-semibold mb-2">施肥方針</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{species.fertilizingPolicy}</p>
        </section>
      )}

      {species.examples && (
        <section className="rounded-lg border border-border/40 p-4">
          <h2 className="text-sm font-semibold mb-2">代表的な樹種</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{species.examples}</p>
        </section>
      )}

      {species.plans.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">季節ごとの施肥傾向</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {seasonSummary.map((season) => {
              const actionBadge = FERTILIZER_ACTION_BADGE[season.dominantAction]
              return (
                <div key={season.label} className="rounded-lg border p-3 text-center">
                  <span className="text-lg">{season.emoji}</span>
                  <p className="text-sm font-medium mt-1">{season.label}</p>
                  <p className={`text-xs mt-1 ${actionBadge.className} inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium`}>
                    <span>{actionBadge.icon}</span>
                    <span>{actionBadge.label}</span>
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {species.plans.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">年間施肥タイムライン</h2>
          <div className="rounded-lg border border-border/40 p-4">
            <FertilizationTimeline plans={species.plans} />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">月別施肥カレンダー</h2>
        <FertilizationCalendar plans={species.plans} />
      </section>

      <FertilizerDisclaimer />
    </div>
  )
}
