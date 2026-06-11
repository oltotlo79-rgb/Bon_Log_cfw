import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../../utils/test-utils'
import { ContentInputSection } from '@/components/post/form/ContentInputSection'
import type { MediaFile } from '@/components/post/hooks/useMediaUpload'

const defaultMediaFiles: MediaFile[] = []

const defaultProps = {
  content: '',
  onChange: vi.fn(),
  maxLength: 500,
  mediaFiles: defaultMediaFiles,
  onMediaRemove: vi.fn(),
}

describe('ContentInputSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('テキストエリアが表示される', () => {
    render(<ContentInputSection {...defaultProps} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('プレースホルダーが表示される', () => {
    render(
      <ContentInputSection
        {...defaultProps}
        placeholder="いまどうしてる？"
      />
    )
    expect(screen.getByPlaceholderText('いまどうしてる？')).toBeInTheDocument()
  })

  it('contentの値がテキストエリアに表示される', () => {
    render(
      <ContentInputSection
        {...defaultProps}
        content="テスト投稿"
      />
    )
    expect(screen.getByRole('textbox')).toHaveValue('テスト投稿')
  })

  it('テキストを入力するとonChangeが呼ばれる', () => {
    const onChange = vi.fn()
    render(
      <ContentInputSection
        {...defaultProps}
        onChange={onChange}
      />
    )
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '新しいテキスト' } })
    expect(onChange).toHaveBeenCalledWith('新しいテキスト')
  })

  it('maxLengthがテキストエリアに設定される', () => {
    render(
      <ContentInputSection
        {...defaultProps}
        maxLength={300}
      />
    )
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('maxLength', '300')
  })

  it('data-testidが設定される', () => {
    render(
      <ContentInputSection
        {...defaultProps}
        data-testid="content-input"
      />
    )
    expect(screen.getByTestId('content-input')).toBeInTheDocument()
  })

  it('メディアファイルがない場合はプレビューが表示されない', () => {
    const { container } = render(
      <ContentInputSection
        {...defaultProps}
        mediaFiles={[]}
      />
    )
    expect(container.querySelector('.relative.aspect-video')).not.toBeInTheDocument()
  })

  it('メディアファイルがある場合はプレビューが表示される', () => {
    const mediaFiles: MediaFile[] = [
      { url: '/test.jpg', type: 'image' },
    ]
    const { container } = render(
      <ContentInputSection
        {...defaultProps}
        mediaFiles={mediaFiles}
      />
    )
    expect(container.querySelector('.relative.aspect-video')).toBeInTheDocument()
  })

  it('メディア削除ボタンをクリックするとonMediaRemoveが呼ばれる', () => {
    const onMediaRemove = vi.fn()
    const mediaFiles: MediaFile[] = [
      { url: '/test.jpg', type: 'image' },
    ]
    const { container } = render(
      <ContentInputSection
        {...defaultProps}
        mediaFiles={mediaFiles}
        onMediaRemove={onMediaRemove}
      />
    )
    const removeBtn = container.querySelector('.relative.aspect-video button')
    if (removeBtn) {
      fireEvent.click(removeBtn)
    }
    expect(onMediaRemove).toHaveBeenCalledWith(0)
  })

  it('rowsプロパティがテキストエリアに設定される', () => {
    render(
      <ContentInputSection
        {...defaultProps}
        rows={5}
      />
    )
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('rows', '5')
  })
})
