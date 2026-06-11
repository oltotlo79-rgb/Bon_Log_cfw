/**
 * ImageGallery.tsx の未カバーブランチを補完するテスト
 *
 * 対象:
 * - グリッドレイアウト: 1/2/3/4枚のレイアウト切替
 * - モーダル: 開閉、キーボードナビ、prev/next境界チェック
 * - onMediaClick: カスタムハンドラ使用時
 * - 動画: 拡大ボタンクリック
 */

import { vi, describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageGallery } from '@/components/post/ImageGallery'

// Sub-componentsのモック
vi.mock('@/components/post/gallery/MediaItem', () => ({
  MediaItem: ({ media }: { media: { id: string; type: string } }) => (
    <div data-testid={`media-${media.id}`}>{media.type}</div>
  ),
}))

vi.mock('@/components/post/gallery/ModalMediaItem', () => ({
  ModalMediaItem: ({ media, onClick }: { media: { id: string }; onClick: (e: React.MouseEvent) => void }) => (
    <div data-testid={`modal-media-${media.id}`} onClick={onClick}>Modal</div>
  ),
}))

const makeImage = (id: string, sortOrder: number, type: 'image' | 'video' = 'image') => ({
  id,
  url: `/${id}.jpg`,
  type,
  sortOrder,
})

describe('ImageGallery - レイアウト', () => {
  it('1枚の画像でグリッドクラスなし', () => {
    const { container } = render(
      <ImageGallery images={[makeImage('1', 0)]} />
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).not.toContain('grid-cols-2')
  })

  it('2枚の画像で2列グリッド', () => {
    const { container } = render(
      <ImageGallery images={[makeImage('1', 0), makeImage('2', 1)]} />
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toContain('grid-cols-2')
  })

  it('3枚の画像で2列グリッド', () => {
    const { container } = render(
      <ImageGallery images={[makeImage('1', 0), makeImage('2', 1), makeImage('3', 2)]} />
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toContain('grid-cols-2')
  })

  it('4枚の画像で2列グリッド', () => {
    const { container } = render(
      <ImageGallery images={[makeImage('1', 0), makeImage('2', 1), makeImage('3', 2), makeImage('4', 3)]} />
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toContain('grid-cols-2')
  })

  it('sortOrderに基づいてソートされる', () => {
    render(
      <ImageGallery images={[makeImage('b', 1), makeImage('a', 0)]} />
    )
    const mediaItems = screen.getAllByTestId(/^media-/)
    expect(mediaItems[0]).toHaveAttribute('data-testid', 'media-a')
    expect(mediaItems[1]).toHaveAttribute('data-testid', 'media-b')
  })
})

describe('ImageGallery - モーダル', () => {
  it('画像クリックでモーダルが開く', async () => {
    const user = userEvent.setup()
    render(
      <ImageGallery images={[makeImage('1', 0), makeImage('2', 1)]} />
    )

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0]!)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('閉じる')).toBeInTheDocument()
  })

  it('閉じるボタンでモーダルが閉じる', async () => {
    const user = userEvent.setup()
    render(
      <ImageGallery images={[makeImage('1', 0), makeImage('2', 1)]} />
    )

    await user.click(screen.getAllByRole('button')[0]!)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByLabelText('閉じる'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('次へ/前へボタンでナビゲーションできる', async () => {
    const user = userEvent.setup()
    render(
      <ImageGallery images={[makeImage('1', 0), makeImage('2', 1), makeImage('3', 2)]} />
    )

    // 最初の画像をクリック
    await user.click(screen.getAllByRole('button')[0]!)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // 最初の画像では「前へ」ボタンが非表示
    expect(screen.queryByLabelText('前の画像')).not.toBeInTheDocument()
    expect(screen.getByLabelText('次の画像')).toBeInTheDocument()

    // 次へ
    await user.click(screen.getByLabelText('次の画像'))
    // 2枚目: 前へ・次への両方が表示
    expect(screen.getByLabelText('前の画像')).toBeInTheDocument()
    expect(screen.getByLabelText('次の画像')).toBeInTheDocument()

    // さらに次へ（最後の画像）
    await user.click(screen.getByLabelText('次の画像'))
    // 最後の画像では「次へ」ボタンが非表示
    expect(screen.getByLabelText('前の画像')).toBeInTheDocument()
    expect(screen.queryByLabelText('次の画像')).not.toBeInTheDocument()
  })

  it('Escapeキーでモーダルが閉じる', async () => {
    const user = userEvent.setup()
    render(
      <ImageGallery images={[makeImage('1', 0), makeImage('2', 1)]} />
    )

    await user.click(screen.getAllByRole('button')[0]!)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ArrowLeftキーで前の画像に移動', async () => {
    const user = userEvent.setup()
    render(
      <ImageGallery images={[makeImage('1', 0), makeImage('2', 1)]} />
    )

    // 2枚目を開く
    await user.click(screen.getAllByRole('button')[1]!)
    expect(screen.getByTestId('modal-media-2')).toBeInTheDocument()

    // ArrowLeftで1枚目に
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' })
    expect(screen.getByTestId('modal-media-1')).toBeInTheDocument()
  })

  it('ArrowRightキーで次の画像に移動', async () => {
    const user = userEvent.setup()
    render(
      <ImageGallery images={[makeImage('1', 0), makeImage('2', 1)]} />
    )

    await user.click(screen.getAllByRole('button')[0]!)
    expect(screen.getByTestId('modal-media-1')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })
    expect(screen.getByTestId('modal-media-2')).toBeInTheDocument()
  })

  it('ArrowLeft on first image does nothing', async () => {
    const user = userEvent.setup()
    render(
      <ImageGallery images={[makeImage('1', 0), makeImage('2', 1)]} />
    )

    await user.click(screen.getAllByRole('button')[0]!)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' })
    expect(screen.getByTestId('modal-media-1')).toBeInTheDocument()
  })

  it('ArrowRight on last image does nothing', async () => {
    const user = userEvent.setup()
    render(
      <ImageGallery images={[makeImage('1', 0), makeImage('2', 1)]} />
    )

    await user.click(screen.getAllByRole('button')[1]!)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })
    expect(screen.getByTestId('modal-media-2')).toBeInTheDocument()
  })

  it('ナビゲーションドットで画像を直接選択できる', async () => {
    const user = userEvent.setup()
    render(
      <ImageGallery images={[makeImage('1', 0), makeImage('2', 1), makeImage('3', 2)]} />
    )

    await user.click(screen.getAllByRole('button')[0]!)
    expect(screen.getByTestId('modal-media-1')).toBeInTheDocument()

    // 3番目のドットをクリック
    await user.click(screen.getByLabelText('画像 3 を表示'))
    expect(screen.getByTestId('modal-media-3')).toBeInTheDocument()
  })

  it('1枚の場合はナビゲーションドットが表示されない', async () => {
    const user = userEvent.setup()
    render(
      <ImageGallery images={[makeImage('1', 0)]} />
    )

    await user.click(screen.getAllByRole('button')[0]!)
    expect(screen.queryByLabelText(/画像 \d+ を表示/)).not.toBeInTheDocument()
  })
})

