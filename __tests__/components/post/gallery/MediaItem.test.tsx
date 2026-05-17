import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../../utils/test-utils'
import { MediaItem } from '@/components/post/gallery/MediaItem'
import type { Media } from '@/components/post/gallery/types'

describe('MediaItem', () => {
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

  it('画像タイプの場合にimg要素をレンダリングする', () => {
    render(<MediaItem media={imageMedia} index={0} />)
    const img = screen.getByAltText('投稿画像 1')
    expect(img).toBeInTheDocument()
    expect(img.tagName).toBe('IMG')
  })

  it('動画タイプの場合にvideo要素をレンダリングする', () => {
    const { container } = render(<MediaItem media={videoMedia} />)
    const video = container.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src', videoMedia.url)
    expect(video).toHaveAttribute('controls')
  })

  it('画像読み込み前にスケルトンを表示する', () => {
    const { container } = render(<MediaItem media={imageMedia} />)
    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
  })

  it('画像のonLoad後にスケルトンが消える', () => {
    const { container } = render(<MediaItem media={imageMedia} />)
    const img = screen.getByAltText('投稿画像 1')

    // onLoad発火前はスケルトンあり
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()

    // onLoad発火
    fireEvent.load(img)

    // スケルトンが消える
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
  })

  it('動画クリック時にイベント伝播を停止する', () => {
    const parentClick = vi.fn()
    const { container } = render(
      <div onClick={parentClick}>
        <MediaItem media={videoMedia} />
      </div>
    )
    const video = container.querySelector('video')!
    fireEvent.click(video)
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('indexに応じたalt属性を設定する', () => {
    render(<MediaItem media={imageMedia} index={2} />)
    expect(screen.getByAltText('投稿画像 3')).toBeInTheDocument()
  })

  it('indexのデフォルト値が0で、alt属性が「投稿画像 1」になる', () => {
    render(<MediaItem media={imageMedia} />)
    expect(screen.getByAltText('投稿画像 1')).toBeInTheDocument()
  })
})
