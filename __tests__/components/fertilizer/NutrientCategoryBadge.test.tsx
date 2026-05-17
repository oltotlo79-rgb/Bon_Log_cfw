import { render, screen } from '@testing-library/react'
import { NutrientCategoryBadge } from '@/components/fertilizer/NutrientCategoryBadge'
import type { NutrientCategory } from '@prisma/client'

describe('NutrientCategoryBadge', () => {
  it('primaryのとき「三大要素」ラベルを表示する', () => {
    render(<NutrientCategoryBadge category={'primary' as NutrientCategory} />)
    expect(screen.getByText('三大要素')).toBeInTheDocument()
  })

  it('secondaryのとき「二次要素」ラベルを表示する', () => {
    render(<NutrientCategoryBadge category={'secondary' as NutrientCategory} />)
    expect(screen.getByText('二次要素')).toBeInTheDocument()
  })

  it('traceのとき「微量要素」ラベルを表示する', () => {
    render(<NutrientCategoryBadge category={'trace' as NutrientCategory} />)
    expect(screen.getByText('微量要素')).toBeInTheDocument()
  })

  it('バッジにrounded-fullクラスが適用される', () => {
    const { container } = render(<NutrientCategoryBadge category={'primary' as NutrientCategory} />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('rounded-full')
  })

  it('primaryバッジにemeraldクラスが含まれる', () => {
    const { container } = render(<NutrientCategoryBadge category={'primary' as NutrientCategory} />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('emerald')
  })
})
