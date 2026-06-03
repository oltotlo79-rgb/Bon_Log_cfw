/**
 * LandingThemeToggle のテスト。
 *
 * - 初期表示 (mounted 前) では aria-label が「ダークモードに切り替える」(default: light)
 * - mounted 後、resolvedTheme=dark なら太陽アイコン + 「ライトモードに切り替える」
 * - クリックで反対のテーマに切り替わる
 * - スタイル: shape (rounded-md, h-8/9), 墨絵カラー (border-black/text-black) を保つ
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LandingThemeToggle } from '@/components/landing/LandingThemeToggle'

const mockSetTheme = vi.fn()
let mockResolvedTheme: 'light' | 'dark' = 'light'

vi.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    theme: mockResolvedTheme,
    resolvedTheme: mockResolvedTheme,
    setTheme: mockSetTheme,
  }),
}))

describe('LandingThemeToggle', () => {
  beforeEach(() => {
    mockSetTheme.mockClear()
    mockResolvedTheme = 'light'
  })

  it('mounted 後、light テーマでは「ダークモードに切り替える」が aria-label に表示される', () => {
    mockResolvedTheme = 'light'
    render(<LandingThemeToggle />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'ダークモードに切り替える')
  })

  it('mounted 後、dark テーマでは「ライトモードに切り替える」が aria-label に表示される', () => {
    mockResolvedTheme = 'dark'
    render(<LandingThemeToggle />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'ライトモードに切り替える')
  })

  it('light のときクリックで setTheme("dark") が呼ばれる', () => {
    mockResolvedTheme = 'light'
    render(<LandingThemeToggle />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('dark のときクリックで setTheme("light") が呼ばれる', () => {
    mockResolvedTheme = 'dark'
    render(<LandingThemeToggle />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockSetTheme).toHaveBeenCalledWith('light')
  })

  it('墨絵テイストのクラスが適用されている (border-black + transparent bg + btn-washi)', () => {
    render(<LandingThemeToggle />)
    const button = screen.getByRole('button')
    const className = button.className
    expect(className).toContain('bg-transparent')
    expect(className).toContain('border-black')
    expect(className).toContain('text-black')
    expect(className).toContain('btn-washi')
    // hover で反転
    expect(className).toContain('hover:bg-black')
    expect(className).toContain('hover:text-white')
  })

  it('正方形のアイコンボタン (h-8/9 + w-8/9)', () => {
    render(<LandingThemeToggle />)
    const button = screen.getByRole('button')
    const className = button.className
    expect(className).toMatch(/h-(8|9)/)
    expect(className).toMatch(/w-(8|9)/)
  })
})
