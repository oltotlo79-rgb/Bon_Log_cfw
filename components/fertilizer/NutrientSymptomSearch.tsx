'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'

type Severity = 'high' | 'medium' | 'low'

interface NutrientInfo {
  name: string
  symbol: string
  slug: string
}

interface SymptomEntry {
  symptom: string
  nutrients: NutrientInfo[]
  explanation: string
  severity: Severity
}

const SYMPTOM_DATA: SymptomEntry[] = [
  {
    symptom: '下位葉の黄化',
    nutrients: [
      { name: '窒素', symbol: 'N', slug: 'nitrogen' },
      { name: 'マグネシウム', symbol: 'Mg', slug: 'magnesium' },
    ],
    explanation:
      '窒素やマグネシウムは移動性の高い要素で、不足すると古い葉から新しい葉へ転流されるため、下位葉から黄化が始まります。',
    severity: 'high',
  },
  {
    symptom: '新葉の黄化',
    nutrients: [
      { name: '鉄', symbol: 'Fe', slug: 'iron' },
      { name: '硫黄', symbol: 'S', slug: 'sulfur' },
      { name: 'マンガン', symbol: 'Mn', slug: 'manganese' },
    ],
    explanation:
      '鉄・硫黄・マンガンは移動性が低く、不足すると新しい葉に供給できないため新葉から症状が現れます。',
    severity: 'high',
  },
  {
    symptom: '葉脈間の黄化',
    nutrients: [
      { name: '鉄', symbol: 'Fe', slug: 'iron' },
      { name: 'マグネシウム', symbol: 'Mg', slug: 'magnesium' },
      { name: 'マンガン', symbol: 'Mn', slug: 'manganese' },
    ],
    explanation:
      '葉脈は緑のまま葉脈間が黄色くなる症状（クロロシス）は、クロロフィル合成に関わる鉄・マグネシウム・マンガンの欠乏を示します。',
    severity: 'medium',
  },
  {
    symptom: '葉の縁が枯れる',
    nutrients: [{ name: 'カリウム', symbol: 'K', slug: 'potassium' }],
    explanation:
      'カリウムは浸透圧調整に関わり、不足すると葉の周縁部から壊死（ネクロシス）が進行します。',
    severity: 'high',
  },
  {
    symptom: '葉が紫色',
    nutrients: [{ name: 'リン酸', symbol: 'P', slug: 'phosphorus' }],
    explanation:
      'リン酸不足ではアントシアニンが蓄積し、葉が紫〜赤紫色に変色します。特に低温期に顕著です。',
    severity: 'medium',
  },
  {
    symptom: '新芽の奇形',
    nutrients: [
      { name: 'カルシウム', symbol: 'Ca', slug: 'calcium' },
      { name: 'ホウ素', symbol: 'B', slug: 'boron' },
    ],
    explanation:
      'カルシウムは細胞壁形成、ホウ素は細胞分裂に必要で、不足すると成長点が変形・壊死します。',
    severity: 'high',
  },
  {
    symptom: '根の発育不良',
    nutrients: [
      { name: 'カルシウム', symbol: 'Ca', slug: 'calcium' },
      { name: 'リン酸', symbol: 'P', slug: 'phosphorus' },
    ],
    explanation:
      'カルシウムは根端の細胞壁構築に、リン酸はエネルギー代謝（ATP）に必須で、不足すると根の伸長が著しく阻害されます。',
    severity: 'high',
  },
  {
    symptom: '花付きが悪い',
    nutrients: [
      { name: 'リン酸', symbol: 'P', slug: 'phosphorus' },
      { name: 'ホウ素', symbol: 'B', slug: 'boron' },
    ],
    explanation:
      'リン酸は花芽分化のエネルギー源、ホウ素は花粉管の伸長に関わるため、不足すると開花・結実が悪化します。',
    severity: 'medium',
  },
  {
    symptom: '小葉症',
    nutrients: [{ name: '亜鉛', symbol: 'Zn', slug: 'zinc' }],
    explanation:
      '亜鉛はオーキシン合成に関与し、不足すると節間が詰まり葉が著しく小さくなります。',
    severity: 'medium',
  },
  {
    symptom: '茎が細い・軟弱',
    nutrients: [{ name: 'カリウム', symbol: 'K', slug: 'potassium' }],
    explanation:
      'カリウムは細胞の膨圧維持と茎の強度に関わり、不足すると茎が徒長して倒伏しやすくなります。',
    severity: 'medium',
  },
  {
    symptom: '耐寒性の低下',
    nutrients: [{ name: 'カリウム', symbol: 'K', slug: 'potassium' }],
    explanation:
      'カリウムは細胞液の濃度調整に関与し、不足すると凍結耐性が下がり冬季のダメージを受けやすくなります。',
    severity: 'low',
  },
  {
    symptom: '全体の生育停滞',
    nutrients: [
      { name: '窒素', symbol: 'N', slug: 'nitrogen' },
      { name: 'リン酸', symbol: 'P', slug: 'phosphorus' },
    ],
    explanation:
      '窒素はタンパク質・クロロフィルの主成分、リン酸はエネルギー代謝の中心で、不足すると植物全体の成長が停滞します。',
    severity: 'high',
  },
]

const SEVERITY_CONFIG: Record<Severity, { label: string; className: string }> = {
  high: {
    label: '重度',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  medium: {
    label: '中度',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  low: {
    label: '軽度',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
}

const TAG_CLOUD_KEYWORDS = [
  '黄化',
  '枯れる',
  '紫色',
  '奇形',
  '根',
  '花',
  '小葉',
  '軟弱',
  '耐寒',
  '生育停滞',
]

export function NutrientSymptomSearch() {
  const [query, setQuery] = useState('')

  const filteredSymptoms = useMemo(() => {
    if (!query.trim()) return SYMPTOM_DATA
    const lowerQuery = query.trim().toLowerCase()
    return SYMPTOM_DATA.filter(
      (entry) =>
        entry.symptom.toLowerCase().includes(lowerQuery) ||
        entry.explanation.toLowerCase().includes(lowerQuery) ||
        entry.nutrients.some(
          (n) =>
            n.name.toLowerCase().includes(lowerQuery) ||
            n.symbol.toLowerCase().includes(lowerQuery)
        )
    )
  }, [query])

  return (
    <div className="space-y-6">
      {/* 検索入力 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="症状を入力（例: 葉が黄色い、縁が枯れる）"
          className="w-full rounded-lg border bg-background pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* タグクラウド */}
      <div className="flex flex-wrap gap-2">
        {TAG_CLOUD_KEYWORDS.map((keyword) => (
          <button
            key={keyword}
            type="button"
            onClick={() => setQuery(keyword)}
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {keyword}
          </button>
        ))}
      </div>

      {/* 検索結果 */}
      {filteredSymptoms.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          該当する症状が見つかりませんでした
        </p>
      ) : (
        <div className="space-y-3">
          {filteredSymptoms.map((entry) => {
            const severityConfig = SEVERITY_CONFIG[entry.severity]
            return (
              <div
                key={entry.symptom}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm">{entry.symptom}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${severityConfig.className}`}
                  >
                    {severityConfig.label}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {entry.explanation}
                </p>

                <div className="flex flex-wrap gap-2">
                  {entry.nutrients.map((nutrient) => (
                    <Link
                      key={nutrient.slug}
                      href={`/fertilizers/nutrients/${nutrient.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1 text-xs hover:bg-primary/10 hover:border-primary/40 transition-colors"
                    >
                      <span className="font-bold text-primary">
                        {nutrient.symbol}
                      </span>
                      <span>{nutrient.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
