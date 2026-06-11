import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { MediaPreviewGrid } from '@/components/post/MediaPreviewGrid'

// next/image モック
// Why: `fill` などの next/image 固有 boolean props を img へ流すと React が
// `Received true for a non-boolean attribute fill` 警告を出すため除去する。
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fill,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    priority,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    quality,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    placeholder,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    blurDataURL,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    loader,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    unoptimized,
    ...props
  }: {
    src: string
    alt: string
    fill?: boolean
    priority?: boolean
    quality?: number
    placeholder?: string
    blurDataURL?: string
    loader?: unknown
    unoptimized?: boolean
    [key: string]: unknown
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="next-image" {...props} />
  ),
}))

describe('MediaPreviewGrid', () => {
  const mockOnRemove = vi.fn()

  it('mediaFilesが空の場合、何もレンダリングしないこと', () => {
    const { container } = render(
      <MediaPreviewGrid mediaFiles={[]} onRemove={mockOnRemove} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('画像ファイルのプレビューを表示すること', () => {
    const mediaFiles = [
      { url: '/image1.jpg', type: 'image' },
      { url: '/image2.jpg', type: 'image' },
    ]

    render(
      <MediaPreviewGrid mediaFiles={mediaFiles} onRemove={mockOnRemove} />
    )

    const images = screen.getAllByTestId('next-image')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute('src', '/image1.jpg')
    expect(images[1]).toHaveAttribute('src', '/image2.jpg')
  })

  it('動画ファイルのプレビューを表示すること', () => {
    const mediaFiles = [
      { url: '/video1.mp4', type: 'video' },
    ]

    const { container } = render(
      <MediaPreviewGrid mediaFiles={mediaFiles} onRemove={mockOnRemove} />
    )

    const video = container.querySelector('video')
    expect(video).toBeTruthy()
    expect(video).toHaveAttribute('src', '/video1.mp4')
  })

  it('画像と動画が混在する場合に正しくレンダリングすること', () => {
    const mediaFiles = [
      { url: '/image1.jpg', type: 'image' },
      { url: '/video1.mp4', type: 'video' },
    ]

    const { container } = render(
      <MediaPreviewGrid mediaFiles={mediaFiles} onRemove={mockOnRemove} />
    )

    const images = screen.getAllByTestId('next-image')
    expect(images).toHaveLength(1)

    const video = container.querySelector('video')
    expect(video).toBeTruthy()
  })

  it('削除ボタンをクリックするとonRemoveが正しいインデックスで呼ばれること', () => {
    const mediaFiles = [
      { url: '/image1.jpg', type: 'image' },
      { url: '/image2.jpg', type: 'image' },
    ]

    render(
      <MediaPreviewGrid mediaFiles={mediaFiles} onRemove={mockOnRemove} />
    )

    const removeButtons = screen.getAllByRole('button')
    expect(removeButtons).toHaveLength(2)

    // 2番目の削除ボタンをクリック
    removeButtons[1]!.click()
    expect(mockOnRemove).toHaveBeenCalledWith(1)

    // 1番目の削除ボタンをクリック
    removeButtons[0]!.click()
    expect(mockOnRemove).toHaveBeenCalledWith(0)
  })

  it('ファイルが1つの場合、grid-cols-2クラスが適用されないこと', () => {
    const mediaFiles = [
      { url: '/image1.jpg', type: 'image' },
    ]

    const { container } = render(
      <MediaPreviewGrid mediaFiles={mediaFiles} onRemove={mockOnRemove} />
    )

    const grid = container.firstChild as HTMLElement
    expect(grid.className).not.toContain('grid-cols-2')
  })

  it('ファイルが複数の場合、grid-cols-2クラスが適用されること', () => {
    const mediaFiles = [
      { url: '/image1.jpg', type: 'image' },
      { url: '/image2.jpg', type: 'image' },
    ]

    const { container } = render(
      <MediaPreviewGrid mediaFiles={mediaFiles} onRemove={mockOnRemove} />
    )

    const grid = container.firstChild as HTMLElement
    expect(grid.className).toContain('grid-cols-2')
  })
})
