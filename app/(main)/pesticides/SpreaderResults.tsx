'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

type SpreaderProductItem = {
  id: string
  name: string
  slug: string
  registrationNumber: string | null
  formulationType: { name: string } | null
  spreaderTypes?: Array<{ spreaderType: { name: string; slug: string } }>
}

type Props = {
  pesticides: SpreaderProductItem[]
}

export function SpreaderResults({ pesticides }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">展着剤一覧</h2>
        <span className="text-sm text-muted-foreground">{pesticides.length}件</span>
      </div>

      {pesticides.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          展着剤データはまだ登録されていません
        </p>
      ) : (
        <div className="space-y-3">
          {pesticides.map((p) => {
            // TypeScript の narrowing が `(p.spreaderTypes?.length ?? 0) > 0` を
            // 配列の存在判定として認識しないため、ローカル const に取り出す。
            const spreaderTypes = p.spreaderTypes ?? []
            return (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border/40 p-4 hover:border-primary/40 hover:bg-muted/20 transition-all"
            >
              <div className="min-w-0">
                <Link
                  href={`/pesticides/products/${p.slug}`}
                  className="text-sm font-semibold hover:text-primary hover:underline"
                >
                  {p.name}
                </Link>
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                  {p.formulationType && <span>{p.formulationType.name}</span>}
                  {p.registrationNumber && <span>No.{p.registrationNumber}</span>}
                  {spreaderTypes.length > 0 && (
                    <span className="text-primary">
                      分類: {spreaderTypes.map(({ spreaderType }, i) => (
                        <span key={spreaderType.slug}>
                          {i > 0 && '、'}
                          <Link
                            href={`/pesticides/spreaders?type=${encodeURIComponent(spreaderType.slug)}`}
                            className="hover:underline"
                          >
                            {spreaderType.name}
                          </Link>
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
              <Link
                href={`/pesticides/products/${p.slug}`}
                className="h-4 w-4 shrink-0 text-muted-foreground hover:text-primary flex items-center justify-center"
                aria-label={`${p.name}の詳細`}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
