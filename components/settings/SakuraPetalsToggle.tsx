'use client'

import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  getBgAnimationPref,
  setBgAnimationType,
  getSeasonalAnimationType,
  isAnimationPref,
  type AnimationPref,
} from '@/lib/sakura-petals-pref'

/** 季節自動の現在のエフェクト名を表示用に取得 */
const SEASONAL_LABELS: Record<string, string> = {
  sakura: '桜',
  dandelion: '綿毛',
  'rain-drops': '雨',
  rain: '水面',
  momiji: '紅葉',
  snow: '雪',
}

/**
 * 設定ページ用: 背景アニメーション選択UI
 * 「季節自動」をデフォルトとし、個別選択も可能。
 */
export function BgAnimationSelect() {
  const [pref, setPref] = useState<AnimationPref>('seasonal')

  useEffect(() => {
    const id = setTimeout(() => setPref(getBgAnimationPref()), 0)
    return () => clearTimeout(id)
  }, [])

  const handleChange = (value: string) => {
    if (!isAnimationPref(value)) return
    setPref(value)
    setBgAnimationType(value)
  }

  const currentSeasonal = getSeasonalAnimationType()
  const seasonalHint = SEASONAL_LABELS[currentSeasonal] ?? currentSeasonal

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor="bg-animation" className="text-sm font-medium">
          背景アニメーション
        </Label>
        <p className="text-xs text-muted-foreground mr-4">
          画面の奥に舞う季節のエフェクトを選択できます
        </p>
      </div>
      <Select value={pref} onValueChange={handleChange}>
        <SelectTrigger id="bg-animation" className="w-[160px] shrink-0">
          <SelectValue placeholder="エフェクトを選択" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="seasonal">季節自動（今: {seasonalHint}）</SelectItem>
          <SelectItem value="sakura">桜の花びら</SelectItem>
          <SelectItem value="dandelion">春の綿毛</SelectItem>
          <SelectItem value="rain-drops">雨</SelectItem>
          <SelectItem value="rain">水面の波紋</SelectItem>
          <SelectItem value="momiji">秋の紅葉</SelectItem>
          <SelectItem value="snow">冬の雪</SelectItem>
          <SelectItem value="none">オフ（非表示）</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
