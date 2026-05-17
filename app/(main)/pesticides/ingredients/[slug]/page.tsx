import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getActiveIngredientBySlug } from '@/lib/actions/pesticide'
import { prisma } from '@/lib/db'
import { loadStaticParams } from '@/lib/build/static-params'
import { getResistanceRiskLabel } from '@/lib/utils/pesticide'
import { PesticideDisclaimer } from '@/components/pesticide/PesticideDisclaimer'
import { ROUTE_PESTICIDES_INGREDIENTS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const ing = await getActiveIngredientBySlug(slug)
  if (!ing) return { title: '原体が見つかりません - BON-LOG' }
  return {
    title: `${ing.name} - 原体詳細 - BON-LOG`,
    alternates: { canonical: pageCanonical(`${ROUTE_PESTICIDES_INGREDIENTS}/${slug}`) },
  }
}

export async function generateStaticParams() {
  return loadStaticParams(async () => {
    const items = await prisma.activeIngredient.findMany({ select: { slug: true } })
    return items.map((i) => ({ slug: i.slug }))
  }, '/pesticides/ingredients')
}

export default async function IngredientDetailPage({ params }: Props) {
  const { slug } = await params
  const ing = await getActiveIngredientBySlug(slug)

  if (!ing) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <Link href="/pesticides/ingredients" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
      <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 原体一覧
    </Link>

      <div>
        <h1 className="text-2xl font-bold">{ing.name}</h1>
        {ing.nameEn && <p className="text-sm text-muted-foreground mt-1">{ing.nameEn}</p>}
      </div>

      <PesticideDisclaimer />

      <section className="rounded-lg border border-border/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold">基本情報</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {ing.fracCode && (
            <>
              <dt className="text-muted-foreground">FRACコード</dt>
              <dd>
                <span className="rounded bg-muted text-muted-foreground px-2 py-0.5 text-xs">
                  {ing.fracCode}
                </span>
              </dd>
            </>
          )}
          {ing.iracCode && (
            <>
              <dt className="text-muted-foreground">IRACコード</dt>
              <dd>
                <span className="rounded bg-muted text-muted-foreground px-2 py-0.5 text-xs">
                  {ing.iracCode}
                </span>
              </dd>
            </>
          )}
          {ing.ingredientGroup && (
            <>
              <dt className="text-muted-foreground">原体グループ</dt>
              <dd>{ing.ingredientGroup}</dd>
            </>
          )}
          {ing.resistanceRisk != null && (
            <>
              <dt className="text-muted-foreground">耐性がつきやすいか</dt>
              <dd>
                <span className="rounded bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                  {getResistanceRiskLabel(ing.resistanceRisk)}
                </span>
              </dd>
            </>
          )}
        </dl>
      </section>

      {ing.description && (
        <section className="rounded-lg border border-border/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold">原体の詳細説明</h2>
          <p className="text-xs text-muted-foreground">
            以下の説明は、FRAC・IRAC等の公的分類および登録情報に基づく事実のみを記載しています。実際の使用は各製品のラベルに従ってください。
          </p>
          <div className="text-sm text-foreground/90 space-y-3 prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-p:my-2">
            {ing.description.split(/\n\n+/).map((paragraph: string, i: number) => (
              <p key={i} className="whitespace-pre-wrap">
                {paragraph.trim()}
              </p>
            ))}
          </div>
        </section>
      )}

      {ing.pesticides.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">この原体を含む薬剤 ({ing.pesticides.length}件)</h2>
          <div className="space-y-2">
            {ing.pesticides.map(({ pesticide: p, contentLabel }: { pesticide: { id: string; slug: string; name: string; formulationType: { name: string } | null }; contentLabel: string | null }) => (
              <Link
                key={p.id}
                href={`/pesticides/products/${p.slug}`}
                className="flex items-center justify-between rounded-lg border border-border/40 p-3 hover:border-primary/40 hover:bg-muted/20 transition-all"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium">{p.name}</span>
                  {contentLabel && <span className="text-xs text-muted-foreground ml-2">{contentLabel}</span>}
                  {p.formulationType && (
                    <span className="text-xs text-muted-foreground ml-2">{p.formulationType.name}</span>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground ml-2" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
