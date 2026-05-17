import { render, screen } from '../../utils/test-utils'
import { ReportSuccessView } from '@/components/report/ReportSuccessView'

describe('ReportSuccessView', () => {
  it('通報受付メッセージを表示する', () => {
    render(<ReportSuccessView />)
    expect(screen.getByText('通報を受け付けました')).toBeInTheDocument()
  })

  it('お礼の説明文を表示する', () => {
    render(<ReportSuccessView />)
    expect(
      screen.getByText('ご協力ありがとうございます。内容を確認し、適切に対応いたします。')
    ).toBeInTheDocument()
  })

  it('チェックサークルアイコン（SVG）を表示する', () => {
    const { container } = render(<ReportSuccessView />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    // 円とチェックマークパスが存在する
    expect(svg?.querySelector('circle')).toBeInTheDocument()
    expect(svg?.querySelector('path')).toBeInTheDocument()
  })
})
