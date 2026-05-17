import { render, screen } from '@testing-library/react'
import { FertilizerActionBadge } from '@/components/fertilizer/FertilizerActionBadge'
import type { FertilizerAction } from '@prisma/client'

describe('FertilizerActionBadge', () => {
  it('noneのとき「—」アイコンと「不要」ラベルを表示する', () => {
    render(<FertilizerActionBadge action={'none' as FertilizerAction} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('不要')).toBeInTheDocument()
  })

  it('lightのとき「△」アイコンと「控えめ」ラベルを表示する', () => {
    render(<FertilizerActionBadge action={'light' as FertilizerAction} />)
    expect(screen.getByText('△')).toBeInTheDocument()
    expect(screen.getByText('控えめ')).toBeInTheDocument()
  })

  it('moderateのとき「○」アイコンと「通常」ラベルを表示する', () => {
    render(<FertilizerActionBadge action={'moderate' as FertilizerAction} />)
    expect(screen.getByText('○')).toBeInTheDocument()
    expect(screen.getByText('通常')).toBeInTheDocument()
  })

  it('heavyのとき「◎」アイコンと「たっぷり」ラベルを表示する', () => {
    render(<FertilizerActionBadge action={'heavy' as FertilizerAction} />)
    expect(screen.getByText('◎')).toBeInTheDocument()
    expect(screen.getByText('たっぷり')).toBeInTheDocument()
  })

  it('バッジにrounded-fullクラスが適用される', () => {
    const { container } = render(<FertilizerActionBadge action={'moderate' as FertilizerAction} />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('rounded-full')
  })
})
