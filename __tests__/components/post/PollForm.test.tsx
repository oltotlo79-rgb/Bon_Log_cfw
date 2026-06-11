import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PollForm } from '@/components/post/PollForm'

const defaultProps = {
  isActive: false,
  onToggle: vi.fn(),
  options: ['', ''],
  onOptionsChange: vi.fn(),
  duration: 86400,
  onDurationChange: vi.fn(),
}

describe('PollForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 非アクティブ状態
  it('非アクティブ時にアンケート追加ボタンが表示される', () => {
    render(<PollForm {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'アンケートを追加' })).toBeInTheDocument()
  })

  it('非アクティブ時にフォームは表示されない', () => {
    render(<PollForm {...defaultProps} />)
    expect(screen.queryByText('アンケート')).not.toBeInTheDocument()
  })

  it('追加ボタンクリックでonToggleが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<PollForm {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'アンケートを追加' }))
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1)
  })

  // アクティブ状態
  it('アクティブ時にフォームが表示される', () => {
    render(<PollForm {...defaultProps} isActive={true} />)
    expect(screen.getByText('アンケート')).toBeInTheDocument()
  })

  it('アクティブ時に選択肢入力フィールドが表示される', () => {
    render(<PollForm {...defaultProps} isActive={true} />)
    const inputs = screen.getAllByPlaceholderText(/選択肢/)
    expect(inputs.length).toBe(2)
  })

  it('選択肢1のプレースホルダーが正しい', () => {
    render(<PollForm {...defaultProps} isActive={true} />)
    expect(screen.getByPlaceholderText('選択肢 1')).toBeInTheDocument()
  })

  it('選択肢2のプレースホルダーが正しい', () => {
    render(<PollForm {...defaultProps} isActive={true} />)
    expect(screen.getByPlaceholderText('選択肢 2')).toBeInTheDocument()
  })

  it('投票期間セレクトが表示される', () => {
    render(<PollForm {...defaultProps} isActive={true} />)
    expect(screen.getByText('投票期間:')).toBeInTheDocument()
  })

  it('選択肢追加ボタンが表示される', () => {
    render(<PollForm {...defaultProps} isActive={true} />)
    expect(screen.getByText('選択肢を追加')).toBeInTheDocument()
  })

  // 選択肢操作
  it('選択肢の入力でonOptionsChangeが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<PollForm {...defaultProps} isActive={true} />)
    await user.type(screen.getByPlaceholderText('選択肢 1'), 'テスト')
    expect(defaultProps.onOptionsChange).toHaveBeenCalled()
  })

  it('選択肢追加ボタンクリックでonOptionsChangeが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<PollForm {...defaultProps} isActive={true} />)
    await user.click(screen.getByText('選択肢を追加'))
    expect(defaultProps.onOptionsChange).toHaveBeenCalledWith(['', '', ''])
  })

  it('2つの選択肢では削除ボタンが表示されない', () => {
    render(<PollForm {...defaultProps} isActive={true} />)
    // XIconボタンは閉じるボタンのみ（削除ボタンはなし）
    const buttons = screen.getAllByRole('button')
    // 閉じるボタン + 追加ボタン = 2つのみ
    // 削除ボタンは選択肢が3つ以上の場合のみ表示
    expect(buttons.length).toBe(2) // 閉じる + 追加
  })

  it('3つの選択肢では削除ボタンが表示される', () => {
    render(<PollForm {...defaultProps} isActive={true} options={['A', 'B', 'C']} />)
    const inputs = screen.getAllByPlaceholderText(/選択肢/)
    expect(inputs.length).toBe(3)
  })

  it('10個の選択肢では追加ボタンが表示されない', () => {
    const tenOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
    render(<PollForm {...defaultProps} isActive={true} options={tenOptions} />)
    expect(screen.queryByText('選択肢を追加')).not.toBeInTheDocument()
  })

  it('4つの選択肢でも追加ボタンが表示される', () => {
    render(<PollForm {...defaultProps} isActive={true} options={['A', 'B', 'C', 'D']} />)
    expect(screen.getByText('選択肢を追加')).toBeInTheDocument()
  })

  it('3つの選択肢から削除するとonOptionsChangeが呼ばれる', async () => {
    const onOptionsChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PollForm
        {...defaultProps}
        isActive={true}
        options={['A', 'B', 'C']}
        onOptionsChange={onOptionsChange}
      />
    )
    // 削除ボタンをクリック（最初の削除ボタン）
    const allButtons = screen.getAllByRole('button')
    // 閉じるボタン、3つの削除ボタン、追加ボタン
    // 削除ボタンは2番目以降
    await user.click(allButtons[1]!) // 最初の選択肢の削除
    expect(onOptionsChange).toHaveBeenCalledWith(['B', 'C'])
  })

  // 閉じるボタン
  it('閉じるボタンクリックでonToggleが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<PollForm {...defaultProps} isActive={true} />)
    // 最初のボタンが閉じるボタン（Xアイコン）
    const closeButton = screen.getAllByRole('button')[0]!
    await user.click(closeButton)
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1)
  })

  // 投票期間
  it('投票期間の変更でonDurationChangeが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<PollForm {...defaultProps} isActive={true} />)
    const select = screen.getByDisplayValue('1日')
    await user.selectOptions(select, '604800')
    expect(defaultProps.onDurationChange).toHaveBeenCalledWith(604800)
  })

  it('投票期間の選択肢が全て表示される', () => {
    render(<PollForm {...defaultProps} isActive={true} />)
    expect(screen.getByText('1時間')).toBeInTheDocument()
    expect(screen.getByText('6時間')).toBeInTheDocument()
    expect(screen.getByText('12時間')).toBeInTheDocument()
    expect(screen.getByText('1日')).toBeInTheDocument()
    expect(screen.getByText('3日')).toBeInTheDocument()
    expect(screen.getByText('7日')).toBeInTheDocument()
  })

  it('デフォルトで1日が選択されている', () => {
    render(<PollForm {...defaultProps} isActive={true} />)
    const select = screen.getByDisplayValue('1日')
    expect(select).toBeInTheDocument()
  })

  // 選択肢の値が表示される
  it('既存の選択肢値が入力欄に表示される', () => {
    render(
      <PollForm
        {...defaultProps}
        isActive={true}
        options={['黒松', '五葉松']}
      />
    )
    expect(screen.getByDisplayValue('黒松')).toBeInTheDocument()
    expect(screen.getByDisplayValue('五葉松')).toBeInTheDocument()
  })

  // 入力フィールドのmaxLength
  it('選択肢入力にmaxLengthが設定されている', () => {
    render(<PollForm {...defaultProps} isActive={true} />)
    const input = screen.getByPlaceholderText('選択肢 1')
    expect(input).toHaveAttribute('maxLength', '50')
  })

  // duration値の確認
  it('3時間の選択肢の値が正しい', () => {
    render(<PollForm {...defaultProps} isActive={true} duration={3600} />)
    const select = screen.getByDisplayValue('1時間')
    expect(select).toBeInTheDocument()
  })
})
