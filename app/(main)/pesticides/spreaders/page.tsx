import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getSpreaderTypes, getSpreaderTypeBySlug } from '@/lib/actions/pesticide'
import { PesticideDisclaimer } from '@/components/pesticide/PesticideDisclaimer'
import { ROUTE_PESTICIDES_SPREADERS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const dynamic = 'force-dynamic' // (main) レイアウト/PremiumProvider が auth() を呼ぶため静的生成不可。SSR で配信しデータは unstable_cache でキャッシュ。

type Props = {
  searchParams: Promise<{ type?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  // クエリで絞り込んだビューも親ページに canonical を集約する。
  const canonical = pageCanonical(ROUTE_PESTICIDES_SPREADERS)
  const params = await searchParams
  if (params.type) {
    const typeItem = await getSpreaderTypeBySlug(params.type)
    if (typeItem) {
      return {
        title: `${typeItem.name}の展着剤 - 農薬・病害虫`,
        description: '展着剤の種類（一般展着剤・固着剤・浸透性展着剤など）と選び方を確認できます。',
        alternates: { canonical },
      }
    }
  }
  return {
    title: '展着剤一覧 - 農薬・病害虫',
    description: '展着剤の種類（一般展着剤・固着剤・浸透性展着剤など）と選び方を確認できます。',
    alternates: { canonical },
  }
}

export default async function SpreadersPage({ searchParams }: Props) {
  const params = await searchParams
  const typeSlug = params.type ?? null

  const [{ spreaders }, selectedType] = await Promise.all([
    getSpreaderTypes(),
    typeSlug ? getSpreaderTypeBySlug(typeSlug) : Promise.resolve(null),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">
            {selectedType ? `${selectedType.name}の展着剤一覧` : '展着剤'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedType ? '該当する展着剤の詳細を見る' : '型を選ぶと該当する展着剤一覧が表示されます'}
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

      {selectedType ? (
        <>
          <Link
            href="/pesticides/spreaders"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground shrink-0 whitespace-nowrap"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 型一覧に戻る
          </Link>
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
              <h2 className="text-sm font-semibold">{selectedType.name}の特徴</h2>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{selectedType.description}</p>
            </div>
            
            <h3 className="text-sm font-semibold mt-4">該当する製品</h3>
            {selectedType.pesticides?.length === 0 ? (
              <p className="text-sm text-muted-foreground">この型の製品はまだ登録されていません</p>
            ) : (
              <div className="grid gap-3">
                {selectedType.pesticides?.map(({ pesticide: p }: { pesticide: { id: string; slug: string; name: string; description: string | null } }) => (
                  <Link
                    key={p.id}
                    href={`/pesticides/products/${p.slug}`}
                    className="flex items-center gap-3 rounded-lg border border-border/40 p-4 hover:border-primary/40 hover:bg-muted/20 transition-all min-h-[3rem]"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold break-words block">{p.name}</span>
                      {p.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-words">{p.description}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground flex-shrink-0" aria-hidden />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      ) : spreaders.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">展着剤データはまだ登録されていません</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">型をクリックすると該当する展着剤一覧が表示されます。</p>
          <div className="space-y-3">
            {spreaders.map((s: { id: string; slug: string; name: string; description: string | null }) => (
              <Link
                key={s.id}
                href={`/pesticides/spreaders?type=${encodeURIComponent(s.slug)}`}
                className="flex items-center gap-3 rounded-lg border border-border/40 p-4 hover:border-primary/40 hover:bg-muted/20 transition-all min-h-[3rem]"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold break-words block">{s.name}</span>
                  {s.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-words">{s.description}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground flex-shrink-0" aria-hidden />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
