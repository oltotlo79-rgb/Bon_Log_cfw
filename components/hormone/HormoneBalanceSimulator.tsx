'use client'

import { useState, useMemo } from 'react'
import {
  BONSAI_TECHNIQUES,
  MONTH_LABELS,
  HORMONE_LEVEL_CONFIG,
  isHormoneActivityLevel,
  SIMULATOR_MAGNITUDE_DELTA,
  SIMULATOR_MAX_LEVEL,
  SIMULATOR_MIN_LEVEL,
  SIMULATOR_LEVEL_THRESHOLDS,
  TECHNIQUE_EFFECT_TYPE_LABELS,
  TECHNIQUE_MAGNITUDE_LABELS,
} from '@/lib/constants/hormone-techniques'

/** DB から来る level 値が想定外でも minimal にフォールバックして config を返す。 */
function getLevelConfig(level: string) {
  const key = isHormoneActivityLevel(level) ? level : 'minimal'
  return HORMONE_LEVEL_CONFIG[key]
}

type SimulatorHormone = {
  id: string
  name: string
  slug: string
}

type SimulatorTechnique = {
  hormoneId: string
  techniqueSlug: string
  effectType: string
  magnitude: string
  hormone: { slug: string }
}

type SimulatorSeasonalLevel = {
  hormoneId: string
  month: number
  level: string
}

type Props = {
  hormones: SimulatorHormone[]
  techniques: SimulatorTechnique[]
  seasonalLevels: SimulatorSeasonalLevel[]
  initialMonth?: number
}

function levelToNumeric(level: string): number {
  return getLevelConfig(level).numericValue
}

function numericToLevel(value: number): string {
  return SIMULATOR_LEVEL_THRESHOLDS.find(({ min }) => value >= min)?.level ?? 'minimal'
}

