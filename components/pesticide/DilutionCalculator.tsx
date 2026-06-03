'use client'

import { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DILUTION_CALCULATOR_RATIO_PRESETS as RATIO_PRESETS,
  DILUTION_CALCULATOR_WATER_PRESETS as WATER_PRESETS,
  DROPS_PER_ML,
  MIN_MEASURABLE_ML,
} from '@/lib/constants/limits'

type CalculationMode = 'normal' | 'reverse'

export function DilutionCalculator() {
  const [mode, setMode] = useState<CalculationMode>('normal')
  const [waterMl, setWaterMl] = useState(1000)
  const [dilutionRatio, setDilutionRatio] = useState(1000)
  const [pesticideMl, setPesticideMl] = useState(1)

  const normalResult = useMemo(() => {
    if (dilutionRatio <= 0) return null
    return waterMl / dilutionRatio
  }, [waterMl, dilutionRatio])

  const reverseResult = useMemo(() => {
    if (pesticideMl <= 0 || dilutionRatio <= 0) return null
    return pesticideMl * dilutionRatio
  }, [pesticideMl, dilutionRatio])

  const handleWaterChange = useCallback((value: string) => {
    const num = Number(value)
    if (!Number.isNaN(num) && num >= 0) setWaterMl(num)
  }, [])

  const handleRatioChange = useCallback((value: string) => {
    const num = Number(value)
    if (!Number.isNaN(num) && num >= 0) setDilutionRatio(num)
  }, [])

  const handlePesticideChange = useCallback((value: string) => {
    const num = Number(value)
    if (!Number.isNaN(num) && num >= 0) setPesticideMl(num)
  }, [])

  function formatResult(ml: number): string {
    if (ml >= 1) return `${Math.round(ml * 100) / 100}mL`
    return `${Math.round(ml * 100) / 100}mL（約${Math.round(ml * DROPS_PER_ML)}滴）`
  }

  function formatWaterResult(ml: number): string {
    if (ml >= 1000) return `${Math.round(ml * 10) / 10}mL（${Math.round(ml / 100) / 10}L）`
    return `${Math.round(ml * 10) / 10}mL`
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button
          variant={mode === 'normal' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('normal')}
        >
          薬剤量を計算
        </Button>
        <Button
          variant={mode === 'reverse' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('reverse')}
        >
          必要水量を計算
        </Button>
      </div>

      {mode === 'normal' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">水量と倍率から薬剤量を求める</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="water-volume">水量（mL）</Label>
              <Input
                id="water-volume"
                type="number"
                min={0}
                value={waterMl}
                onChange={(e) => handleWaterChange(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {WATER_PRESETS.map(({ label, value }) => (
                  <Button
                    key={value}
                    variant={waterMl === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWaterMl(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dilution-ratio">希釈倍率</Label>
              <Input
                id="dilution-ratio"
                type="number"
                min={1}
                value={dilutionRatio}
                onChange={(e) => handleRatioChange(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {RATIO_PRESETS.map(({ label, value }) => (
                  <Button
                    key={value}
                    variant={dilutionRatio === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDilutionRatio(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {normalResult !== null && (
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">計算結果</p>
                <p className="text-2xl font-bold text-primary">
                  {formatResult(normalResult)}
                </p>
                <p className="text-xs text-muted-foreground">
                  水{waterMl}mLに対して{dilutionRatio}倍希釈
                </p>
                {normalResult < MIN_MEASURABLE_ML && (
                  <Badge variant="destructive" className="mt-1">
                    {MIN_MEASURABLE_ML}mL未満のため正確な計量が困難です。より多い水量での調製をお勧めします。
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">薬剤量と倍率から必要水量を求める</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pesticide-amount">薬剤量（mL）</Label>
              <Input
                id="pesticide-amount"
                type="number"
                min={0}
                step={0.1}
                value={pesticideMl}
                onChange={(e) => handlePesticideChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dilution-ratio-reverse">希釈倍率</Label>
              <Input
                id="dilution-ratio-reverse"
                type="number"
                min={1}
                value={dilutionRatio}
                onChange={(e) => handleRatioChange(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {RATIO_PRESETS.map(({ label, value }) => (
                  <Button
                    key={value}
                    variant={dilutionRatio === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDilutionRatio(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {reverseResult !== null && (
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">必要水量</p>
                <p className="text-2xl font-bold text-primary">
                  {formatWaterResult(reverseResult)}
                </p>
                <p className="text-xs text-muted-foreground">
                  薬剤{pesticideMl}mLに対して{dilutionRatio}倍希釈
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
