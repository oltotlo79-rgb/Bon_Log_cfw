import { render, screen } from '../../utils/test-utils'
import { MaffUnverifiedBadge } from '@/components/pesticide/MaffUnverifiedBadge'

describe('MaffUnverifiedBadge', () => {
  it('show=false の場合は何も表示しない', () => {
    const { container } = render(<MaffUnverifiedBadge show={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('show=true の場合に見出し「登録番号は未掲載です」を表示する', () => {
    render(<MaffUnverifiedBadge show />)
    expect(screen.getByText('登録番号は未掲載です')).toBeInTheDocument()
  })

  it('MAFF リンクのテキスト「農林水産省の農薬登録情報提供システム」を含む', () => {
    render(<MaffUnverifiedBadge show />)
    expect(screen.getByText('農林水産省の農薬登録情報提供システム')).toBeInTheDocument()
  })

  it('MAFF リンクが正しい href を持つ', () => {
    render(<MaffUnverifiedBadge show />)
    const link = screen.getByRole('link', { name: '農林水産省の農薬登録情報提供システム' })
    expect(link).toHaveAttribute('href', 'https://pesticide.maff.go.jp/')
  })

  it('MAFF リンクが新しいタブで開く（target=_blank / rel=noopener noreferrer）', () => {
    render(<MaffUnverifiedBadge show />)
    const link = screen.getByRole('link', { name: '農林水産省の農薬登録情報提供システム' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('「この製品の農薬登録番号は当サイトで確認できていません」の文言を含む', () => {
    render(<MaffUnverifiedBadge show />)
    expect(screen.getByText(/この製品の農薬登録番号は当サイトで確認できていません/)).toBeInTheDocument()
  })

  it('「最新の登録情報をご確認ください」の文言を含む', () => {
    render(<MaffUnverifiedBadge show />)
    expect(screen.getByText(/最新の登録情報をご確認ください/)).toBeInTheDocument()
  })
})
