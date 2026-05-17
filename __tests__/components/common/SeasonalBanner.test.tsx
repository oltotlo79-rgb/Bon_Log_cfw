import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'

const mockGetCurrentSeason = vi.fn()
const mockGetSeasonInfo = vi.fn()
const mockGetSeasonImagePath = vi.fn()

vi.mock('@/lib/utils/season', () => ({
  getCurrentSeason: () => mockGetCurrentSeason(),
  getSeasonInfo: (...args: unknown[]) => mockGetSeasonInfo(...args),
  getSeasonImagePath: (...args: unknown[]) => mockGetSeasonImagePath(...args),
}))

import { SeasonalBanner } from '@/components/common/SeasonalBanner'

describe('SeasonalBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentSeason.mockReturnValue('spring')
    mockGetSeasonInfo.mockReturnValue({
      id: 'spring',
      label: '春',
      description: '新緑の季節',
      months: [3, 4, 5],
    })
    mockGetSeasonImagePath.mockImplementation(
      (season: string, variant: string) => `/images/generated/seasons/season-${season}-${variant}.webp`
    )
  })

  it('正常にレンダリングされる', () => {
    const { container } = render(<SeasonalBanner />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('getCurrentSeasonを呼び出す', () => {
    render(<SeasonalBanner />)
    expect(mockGetCurrentSeason).toHaveBeenCalled()
  })

  it('getSeasonInfoを呼び出す', () => {
    render(<SeasonalBanner />)
    expect(mockGetSeasonInfo).toHaveBeenCalledWith('spring')
  })

  it('4つの画像バリアントを取得する', () => {
    render(<SeasonalBanner />)
    expect(mockGetSeasonImagePath).toHaveBeenCalledTimes(4)
    expect(mockGetSeasonImagePath).toHaveBeenCalledWith('spring', 'mobile')
    expect(mockGetSeasonImagePath).toHaveBeenCalledWith('spring', 'desktop')
    expect(mockGetSeasonImagePath).toHaveBeenCalledWith('spring', 'mobile-dark')
    expect(mockGetSeasonImagePath).toHaveBeenCalledWith('spring', 'desktop-dark')
  })

  it('alt属性に季節名が含まれる', () => {
    render(<SeasonalBanner />)
    const images = screen.getAllByRole('img')
    expect(images.length).toBeGreaterThanOrEqual(1)
    const altTexts = images.map((img) => img.getAttribute('alt'))
    expect(altTexts.some((alt) => alt?.includes('春'))).toBe(true)
  })

  it('夏の場合も正しく動作する', () => {
    mockGetCurrentSeason.mockReturnValue('summer')
    mockGetSeasonInfo.mockReturnValue({
      id: 'summer',
      label: '夏',
      description: '深緑の季節',
      months: [6, 7, 8],
    })

    render(<SeasonalBanner />)
    expect(mockGetSeasonImagePath).toHaveBeenCalledWith('summer', 'desktop')
  })

  it('秋の場合も正しく動作する', () => {
    mockGetCurrentSeason.mockReturnValue('autumn')
    mockGetSeasonInfo.mockReturnValue({
      id: 'autumn',
      label: '秋',
      description: '紅葉の季節',
      months: [9, 10, 11],
    })

    render(<SeasonalBanner />)
    expect(mockGetSeasonImagePath).toHaveBeenCalledWith('autumn', 'desktop')
  })

  it('冬の場合も正しく動作する', () => {
    mockGetCurrentSeason.mockReturnValue('winter')
    mockGetSeasonInfo.mockReturnValue({
      id: 'winter',
      label: '冬',
      description: '枯山水の季節',
      months: [12, 1, 2],
    })

    render(<SeasonalBanner />)
    expect(mockGetSeasonImagePath).toHaveBeenCalledWith('winter', 'desktop')
  })

  it('フェードアウト用のmask-imageスタイルが適用されている', () => {
    const { container } = render(<SeasonalBanner />)
    const imageContainer = container.querySelector('[class*="mask-image"]')
    expect(imageContainer).toBeInTheDocument()
  })
})
