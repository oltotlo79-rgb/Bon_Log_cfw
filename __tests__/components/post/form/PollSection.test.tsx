import { vi } from 'vitest'
import { render, screen } from '../../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PollSection } from '@/components/post/form/PollSection'

const defaultProps = {
  isActive: false,
  options: ['', ''],
  duration: 86400,
  onToggle: vi.fn(),
  onOptionsChange: vi.fn(),
  onDurationChange: vi.fn(),
}

describe('PollSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('非アクティブ時にアンケート追加ボタンが表示される', () => {
    render(<PollSection {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'アンケートを追加' })).toBeInTheDocument()
  })

  it('非アクティブ時にフォームが表示されない', () => {
    render(<PollSection {...defaultProps} />)
    expect(screen.queryByText('アンケート')).not.toBeInTheDocument()
  })

  it('追加ボタンクリックでonToggleが呼ばれる', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<PollSection {...defaultProps} onToggle={onToggle} />)
    await user.click(screen.getByRole('button', { name: 'アンケートを追加' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('アクティブ時にアンケートフォームが表示される', () => {
    render(<PollSection {...defaultProps} isActive={true} />)
    expect(screen.getByText('アンケート')).toBeInTheDocument()
  })

  it('アクティブ時に選択肢入力フィールドが表示される', () => {
    render(<PollSection {...defaultProps} isActive={true} />)
    const inputs = screen.getAllByPlaceholderText(/選択肢/)
    expect(inputs.length).toBe(2)
  })

  it('選択肢入力でonOptionsChangeが呼ばれる', async () => {
    const onOptionsChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PollSection
        {...defaultProps}
        isActive={true}
        onOptionsChange={onOptionsChange}
      />
    )
    await user.type(screen.getByPlaceholderText('選択肢 1'), 'テスト選択肢')
    expect(onOptionsChange).toHaveBeenCalled()
  })

  it('選択肢追加ボタンをクリックするとonOptionsChangeが呼ばれる', async () => {
    const onOptionsChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PollSection
        {...defaultProps}
        isActive={true}
        onOptionsChange={onOptionsChange}
      />
    )
    await user.click(screen.getByText('選択肢を追加'))
    expect(onOptionsChange).toHaveBeenCalledWith(['', '', ''])
  })

  it('10個の選択肢では追加ボタンが表示されない', () => {
    const tenOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
    render(
      <PollSection
        {...defaultProps}
        isActive={true}
        options={tenOptions}
      />
    )
    expect(screen.queryByText('選択肢を追加')).not.toBeInTheDocument()
  })

  it('投票期間セレクトが表示される', () => {
    render(<PollSection {...defaultProps} isActive={true} />)
    expect(screen.getByText('投票期間:')).toBeInTheDocument()
  })

  it('投票期間の変更でonDurationChangeが呼ばれる', async () => {
    const onDurationChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PollSection
        {...defaultProps}
        isActive={true}
        onDurationChange={onDurationChange}
      />
    )
    const select = screen.getByDisplayValue('1日')
    await user.selectOptions(select, '604800')
    expect(onDurationChange).toHaveBeenCalledWith(604800)
  })

  it('閉じるボタンクリックでonToggleが呼ばれる', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(
      <PollSection
        {...defaultProps}
        isActive={true}
        onToggle={onToggle}
      />
    )
    const closeButton = screen.getAllByRole('button')[0]
    await user.click(closeButton)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('3つの選択肢から削除するとonOptionsChangeが呼ばれる', async () => {
    const onOptionsChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PollSection
        {...defaultProps}
        isActive={true}
        options={['A', 'B', 'C']}
        onOptionsChange={onOptionsChange}
      />
    )
    const allButtons = screen.getAllByRole('button')
    await user.click(allButtons[1])
    expect(onOptionsChange).toHaveBeenCalledWith(['B', 'C'])
  })

  it('デフォルトで1日の投票期間が選択されている', () => {
    render(<PollSection {...defaultProps} isActive={true} duration={86400} />)
    expect(screen.getByDisplayValue('1日')).toBeInTheDocument()
  })

  it('2つの選択肢では削除ボタンが表示されない', () => {
    render(<PollSection {...defaultProps} isActive={true} />)
    const buttons = screen.getAllByRole('button')
    // 閉じるボタン + 追加ボタン = 2つのみ（削除ボタンなし）
    expect(buttons.length).toBe(2)
  })

  it('既存の選択肢値が入力欄に表示される', () => {
    render(
      <PollSection
        {...defaultProps}
        isActive={true}
        options={['黒松', '五葉松']}
      />
    )
    expect(screen.getByDisplayValue('黒松')).toBeInTheDocument()
    expect(screen.getByDisplayValue('五葉松')).toBeInTheDocument()
  })
})
