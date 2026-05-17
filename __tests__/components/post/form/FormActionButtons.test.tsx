import { vi } from 'vitest'
import { render, screen } from '../../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { FormActionButtons } from '@/components/post/form/FormActionButtons'

const defaultProps = {
  submitLoading: false,
  submitDisabled: false,
  charCount: 0,
  maxLength: 500,
}

describe('FormActionButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('投稿するボタンが表示される', () => {
    render(<FormActionButtons {...defaultProps} />)
    expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
  })

  it('残り文字数が表示される', () => {
    render(<FormActionButtons {...defaultProps} charCount={100} maxLength={500} />)
    expect(screen.getByText('400')).toBeInTheDocument()
  })

  it('初期状態（0文字）で残り文字数が500と表示される', () => {
    render(<FormActionButtons {...defaultProps} />)
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  it('submitDisabledがtrueの場合に投稿ボタンが無効化される', () => {
    render(<FormActionButtons {...defaultProps} submitDisabled={true} />)
    expect(screen.getByRole('button', { name: '投稿する' })).toBeDisabled()
  })

  it('submitLoadingがtrueの場合に"投稿中..."と表示される', () => {
    render(<FormActionButtons {...defaultProps} submitLoading={true} />)
    expect(screen.getByRole('button', { name: '投稿中...' })).toBeInTheDocument()
  })

  it('submitLoadingがtrueの場合に投稿ボタンが無効化される', () => {
    render(<FormActionButtons {...defaultProps} submitLoading={true} />)
    expect(screen.getByRole('button', { name: '投稿中...' })).toBeDisabled()
  })

  it('文字数がmaxLengthを超えると投稿ボタンが無効化される', () => {
    render(<FormActionButtons {...defaultProps} charCount={501} maxLength={500} />)
    expect(screen.getByRole('button', { name: '投稿する' })).toBeDisabled()
  })

  it('文字数がmaxLengthと等しい場合は投稿ボタンが有効', () => {
    render(<FormActionButtons {...defaultProps} charCount={500} maxLength={500} submitDisabled={false} />)
    expect(screen.getByRole('button', { name: '投稿する' })).not.toBeDisabled()
  })

  it('onSaveDraftが提供された場合に下書き保存ボタンが表示される', () => {
    render(
      <FormActionButtons
        {...defaultProps}
        onSaveDraft={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: '下書き保存' })).toBeInTheDocument()
  })

  it('onSaveDraftが提供されない場合に下書き保存ボタンが表示されない', () => {
    render(<FormActionButtons {...defaultProps} />)
    expect(screen.queryByRole('button', { name: '下書き保存' })).not.toBeInTheDocument()
  })

  it('下書き保存ボタンをクリックするとonSaveDraftが呼ばれる', async () => {
    const onSaveDraft = vi.fn()
    const user = userEvent.setup()
    render(
      <FormActionButtons
        {...defaultProps}
        onSaveDraft={onSaveDraft}
      />
    )
    await user.click(screen.getByRole('button', { name: '下書き保存' }))
    expect(onSaveDraft).toHaveBeenCalledTimes(1)
  })

  it('savingDraftがtrueの場合に"保存中..."と表示される', () => {
    render(
      <FormActionButtons
        {...defaultProps}
        onSaveDraft={vi.fn()}
        savingDraft={true}
      />
    )
    expect(screen.getByRole('button', { name: '保存中...' })).toBeInTheDocument()
  })

  it('savingDraftがtrueの場合に下書き保存ボタンが無効化される', () => {
    render(
      <FormActionButtons
        {...defaultProps}
        onSaveDraft={vi.fn()}
        savingDraft={true}
      />
    )
    expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled()
  })

  it('submitDisabledがtrueの場合に下書き保存ボタンも無効化される', () => {
    render(
      <FormActionButtons
        {...defaultProps}
        onSaveDraft={vi.fn()}
        submitDisabled={true}
      />
    )
    expect(screen.getByRole('button', { name: '下書き保存' })).toBeDisabled()
  })

  it('draftCountが0の場合に下書き一覧リンクが表示されない', () => {
    render(
      <FormActionButtons
        {...defaultProps}
        draftCount={0}
        draftHref="/drafts"
      />
    )
    expect(screen.queryByTitle('下書き一覧')).not.toBeInTheDocument()
  })

  it('draftCountが0より大きい場合に下書き一覧リンクが表示される', () => {
    render(
      <FormActionButtons
        {...defaultProps}
        draftCount={3}
        draftHref="/drafts"
      />
    )
    expect(screen.getByTitle('下書き一覧')).toBeInTheDocument()
  })

  it('draftHrefが設定されていない場合は下書き一覧リンクが表示されない', () => {
    render(
      <FormActionButtons
        {...defaultProps}
        draftCount={3}
      />
    )
    expect(screen.queryByTitle('下書き一覧')).not.toBeInTheDocument()
  })

  it('下書き一覧リンクのhrefが正しく設定される', () => {
    render(
      <FormActionButtons
        {...defaultProps}
        draftCount={1}
        draftHref="/drafts"
      />
    )
    const link = screen.getByTitle('下書き一覧')
    expect(link).toHaveAttribute('href', '/drafts')
  })

  it('残り文字数が負の場合に投稿ボタンが無効化される', () => {
    render(<FormActionButtons {...defaultProps} charCount={510} maxLength={500} />)
    expect(screen.getByRole('button', { name: '投稿する' })).toBeDisabled()
  })
})
