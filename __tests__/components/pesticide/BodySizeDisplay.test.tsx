import { render, screen } from '../../utils/test-utils'
import { BodySizeDisplay } from '@/components/pesticide/BodySizeDisplay'

describe('BodySizeDisplay', () => {
  it('両方 null の場合は何も表示しない', () => {
    const { container } = render(<BodySizeDisplay minMm={null} maxMm={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('min と max が同値の場合は「約 N mm」と表示する', () => {
    render(<BodySizeDisplay minMm={5} maxMm={5} />)
    expect(screen.getByText(/約 5 mm/)).toBeInTheDocument()
  })

  it('min と max が異なる場合は範囲「min〜max mm」を表示する', () => {
    render(<BodySizeDisplay minMm={3} maxMm={8} />)
    expect(screen.getByText(/3〜8 mm/)).toBeInTheDocument()
  })

  it('min のみの場合は「min mm 以上」と表示する', () => {
    render(<BodySizeDisplay minMm={10} maxMm={null} />)
    expect(screen.getByText(/10 mm 以上/)).toBeInTheDocument()
  })

  it('max のみの場合は「max mm 以下」と表示する', () => {
    render(<BodySizeDisplay minMm={null} maxMm={15} />)
    expect(screen.getByText(/15 mm 以下/)).toBeInTheDocument()
  })

  it('表示テキストの前に「体長:」ラベルが付く', () => {
    render(<BodySizeDisplay minMm={5} maxMm={10} />)
    expect(screen.getByText(/体長:/)).toBeInTheDocument()
  })

  it('小数点値を正しく表示する', () => {
    render(<BodySizeDisplay minMm={1.5} maxMm={2.5} />)
    expect(screen.getByText(/1.5〜2.5 mm/)).toBeInTheDocument()
  })

  it('min と max が 0 の場合は「約 0 mm」と表示する', () => {
    render(<BodySizeDisplay minMm={0} maxMm={0} />)
    expect(screen.getByText(/約 0 mm/)).toBeInTheDocument()
  })
})
