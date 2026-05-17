/**
 * @file 統計グラフコンポーネント
 * @description 統計データをライン/エリア/バーグラフで表示するクライアントコンポーネント。
 *              期間・指標・グラフタイプの切り替え機能を提供する。
 */

'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  isAdminStatsPeriod,
  isAdminStatsMetric,
  type AdminStatsPeriod,
  type AdminStatsMetric,
  type AdminStatsChartType,
} from '@/lib/constants/admin-stats'

type StatsData = {
  date: string
  users: number
  posts: number
  comments: number
}

type StatsChartsProps = {
  data: StatsData[]
}

export function StatsCharts({ data }: StatsChartsProps) {
  const [chartType, setChartType] = useState<AdminStatsChartType>('area')
  const [period, setPeriod] = useState<AdminStatsPeriod>('30')
  const [selectedMetric, setSelectedMetric] = useState<AdminStatsMetric>('all')

  // 期間でフィルタ
  const filteredData = data.slice(-parseInt(period))

  // 日付をフォーマット
  const formattedData = filteredData.map((item: StatsData) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
  }))

  const renderChart = () => {
    const commonProps = {
      data: formattedData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    }

    const colors = {
      users: '#3b82f6',
      posts: '#22c55e',
      comments: '#a855f7',
    }

    const renderLines = () => {
      if (selectedMetric === 'all') {
        return (
          <>
            <Line type="monotone" dataKey="users" stroke={colors.users} strokeWidth={2} dot={false} name="ユーザー数" />
            <Line type="monotone" dataKey="posts" stroke={colors.posts} strokeWidth={2} dot={false} name="投稿数" />
            <Line type="monotone" dataKey="comments" stroke={colors.comments} strokeWidth={2} dot={false} name="コメント数" />
          </>
        )
      }
      return (
        <Line
          type="monotone"
          dataKey={selectedMetric}
          stroke={colors[selectedMetric]}
          strokeWidth={2}
          dot={false}
          name={selectedMetric === 'users' ? 'ユーザー数' : selectedMetric === 'posts' ? '投稿数' : 'コメント数'}
        />
      )
    }

    const renderAreas = () => {
      if (selectedMetric === 'all') {
        return (
          <>
            <Area type="monotone" dataKey="users" stroke={colors.users} fill={colors.users} fillOpacity={0.3} name="ユーザー数" />
            <Area type="monotone" dataKey="posts" stroke={colors.posts} fill={colors.posts} fillOpacity={0.3} name="投稿数" />
            <Area type="monotone" dataKey="comments" stroke={colors.comments} fill={colors.comments} fillOpacity={0.3} name="コメント数" />
          </>
        )
      }
      return (
        <Area
          type="monotone"
          dataKey={selectedMetric}
          stroke={colors[selectedMetric]}
          fill={colors[selectedMetric]}
          fillOpacity={0.3}
          name={selectedMetric === 'users' ? 'ユーザー数' : selectedMetric === 'posts' ? '投稿数' : 'コメント数'}
        />
      )
    }

    const renderBars = () => {
      if (selectedMetric === 'all') {
        return (
          <>
            <Bar dataKey="users" fill={colors.users} name="ユーザー数" />
            <Bar dataKey="posts" fill={colors.posts} name="投稿数" />
            <Bar dataKey="comments" fill={colors.comments} name="コメント数" />
          </>
        )
      }
      return (
        <Bar
          dataKey={selectedMetric}
          fill={colors[selectedMetric]}
          name={selectedMetric === 'users' ? 'ユーザー数' : selectedMetric === 'posts' ? '投稿数' : 'コメント数'}
        />
      )
    }

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            {renderLines()}
          </LineChart>
        )
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            {renderAreas()}
          </AreaChart>
        )
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            {renderBars()}
          </BarChart>
        )
    }
  }

  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-lg font-semibold">推移グラフ</h2>

        <div className="flex flex-wrap items-center gap-4">
          {/* 期間選択 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">期間:</span>
            <select
              value={period}
              onChange={(e) => {
                if (isAdminStatsPeriod(e.target.value)) setPeriod(e.target.value)
              }}
              className="px-3 py-1.5 text-sm border rounded-lg bg-background"
            >
              <option value="7">7日間</option>
              <option value="14">14日間</option>
              <option value="30">30日間</option>
            </select>
          </div>

          {/* 指標選択 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">指標:</span>
            <select
              value={selectedMetric}
              onChange={(e) => {
                if (isAdminStatsMetric(e.target.value)) setSelectedMetric(e.target.value)
              }}
              className="px-3 py-1.5 text-sm border rounded-lg bg-background"
            >
              <option value="all">すべて</option>
              <option value="users">ユーザー数</option>
              <option value="posts">投稿数</option>
              <option value="comments">コメント数</option>
            </select>
          </div>

          {/* グラフタイプ選択 */}
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <button
              onClick={() => setChartType('area')}
              className={`px-3 py-1 text-sm rounded ${
                chartType === 'area' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              エリア
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1 text-sm rounded ${
                chartType === 'line' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              ライン
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-3 py-1 text-sm rounded ${
                chartType === 'bar' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              バー
            </button>
          </div>
        </div>
      </div>

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
