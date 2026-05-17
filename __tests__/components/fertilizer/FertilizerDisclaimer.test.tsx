import { render, screen } from '@testing-library/react'
import { FertilizerDisclaimer } from '@/components/fertilizer/FertilizerDisclaimer'

describe('FertilizerDisclaimer', () => {
  it('免責の文言を表示する', () => {
    render(<FertilizerDisclaimer />)
    expect(
      screen.getByText(/施肥の情報は一般的な盆栽管理の知識に基づいた目安です/)
    ).toBeInTheDocument()
  })

  it('調整を促す文言が含まれる', () => {
    render(<FertilizerDisclaimer />)
    expect(
      screen.getByText(/樹の状態、用土、気候、環境に応じて調整してください/)
    ).toBeInTheDocument()
  })

  it('製品推奨でないことの文言が含まれる', () => {
    render(<FertilizerDisclaimer />)
    expect(
      screen.getByText(/特定の肥料製品を推奨するものではありません/)
    ).toBeInTheDocument()
  })
})
