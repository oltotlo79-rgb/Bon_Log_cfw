import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  getFormulationTypes,
  getFormulationTypeByCode,
  getPesticides,
} from '@/lib/actions/pesticide'
import { PesticideDisclaimer } from '@/components/pesticide/PesticideDisclaimer'
import type { PesticideType } from '@prisma/client'
import { ROUTE_PESTICIDES_FORMULATIONS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

const TYPE_LABELS: Record<PesticideType, string> = {
  fungicide: '殺菌剤',
  insecticide: '殺虫剤',
  acaricide: '殺ダニ剤',
  compound: '複合剤',
  other: 'その他',
}

type Props = {
  searchParams: Promise<{ formulation?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  // クエリパラメータでフィルタするビューは、検索エンジンへの重複コンテンツ回避のため
  // 親ページにキャノニカルを集約する。
  const canonical = pageCanonical(ROUTE_PESTICIDES_FORMULATIONS)
  const params = await searchParams
  if (params.formulation) {
    const formulation = await getFormulationTypeByCode(params.formulation)
    if (formulation) {
      return {
        title: `${formulation.name}の薬剤一覧 - 剤型 - 農薬・病害虫`,
        alternates: { canonical },
      }
    }
  }
  return {
    title: '剤型の違い - 農薬・病害虫',
    description: '農薬の剤型（乳剤・水和剤・粒剤など）の特徴と使い分けを確認できます。',
    alternates: { canonical },
  }
}

export default async function FormulationsPage({ searchParams }: Props) {
  const params = await searchParams
  const formulationCode = params.formulation ?? null

  const [{ formulations }, formulationDetail, { pesticides }] = await Promise.all([
    getFormulationTypes(),
    formulationCode ? getFormulationTypeByCode(formulationCode) : Promise.resolve(null),
    formulationCode
      ? getPesticides({ formulationTypeCode: formulationCode })
      : Promise.resolve({ pesticides: [] as Awaited<ReturnType<typeof getPesticides>>['pesticides'] }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">
            {formulationDetail ? `${formulationDetail.name}の薬剤一覧` : '剤型の違い'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formulationDetail
              ? `${pesticides.length}件の薬剤`
              : '農薬の剤型ごとの特徴と使い方'}
          </p>
        </div>
        <Link
          href="/pesticides"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0 whitespace-nowrap"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 農薬・病害虫トップ
        </Link>
      </div>

      <PesticideDisclaimer />

      {formulationDetail ? (
        <>
          <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{formulationDetail.name}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {formulationDetail.code}
              </span>
            </div>
            {formulationDetail.description && (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                {formulationDetail.description}
              </p>
            )}
          </div>

          <Link
            href="/pesticides/formulations"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground shrink-0 whitespace-nowrap"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 剤型一覧に戻る
          </Link>

          {pesticides.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              この剤型の薬剤はまだ登録されていません
            </p>
          ) : (
            <div className="space-y-2">
              {pesticides.map((p: { id: string; slug: string; name: string; pesticideType: PesticideType; registrationNumber: string | null }) => (
                <Link
                  key={p.id}
                  href={`/pesticides/products/${p.slug}`}
                  className="flex items-center gap-3 rounded-lg border border-border/40 p-3 hover:border-primary/40 hover:bg-muted/20 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium break-words block">{p.name}</span>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                        {TYPE_LABELS[p.pesticideType]}
                      </span>
                      {p.registrationNumber && <span>No.{p.registrationNumber}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground flex-shrink-0" aria-hidden />
                </Link>
              ))}
            </div>
          )}
        </>
      ) : formulations.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">剤型データはまだ登録されていません</p>
      ) : (
        <div className="space-y-3">
          {formulations.map((f: { id: string; code: string; name: string; description: string | null; _count: { pesticides: number } }) => {
            const hasPesticides = f._count.pesticides > 0
            return hasPesticides ? (
              <Link
                key={f.id}
                href={`/pesticides/formulations?formulation=${encodeURIComponent(f.code)}`}
                className="block rounded-lg border border-border/40 p-4 transition-all hover:border-primary/40 hover:bg-muted/20"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold break-words">{f.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {f.code}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">{f._count.pesticides}製品 →</span>
                </div>
                {f.description && (
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-2">
                    {f.description}
                  </p>
                )}
              </Link>
            ) : (
              <div
                key={f.id}
                className="rounded-lg border border-border/40 p-4 opacity-60"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold break-words">{f.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {f.code}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">0製品</span>
                </div>
                {f.description && (
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-2">
                    {f.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
