import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../../utils/test-utils'
import { createRef } from 'react'
import { MediaUploadSection } from '@/components/post/form/MediaUploadSection'

function makeRef(el: HTMLInputElement | null = null) {
  const ref = createRef<HTMLInputElement | null>()
  // @ts-expect-error - setting current directly for testing
  ref.current = el
  return ref
}

const defaultProps = {
  mediaFiles: [],
  uploading: false,
  uploadProgress: 0,
  onFileSelect: vi.fn(),
  onRemove: vi.fn(),
  fileInputRef: makeRef(),
  maxTotal: 4,
}

describe('MediaUploadSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ファイル選択入力が非表示で存在する', () => {
    const { container } = render(<MediaUploadSection {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
    expect(fileInput).toHaveClass('hidden')
  })

  it('ファイル入力がimage/video形式を受け付ける', () => {
    const { container } = render(<MediaUploadSection {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime')
  })

  it('メディア追加ボタンが表示される', () => {
    render(<MediaUploadSection {...defaultProps} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('メディアファイルがない場合はプレビューが表示されない', () => {
    const { container } = render(<MediaUploadSection {...defaultProps} />)
    expect(container.querySelector('.relative.aspect-video')).not.toBeInTheDocument()
  })

  it('画像ファイルがある場合はプレビューが表示される', () => {
    const mediaFiles = [{ url: '/test.jpg', type: 'image' }]
    const { container } = render(
      <MediaUploadSection {...defaultProps} mediaFiles={mediaFiles} />
    )
    expect(container.querySelector('.relative.aspect-video')).toBeInTheDocument()
  })

  it('動画ファイルがある場合はvideoタグが表示される', () => {
    const mediaFiles = [{ url: '/test.mp4', type: 'video' }]
    const { container } = render(
      <MediaUploadSection {...defaultProps} mediaFiles={mediaFiles} />
    )
    expect(container.querySelector('video')).toBeInTheDocument()
  })

  it('メディア削除ボタンをクリックするとonRemoveが呼ばれる', () => {
    const onRemove = vi.fn()
    const mediaFiles = [{ url: '/test.jpg', type: 'image' }]
    const { container } = render(
      <MediaUploadSection {...defaultProps} mediaFiles={mediaFiles} onRemove={onRemove} />
    )
    const removeBtn = container.querySelector('.relative.aspect-video button')
    if (removeBtn) {
      fireEvent.click(removeBtn)
    }
    expect(onRemove).toHaveBeenCalledWith(0)
  })

  it('複数のメディアファイルがある場合はgrid-cols-2が適用される', () => {
    const mediaFiles = [
      { url: '/test1.jpg', type: 'image' },
      { url: '/test2.jpg', type: 'image' },
    ]
    const { container } = render(
      <MediaUploadSection {...defaultProps} mediaFiles={mediaFiles} />
    )
    const grid = container.querySelector('.grid-cols-2')
    expect(grid).toBeInTheDocument()
  })

  it('disabledがtrueの場合にメディア追加ボタンが無効化される', () => {
    render(<MediaUploadSection {...defaultProps} disabled={true} />)
    const buttons = screen.getAllByRole('button')
    const mediaButton = buttons.find(btn => !btn.closest('.relative'))
    expect(mediaButton).toBeDisabled()
  })

  it('uploadingがtrueの場合にメディア追加ボタンが無効化される', () => {
    render(<MediaUploadSection {...defaultProps} uploading={true} />)
    const buttons = screen.getAllByRole('button')
    const mediaButton = buttons.find(btn => !btn.closest('.relative'))
    expect(mediaButton).toBeDisabled()
  })

  it('mediaFilesの数がmaxTotalに達した場合にメディア追加ボタンが無効化される', () => {
    const mediaFiles = [
      { url: '/1.jpg', type: 'image' },
      { url: '/2.jpg', type: 'image' },
      { url: '/3.jpg', type: 'image' },
      { url: '/4.jpg', type: 'image' },
    ]
    render(
      <MediaUploadSection {...defaultProps} mediaFiles={mediaFiles} maxTotal={4} />
    )
    const buttons = screen.getAllByRole('button')
    const mediaButton = buttons.find(btn => !btn.closest('.relative'))
    expect(mediaButton).toBeDisabled()
  })

  it('uploadingがtrueの場合にプログレスバーが表示される', () => {
    render(
      <MediaUploadSection
        {...defaultProps}
        uploading={true}
        uploadProgress={50}
      />
    )
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('uploadingがfalseの場合にプログレスバーが表示されない', () => {
    render(
      <MediaUploadSection
        {...defaultProps}
        uploading={false}
        uploadProgress={50}
      />
    )
    expect(screen.queryByText('50%')).not.toBeInTheDocument()
  })

  it('ファイル選択時にonFileSelectが呼ばれる', () => {
    const onFileSelect = vi.fn()
    const { container } = render(
      <MediaUploadSection {...defaultProps} onFileSelect={onFileSelect} />
    )
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    fireEvent.change(fileInput)
    expect(onFileSelect).toHaveBeenCalled()
  })

  it('multipleファイル選択が有効', () => {
    const { container } = render(<MediaUploadSection {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('multiple')
  })
})
