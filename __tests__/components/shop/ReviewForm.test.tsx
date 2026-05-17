import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { ReviewForm } from '@/components/shop/ReviewForm'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
}))

// next/image モック
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, fill, className }: { src: string; alt: string; fill?: boolean; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-fill={fill ? 'true' : undefined} className={className} />
  ),
}))

// Server Actions モック
const mockCreateReview = vi.fn()
vi.mock('@/lib/actions/review', () => ({
  createReview: (...args: unknown[]) => mockCreateReview(...args),
}))

// StarRating モック
vi.mock('@/components/shop/StarRating', () => ({
  StarRating: ({ rating, interactive, onChange }: { rating: number; size?: string; interactive?: boolean; onChange?: (v: number) => void }) => (
    <div data-testid="star-rating">
      <span data-testid="current-rating">{rating}</span>
      {interactive && (
        <>
          {[1, 2, 3, 4, 5].map((v) => (
            <button key={v} data-testid={`star-${v}`} onClick={() => onChange?.(v)}>
              星{v}
            </button>
          ))}
        </>
      )}
    </div>
  ),
}))

// client-image-compression モック
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn((file: File) => Promise.resolve(file)),
  formatFileSize: vi.fn((size: number) => `${size}B`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
}))

describe('ReviewForm', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateReview.mockResolvedValue({ success: true })
  })

  it('星評価セレクターを表示する', () => {
    render(<ReviewForm shopId="shop-1" />)
    expect(screen.getByTestId('star-rating')).toBeInTheDocument()
  })

  it('コメントテキストエリアを表示する', () => {
    render(<ReviewForm shopId="shop-1" />)
    expect(screen.getByPlaceholderText('盆栽園の感想を書いてください...')).toBeInTheDocument()
  })

  it('送信ボタンを表示する', () => {
    render(<ReviewForm shopId="shop-1" />)
    expect(screen.getByRole('button', { name: /レビューを投稿/ })).toBeInTheDocument()
  })

  it('評価未選択時は送信ボタンが無効化される', () => {
    render(<ReviewForm shopId="shop-1" />)
    expect(screen.getByRole('button', { name: /レビューを投稿/ })).toBeDisabled()
  })

  it('評価を選択すると送信ボタンが有効になる', () => {
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-3'))
    expect(screen.getByRole('button', { name: /レビューを投稿/ })).not.toBeDisabled()
  })

  it('コメントを入力できる', () => {
    render(<ReviewForm shopId="shop-1" />)
    const textarea = screen.getByPlaceholderText('盆栽園の感想を書いてください...')
    fireEvent.change(textarea, { target: { value: '素晴らしい盆栽園' } })
    expect(textarea).toHaveValue('素晴らしい盆栽園')
  })

  it('評価ラベルに必須マークが表示される', () => {
    render(<ReviewForm shopId="shop-1" />)
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('送信時にcreateReviewを呼び出す', async () => {
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-4'))
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      expect(mockCreateReview).toHaveBeenCalled()
    })
  })

  it('送信時にshopIdが含まれる', async () => {
    render(<ReviewForm shopId="shop-xyz" />)
    fireEvent.click(screen.getByTestId('star-5'))
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      const formData = mockCreateReview.mock.calls[0][0] as FormData
      expect(formData.get('shopId')).toBe('shop-xyz')
    })
  })

  it('送信時に評価値が含まれる', async () => {
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-3'))
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      const formData = mockCreateReview.mock.calls[0][0] as FormData
      expect(formData.get('rating')).toBe('3')
    })
  })

  it('送信時にコメントが含まれる', async () => {
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-4'))
    fireEvent.change(screen.getByPlaceholderText('盆栽園の感想を書いてください...'), {
      target: { value: 'テストコメント' },
    })
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      const formData = mockCreateReview.mock.calls[0][0] as FormData
      expect(formData.get('content')).toBe('テストコメント')
    })
  })

  it('送信成功時にonSuccessコールバックを呼ぶ', async () => {
    const onSuccess = vi.fn()
    render(<ReviewForm shopId="shop-1" onSuccess={onSuccess} />)
    fireEvent.click(screen.getByTestId('star-5'))
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('送信成功時にrouter.refreshを呼ぶ', async () => {
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-5'))
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockCreateReview.mockResolvedValue({ error: 'レビューの投稿に失敗しました' })
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-4'))
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      expect(screen.getByText('レビューの投稿に失敗しました')).toBeInTheDocument()
    })
  })

  it('画像追加ボタンを表示する', () => {
    render(<ReviewForm shopId="shop-1" />)
    expect(screen.getByText('画像を追加')).toBeInTheDocument()
  })

  it('画像枚数表示を表示する', () => {
    render(<ReviewForm shopId="shop-1" />)
    expect(screen.getByText('0/3枚')).toBeInTheDocument()
  })

  it('評価未選択でフォーム送信するとエラーを表示', () => {
    render(<ReviewForm shopId="shop-1" />)
    const form = screen.getByRole('button', { name: /レビューを投稿/ }).closest('form')!
    fireEvent.submit(form)

    expect(screen.getByText('評価を選択してください')).toBeInTheDocument()
  })

  it('送信成功後にフォームがリセットされる', async () => {
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-4'))
    fireEvent.change(screen.getByPlaceholderText('盆栽園の感想を書いてください...'), {
      target: { value: 'テスト' },
    })
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      expect(screen.getByTestId('current-rating')).toHaveTextContent('0')
      expect(screen.getByPlaceholderText('盆栽園の感想を書いてください...')).toHaveValue('')
    })
  })

  it('送信中は「投稿中...」を表示する', async () => {
    mockCreateReview.mockImplementation(() => new Promise(() => {}))
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-5'))
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      expect(screen.getByText('投稿中...')).toBeInTheDocument()
    })
  })

  it('コメントなしでも評価があれば送信できる', async () => {
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-3'))
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      expect(mockCreateReview).toHaveBeenCalled()
    })
  })

  it('コメントラベルが表示される', () => {
    render(<ReviewForm shopId="shop-1" />)
    expect(screen.getByText('コメント')).toBeInTheDocument()
  })

  it('評価を変更できる', () => {
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-3'))
    expect(screen.getByTestId('current-rating')).toHaveTextContent('3')

    fireEvent.click(screen.getByTestId('star-5'))
    expect(screen.getByTestId('current-rating')).toHaveTextContent('5')
  })

  it('ファイル入力がimage/*を受け付ける', () => {
    const { container } = render(<ReviewForm shopId="shop-1" />)
    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('accept', 'image/*')
  })

  it('エラーメッセージが初期状態で非表示', () => {
    render(<ReviewForm shopId="shop-1" />)
    expect(screen.queryByText('レビューの投稿に失敗しました')).not.toBeInTheDocument()
    expect(screen.queryByText('評価を選択してください')).not.toBeInTheDocument()
  })

  it('画像サイズ超過でエラーを表示する', () => {
    render(<ReviewForm shopId="shop-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const bigFile = new File(['test'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 })
    fireEvent.change(fileInput, { target: { files: [bigFile] } })

    expect(screen.getByText(/画像は.*MB以下にしてください/)).toBeInTheDocument()
  })

  it('アップロードエラー時にエラーメッセージを表示する', async () => {
     
    const { prepareFileForUpload } = await import('@/lib/client-image-compression')
    prepareFileForUpload.mockRejectedValue(new Error('compression failed'))

    render(<ReviewForm shopId="shop-1" />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  it('コメントが空白のみの場合はcontentをFormDataに含めない', async () => {
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-4'))
    fireEvent.change(screen.getByPlaceholderText('盆栽園の感想を書いてください...'), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      const formData = mockCreateReview.mock.calls[0][0] as FormData
      expect(formData.get('content')).toBeNull()
    })
  })

  it('onSuccessが未定義でもエラーにならない', async () => {
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-5'))
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      expect(mockCreateReview).toHaveBeenCalled()
    })
    // No error should be thrown
  })

  // ============================================================
  // 追加テスト: 画像アップロードXHR、画像削除、画像上限
  // ============================================================

  it('画像アップロード成功時に画像プレビューが表示される', async () => {
     
    const { prepareFileForUpload } = await import('@/lib/client-image-compression')
    prepareFileForUpload.mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))

    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      addEventListener: vi.fn(),
      upload: { addEventListener: vi.fn() },
      status: 200,
      responseText: JSON.stringify({ url: '/uploaded.jpg' }),
    }
    vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function() { return mockXHR } as unknown as () => XMLHttpRequest)
    mockXHR.send.mockImplementation(() => {
      const loadHandler = mockXHR.addEventListener.mock.calls.find(
        (c: [string, () => void]) => c[0] === 'load'
      )?.[1]
      if (loadHandler) loadHandler()
    })

    render(<ReviewForm shopId="shop-1" />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('1/3枚')).toBeInTheDocument()
    })

    vi.restoreAllMocks()
  })

  it('画像アップロードXHRエラー時にエラーを表示する', async () => {
     
    const { prepareFileForUpload } = await import('@/lib/client-image-compression')
    prepareFileForUpload.mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))

    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      addEventListener: vi.fn(),
      upload: { addEventListener: vi.fn() },
    }
    vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function() { return mockXHR } as unknown as () => XMLHttpRequest)
    mockXHR.send.mockImplementation(() => {
      const errorHandler = mockXHR.addEventListener.mock.calls.find(
        (c: [string, () => void]) => c[0] === 'error'
      )?.[1]
      if (errorHandler) errorHandler()
    })

    render(<ReviewForm shopId="shop-1" />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })

    vi.restoreAllMocks()
  })

  it('画像アップロードで非200レスポンス時にエラーを表示する', async () => {
     
    const { prepareFileForUpload } = await import('@/lib/client-image-compression')
    prepareFileForUpload.mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))

    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      addEventListener: vi.fn(),
      upload: { addEventListener: vi.fn() },
      status: 500,
      responseText: 'Server Error',
    }
    vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function() { return mockXHR } as unknown as () => XMLHttpRequest)
    mockXHR.send.mockImplementation(() => {
      const loadHandler = mockXHR.addEventListener.mock.calls.find(
        (c: [string, () => void]) => c[0] === 'load'
      )?.[1]
      if (loadHandler) loadHandler()
    })

    render(<ReviewForm shopId="shop-1" />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })

    vi.restoreAllMocks()
  })
})
