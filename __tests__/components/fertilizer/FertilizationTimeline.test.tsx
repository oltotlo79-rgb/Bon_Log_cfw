/**
 * @file FertilizationTimeline の表示検証テスト
 *
 * 12か月分のグリッド・季節ラベル・NPK サブバー・凡例を検証する Server Component。
 * Prisma 型の `FertilizerAction` / `NutrientLevel` を用いて
 * 実データに近いパターンで描画結果を検証する。
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FertilizationTimeline } from '@/components/fertilizer/FertilizationTimeline'

describe('FertilizationTimeline', () => {
  it('plans が空でも 12ヶ月分すべてセルが描画され、季節ラベルも表示される', () => {
    const { container } = render(<FertilizationTimeline plans={[]} />)

    // 季節ラベル 4 個
    expect(screen.getByText('春')).toBeInTheDocument()
    expect(screen.getByText('夏')).toBeInTheDocument()
    expect(screen.getByText('秋')).toBeInTheDocument()
    expect(screen.getByText('冬')).toBeInTheDocument()

    // 月ラベル 1月〜12月
    for (let m = 1; m <= 12; m += 1) {
      expect(screen.getByText(`${m}月`)).toBeInTheDocument()
    }

    // 12 × メインバーセル + 12 × N + 12 × P + 12 × K = 最低 48 セル
    const cells = container.querySelectorAll('[title*="月"]')
    expect(cells.length).toBeGreaterThanOrEqual(48)
  })

  it('plans で指定した月の施肥アクションがタイトルに反映される', () => {
    render(
      <FertilizationTimeline
        plans={[
          {
            month: 4,
            action: 'heavy',
            nitrogenLevel: 'high',
            phosphorusLevel: 'balanced',
            potassiumLevel: 'low',
          },
        ]}
      />,
    )

    // メインバー tooltip（FERTILIZER_ACTION_BADGE.heavy.label = "たっぷり"）
    expect(document.querySelector('[title="4月: たっぷり"]')).not.toBeNull()
    // N サブバー tooltip
    expect(document.querySelector('[title^="4月 N:"]')).not.toBeNull()
  })

  it('全施肥アクションが凡例に登場する', () => {
    render(<FertilizationTimeline plans={[]} />)
    // FERTILIZER_ACTION_BADGE のラベルは実定数に合わせる
    expect(screen.getByText('施肥量:')).toBeInTheDocument()
    // 4 種（none/light/moderate/heavy）の凡例ラベルが見える
    // label が「無施肥」「少なめ」「標準」「多め」など定数から来る
    const legendEntries = screen.getByText('施肥量:').parentElement
    expect(legendEntries).not.toBeNull()
    expect(legendEntries!.querySelectorAll('span.inline-block').length).toBeGreaterThanOrEqual(4)
  })

  it('NPK 凡例の 3 要素が描画される', () => {
    render(<FertilizationTimeline plans={[]} />)
    // N, P, K の凡例テキスト
    const labels = screen.getAllByText(/^[NPK]$/)
    expect(labels.length).toBeGreaterThanOrEqual(3) // 行ラベルと凡例で重複あり
  })

  it('plans で指定しない月はデフォルトで `none` として描画される', () => {
    render(
      <FertilizationTimeline
        plans={[
          {
            month: 3,
            action: 'light',
            nitrogenLevel: null,
            phosphorusLevel: null,
            potassiumLevel: null,
          },
        ]}
      />,
    )
    // 1月（指定外）は none 扱い（FERTILIZER_ACTION_BADGE.none.label = "不要"）
    expect(document.querySelector('[title="1月: 不要"]')).not.toBeNull()
    // 3月（指定）は light 扱い（FERTILIZER_ACTION_BADGE.light.label = "控えめ"）
    expect(document.querySelector('[title="3月: 控えめ"]')).not.toBeNull()
  })
})
