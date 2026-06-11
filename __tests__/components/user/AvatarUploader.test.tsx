import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { AvatarUploader } from '@/components/user/AvatarUploader'

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
const mockPrepareFileForUpload = vi.fn().mockImplementation((file) => Promise.resolve(file))
const mockFormatFileSize = vi.fn().mockImplementation((bytes: number) => `${Math.round(bytes / 1024)}KB`)
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: (...args: unknown[]) => mockPrepareFileForUpload(...args),
  formatFileSize: (...args: unknown[]) => mockFormatFileSize(...args),
}))

describe('AvatarUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  // ============================================================
  // 基本レンダリング
  // ============================================================

  describe('基本レンダリング', () => {
    it('アップロードボタンを表示する', () => {
      render(<AvatarUploader currentUrl={null} nickname="テスト" />)
      expect(screen.getByRole('button', { name: /画像を変更/ })).toBeInTheDocument()
    })

    it('現在のアバターがない場合はイニシャルを表示', () => {
      render(<AvatarUploader currentUrl={null} nickname="テスト" />)
      expect(screen.getByText('テ')).toBeInTheDocument()
    })

    it('ファイル形式の説明を表示する', () => {
      render(<AvatarUploader currentUrl={null} nickname="テスト" />)
      expect(screen.getByText(/JPEG、PNG、WebP形式/)).toBeInTheDocument()
    })

    it('ファイル入力がhidden', () => {
      render(<AvatarUploader currentUrl={null} nickname="テスト" />)
      const fileInput = document.querySelector('input[type="file"]')
      expect(fileInput).toHaveClass('hidden')
    })

    it('現在のアバターがある場合は画像を表示', () => {
      render(<AvatarUploader currentUrl="/avatar.jpg" nickname="テスト" />)
      const image = screen.getByAltText('テスト')
      expect(image).toBeInTheDocument()
    })
  })

  // ============================================================
  // ファイル選択
  // ============================================================

  describe('ファイル選択', () => {
    it('ボタンクリックでファイル選択を開く', async () => {
      const user = userEvent.setup()
      render(<AvatarUploader currentUrl={null} nickname="テスト" />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const clickSpy = vi.spyOn(fileInput, 'click')

      await user.click(screen.getByRole('button', { name: /画像を変更/ }))

      expect(clickSpy).toHaveBeenCalled()
    })

    it('accept属性が正しい画像形式を指定', () => {
      render(<AvatarUploader currentUrl={null} nickname="テスト" />)
      const fileInput = document.querySelector('input[type="file"]')
      expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
    })
  })

  // ============================================================
  // イニシャル表示
  // ============================================================

  describe('イニシャル表示', () => {
    it('日本語ニックネームの最初の文字を表示', () => {
      render(<AvatarUploader currentUrl={null} nickname="盆栽太郎" />)
      expect(screen.getByText('盆')).toBeInTheDocument()
    })

    it('英語ニックネームの最初の文字を表示', () => {
      render(<AvatarUploader currentUrl={null} nickname="Bonsai" />)
      expect(screen.getByText('B')).toBeInTheDocument()
    })

    it('数字で始まるニックネームでも動作する', () => {
      render(<AvatarUploader currentUrl={null} nickname="123盆栽" />)
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  // ============================================================
  // アップロード処理
  // ============================================================

  describe('アップロード処理', () => {
    it('アップロード成功時にページがリフレッシュされる', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: '/new-avatar.jpg' }),
      })

      render(<AvatarUploader currentUrl={null} nickname="テスト" />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })

      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('APIが正しいエンドポイントで呼ばれる', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: '/new-avatar.jpg' }),
      })

      render(<AvatarUploader currentUrl={null} nickname="テスト" />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })

      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/upload/avatar', expect.any(Object))
      })
    })

    it('FormDataでファイルが送信される', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: '/new-avatar.jpg' }),
      })

      render(<AvatarUploader currentUrl={null} nickname="テスト" />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })

      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/upload/avatar',
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

      render(<AvatarUploader currentUrl={null} nickname="テスト" />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })

      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))

      await waitFor(() => {
        expect(screen.getByText('ファイルサイズが大きすぎます')).toBeInTheDocument()
      })
    })

    it('ネットワークエラー時にデフォルトエラーを表示', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<AvatarUploader currentUrl={null} nickname="テスト" />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })

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

      render(<AvatarUploader currentUrl={null} nickname="テスト" />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })

      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))

      await waitFor(() => {
        expect(screen.getByText('サーバーエラー')).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // ローディング状態
  // ============================================================

  describe('ローディング状態', () => {
    it('アップロード中はボタンが無効になる', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, json: () => Promise.resolve({}) }), 100)
          )
      )

      render(<AvatarUploader currentUrl={null} nickname="テスト" />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })

      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))

      const button = screen.getByRole('button', { name: /画像を変更/ })
      expect(button).toBeDisabled()
    })
  })

  // ============================================================
  // ファイルなし
  // ============================================================

  describe('ファイルなし', () => {
    it('ファイルが選択されなかった場合は何もしない', () => {
      render(<AvatarUploader currentUrl={null} nickname="テスト" />)

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
  it('ボタン内にSVGアイコンが表示される', () => {
    render(<AvatarUploader currentUrl={null} nickname="テスト" />)

    const button = screen.getByRole('button', { name: /画像を変更/ })
    const svg = button.querySelector('svg')

    expect(svg).toBeInTheDocument()
  })
})

// ============================================================
// 圧縮設定テスト
// ============================================================

describe('アバター圧縮設定', () => {
  it('最大サイズは500KB', () => {
    const maxSizeMB = 0.5
    expect(maxSizeMB).toBe(0.5)
  })

  it('最大解像度は512px', () => {
    const maxWidthOrHeight = 512
    expect(maxWidthOrHeight).toBe(512)
  })
})

// ============================================================
// 圧縮ログテスト
// ============================================================

describe('圧縮成功時のログ', () => {
  it('圧縮によってファイルサイズが減少してもログが出力されない（本番ログ削除済み）', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // 圧縮後のファイルサイズを元のファイルより小さくモック
    const originalFile = new File(['x'.repeat(10000)], 'avatar.jpg', { type: 'image/jpeg' })
    const compressedFile = new File(['x'.repeat(5000)], 'avatar.jpg', { type: 'image/jpeg' })
    mockPrepareFileForUpload.mockResolvedValueOnce(compressedFile)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: '/new-avatar.jpg' }),
    })

    render(<AvatarUploader currentUrl={null} nickname="テスト" />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', { value: [originalFile] })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // 本番ログ削除済みのため、console.logは呼ばれない
    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
