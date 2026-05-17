import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, Beaker, TreeDeciduous, LayoutGrid, BookOpen, Sprout, Droplets, Sun, Package, Layers, CloudRain } from 'lucide-react'
import { getNutrients, getTreeSpecies, getFertilizerColumns } from '@/lib/actions/fertilizer'
import { FertilizerDisclaimer } from '@/components/fertilizer/FertilizerDisclaimer'
import { NutrientCard } from '@/components/fertilizer/NutrientCard'
import { PostDetailAdUnit } from '@/components/ads'
import { getCurrentSeason } from '@/lib/utils/season'
import {
  ROUTE_FERTILIZERS,
  ROUTE_FERTILIZERS_CATEGORIES,
  ROUTE_FERTILIZERS_COLUMNS,
  ROUTE_FERTILIZERS_NUTRIENTS,
  ROUTE_FERTILIZERS_PRODUCTS,
  ROUTE_FERTILIZERS_SCHEDULES,
  ROUTE_FERTILIZERS_SOIL,
  ROUTE_FERTILIZERS_WATERING,
} from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '施肥ガイド - BON-LOG',
  description: '盆栽の施肥に必要な栄養素・肥料カテゴリ・樹種別スケジュールを確認できます。',
  alternates: { canonical: pageCanonical(ROUTE_FERTILIZERS) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

import type { Season } from '@/lib/utils/season'

/** 季節ごとの施肥ポイント */
const SEASONAL_TIPS: Record<Season, { title: string; description: string; icon: typeof Sprout }> = {
  spring: {
    title: '春の施肥 — 成長期の始まり',
    description: '芽出し後の肥料が一年の成長を左右します。窒素(N)多めの肥料で葉と枝の成長を促しましょう。ただし花物・実物は花芽分化を妨げないようリン酸(P)重視にします。',
    icon: Sprout,
  },
  summer: {
    title: '夏の施肥 — 控えめに管理',
    description: '猛暑期（7-8月）は根が弱りやすいため、施肥を控えるか薄めの液肥に切り替えます。梅雨明け直後の施肥は特に注意が必要です。',
    icon: Sun,
  },
  autumn: {
    title: '秋の施肥 — 冬越し準備',
    description: 'カリウム(K)を増やし耐寒性を高めます。9-10月はしっかり施肥して樹勢を蓄え、11月以降は徐々に控えましょう。紅葉樹は肥料を早めに切ると色づきが良くなります。',
    icon: TreeDeciduous,
  },
  winter: {
    title: '冬の施肥 — 休眠期は原則不要',
    description: '落葉樹は休眠中のため施肥不要です。常緑樹も控えめに。寒肥として2月下旬に有機肥料を置く場合もありますが、地域の気候に合わせてください。',
    icon: Droplets,
  },
}

export default async function FertilizerTopPage() {
  const [{ nutrients }, { treeSpecies }, { columns }] = await Promise.all([
    getNutrients(),
    getTreeSpecies(),
    getFertilizerColumns(),
  ])

  const primaryNutrients = nutrients.filter((n) => n.category === 'primary')
  const secondaryNutrients = nutrients.filter((n) => n.category === 'secondary')
  const season = getCurrentSeason()
  const tip = SEASONAL_TIPS[season]
  const SeasonIcon = tip.icon

  const navCards: { href: string; icon: typeof Beaker; label: string; description: string; count: number | undefined }[] = [
    {
      href: ROUTE_FERTILIZERS_NUTRIENTS,
      icon: Beaker,
      label: '栄養素辞典',
      description: `N・P・Kなど${nutrients.length}種の栄養素を解説`,
      count: nutrients.length,
    },
    {
      href: ROUTE_FERTILIZERS_CATEGORIES,
      icon: LayoutGrid,
      label: '肥料カテゴリ比較',
      description: '有機肥料・化成肥料・液肥などを比較',
      count: undefined,
    },
    {
      href: ROUTE_FERTILIZERS_SCHEDULES,
      icon: TreeDeciduous,
      label: '樹種別施肥スケジュール',
      description: `${treeSpecies.length}樹種の月別カレンダー`,
      count: treeSpecies.length,
    },
    {
      href: ROUTE_FERTILIZERS_COLUMNS,
      icon: BookOpen,
      label: 'コラム・読みもの',
      description: columns.length > 0 ? `${columns.length}件の記事` : '施肥テクニックや基礎知識',
      count: columns.length,
    },
    {
      href: ROUTE_FERTILIZERS_PRODUCTS,
      icon: Package,
      label: '定番肥料ガイド',
      description: '盆栽栽培でよく使われる肥料製品を紹介',
      count: undefined,
    },
    {
      href: ROUTE_FERTILIZERS_SOIL,
      icon: Layers,
      label: '用土と施肥の関係',
      description: '用土の種類と保肥力が施肥に与える影響',
      count: undefined,
    },
    {
      href: ROUTE_FERTILIZERS_WATERING,
      icon: CloudRain,
      label: '水やりと施肥',
      description: '灌水と施肥の適切な組み合わせ',
      count: undefined,
    },
  ]

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold">施肥ガイド</h1>
        
        {/* ヘッダー画像。light/dark variant は片方しか表示されないため preload は使わず
            loading="eager" + fetchPriority="high" で LCP のみを上げる。 */}
        <div className="relative w-full aspect-[21/9] rounded-lg overflow-hidden my-6">
          <Image
            src="/images/generated/fertilizers/header-fertilizer.webp"
            alt="施肥ガイド"
            fill
            className="object-cover object-center dark:hidden"
            sizes="(max-width: 768px) 100vw, 1200px"
            loading="eager"
            fetchPriority="high"
          />
          <Image
            src="/images/generated/fertilizers/header-fertilizer-dark.webp"
            alt="施肥ガイド"
            fill
            className="object-cover object-center hidden dark:block"
            sizes="(max-width: 768px) 100vw, 1200px"
            loading="eager"
            fetchPriority="high"
          />
        </div>

        <p className="text-sm text-muted-foreground mt-1">
          盆栽の健康を支える施肥の基礎知識・樹種別スケジュールを確認できます
        </p>
      </div>

      {/* 季節の施肥ポイント */}
      <section className="rounded-lg border bg-card overflow-hidden">
        {/* セクション挿絵 — アスペクト比 16:9 (aspect-video) を厳守 */}
        <div className="relative w-full aspect-video border-b">
          <Image
            src={`/images/generated/fertilizers/seasonal-${season}.webp`}
            alt={tip.title}
            fill
            className="object-cover object-center dark:hidden"
            sizes="(max-width: 768px) 100vw, 800px"
          />
          <Image
            src={`/images/generated/fertilizers/seasonal-${season}-dark.webp`}
            alt={tip.title}
            fill
            className="object-cover object-center hidden dark:block"
            sizes="(max-width: 768px) 100vw, 800px"
          />
        </div>
        <div className="flex items-start gap-4 p-5">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <SeasonIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold">{tip.title}</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {tip.description}
            </p>
          </div>
        </div>
      </section>

      {/* ナビゲーションカード */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {navCards.map(({ href, icon: Icon, label, description, count }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-3 rounded-lg border p-4 hover:border-primary/40 hover:bg-accent/50 transition-all"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Icon className="w-4.5 h-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{label}</span>
                  {count !== undefined && count > 0 && (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{count}</span>
                  )}
                  <ChevronRight className="h-4 w-4 ml-auto shrink-0 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <FertilizerDisclaimer />

      {/* 三大栄養素 */}
      <section className="space-y-4">
        {/* セクション挿絵 — アスペクト比 16:9 (aspect-video) を厳守 */}
        <div className="relative w-full aspect-video rounded-lg overflow-hidden my-4">
          <Image
            src="/images/generated/fertilizers/nutrient-npk.webp"
            alt="三大栄養素"
            fill
            className="object-cover object-center dark:hidden"
            sizes="(max-width: 768px) 100vw, 800px"
          />
          <Image
            src="/images/generated/fertilizers/nutrient-npk-dark.webp"
            alt="三大栄養素"
            fill
            className="object-cover object-center hidden dark:block"
            sizes="(max-width: 768px) 100vw, 800px"
          />
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">三大栄養素（N・P・K）</h2>
          <Link
            href={ROUTE_FERTILIZERS_NUTRIENTS}
            className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
          >
            すべて見る <ChevronRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          植物の成長に最も重要な3つの栄養素です。肥料パッケージの「N-P-K」表記はこの3要素の含有比率を表します。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {primaryNutrients.map((nutrient) => (
            <NutrientCard key={nutrient.id} nutrient={nutrient} />
          ))}
        </div>
      </section>

      {/* 二次要素 */}
      {secondaryNutrients.length > 0 && (
        <section className="space-y-4">
          {/* セクション挿絵 — アスペクト比 16:9 (aspect-video) を厳守 */}
          <div className="relative w-full aspect-video rounded-lg overflow-hidden my-4">
            <Image
              src="/images/generated/fertilizers/nutrient-secondary.webp"
              alt="二次要素"
              fill
              className="object-cover object-center dark:hidden"
              sizes="(max-width: 768px) 100vw, 800px"
            />
            <Image
              src="/images/generated/fertilizers/nutrient-secondary-dark.webp"
              alt="二次要素"
              fill
              className="object-cover object-center hidden dark:block"
              sizes="(max-width: 768px) 100vw, 800px"
            />
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">二次要素（Ca・Mg・S）</h2>
            <Link
              href="/fertilizers/nutrients"
              className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
            >
              すべて見る <ChevronRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            三大栄養素に次いで重要な要素です。不足すると葉の黄変や生育不良の原因になります。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {secondaryNutrients.map((nutrient) => (
              <NutrientCard key={nutrient.id} nutrient={nutrient} />
            ))}
          </div>
        </section>
      )}

      <aside aria-label="広告">
        <PostDetailAdUnit />
      </aside>
    </div>
  )
}