export function HormoneBalanceSimulator({ hormones, techniques, seasonalLevels, initialMonth }: Props) {
  const currentMonth = initialMonth ?? (new Date().getMonth() + 1)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedTechniques, setSelectedTechniques] = useState<Set<string>>(new Set())

  const toggleTechnique = (slug: string) => {
    setSelectedTechniques((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) {
        next.delete(slug)
      } else {
        next.add(slug)
      }
      return next
    })
  }

  const clearAllTechniques = () => {
    setSelectedTechniques(new Set())
  }

  const baselineLevels = useMemo(() => {
    const result = new Map<string, { level: string; numericValue: number }>()
    for (const hormone of hormones) {
      const entry = seasonalLevels.find(
        (s) => s.hormoneId === hormone.id && s.month === selectedMonth
      )
      const level = entry?.level ?? 'minimal'
      result.set(hormone.id, { level, numericValue: levelToNumeric(level) })
    }
    return result
  }, [hormones, seasonalLevels, selectedMonth])

  const hasSelectedTechniques = selectedTechniques.size > 0

  const predictedLevels = useMemo(() => {
    if (selectedTechniques.size === 0) return null

    const result = new Map<string, { baseline: number; delta: number; predicted: number; predictedLevel: string; effectType: string | null; magnitude: string | null }>()

    for (const hormone of hormones) {
      const baseline = baselineLevels.get(hormone.id)?.numericValue ?? 0
      const matchingTechniques = techniques.filter(
        (t) => selectedTechniques.has(t.techniqueSlug) && t.hormone.slug === hormone.slug
      )

      let delta = 0
      let effectType: string | null = null
      let magnitude: string | null = null

      for (const mt of matchingTechniques) {
        const magnitudeDelta = SIMULATOR_MAGNITUDE_DELTA[mt.magnitude] ?? 0

        if (mt.effectType === 'increase') {
          delta += magnitudeDelta
        } else if (mt.effectType === 'decrease') {
          delta -= magnitudeDelta
        }
        // redistribute: delta += 0, 特別表示

        // 最後にマッチした技法の情報を表示用に保持（複数の場合は代表値）
        effectType = matchingTechniques.length === 1 ? mt.effectType : 'combined'
        magnitude = matchingTechniques.length === 1 ? mt.magnitude : null
      }

      const predicted = Math.min(
        SIMULATOR_MAX_LEVEL,
        Math.max(SIMULATOR_MIN_LEVEL, baseline + delta)
      )

      result.set(hormone.id, {
        baseline,
        delta,
        predicted,
        predictedLevel: numericToLevel(predicted),
        effectType,
        magnitude,
      })
    }

    return result
  }, [hormones, techniques, baselineLevels, selectedTechniques])

  const barMaxWidth = SIMULATOR_MAX_LEVEL

  return (
    <div className="space-y-6">
      {/* 月セレクター */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">月を選択</h3>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
          {MONTH_LABELS.map((label, i) => {
            const month = i + 1
            const isSelected = selectedMonth === month
            return (
              <button
                key={label}
                type="button"
                onClick={() => setSelectedMonth(month)}
                className={`px-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 技法セレクター */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">技法を選択（複数可）</h3>
          {hasSelectedTechniques && (
            <button
              type="button"
              onClick={clearAllTechniques}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              すべて解除
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BONSAI_TECHNIQUES.map((technique) => {
            const isSelected = selectedTechniques.has(technique.slug)
            return (
              <button
                key={technique.slug}
                type="button"
                onClick={() => toggleTechnique(technique.slug)}
                className={`text-left px-3 py-2 rounded-md text-xs transition-colors border ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background hover:bg-accent'
                }`}
              >
                <span className="font-medium block">{technique.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 結果表示 */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">
          {MONTH_LABELS[selectedMonth - 1]}のホルモンバランス
          {hasSelectedTechniques && (
            <span className="font-normal text-muted-foreground ml-1">
              ＋ {BONSAI_TECHNIQUES.filter((t) => selectedTechniques.has(t.slug)).map((t) => t.name).join(' + ')}
            </span>
          )}
        </h3>

        <div className="space-y-2">
          {hormones.map((hormone) => {
            const baseline = baselineLevels.get(hormone.id)
            const prediction = predictedLevels?.get(hormone.id)
            const baseLevel = baseline?.level ?? 'minimal'
            const baseConfig = getLevelConfig(baseLevel)
            const baseValue = baseline?.numericValue ?? 0

            const showPrediction = prediction && hasSelectedTechniques
            const predictedConfig = showPrediction
              ? getLevelConfig(prediction.predictedLevel)
              : null

            return (
              <div key={hormone.id} className="rounded-md border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{hormone.name}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`${baseConfig.color} text-white px-1.5 py-0.5 rounded text-[10px] font-bold`}>
                      {baseConfig.label}
                    </span>
                    {showPrediction && prediction.effectType && (
                      <>
                        <span className="text-muted-foreground">→</span>
                        {prediction.effectType === 'redistribute' ? (
                          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {TECHNIQUE_EFFECT_TYPE_LABELS.redistribute}
                          </span>
                        ) : (
                          <span className={`${predictedConfig?.color ?? ''} text-white px-1.5 py-0.5 rounded text-[10px] font-bold`}>
                            {predictedConfig?.label ?? ''}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          ({TECHNIQUE_EFFECT_TYPE_LABELS[prediction.effectType] ?? ''}{prediction.magnitude ? ` ${TECHNIQUE_MAGNITUDE_LABELS[prediction.magnitude] ?? ''}` : ''})
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* バー表示 */}
                <div className="flex items-center gap-1 h-4">
                  <div
                    className={`${baseConfig.color} h-full rounded transition-all`}
                    style={{ width: `${(baseValue / barMaxWidth) * 100}%`, minWidth: baseValue > 0 ? '4px' : '2px' }}
                  />
                  {showPrediction && prediction.delta !== 0 && (
                    <div
                      className={`${prediction.delta > 0 ? 'bg-green-300 dark:bg-green-700' : 'bg-red-300 dark:bg-red-700'} h-full rounded transition-all`}
                      style={{ width: `${(Math.abs(prediction.delta) / barMaxWidth) * 100}%`, minWidth: '2px' }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 注意書き */}
      <p className="text-[11px] text-muted-foreground border-t pt-3">
        ※ シミュレーション結果は植物生理学の一般的な知見に基づく概算です。実際の効果は樹種・樹齢・環境条件により異なります。
      </p>
    </div>
  )
}
