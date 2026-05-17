import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DilutionCalculator } from '@/components/pesticide/DilutionCalculator'
import { PesticideDisclaimer } from '@/components/pesticide/PesticideDisclaimer'
import { ROUTE_PESTICIDES_DILUTION } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '希釈計算ツール | 農薬・病害虫',
  description: '希釈倍率から必要な薬剤量を計算。水量と倍率を入力するだけで簡単に算出できます。',
  alternates: { canonical: pageCanonical(ROUTE_PESTICIDES_DILUTION) },
}

export default function DilutionCalculatorPage() {
  return (
    <div className="space-y-6">
      {/* 戻るリンク */}
      <Link
        href="/pesticides"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        農薬・病害虫トップへ
      </Link>

      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold">希釈計算ツール</h1>
        <p className="text-sm text-muted-foreground mt-1">
          希釈倍率から薬剤量を計算、または薬剤量から必要な水量を逆算できます
        </p>
      </div>

      <DilutionCalculator />

      <PesticideDisclaimer />
    </div>
  )
}
