import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { TermDescriptionExpanded } from '@/components/dictionary/TermDescriptionExpanded'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

const SHORT_TEXT = 'これは短い説明です。'
const LONG_TEXT = 'あ'.repeat(501)
const EXACTLY_THRESHOLD_TEXT = 'あ'.repeat(500)

describe('TermDescriptionExpanded', () => {
  describe('閾値以下（500文字以下）', () => {
    it('短いテキストは展開ボタンなしで全文表示する', () => {
      render(<TermDescriptionExpanded description={SHORT_TEXT} />)
      expect(screen.getByText(SHORT_TEXT)).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('ちょうど閾値の文字数では展開ボタンを表示しない', () => {
      render(<TermDescriptionExpanded description={EXACTLY_THRESHOLD_TEXT} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('閾値超過（501文字以上）', () => {
    it('長いテキストは「続きを読む」ボタンを表示する', () => {
      render(<TermDescriptionExpanded description={LONG_TEXT} />)
      expect(screen.getByRole('button', { name: '続きを読む' })).toBeInTheDocument()
    })

    it('「続きを読む」クリックで「折りたたむ」に変わる', async () => {
      const user = userEvent.setup()
      render(<TermDescriptionExpanded description={LONG_TEXT} />)

      const expandBtn = screen.getByRole('button', { name: '続きを読む' })
      await user.click(expandBtn)

      expect(screen.getByRole('button', { name: '折りたたむ' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '続きを読む' })).not.toBeInTheDocument()
    })

    it('「折りたたむ」クリックで「続きを読む」に戻る', async () => {
      const user = userEvent.setup()
      render(<TermDescriptionExpanded description={LONG_TEXT} />)

      await user.click(screen.getByRole('button', { name: '続きを読む' }))
      await user.click(screen.getByRole('button', { name: '折りたたむ' }))

      expect(screen.getByRole('button', { name: '続きを読む' })).toBeInTheDocument()
    })

    it('テキスト本文は DOM に含まれる（SEO クローラー向け）', () => {
      render(<TermDescriptionExpanded description={LONG_TEXT} />)
      expect(screen.getByText(LONG_TEXT)).toBeInTheDocument()
    })
  })

  describe('collapseThreshold カスタム値', () => {
    it('collapseThreshold=10 のとき 11 文字で展開ボタンを表示する', () => {
      render(
        <TermDescriptionExpanded
          description={'あ'.repeat(11)}
          collapseThreshold={10}
        />
      )
      expect(screen.getByRole('button', { name: '続きを読む' })).toBeInTheDocument()
    })

    it('collapseThreshold=10 のとき 10 文字では展開ボタンを表示しない', () => {
      render(
        <TermDescriptionExpanded
          description={'あ'.repeat(10)}
          collapseThreshold={10}
        />
      )
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })
})
