import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// days パラメータが URL に無いケース専用ファイル（次段の || フォールバック分岐を検証）
const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams('')
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

import { PeriodFilter } from '@/components/analytics/PeriodFilter'

describe('PeriodFilter (days パラメータ未指定)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('days パラメータが無い場合はデフォルトの30日がアクティブスタイルになる', () => {
    render(<PeriodFilter />)
    const activeButton = screen.getByText('30日')
    expect(activeButton.className).toContain('bg-background')
    expect(activeButton.className).toContain('font-medium')
  })
})
