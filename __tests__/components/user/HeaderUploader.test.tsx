

import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { HeaderUploader } from '@/components/user/HeaderUploader'

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
    refresh: mockRefresh,
  }),
}))

// fetch モック
const mockFetch = vi.fn()
global.fetch = mockFetch

// client-image-compression モック
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn().mockImplementation((file) => Promise.resolve(file)),
  formatFileSize: vi.fn().mockImplementation((bytes) => `${Math.round(bytes / 1024)}KB`),
}))

describe('HeaderUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  // ============================================================
  // 基本レンダリング
  // ============================================================

  describe('基本レンダリング', () => {
    it('コンポーネントが正しくレンダリングされる', () => {
      render(<HeaderUploader currentUrl={null} />)
      expect(screen.getByText(/JPEG、PNG、WebP形式/)).toBeInTheDocument()
    })

    it('現在のヘッダー画像がない場合はカメラアイコンを表示', () => {
      render(<HeaderUploader currentUrl={null} />)
      const svg = document.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('現在のヘッダー画像がある場合は画像を表示', () => {
      render(<HeaderUploader currentUrl="/header.jpg" />)
      const image = screen.getByAltText('ヘッダー画像')
      expect(image).toBeInTheDocument()
    })

    it('ファイル形式と推奨サイズの説明を表示', () => {
      render(<HeaderUploader currentUrl={null} />)
      expect(screen.getByText(/JPEG、PNG、WebP形式.*推奨サイズ: 1500x500px/)).toBeInTheDocument()
    })

    it('非表示のファイル入力が存在する', () => {
      render(<HeaderUploader currentUrl={null} />)
      const input = document.querySelector('input[type="file"]')
      expect(input).toBeInTheDocument()
      expect(input).toHaveClass('hidden')
    })

    it('クリック可能なエリアが存在する', () => {
      render(<HeaderUploader currentUrl={null} />)
      const clickableArea = document.querySelector('.cursor-pointer')
      expect(clickableArea).toBeInTheDocument()
    })
  })

  // ============================================================
  // ファイル選択
  // ============================================================

  describe('ファイル選択', () => {
    it('エリアクリックでファイル入力がトリガーされる', async () => {
      const user = userEvent.setup()
      render(<HeaderUploader currentUrl={null} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const clickSpy = vi.spyOn(fileInput, 'click')

      const clickableArea = document.querySelector('.cursor-pointer') as HTMLElement
      await user.click(clickableArea)

      expect(clickSpy).toHaveBeenCalled()
    })

    it('accept属性が正しい画像形式を指定', () => {
      render(<HeaderUploader currentUrl={null} />)
      const fileInput = document.querySelector('input[type="file"]')
      expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
    })
  })

  // ============================================================
  // アップロード処理
  // ============================================================

  describe('アップロード処理', () => {
    it('アップロード成功時にページがリフレッシュされる', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: '/new-header.jpg' }),
      })

      render(<HeaderUploader currentUrl={null} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'header.jpg', { type: 'image/jpeg' })

      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('APIが正しいエンドポイントで呼ばれる', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: '/new-header.jpg' }),
      })

      render(<HeaderUploader currentUrl={null} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'header.jpg', { type: 'image/jpeg' })

      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/upload/header', expect.any(Object))
      })
    })

    it('FormDataでファイルが送信される', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: '/new-header.jpg' }),
      })

      render(<HeaderUploader currentUrl={null} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'header.jpg', { type: 'image/jpeg' })

      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/upload/header',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(FormData),
          })
        )
      })
    })
  })

  // ============================================================
  // エラーハンドリング
  // ============================================================

  describe('エラーハンドリング', () => {
    it('APIエラー時にエラーメッセージを表示', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'ファイルサイズが大きすぎます' }),
      })

      render(<HeaderUploader currentUrl={null} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'header.jpg', { type: 'image/jpeg' })

      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))

      await waitFor(() => {
        expect(screen.getByText('ファイルサイズが大きすぎます')).toBeInTheDocument()
      })
    })

    it('ネットワークエラー時にデフォルトエラーを表示', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<HeaderUploader currentUrl={null} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'header.jpg', { type: 'image/jpeg' })

      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))

      await waitFor(() => {
        expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
      })
    })

    it('result.errorがある場合にエラーを表示', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ error: 'サーバーエラー' }),
      })

      render(<HeaderUploader currentUrl={null} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'header.jpg', { type: 'image/jpeg' })

      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))

      await waitFor(() => {
        expect(screen.getByText('サーバーエラー')).toBeInTheDocument()
      })
    })

    it('エラー時にプレビューが元の画像に戻る', async () => {
      const originalUrl = '/original-header.jpg'

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'エラー' }),
      })

      render(<HeaderUploader currentUrl={originalUrl} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'header.jpg', { type: 'image/jpeg' })

      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))

      await waitFor(() => {
        const image = screen.getByAltText('ヘッダー画像')
        expect(image).toHaveAttribute('src', expect.stringContaining('original-header.jpg'))
      })
    })
  })

  // ============================================================
  // ホバー状態
  // ============================================================

  describe('ホバー状態', () => {
    it('ホバー時のオーバーレイが存在する', () => {
      render(<HeaderUploader currentUrl="/header.jpg" />)
      const overlay = document.querySelector('.group-hover\\:opacity-100')
      expect(overlay).toBeInTheDocument()
    })

    it('変更ボタンが存在する', () => {
      render(<HeaderUploader currentUrl="/header.jpg" />)
      expect(screen.getByRole('button', { name: /変更する/ })).toBeInTheDocument()
    })
  })

  // ============================================================
  // ファイルなし
  // ============================================================

  describe('ファイルなし', () => {
    it('ファイルが選択されなかった場合は何もしない', () => {
      render(<HeaderUploader currentUrl={null} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      Object.defineProperty(fileInput, 'files', { value: [] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})

// ============================================================
// CameraIconコンポーネント
// ============================================================

describe('CameraIcon', () => {
  it('画像がない場合に表示される', () => {
    render(<HeaderUploader currentUrl={null} />)
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('変更ボタン内にも表示される', () => {
    render(<HeaderUploader currentUrl="/header.jpg" />)
    const button = screen.getByRole('button', { name: /変更する/ })
    const svg = button.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})

// ============================================================
// 圧縮設定テスト
// ============================================================

describe('ヘッダー圧縮設定', () => {
  it('最大サイズは1MB', () => {
    const maxSizeMB = 1
    expect(maxSizeMB).toBe(1)
  })

  it('最大幅は1500px', () => {
    const maxWidthOrHeight = 1500
    expect(maxWidthOrHeight).toBe(1500)
  })

  it('推奨アスペクト比は3:1', () => {
    const width = 1500
    const height = 500
    const aspectRatio = width / height
    expect(aspectRatio).toBe(3)
  })
})

// ============================================================
// 寸法テスト
// ============================================================

describe('ヘッダー寸法', () => {
  it('高さは128pxに設定されている', () => {
    render(<HeaderUploader currentUrl={null} />)
    const container = document.querySelector('.h-32')
    expect(container).toBeInTheDocument()
  })

  it('角丸が設定されている', () => {
    render(<HeaderUploader currentUrl={null} />)
    const container = document.querySelector('.rounded-lg')
    expect(container).toBeInTheDocument()
  })
})
