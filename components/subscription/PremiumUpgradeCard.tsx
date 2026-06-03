/**
 * @module components/subscription/PremiumUpgradeCard
 */

'use client'

import Link from 'next/link'
import { ROUTE_SETTINGS_SUBSCRIPTION } from '@/lib/constants/routes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Crown, Check } from 'lucide-react'

type PremiumUpgradeCardProps = {
  title?: string
  description?: string
  showFeatures?: boolean
}

// 無料会員との差別化ポイント
const features = [
  '投稿文字数 2000文字',
  '画像添付 6枚まで',
  '動画添付 3本まで',
  '予約投稿機能',
  '投稿分析ダッシュボード',
]

export function PremiumUpgradeCard({
  title = 'プレミアム会員限定機能',
  description = 'この機能を利用するにはプレミアム会員への登録が必要です。',
  showFeatures = true,
}: PremiumUpgradeCardProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <Crown className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <p className="text-muted-foreground mt-2">{description}</p>
      </CardHeader>

      <CardContent>
        {showFeatures && (
          <ul className="space-y-2 mb-6">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="text-center">
          <p className="text-2xl font-bold mb-4">
            ¥500<span className="text-sm font-normal text-muted-foreground">/月</span>
          </p>
          <Button asChild variant="bonsai" className="w-full">
            <Link href={ROUTE_SETTINGS_SUBSCRIPTION}>プレミアムに登録する</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
