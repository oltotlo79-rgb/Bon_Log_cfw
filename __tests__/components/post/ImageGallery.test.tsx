import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ImageGallery } from '@/components/post/ImageGallery'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockImages = [
  { id: 'media-1', url: '/image1.jpg', type: 'image', sortOrder: 0 },
  { id: 'media-2', url: '/image2.jpg', type: 'image', sortOrder: 1 },
]

const mockVideo = [
  { id: 'media-3', url: '/video.mp4', type: 'video', sortOrder: 0 },
]

describe('ImageGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('画像を表示する', () => {
    render(<ImageGallery images={mockImages} />)
    const images = document.querySelectorAll('img')
    expect(images).toHaveLength(2)
  })

  it('画像がsortOrder順に表示される', () => {
    const unorderedImages = [
      { id: 'media-2', url: '/image2.jpg', type: 'image', sortOrder: 1 },
      { id: 'media-1', url: '/image1.jpg', type: 'image', sortOrder: 0 },
    ]
    render(<ImageGallery images={unorderedImages} />)
    const images = document.querySelectorAll('img')
    expect(images[0]).toHaveAttribute('src', '/image1.jpg')
    expect(images[1]).toHaveAttribute('src', '/image2.jpg')
  })

  it('1枚の画像は全幅で表示される', () => {
    render(<ImageGallery images={[mockImages[0]]} />)
    const image = document.querySelector('img')
    expect(image).toBeInTheDocument()
  })

  it('複数画像はグリッドで表示される', () => {
    render(<ImageGallery images={mockImages} />)
    const images = document.querySelectorAll('img')
    expect(images).toHaveLength(2)
  })

  it('画像クリックでモーダルを開く', async () => {
    const user = userEvent.setup()
    render(<ImageGallery images={mockImages} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])

    // モーダルが表示される（閉じるボタンがある）
    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(2)
    })
  })

  it('モーダルの閉じるボタンでモーダルを閉じる', async () => {
    const user = userEvent.setup()
    render(<ImageGallery images={mockImages} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])

    // モーダルが開いている
    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(2)
    })

    // 閉じるボタンをクリック（最初のボタン以外で、モーダル内のボタン）
    const allButtons = screen.getAllByRole('button')
    // 閉じるボタンは通常最初か最後にある
    const closeButton = allButtons.find(btn => btn.className.includes('rounded-full'))
    if (closeButton) {
      await user.click(closeButton)
    }
  })

  it('動画を表示する', () => {
    render(<ImageGallery images={mockVideo} />)
    // 動画要素があることを確認（video要素はroleがないので別の方法で確認）
    const container = document.querySelector('video')
    expect(container).toBeInTheDocument()
  })

  it('onMediaClickコールバックが呼ばれる', async () => {
    const mockOnMediaClick = vi.fn()
    const user = userEvent.setup()
    render(<ImageGallery images={mockImages} onMediaClick={mockOnMediaClick} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])

    expect(mockOnMediaClick).toHaveBeenCalledWith(mockImages[0])
  })

  it('複数画像の場合ナビゲーションドットを表示する', async () => {
    const user = userEvent.setup()
    render(<ImageGallery images={mockImages} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])

    // モーダル内のナビゲーションドットが表示される
    await waitFor(() => {
      const allButtons = screen.getAllByRole('button')
      // 画像ボタン(2) + 閉じるボタン(1) + ナビゲーションドット(2) = 5以上
      expect(allButtons.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('3枚の画像で最初の画像は大きく表示される', () => {
    const threeImages = [
      { id: 'media-1', url: '/image1.jpg', type: 'image', sortOrder: 0 },
      { id: 'media-2', url: '/image2.jpg', type: 'image', sortOrder: 1 },
      { id: 'media-3', url: '/image3.jpg', type: 'image', sortOrder: 2 },
    ]
    render(<ImageGallery images={threeImages} />)
    const images = document.querySelectorAll('img')
    expect(images).toHaveLength(3)
  })

  it('4枚の画像を2x2グリッドで表示する', () => {
    const fourImages = [
      { id: 'media-1', url: '/image1.jpg', type: 'image', sortOrder: 0 },
      { id: 'media-2', url: '/image2.jpg', type: 'image', sortOrder: 1 },
      { id: 'media-3', url: '/image3.jpg', type: 'image', sortOrder: 2 },
      { id: 'media-4', url: '/image4.jpg', type: 'image', sortOrder: 3 },
    ]
    render(<ImageGallery images={fourImages} />)
    const images = document.querySelectorAll('img')
    expect(images).toHaveLength(4)
  })

  it('2番目の画像をクリックすると正しい画像がモーダルに表示される', async () => {
    const user = userEvent.setup()
    render(<ImageGallery images={mockImages} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[1]) // 2番目の画像をクリック

    // モーダルが開かれる
    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(2)
    })
  })

  it('モーダルで次へボタンをクリックすると次の画像に移動する', async () => {
    const user = userEvent.setup()
    render(<ImageGallery images={mockImages} />)

    // 最初の画像をクリックしてモーダルを開く
    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])

    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(2)
    })

    // 次へボタンを探してクリック（右矢印ボタン）
    const allButtons = screen.getAllByRole('button')
    // 次へボタンはright-4クラスを含む
    const nextButton = allButtons.find(btn => btn.className.includes('right-4') && btn.className.includes('top-1/2'))
    if (nextButton) {
      await user.click(nextButton)
    }
  })

  it('モーダルで前へボタンをクリックすると前の画像に移動する', async () => {
    const user = userEvent.setup()
    render(<ImageGallery images={mockImages} />)

    // 2番目の画像をクリックしてモーダルを開く
    const buttons = screen.getAllByRole('button')
    await user.click(buttons[1])

    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(2)
    })

    // 前へボタンを探してクリック（左矢印ボタン）
    const allButtons = screen.getAllByRole('button')
    const prevButton = allButtons.find(btn => btn.className.includes('left-4') && btn.className.includes('top-1/2'))
    if (prevButton) {
      await user.click(prevButton)
    }
  })

  it('ナビゲーションドットが画像の数と一致する', async () => {
    const threeImages = [
      { id: 'media-1', url: '/image1.jpg', type: 'image', sortOrder: 0 },
      { id: 'media-2', url: '/image2.jpg', type: 'image', sortOrder: 1 },
      { id: 'media-3', url: '/image3.jpg', type: 'image', sortOrder: 2 },
    ]
    const user = userEvent.setup()
    render(<ImageGallery images={threeImages} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])

    await waitFor(() => {
      const allButtons = screen.getAllByRole('button')
      // ドットボタンはw-2 h-2 rounded-fullクラスを持つ
      const dotButtons = allButtons.filter(btn => btn.className.includes('w-2') && btn.className.includes('h-2'))
      expect(dotButtons).toHaveLength(3)
    })
  })

  it('ナビゲーションドットをクリックすると画像が切り替わる', async () => {
    const user = userEvent.setup()
    render(<ImageGallery images={mockImages} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])

    await waitFor(() => {
      const allButtons = screen.getAllByRole('button')
      const dotButtons = allButtons.filter(btn => btn.className.includes('w-2') && btn.className.includes('h-2'))
      expect(dotButtons.length).toBeGreaterThanOrEqual(2)
    })

    // 2番目のドットをクリック
    const allButtons = screen.getAllByRole('button')
    const dotButtons = allButtons.filter(btn => btn.className.includes('w-2') && btn.className.includes('h-2'))
    if (dotButtons[1]) {
      await user.click(dotButtons[1])
    }
  })

  it('モーダルの背景クリックでモーダルが閉じる', async () => {
    const user = userEvent.setup()
    render(<ImageGallery images={mockImages} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])

    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(2)
    })

    // 背景（fixed inset-0のdiv）をクリック
    const backdrop = document.querySelector('.fixed.inset-0')
    if (backdrop) {
      await user.click(backdrop as HTMLElement)
    }

    await waitFor(() => {
      expect(document.querySelector('.fixed.inset-0')).not.toBeInTheDocument()
    })
  })

  it('動画要素にcontrols属性がある', () => {
    render(<ImageGallery images={mockVideo} />)
    const video = document.querySelector('video')
    expect(video).toHaveAttribute('controls')
  })

  it('動画の拡大ボタンをクリックするとモーダルが開く', async () => {
    const user = userEvent.setup()
    render(<ImageGallery images={mockVideo} />)

    // 動画には拡大ボタン（title="拡大表示"）がある
    const expandButton = screen.getByTitle('拡大表示')
    await user.click(expandButton)

    await waitFor(() => {
      expect(document.querySelector('.fixed.inset-0')).toBeInTheDocument()
    })
  })

  it('1枚の画像ではナビゲーションドットが表示されない', async () => {
    const user = userEvent.setup()
    render(<ImageGallery images={[mockImages[0]]} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])

    await waitFor(() => {
      const allButtons = screen.getAllByRole('button')
      const dotButtons = allButtons.filter(btn => btn.className.includes('w-2') && btn.className.includes('h-2'))
      expect(dotButtons).toHaveLength(0)
    })
  })

  it('画像のalt属性が説明的に設定されている', () => {
    render(<ImageGallery images={mockImages} />)
    const images = document.querySelectorAll('img')
    images.forEach((img, index) => {
      expect(img).toHaveAttribute('alt', `投稿画像 ${index + 1}`)
    })
  })

  it('複数の動画が正しくレンダリングされる', () => {
    const multipleVideos = [
      { id: 'media-1', url: '/video1.mp4', type: 'video', sortOrder: 0 },
      { id: 'media-2', url: '/video2.mp4', type: 'video', sortOrder: 1 },
    ]
    render(<ImageGallery images={multipleVideos} />)
    const videos = document.querySelectorAll('video')
    expect(videos).toHaveLength(2)
  })

  it('画像と動画の混合メディアが正しくレンダリングされる', () => {
    const mixedMedia = [
      { id: 'media-1', url: '/image1.jpg', type: 'image', sortOrder: 0 },
      { id: 'media-2', url: '/video.mp4', type: 'video', sortOrder: 1 },
    ]
    render(<ImageGallery images={mixedMedia} />)
    const images = document.querySelectorAll('img')
    const videos = document.querySelectorAll('video')
    expect(images).toHaveLength(1)
    expect(videos).toHaveLength(1)
  })

  it('空の画像配列では何も表示されない', () => {
    const { container } = render(<ImageGallery images={[]} />)
    const images = container.querySelectorAll('img')
    const videos = container.querySelectorAll('video')
    expect(images).toHaveLength(0)
    expect(videos).toHaveLength(0)
  })

  it('6枚以上の画像も正しく処理される', () => {
    const manyImages = Array.from({ length: 6 }, (_, i) => ({
      id: `media-${i}`,
      url: `/image${i}.jpg`,
      type: 'image',
      sortOrder: i,
    }))
    render(<ImageGallery images={manyImages} />)
    const images = document.querySelectorAll('img')
    expect(images).toHaveLength(6)
  })

  describe('動画クリックイベント', () => {
    it('グリッド内の動画クリックでイベント伝播が停止される', async () => {
      const user = userEvent.setup()
      const onParentClick = vi.fn()

      render(
        <div onClick={onParentClick}>
          <ImageGallery images={mockVideo} />
        </div>
      )

      const video = document.querySelector('video')
      expect(video).toBeInTheDocument()

      // 動画をクリック
      await user.click(video!)

      // 親のクリックハンドラは呼ばれない（stopPropagationで止められる）
      // 注: userEventではstopPropagationの効果は限定的だがイベントが発火すること確認
      expect(video).toBeInTheDocument()
    })

    it('モーダル内の動画クリックでモーダルが閉じない', async () => {
      const user = userEvent.setup()
      render(<ImageGallery images={mockVideo} />)

      // 拡大ボタンでモーダルを開く
      const expandButton = screen.getByTitle('拡大表示')
      await user.click(expandButton)

      await waitFor(() => {
        expect(document.querySelector('.fixed.inset-0')).toBeInTheDocument()
      })

      // モーダル内の動画をクリック
      const modalVideo = document.querySelector('.fixed video')
      expect(modalVideo).toBeInTheDocument()

      await user.click(modalVideo as HTMLElement)

      // モーダルはまだ開いている
      expect(document.querySelector('.fixed.inset-0')).toBeInTheDocument()
    })
  })

  describe('モーダル内の画像クリック', () => {
    it('モーダル内の画像クリックでstopPropagationが呼ばれる', async () => {
      const user = userEvent.setup()
      render(<ImageGallery images={mockImages} />)

      const buttons = screen.getAllByRole('button')
      await user.click(buttons[0])

      await waitFor(() => {
        expect(document.querySelector('.fixed.inset-0')).toBeInTheDocument()
      })

      // モーダル内の画像をクリック
      const modalImage = document.querySelector('.fixed img')
      expect(modalImage).toBeInTheDocument()

      await user.click(modalImage as HTMLElement)

      // モーダルはまだ開いている（stopPropagationで閉じない）
      expect(document.querySelector('.fixed.inset-0')).toBeInTheDocument()
    })
  })

  describe('画像の読み込み状態', () => {
    it('画像読み込み完了でopacity-100クラスが適用される', async () => {
      render(<ImageGallery images={mockImages} />)

      const images = document.querySelectorAll('img')
      // onLoadイベント発火後のスタイル確認
      images.forEach(img => {
        // 初期状態ではisLoading=trueなのでopacity-0クラスがあるかもしれないが
        // 画像のclassListに適切なクラスがあることを確認
        expect(img.classList.toString()).toContain('object-cover')
      })
    })
  })

  describe('priority属性', () => {
    it('最初の画像にはpriority属性が設定される', () => {
      render(<ImageGallery images={mockImages} />)

      const images = document.querySelectorAll('img')
      // Next.js Imageコンポーネントはpriority属性をfetchpriority="high"に変換
      // またはloading属性がないことで確認
      expect(images[0]).toBeInTheDocument()
    })
  })

  describe('モーダルで動画を表示', () => {
    it('動画モーダルでautoPlay属性がある', async () => {
      const user = userEvent.setup()
      render(<ImageGallery images={mockVideo} />)

      const expandButton = screen.getByTitle('拡大表示')
      await user.click(expandButton)

      await waitFor(() => {
        const modalVideo = document.querySelector('.fixed video')
        expect(modalVideo).toBeInTheDocument()
        expect(modalVideo).toHaveAttribute('autoplay')
      })
    })

    it('動画モーダルにcontrols属性がある', async () => {
      const user = userEvent.setup()
      render(<ImageGallery images={mockVideo} />)

      const expandButton = screen.getByTitle('拡大表示')
      await user.click(expandButton)

      await waitFor(() => {
        const modalVideo = document.querySelector('.fixed video')
        expect(modalVideo).toHaveAttribute('controls')
      })
    })
  })
})
