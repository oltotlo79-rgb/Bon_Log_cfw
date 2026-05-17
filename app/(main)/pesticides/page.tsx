import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, Bug, Beaker, FlaskConical, Droplets, BookOpen, SprayCan, FlaskRound, Calculator } from 'lucide-react'
import { getDiseasePests, getPesticides, getSpreaderProducts } from '@/lib/actions/pesticide'
import { normalizePesticideType } from '@/lib/utils/pesticide'
import type { PesticideType } from '@prisma/client'
import { PesticideDisclaimer } from '@/components/pesticide/PesticideDisclaimer'
import { PostDetailAdUnit } from '@/components/ads'
import { PesticideSearchForm } from './PesticideSearchForm'
import { DiseasePestGrid } from './DiseasePestGrid'
import { PesticideAllList } from './PesticideAllList'
import { PesticideResults } from './PesticideResults'
import { SpreaderResults } from './SpreaderResults'
import {
  ROUTE_PESTICIDES,
  ROUTE_PESTICIDES_COLUMNS,
  ROUTE_PESTICIDES_DILUTION,
  ROUTE_PESTICIDES_DISEASES_PESTS,
  ROUTE_PESTICIDES_FORMULATIONS,
  ROUTE_PESTICIDES_INGREDIENTS,
  ROUTE_PESTICIDES_MIXING,
  ROUTE_PESTICIDES_SPRAY_GUIDE,
  ROUTE_PESTICIDES_SPREADERS,
} from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '農薬・病害虫 - BON-LOG',
  description: '病害虫から効く薬剤を検索。農薬の成分・FRAC/IRACコード・剤型情報を確認できます。',
  alternates: { canonical: pageCanonical(ROUTE_PESTICIDES) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

type Props = {
  searchParams: Promise<{
    diseasePest?: string
    search?: string
    type?: string
    category?: string
  }>
}

export default async function PesticideTopPage({ searchParams }: Props) {
  const params = await searchParams
  const selectedDiseasePestId = params.diseasePest
  const searchQuery = params.search
  const categoryParam = params.category === 'pest' || params.category === 'disease' || params.category === 'beneficial_insect' ? params.category : undefined
  const rawType = params.type
  const isSpreaderView = rawType === 'spreader'
  const pesticideType = normalizePesticideType(rawType)

  const [diseasePestsRes, pesticideResult, spreaderResult, allProductsRes] = await Promise.all([
    getDiseasePests(),
    !isSpreaderView && (selectedDiseasePestId || searchQuery || pesticideType)
      ? getPesticides({ diseasePestId: selectedDiseasePestId, search: searchQuery, type: pesticideType })
      : Promise.resolve({ pesticides: [] }),
    isSpreaderView ? getSpreaderProducts() : Promise.resolve({ pesticides: [] }),
    !selectedDiseasePestId && !searchQuery && !pesticideType && !isSpreaderView && !categoryParam
      ? Promise.all([getPesticides({}), getSpreaderProducts()])
      : Promise.resolve([null, null] as const),
  ])

  const { diseasePests } = diseasePestsRes
  const spreaderIds = new Set<string>(
    allProductsRes[1]?.pesticides?.map((p: { id: string }) => p.id) ?? []
  )
  const allProducts =
    allProductsRes[0]?.pesticides?.map((p: { id: string; name: string; slug: string; pesticideType: PesticideType }) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      pesticideType: p.pesticideType,
    })) ?? []

  const showResults = !!(selectedDiseasePestId || searchQuery || pesticideType || isSpreaderView)

  // 統計情報
  const diseaseCount = diseasePests.filter((dp: { category: string }) => dp.category === 'disease').length
  const pestCount = diseasePests.filter((dp: { category: string }) => dp.category === 'pest').length
  const beneficialCount = diseasePests.filter((dp: { category: string }) => dp.category === 'beneficial_insect').length

  const navCards = [
    {
      href: ROUTE_PESTICIDES_DISEASES_PESTS,
      icon: Bug,
      label: '病害虫・益虫図鑑',
      description: `病害${diseaseCount}件・害虫${pestCount}件・益虫${beneficialCount}件`,
    },
    {
      href: ROUTE_PESTICIDES_INGREDIENTS,
      icon: Beaker,
      label: '有効成分（原体）一覧',
      description: 'FRAC/IRACコード・耐性リスクを確認',
    },
    {
      href: ROUTE_PESTICIDES_FORMULATIONS,
      icon: FlaskConical,
      label: '剤型の違い',
      description: '水和剤・乳剤・粒剤など剤型ごとの特徴を比較',
    },
    {
      href: ROUTE_PESTICIDES_SPREADERS,
      icon: Droplets,
      label: '展着剤',
      description: '薬液の付着・浸透を助ける展着剤の分類と製品',
    },
    {
      href: ROUTE_PESTICIDES_COLUMNS,
      icon: BookOpen,
      label: 'コラム・読みもの',
      description: '混用順序・希釈方法・耐性管理など実践知識',
    },
    {
      href: ROUTE_PESTICIDES_SPRAY_GUIDE,
      icon: SprayCan,
      label: '散布方法ガイド',
      description: '希釈・散布の実践ガイド',
    },
    {
      href: ROUTE_PESTICIDES_MIXING,
      icon: FlaskRound,
      label: '混用チェッカー',
      description: '農薬の混用可否を確認',
    },
    {
      href: ROUTE_PESTICIDES_DILUTION,
      icon: Calculator,
      label: '希釈計算ツール',
      description: '希釈倍率から薬剤量を計算',
    },
  ]

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold">農薬・病害虫</h1>
        
        {/* ヘッダー画像。light/dark variant は片方しか表示されないため preload は使わず
            loading="eager" + fetchPriority="high" で LCP のみを上げる。 */}
        <div className="relative w-full aspect-[21/9] rounded-lg overflow-hidden my-6">
          <Image
            src="/images/generated/pesticides/header-pesticide.webp"
            alt="農薬・病害虫"
            fill
            className="object-cover object-center dark:hidden"
            sizes="(max-width: 768px) 100vw, 1200px"
            loading="eager"
            fetchPriority="high"
          />
          <Image
            src="/images/generated/pesticides/header-pesticide-dark.webp"
            alt="農薬・病害虫"
            fill
            className="object-cover object-center hidden dark:block"
            sizes="(max-width: 768px) 100vw, 1200px"
            loading="eager"
            fetchPriority="high"
          />
        </div>

        <p className="text-sm text-muted-foreground mt-1">
          病害虫を選んで効く薬剤を検索、または薬剤名で直接検索できます
        </p>
      </div>

      {/* ナビゲーションカード */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {navCards.map(({ href, icon: Icon, label, description }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-3 rounded-lg border p-4 hover:border-primary/40 hover:bg-accent/50 transition-all"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Icon className="w-4.5 h-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-sm">{label}</span>
                  <ChevronRight className="h-4 w-4 ml-auto shrink-0 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <PesticideDisclaimer />

      {/* 検索フォーム */}
      <PesticideSearchForm
        defaultSearch={searchQuery}
        defaultType={isSpreaderView ? 'spreader' : pesticideType}
        defaultCategory={categoryParam}
      />

      {/* 結果表示 */}
      <div className="grid grid-cols-1 gap-6">
        {!showResults && !categoryParam && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">一覧（あいうえお順）</h2>
            <PesticideAllList
              diseasePests={diseasePests}
              products={allProducts}
              spreaderIds={spreaderIds}
              selectedDiseasePestId={selectedDiseasePestId}
            />
          </div>
        )}
        {!showResults && categoryParam && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">病害虫から探す</h2>
            <DiseasePestGrid
              diseasePests={diseasePests}
              selectedId={selectedDiseasePestId}
              filterByCategory={categoryParam}
            />
          </div>
        )}
        {showResults && isSpreaderView && (
          <SpreaderResults pesticides={spreaderResult.pesticides} />
        )}
        {showResults && !isSpreaderView && (
          <PesticideResults
            pesticides={pesticideResult.pesticides}
            selectedDiseasePestId={selectedDiseasePestId}
            diseasePests={diseasePests}
          />
        )}
      </div>

      <aside aria-label="広告">
        <PostDetailAdUnit />
      </aside>
    </div>
  )
}
