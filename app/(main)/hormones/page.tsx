import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, BookOpen, Zap, Wrench, Network, Calendar, SlidersHorizontal } from 'lucide-react'
import { getHormones, getHormoneColumns } from '@/lib/actions/hormone'
import { HormoneDisclaimer } from '@/components/hormone/HormoneDisclaimer'
import { HormoneCard } from '@/components/hormone/HormoneCard'
import {
  ROUTE_HORMONES,
  ROUTE_HORMONE_CALENDAR,
  ROUTE_HORMONE_COLUMNS,
  ROUTE_HORMONE_DIAGRAM,
  ROUTE_HORMONE_INTERACTIONS,
  ROUTE_HORMONE_SIMULATOR,
  ROUTE_HORMONE_TECHNIQUES,
} from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '植物ホルモン - BON-LOG',
  description: '盆栽に関わる植物ホルモンの種類・役割・相互作用を解説します。',
  alternates: { canonical: pageCanonical(ROUTE_HORMONES) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

export default async function HormoneTopPage() {
  const [{ hormones }, { columns }] = await Promise.all([
    getHormones(),
    getHormoneColumns(),
  ])

  const majorHormones = hormones.filter((h) => h.category === 'major')
  const secondaryHormones = hormones.filter((h) => h.category === 'secondary')

  const navCards = [
    {
      href: ROUTE_HORMONE_TECHNIQUES,
      icon: Wrench,
      label: '技法とホルモン',
      description: '盆栽技法がホルモンに与える影響',
    },
    {
      href: ROUTE_HORMONE_INTERACTIONS,
      icon: Zap,
      label: 'ホルモン相互作用',
      description: 'ホルモン間の相乗・拮抗・調節関係を一覧',
    },
    {
      href: ROUTE_HORMONE_DIAGRAM,
      icon: Network,
      label: '相互作用ダイアグラム',
      description: 'ホルモン間の関係をネットワーク図で可視化',
    },
    {
      href: ROUTE_HORMONE_CALENDAR,
      icon: Calendar,
      label: '年間活性カレンダー',
      description: '五大ホルモンの月別活性を一覧表示',
    },
    {
      href: ROUTE_HORMONE_SIMULATOR,
      icon: SlidersHorizontal,
      label: 'バランスシミュレーター',
      description: '月と技法を選んでホルモン変動を予測',
    },
    {
      href: ROUTE_HORMONE_COLUMNS,
      icon: BookOpen,
      label: 'コラム・読みもの',
      description: columns.length > 0 ? `${columns.length}件の記事` : '植物ホルモンの基礎知識',
      count: columns.length,
    },
  ]

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold">植物ホルモン</h1>
        
        {/* ヘッダー画像。light/dark variant は片方しか表示されないため preload は使わず
            loading="eager" + fetchPriority="high" で LCP のみを上げる。 */}
        <div className="relative w-full aspect-[21/9] rounded-lg overflow-hidden my-6">
          <Image
            src="/images/generated/hormones/header-hormone.webp"
            alt="植物ホルモン"
            fill
            className="object-cover object-center dark:hidden"
            sizes="(max-width: 768px) 100vw, 1200px"
            loading="eager"
            fetchPriority="high"
          />
          <Image
            src="/images/generated/hormones/header-hormone-dark.webp"
            alt="植物ホルモン"
            fill
            className="object-cover object-center hidden dark:block"
            sizes="(max-width: 768px) 100vw, 1200px"
            loading="eager"
            fetchPriority="high"
          />
        </div>

        <p className="text-sm text-muted-foreground mt-1">
          盆栽の成長・休眠・発根に関わる植物ホルモンの役割と相互作用を学べます
        </p>
      </div>

      {/* ナビゲーションカード */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

      <HormoneDisclaimer />

      {/* 五大ホルモン */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">五大ホルモン</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          植物の成長・分化・休眠を制御する主要な5つのホルモンです。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {majorHormones.map((hormone) => (
            <HormoneCard key={hormone.id} hormone={hormone} />
          ))}
        </div>
      </section>

      {/* 二次ホルモン */}
      {secondaryHormones.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">二次ホルモン</h2>
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            近年注目されているホルモンで、ストレス応答や成長調節に関与します。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {secondaryHormones.map((hormone) => (
              <HormoneCard key={hormone.id} hormone={hormone} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