describe('ImageGallery - onMediaClick', () => {
  it('onMediaClickが指定されている場合はモーダルを開かない', async () => {
    const handler = vi.fn()
    const user = userEvent.setup()
    render(
      <ImageGallery images={[makeImage('1', 0)]} onMediaClick={handler} />
    )

    await user.click(screen.getAllByRole('button')[0]!)

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('ImageGallery - 動画', () => {
  it('動画の拡大ボタンでモーダルが開く', async () => {
    const user = userEvent.setup()
    render(
      <ImageGallery images={[makeImage('vid1', 0, 'video')]} />
    )

    // 拡大ボタンをクリック
    await user.click(screen.getByTitle('拡大表示'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('動画にonMediaClickが指定されている場合はカスタムハンドラを呼ぶ', async () => {
    const handler = vi.fn()
    const user = userEvent.setup()
    render(
      <ImageGallery images={[makeImage('vid1', 0, 'video')]} onMediaClick={handler} />
    )

    await user.click(screen.getByTitle('拡大表示'))

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'vid1', type: 'video' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('3枚構成の1枚目が動画の場合row-span-2クラスが適用される', () => {
    const { container } = render(
      <ImageGallery
        images={[
          makeImage('vid1', 0, 'video'),
          makeImage('2', 1),
          makeImage('3', 2),
        ]}
      />
    )

    const videoContainer = container.querySelector('[class*="row-span-2"]')
    expect(videoContainer).toBeInTheDocument()
  })
})
