import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../../utils/test-utils'
import { ModalMediaItem } from '@/components/post/gallery/ModalMediaItem'
import type { Media } from '@/components/post/gallery/types'

describe('ModalMediaItem', () => {
  const imageMedia: Media = {
    id: 'img-1',
    url: 'https://example.com/photo.jpg',
    type: 'image',
    sortOrder: 0,
  }

  const videoMedia: Media = {
    id: 'vid-1',
    url: 'https://example.com/video.mp4',
    type: 'video',
    sortOrder: 0,
  }

  const mockOnClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('画像タイプの場合にimg要素をレンダリングする', () => {
    render(<ModalMediaItem media={imageMedia} onClick={mockOnClick} />)
    const img = screen.getByAltText('投稿画像の拡大表示')
    expect(img).toBeInTheDocument()
    expect(img.tagName).toBe('IMG')
  })

  it('動画タイプの場合にautoPlay付きのvideo要素をレンダリングする', () => {
    const { container } = render(<ModalMediaItem media={videoMedia} onClick={mockOnClick} />)
    const video = container.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src', videoMedia.url)
    expect(video).toHaveAttribute('autoplay')
    expect(video).toHaveAttribute('controls')
  })

  it('動画クリック時にイベント伝播を停止する', () => {
    const parentClick = vi.fn()
    const { container } = render(
      <div onClick={parentClick}>
        <ModalMediaItem media={videoMedia} onClick={mockOnClick} />
      </div>
    )
    const video = container.querySelector('video')!
    fireEvent.click(video)
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('画像クリック時にonClickハンドラが呼ばれる', () => {
    render(<ModalMediaItem media={imageMedia} onClick={mockOnClick} />)
    const img = screen.getByAltText('投稿画像の拡大表示')
    fireEvent.click(img)
    expect(mockOnClick).toHaveBeenCalled()
  })
})
