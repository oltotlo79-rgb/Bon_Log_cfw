import { render, screen } from '@testing-library/react'
import { NutrientLevelIndicator } from '@/components/fertilizer/NutrientLevelIndicator'
import type { NutrientLevel } from '@prisma/client'

describe('NutrientLevelIndicator', () => {
  it('levelがnullのとき「—」を表示する', () => {
    render(<NutrientLevelIndicator level={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('highのとき「↑」アイコンを表示する', () => {
    render(<NutrientLevelIndicator level={'high' as NutrientLevel} />)
    expect(screen.getByText('↑')).toBeInTheDocument()
  })

  it('balancedのとき「→」アイコンを表示する', () => {
    render(<NutrientLevelIndicator level={'balanced' as NutrientLevel} />)
    expect(screen.getByText('→')).toBeInTheDocument()
  })

  it('lowのとき「↓」アイコンを表示する', () => {
    render(<NutrientLevelIndicator level={'low' as NutrientLevel} />)
    expect(screen.getByText('↓')).toBeInTheDocument()
  })

  it('noneのとき「—」アイコンを表示する', () => {
    render(<NutrientLevelIndicator level={'none' as NutrientLevel} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('nutrientを渡すとラベルが表示される', () => {
    render(<NutrientLevelIndicator level={'high' as NutrientLevel} nutrient="N" />)
    expect(screen.getByText('N')).toBeInTheDocument()
    expect(screen.getByText('↑')).toBeInTheDocument()
  })

  it('nutrientなしの場合はラベルが表示されない', () => {
    render(<NutrientLevelIndicator level={'high' as NutrientLevel} />)
    expect(screen.getByText('↑')).toBeInTheDocument()
    expect(screen.queryByText('N')).not.toBeInTheDocument()
  })

  it('levelがnullのときnutrientは無視される', () => {
    render(<NutrientLevelIndicator level={null} nutrient="P" />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('P')).not.toBeInTheDocument()
  })
})
