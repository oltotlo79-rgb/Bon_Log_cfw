/**
 * @file 農薬関連データ表示セクション（Server Component）
 * @description 有効成分・効果（対象病害虫）・混用不可 を表形式で表示する読み取り専用ビュー。
 *              Server Component として出力する SEO 上のメリットと、初期表示の高速化が目的。
 */

import Link from 'next/link'
import { Atom, Bug, Ban } from 'lucide-react'

const EFFECT_RATING_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export interface PesticideIngredient {
  activeIngredient: {
    name: string
    fracCode?: string | null
    iracCode?: string | null
  }
  contentLabel?: string | null
}

export interface PesticideEffect {
  id: string
  diseasePest: { name: string; category: string }
  preventionLevel?: string | null
  treatmentLevel?: string | null
  efficacyLevel?: string | null
  note?: string | null
}

export interface PesticideIncompatible {
  incompatibleWith: { id: string; name: string }
}

export interface PesticideRelationsProps {
  ingredients: PesticideIngredient[]
  effects: PesticideEffect[]
  incompatibles: PesticideIncompatible[]
}

function formatEffectLevel(level?: string | null): string {
  if (!level) return '-'
  return EFFECT_RATING_LABELS[level] ?? level
}

export function PesticideRelations({
  ingredients,
  effects,
  incompatibles,
}: PesticideRelationsProps) {
  return (
    <>
      {/* 有効成分 */}
      <section className="bg-card rounded-lg border p-6" aria-labelledby="pesticide-ingredients-heading">
        <h2
          id="pesticide-ingredients-heading"
          className="text-lg font-semibold mb-4 flex items-center gap-2"
        >
          <Atom className="w-5 h-5" />
          有効成分（{ingredients.length}件）
        </h2>
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground">有効成分は登録されていません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th scope="col" className="text-left py-2 px-3 font-medium text-muted-foreground">
                    成分名
                  </th>
                  <th scope="col" className="text-left py-2 px-3 font-medium text-muted-foreground">
                    含有量
                  </th>
                  <th scope="col" className="text-left py-2 px-3 font-medium text-muted-foreground">
                    FRACコード
                  </th>
                  <th scope="col" className="text-left py-2 px-3 font-medium text-muted-foreground">
                    IRACコード
                  </th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ing, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-2 px-3 font-medium">{ing.activeIngredient.name}</td>
                    <td className="py-2 px-3 text-muted-foreground">{ing.contentLabel || '-'}</td>
                    <td className="py-2 px-3 font-mono text-xs">
                      {ing.activeIngredient.fracCode || '-'}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">
                      {ing.activeIngredient.iracCode || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 効果（対象病害虫） */}
      <section className="bg-card rounded-lg border p-6" aria-labelledby="pesticide-effects-heading">
        <h2
          id="pesticide-effects-heading"
          className="text-lg font-semibold mb-4 flex items-center gap-2"
        >
          <Bug className="w-5 h-5" />
          効果・対象病害虫（{effects.length}件）
        </h2>
        {effects.length === 0 ? (
          <p className="text-sm text-muted-foreground">効果データは登録されていません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th scope="col" className="text-left py-2 px-3 font-medium text-muted-foreground">
                    病害虫名
                  </th>
                  <th scope="col" className="text-left py-2 px-3 font-medium text-muted-foreground">
                    区分
                  </th>
                  <th scope="col" className="text-center py-2 px-3 font-medium text-muted-foreground">
                    予防
                  </th>
                  <th scope="col" className="text-center py-2 px-3 font-medium text-muted-foreground">
                    治療
                  </th>
                  <th scope="col" className="text-center py-2 px-3 font-medium text-muted-foreground">
                    効力
                  </th>
                  <th scope="col" className="text-left py-2 px-3 font-medium text-muted-foreground">
                    備考
                  </th>
                </tr>
              </thead>
              <tbody>
                {effects.map((eff) => (
                  <tr key={eff.id} className="border-b last:border-0">
                    <td className="py-2 px-3 font-medium">{eff.diseasePest.name}</td>
                    <td className="py-2 px-3 text-muted-foreground">{eff.diseasePest.category}</td>
                    <td className="py-2 px-3 text-center">{formatEffectLevel(eff.preventionLevel)}</td>
                    <td className="py-2 px-3 text-center">{formatEffectLevel(eff.treatmentLevel)}</td>
                    <td className="py-2 px-3 text-center">{formatEffectLevel(eff.efficacyLevel)}</td>
                    <td className="py-2 px-3 text-muted-foreground text-xs">{eff.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 混用不可 */}
      <section className="bg-card rounded-lg border p-6" aria-labelledby="pesticide-incompatibles-heading">
        <h2
          id="pesticide-incompatibles-heading"
          className="text-lg font-semibold mb-4 flex items-center gap-2"
        >
          <Ban className="w-5 h-5" />
          混用不可（{incompatibles.length}件）
        </h2>
        {incompatibles.length === 0 ? (
          <p className="text-sm text-muted-foreground">混用不可データは登録されていません</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {incompatibles.map((inc) => (
              <Link
                key={inc.incompatibleWith.id}
                href={`/admin/pesticide-data/${inc.incompatibleWith.id}`}
                className="inline-flex items-center px-3 py-1.5 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-full text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <Ban className="w-3.5 h-3.5 mr-1.5" aria-hidden />
                {inc.incompatibleWith.name}
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
