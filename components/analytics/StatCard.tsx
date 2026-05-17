/** 数値統計を視覚的に表示するためのカードコンポーネント。 */

import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

type StatCardProps = {
  title: string
  value: number | string
  icon: LucideIcon
  description?: string
  /** 前期比の変化率（%）。nullの場合は非表示 */
  change?: number | null
}

export function StatCard({ title, value, icon: Icon, description, change }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground whitespace-nowrap">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {change !== undefined && change !== null && (
                <span className={`flex items-center gap-0.5 text-xs font-medium ${
                  change > 0 ? 'text-green-600 dark:text-green-400' :
                  change < 0 ? 'text-red-600 dark:text-red-400' :
                  'text-muted-foreground'
                }`}>
                  {change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                  {change > 0 ? '+' : ''}{change}%
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
