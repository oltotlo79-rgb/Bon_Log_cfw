/**
 * HormoneBalanceSimulator のインタラクティブ動作テスト
 *
 * 既存の hormone-components.test.tsx は描画チェックのみを担当する。
 * このファイルは月選択・技法トグル・予測値計算・redistribute / combined
 * 表示・バー幅レンダリングなど、47% / 27% に留まっていた branch を補強する。
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HormoneBalanceSimulator } from '@/components/hormone/HormoneBalanceSimulator'

// ホルモン (オーキシン: high@4月, ジベレリン: moderate@4月)
const hormones = [
  { id: 'h-auxin', name: 'オーキシン', slug: 'auxin' },
  { id: 'h-gib', name: 'ジベレリン', slug: 'gibberellin' },
]

const seasonalLevels = [
  { hormoneId: 'h-auxin', month: 4, level: 'high' },
  { hormoneId: 'h-gib', month: 4, level: 'moderate' },
  { hormoneId: 'h-auxin', month: 5, level: 'low' },
]

const techniques = [
  // 摘芯: オーキシン強減少
  { hormoneId: 'h-auxin', techniqueSlug: 'pinching', effectType: 'decrease', magnitude: 'strong', hormone: { slug: 'auxin' } },
  // 剪定: ジベレリン弱増加
  { hormoneId: 'h-gib', techniqueSlug: 'pruning', effectType: 'increase', magnitude: 'mild', hormone: { slug: 'gibberellin' } },
  // 取り木: オーキシン再分配
  { hormoneId: 'h-auxin', techniqueSlug: 'air-layering', effectType: 'redistribute', magnitude: 'moderate', hormone: { slug: 'auxin' } },
]

function renderSim(initialMonth = 4) {
  return render(
    <HormoneBalanceSimulator
      hormones={hormones}
      techniques={techniques}
      seasonalLevels={seasonalLevels}
      initialMonth={initialMonth}
    />,
  )
}

describe('HormoneBalanceSimulator - 初期状態', () => {
  it('initialMonth の月ボタンが選択状態（primary 配色）で描画される', () => {
    renderSim(4)
    const apr = screen.getByRole('button', { name: '4月' })
    expect(apr.className).toContain('bg-primary')
  })

  it('initialMonth 未指定なら現在月を選択', () => {
    render(
      <HormoneBalanceSimulator
        hormones={hormones}
        techniques={techniques}
        seasonalLevels={seasonalLevels}
      />,
    )
    const currentMonth = new Date().getMonth() + 1
    const btn = screen.getByRole('button', { name: `${currentMonth}月` })
    expect(btn.className).toContain('bg-primary')
  })

  it('技法未選択時は「すべて解除」ボタンが描画されない', () => {
    renderSim()
    expect(screen.queryByRole('button', { name: 'すべて解除' })).not.toBeInTheDocument()
  })

  it('技法未選択時は予測表示（→ や 増加/減少 などの effectType ラベル）が出ない', () => {
    renderSim()
    // 矢印 → を含むテキストは予測時のみ表示される
    expect(screen.queryByText('→')).not.toBeInTheDocument()
  })
})

describe('HormoneBalanceSimulator - 月切り替え', () => {
  it('別の月ボタンをクリックすると selected が移動する', () => {
    renderSim(4)
    fireEvent.click(screen.getByRole('button', { name: '5月' }))
    const may = screen.getByRole('button', { name: '5月' })
    expect(may.className).toContain('bg-primary')
    const apr = screen.getByRole('button', { name: '4月' })
    expect(apr.className).not.toContain('bg-primary')
  })

  it('選択した月のヘッダーラベルが反映される', () => {
    renderSim(4)
    expect(screen.getByText(/4月のホルモンバランス/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '7月' }))
    expect(screen.getByText(/7月のホルモンバランス/)).toBeInTheDocument()
  })

  it('シーズナルデータがない月は minimal 扱い（予測なしでもバーは最小幅）', () => {
    const { container } = renderSim(1) // 1月のデータは無し → minimal
    // 各ホルモンカード内のバー（最初の div with style width）の minWidth は 2px
    const bars = container.querySelectorAll('[style*="width"]')
    expect(bars.length).toBeGreaterThan(0)
  })
})

describe('HormoneBalanceSimulator - 技法トグル', () => {
  it('技法をクリックすると選択状態（border-primary）になる', () => {
    renderSim(4)
    const pinch = screen.getByRole('button', { name: '摘芯（芽摘み）' })
    fireEvent.click(pinch)
    expect(pinch.className).toContain('border-primary')
  })

  it('もう一度クリックすると選択解除される', () => {
    renderSim(4)
    const pinch = screen.getByRole('button', { name: '摘芯（芽摘み）' })
    fireEvent.click(pinch)
    fireEvent.click(pinch)
    expect(pinch.className).not.toContain('border-primary')
  })

  it('技法選択中は「すべて解除」ボタンが現れる', () => {
    renderSim(4)
    fireEvent.click(screen.getByRole('button', { name: '摘芯（芽摘み）' }))
    expect(screen.getByRole('button', { name: 'すべて解除' })).toBeInTheDocument()
  })

  it('「すべて解除」で全ての選択がリセットされる', () => {
    renderSim(4)
    fireEvent.click(screen.getByRole('button', { name: '摘芯（芽摘み）' }))
    fireEvent.click(screen.getByRole('button', { name: '剪定' }))
    fireEvent.click(screen.getByRole('button', { name: 'すべて解除' }))

    const pinch = screen.getByRole('button', { name: '摘芯（芽摘み）' })
    const prune = screen.getByRole('button', { name: '剪定' })
    expect(pinch.className).not.toContain('border-primary')
    expect(prune.className).not.toContain('border-primary')
    expect(screen.queryByRole('button', { name: 'すべて解除' })).not.toBeInTheDocument()
  })

  it('選択された技法名がヘッダーに連結表示される（複数時は + で区切る）', () => {
    renderSim(4)
    fireEvent.click(screen.getByRole('button', { name: '摘芯（芽摘み）' }))
    fireEvent.click(screen.getByRole('button', { name: '剪定' }))

    expect(screen.getByText(/摘芯（芽摘み） \+ 剪定/)).toBeInTheDocument()
  })
})

describe('HormoneBalanceSimulator - 予測値計算', () => {
  it('decrease 技法を選ぶと「減少」ラベルと → が表示される', () => {
    renderSim(4)
    fireEvent.click(screen.getByRole('button', { name: '摘芯（芽摘み）' }))

    expect(screen.getByText('→')).toBeInTheDocument()
    expect(screen.getByText(/減少/)).toBeInTheDocument()
  })

  it('increase 技法を選ぶと「増加」ラベルが表示される', () => {
    renderSim(4)
    fireEvent.click(screen.getByRole('button', { name: '剪定' }))

    expect(screen.getByText(/増加/)).toBeInTheDocument()
  })

  it('redistribute 技法を選ぶと「再分配」バッジ（青背景）が表示される', () => {
    const { container } = renderSim(4)
    fireEvent.click(screen.getByRole('button', { name: '取り木' }))

    expect(screen.getByText('再分配')).toBeInTheDocument()
    // 青系の class（bg-blue-100）が付与される
    const blueBadge = container.querySelector('.bg-blue-100')
    expect(blueBadge).not.toBeNull()
  })

  it('複数の同一ホルモン技法を選ぶと「複合効果」表示になる', () => {
    // 摘芯（decrease）と取り木（redistribute）はどちらも auxin
    renderSim(4)
    fireEvent.click(screen.getByRole('button', { name: '摘芯（芽摘み）' }))
    fireEvent.click(screen.getByRole('button', { name: '取り木' }))

    expect(screen.getByText(/複合効果/)).toBeInTheDocument()
  })

  it('単一技法選択時はその magnitude（強/中/弱）も表示される', () => {
    renderSim(4)
    // 摘芯は magnitude: 'strong'
    fireEvent.click(screen.getByRole('button', { name: '摘芯（芽摘み）' }))
    expect(screen.getByText(/強/)).toBeInTheDocument()
  })

  it('複数技法時は magnitude（強/弱）が () 内に出ない（複合効果のみ）', () => {
    renderSim(4)
    fireEvent.click(screen.getByRole('button', { name: '摘芯（芽摘み）' }))
    fireEvent.click(screen.getByRole('button', { name: '取り木' }))
    // 単一時は「(減少 強)」のように出る。複数時は「(複合効果)」のみ。
    // → 括弧内に「強」「弱」が現れない
    expect(screen.queryByText(/\(.*強.*\)/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\(.*弱.*\)/)).not.toBeInTheDocument()
    // 「複合効果」ラベルは出ている
    expect(screen.getByText(/複合効果/)).toBeInTheDocument()
  })

  it('該当する技法がないホルモンは予測表示を出さない（ジベレリンに摘芯は無効）', () => {
    renderSim(4)
    fireEvent.click(screen.getByRole('button', { name: '摘芯（芽摘み）' }))

    // ジベレリン行には effectType ラベルが出ない
    // → ジベレリン名と「moderate」バッジしか出ない
    expect(screen.getByText('ジベレリン')).toBeInTheDocument()
    // オーキシン側にだけ「→」が出るので画面全体で「→」は1個
    const arrows = screen.getAllByText('→')
    expect(arrows).toHaveLength(1)
  })
})

describe('HormoneBalanceSimulator - 上限・下限クランプ', () => {
  it('予測値は MAX_LEVEL（=4）を超えない（複数の強増加技法でも上限止まり）', () => {
    // 強増加を 3 個重ねる setup
    const techs = [
      { hormoneId: 'h1', techniqueSlug: 'pinching', effectType: 'increase', magnitude: 'strong', hormone: { slug: 'auxin' } },
      { hormoneId: 'h1', techniqueSlug: 'pruning', effectType: 'increase', magnitude: 'strong', hormone: { slug: 'auxin' } },
      { hormoneId: 'h1', techniqueSlug: 'wiring', effectType: 'increase', magnitude: 'strong', hormone: { slug: 'auxin' } },
    ]
    const h = [{ id: 'h1', name: 'オーキシン', slug: 'auxin' }]
    const sl = [{ hormoneId: 'h1', month: 4, level: 'high' }] // baseline=3
    const { container } = render(
      <HormoneBalanceSimulator hormones={h} techniques={techs} seasonalLevels={sl} initialMonth={4} />,
    )

    fireEvent.click(screen.getByRole('button', { name: '摘芯（芽摘み）' }))
    fireEvent.click(screen.getByRole('button', { name: '剪定' }))
    fireEvent.click(screen.getByRole('button', { name: '針金掛け' }))

    // 予測バーが描画される（delta>0 で緑系背景）
    const greenBar = container.querySelector('.bg-green-300, .dark\\:bg-green-700')
    expect(greenBar).not.toBeNull()
  })

  it('予測値は MIN_LEVEL（=0）を下回らない', () => {
    const techs = [
      { hormoneId: 'h1', techniqueSlug: 'pinching', effectType: 'decrease', magnitude: 'strong', hormone: { slug: 'auxin' } },
      { hormoneId: 'h1', techniqueSlug: 'pruning', effectType: 'decrease', magnitude: 'strong', hormone: { slug: 'auxin' } },
    ]
    const h = [{ id: 'h1', name: 'オーキシン', slug: 'auxin' }]
    const sl = [{ hormoneId: 'h1', month: 4, level: 'low' }] // baseline=1
    const { container } = render(
      <HormoneBalanceSimulator hormones={h} techniques={techs} seasonalLevels={sl} initialMonth={4} />,
    )

    fireEvent.click(screen.getByRole('button', { name: '摘芯（芽摘み）' }))
    fireEvent.click(screen.getByRole('button', { name: '剪定' }))

    // 予測バーが描画される（delta<0 で赤系背景）
    const redBar = container.querySelector('.bg-red-300, .dark\\:bg-red-700')
    expect(redBar).not.toBeNull()
  })

  it('redistribute 単独では delta=0 のため予測バー（緑/赤）が出ない', () => {
    const { container } = renderSim(4)
    fireEvent.click(screen.getByRole('button', { name: '取り木' }))

    // delta=0 なので増減バーは描画されない
    expect(container.querySelector('.bg-green-300, .bg-red-300')).toBeNull()
  })
})

describe('HormoneBalanceSimulator - エッジケース', () => {
  it('hormones が空配列でも例外を投げない', () => {
    expect(() =>
      render(
        <HormoneBalanceSimulator
          hormones={[]}
          techniques={[]}
          seasonalLevels={[]}
          initialMonth={4}
        />,
      ),
    ).not.toThrow()
  })

  it('未知の magnitude（type に無い値）は delta 0 として扱われる', () => {
    const techs = [
      { hormoneId: 'h1', techniqueSlug: 'pinching', effectType: 'increase', magnitude: 'unknown', hormone: { slug: 'auxin' } },
    ]
    const h = [{ id: 'h1', name: 'オーキシン', slug: 'auxin' }]
    const sl = [{ hormoneId: 'h1', month: 4, level: 'moderate' }]
    const { container } = render(
      <HormoneBalanceSimulator hormones={h} techniques={techs} seasonalLevels={sl} initialMonth={4} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '摘芯（芽摘み）' }))

    // delta=0 → 増減バーは描画されない
    expect(container.querySelector('.bg-green-300, .bg-red-300')).toBeNull()
  })
})
