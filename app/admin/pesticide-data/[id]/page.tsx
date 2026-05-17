/**
 * @file 農薬詳細・編集ページ（Server Component）
 * @description 農薬詳細データを Server Side で取得し、編集フォーム（Client Component）と
 *              関連データ／履歴タイムライン（Server Component）に分離してレンダリングする。
 * @route /admin/pesticide-data/[id]
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FlaskConical } from 'lucide-react'
import type { PesticideType } from '@prisma/client'
import { getAdminPesticideDetail } from '@/lib/actions/admin/pesticide-data'
import { PesticideEditForm } from './PesticideEditForm'
import {
  PesticideRelations,
  type PesticideEffect,
  type PesticideIncompatible,
  type PesticideIngredient,
} from './PesticideRelations'
import {
  PesticideHistoryTimeline,
  type PesticideHistoryEntry,
} from './PesticideHistoryTimeline'

export const dynamic = 'force-dynamic'

const PESTICIDE_TYPE_LABELS: Record<PesticideType, string> = {
  insecticide: '殺虫剤',
  fungicide: '殺菌剤',
  acaricide: '殺ダニ剤',
  compound: '複合剤',
  other: 'その他',
}

const PESTICIDE_TYPE_COLORS: Record<PesticideType, string> = {
  fungicide: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  insecticide: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  acaricide: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  compound: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const result = await getAdminPesticideDetail(id)
  const name =
    result && 'pesticide' in result && result.pesticide ? result.pesticide.name : '詳細'
  return {
    title: `${name} - 農薬データ管理 | BON-LOG 管理`,
    // 管理画面は検索エンジンに公開しない
    robots: { index: false, follow: false },
  }
}

export default async function PesticideDetailPage({ params }: PageProps) {
  const { id } = await params
  const result = await getAdminPesticideDetail(id)

  if (!result || 'error' in result) {
    // 管理者権限がない／農薬が存在しないケースを notFound に寄せる。
    // middleware 側で既に /admin/* の認可は行われているので、ここでは
    // データ欠落を UX 上のエラーとして表現する。
    notFound()
  }

  const { pesticide, history } = result

  const ingredients: PesticideIngredient[] = pesticide.ingredients.map((ing) => ({
    activeIngredient: {
      name: ing.activeIngredient.name,
      fracCode: ing.activeIngredient.fracCode,
      iracCode: ing.activeIngredient.iracCode,
    },
    contentLabel: ing.contentLabel,
  }))

  const effects: PesticideEffect[] = pesticide.effects.map((eff) => ({
    id: eff.id,
    diseasePest: { name: eff.diseasePest.name, category: eff.diseasePest.category },
    preventionLevel: eff.preventionLevel,
    treatmentLevel: eff.treatmentLevel,
    efficacyLevel: eff.efficacyLevel,
    note: eff.note,
  }))

  const incompatibles: PesticideIncompatible[] = pesticide.incompatibleWith.map((inc) => ({
    incompatibleWith: { id: inc.incompatibleWith.id, name: inc.incompatibleWith.name },
  }))

  const historyEntries: PesticideHistoryEntry[] = history.map((entry) => ({
    id: entry.id,
    action: entry.action,
    performedBy: entry.performedBy,
    createdAt: entry.createdAt,
    changes: entry.changes,
  }))

  const typeLabel = PESTICIDE_TYPE_LABELS[pesticide.pesticideType]
  const typeBadgeColor = PESTICIDE_TYPE_COLORS[pesticide.pesticideType]

  return (
    <div className="space-y-6">
      <Link
        href="/admin/pesticide-data"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        農薬一覧に戻る
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="w-7 h-7" aria-hidden />
            {pesticide.name}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            {pesticide.registrationNumber && (
              <span className="text-sm text-muted-foreground font-mono">
                登録番号: {pesticide.registrationNumber}
              </span>
            )}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeColor}`}
            >
              {typeLabel}
            </span>
          </div>
        </div>
      </div>

      <PesticideEditForm
        id={pesticide.id}
        initial={{
          name: pesticide.name,
          registrationNumber: pesticide.registrationNumber,
          pesticideType: pesticide.pesticideType,
          description: pesticide.description,
          formulationTypeName: pesticide.formulationType?.name ?? null,
        }}
      />

      <PesticideRelations
        ingredients={ingredients}
        effects={effects}
        incompatibles={incompatibles}
      />

      <PesticideHistoryTimeline history={historyEntries} />
    </div>
  )
}
