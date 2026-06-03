'use client'


import { useState, useTransition } from 'react'
import { Download, Loader2 } from 'lucide-react'


interface DailyEngagement {
  date: string
  posts: number
  likes: number
  comments: number
}

interface ContentAnalyticsClientProps {
  dailyEngagement: DailyEngagement[]
}

export function ContentAnalyticsClient({ dailyEngagement }: ContentAnalyticsClientProps) {
  const [isPending, startTransition] = useTransition()
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExportCSV = () => {
    setExportError(null)
    startTransition(async () => {
      // 日別エンゲージメントのCSVをクライアントで生成
      const header = '日付,投稿数,いいね数,コメント数'
      const rows = dailyEngagement.map(d =>
        `${d.date},${d.posts},${d.likes},${d.comments}`
      )
      const csvContent = [header, ...rows].join('\n')

      // BOMを付与してExcelで文字化けしないようにする
      const bom = '\uFEFF'
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `content_engagement_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  }

  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">日別エンゲージメント</h2>
        <button
          onClick={handleExportCSV}
          disabled={isPending}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          CSVエクスポート
        </button>
      </div>

      {exportError && (
        <p className="text-sm text-destructive mb-3">{exportError}</p>
      )}

      {dailyEngagement.length === 0 ? (
        <p className="text-muted-foreground text-sm">データがありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">日付</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">投稿数</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">いいね数</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">コメント数</th>
              </tr>
            </thead>
            <tbody>
              {dailyEngagement.map(d => (
                <tr key={d.date} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{d.date}</td>
                  <td className="px-3 py-2 text-right">{d.posts.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{d.likes.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{d.comments.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="px-3 py-2">合計</td>
                <td className="px-3 py-2 text-right">
                  {dailyEngagement.reduce((s, d) => s + d.posts, 0).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right">
                  {dailyEngagement.reduce((s, d) => s + d.likes, 0).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right">
                  {dailyEngagement.reduce((s, d) => s + d.comments, 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
