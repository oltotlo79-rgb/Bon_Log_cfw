import { render, screen } from '@testing-library/react'
import { PesticideDisclaimer } from '@/components/pesticide/PesticideDisclaimer'

describe('PesticideDisclaimer', () => {
  it('免責の文言を表示する', () => {
    render(<PesticideDisclaimer />)
    expect(
      screen.getByText(/本機能の農薬・病害虫情報は参考用です/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/農薬のラベルおよび最新の登録情報を確認し/)
    ).toBeInTheDocument()
  })

  it('注意を促す文言が含まれる', () => {
    render(<PesticideDisclaimer />)
    expect(screen.getByText(/用法・用量・使用時期を守ってください/)).toBeInTheDocument()
  })
})
