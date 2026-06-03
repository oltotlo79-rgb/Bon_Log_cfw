import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getHormoneTechniques } from '@/lib/actions/hormone'
import { BONSAI_TECHNIQUES } from '@/lib/constants/hormone-techniques'
import { HormoneTechniqueCard } from '@/components/hormone/HormoneTechniqueCard'
import { HormoneDisclaimer } from '@/components/hormone/HormoneDisclaimer'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { BASE_URL, ROUTE_HORMONES, ROUTE_HORMONE_TECHNIQUES } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '技法とホルモン - 植物ホルモン',
  description: '盆栽の各技法（摘芯・剪定・針金掛け等）が植物ホルモンに与える影響を科学的に解説します。',
  alternates: { canonical: pageCanonical(ROUTE_HORMONE_TECHNIQUES) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

export default async function HormoneTechniquesPage() {
  const { techniques } = await getHormoneTechniques()

  const groupedByTechnique = new Map<string, typeof techniques>()
  for (const t of techniques) {
    const existing = groupedByTechnique.get(t.techniqueSlug) ?? []
    existing.push(t)
    groupedByTechnique.set(t.techniqueSlug, existing)
  }

  return (
    <div className="space-y-6">
      <BreadcrumbJsonLd
        items={[
          { name: '植物ホルモン', url: `${BASE_URL}${ROUTE_HORMONES}` },
          { name: '技法とホルモン', url: `${BASE_URL}${ROUTE_HORMONE_TECHNIQUES}` },
        ]}
      />

      <Link href={ROUTE_HORMONES} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 植物ホルモン一覧
      </Link>

      <div>
        <h1 className="text-2xl font-bold">技法とホルモン</h1>
        <p className="text-sm text-muted-foreground mt-1">
          盆栽の各技法が植物ホルモンにどのような影響を与えるかを科学的根拠とともに解説します
        </p>
      </div>

      <HormoneDisclaimer />

      <div className="space-y-4">
        {BONSAI_TECHNIQUES.map((technique) => {
          const techniqueData = groupedByTechnique.get(technique.slug) ?? []
          const effects = techniqueData.map((t) => ({
            hormoneName: t.hormone.name,
            hormoneSlug: t.hormone.slug,
            effectType: t.effectType,
            magnitude: t.magnitude,
            mechanism: t.mechanism,
          }))

          return (
            <HormoneTechniqueCard
              key={technique.slug}
              techniqueName={technique.name}
              techniqueNameEn={technique.nameEn}
              description={technique.description}
              effects={effects}
            />
          )
        })}
      </div>
    </div>
  )
}
