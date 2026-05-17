import { render } from '../../utils/test-utils'
import { SearchResultsSkeleton } from '@/components/search/SearchResultsSkeleton'

describe('SearchResultsSkeleton', () => {
  it('スケルトンコンテナが表示される', () => {
    const { container } = render(<SearchResultsSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('3件分のスケルトンカードが表示される', () => {
    const { container } = render(<SearchResultsSkeleton />)
    const cards = container.querySelectorAll('.bg-card')
    expect(cards.length).toBe(3)
  })

  it('スケルトンカードにanimate-pulseクラスが適用される', () => {
    const { container } = render(<SearchResultsSkeleton />)
    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('各カードにアバタースケルトンが表示される', () => {
    const { container } = render(<SearchResultsSkeleton />)
    const avatars = container.querySelectorAll('.w-10.h-10.rounded-full.bg-muted')
    expect(avatars.length).toBe(3)
  })

  it('各カードにコンテンツスケルトンが表示される', () => {
    const { container } = render(<SearchResultsSkeleton />)
    // コンテンツ部分のスケルトンライン（w-fullの行）
    const contentLines = container.querySelectorAll('.h-4.w-full.bg-muted.rounded')
    expect(contentLines.length).toBe(3)
  })

  it('各カードにユーザー名スケルトンが表示される', () => {
    const { container } = render(<SearchResultsSkeleton />)
    const nameSkeleton = container.querySelectorAll('.h-4.w-24.bg-muted.rounded')
    expect(nameSkeleton.length).toBe(3)
  })

  it('各カードに日時スケルトンが表示される', () => {
    const { container } = render(<SearchResultsSkeleton />)
    const dateSkeleton = container.querySelectorAll('.h-3.w-16.bg-muted.rounded')
    expect(dateSkeleton.length).toBe(3)
  })

  it('外側のコンテナにspace-y-4クラスが適用される', () => {
    const { container } = render(<SearchResultsSkeleton />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('space-y-4')
  })

  it('各カードにborderクラスが適用される', () => {
    const { container } = render(<SearchResultsSkeleton />)
    const cards = container.querySelectorAll('.border')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('各カードにrounded-lgクラスが適用される', () => {
    const { container } = render(<SearchResultsSkeleton />)
    const cards = container.querySelectorAll('.rounded-lg')
    expect(cards.length).toBe(3)
  })
})
