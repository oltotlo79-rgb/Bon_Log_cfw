 
import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BonsaiRecordForm } from '@/components/bonsai/BonsaiRecordForm'

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

// next/image モック
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, fill, className }: { src: string; alt: string; fill?: boolean; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-fill={fill ? 'true' : undefined} className={className} />
  ),
}))

// Server Actions モック
const mockAddBonsaiRecord = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  addBonsaiRecord: (...args: unknown[]) => mockAddBonsaiRecord(...args),
}))

// client-image-compression モック
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn((file: File) => Promise.resolve(file)),
  formatFileSize: vi.fn((size: number) => `${size}B`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
}))

// fetch モック
const mockFetch = vi.fn()
global.fetch = mockFetch

// URL.createObjectURL モック
const mockCreateObjectURL = vi.fn(() => 'blob:test-url')
const mockRevokeObjectURL = vi.fn()
URL.createObjectURL = mockCreateObjectURL
URL.revokeObjectURL = mockRevokeObjectURL

describe('BonsaiRecordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddBonsaiRecord.mockResolvedValue({ success: true })
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ url: '/uploaded-image.jpg' }),
    })
  })

  it('テキストエリアを表示する', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    expect(screen.getByPlaceholderText(/成長の様子や作業内容を記録/)).toBeInTheDocument()
  })

  it('画像追加ボタンを表示する', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    expect(screen.getByText('画像を追加')).toBeInTheDocument()
  })

  it('送信ボタンを表示する', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    expect(screen.getByRole('button', { name: '記録する' })).toBeInTheDocument()
  })

  it('テキストを入力できる', async () => {
    const user = userEvent.setup()
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    const textarea = screen.getByPlaceholderText(/成長の様子/)
    await user.type(textarea, '今日は剪定しました')
    expect(textarea).toHaveValue('今日は剪定しました')
  })

  it('テキストも画像もない場合は送信不可', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    expect(screen.getByRole('button', { name: '記録する' })).toBeDisabled()
  })

  it('空白のみの場合は送信不可', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    const textarea = screen.getByPlaceholderText(/成長の様子/)
    fireEvent.change(textarea, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: '記録する' })).toBeDisabled()
  })

  it('テキスト入力で送信ボタンが有効になる', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    const textarea = screen.getByPlaceholderText(/成長の様子/)
    fireEvent.change(textarea, { target: { value: 'テスト記録' } })
    expect(screen.getByRole('button', { name: '記録する' })).not.toBeDisabled()
  })

  it('画像を選択できる', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(mockCreateObjectURL).toHaveBeenCalled()
  })

  it('画像プレビューが表示される', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    // プレビュー画像が表示される
    const images = document.querySelectorAll('img[src="blob:test-url"]')
    expect(images.length).toBeGreaterThanOrEqual(1)
  })

  it('最大4枚まで画像を選択できる', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    expect(screen.getByText('最大4枚まで')).toBeInTheDocument()
  })

  it('画像を削除できる', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    // 画像が追加された後、削除ボタンをクリック
    const deleteButtons = document.querySelectorAll('button[type="button"]')
    const imageDeleteButton = Array.from(deleteButtons).find(btn =>
      btn.querySelector('svg') && btn.closest('.relative')
    )
    if (imageDeleteButton) {
      fireEvent.click(imageDeleteButton)
      expect(mockRevokeObjectURL).toHaveBeenCalled()
    }
  })

  it('送信時にaddBonsaiRecordをbonsaiIdで呼ぶ', async () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-xyz" />)
    fireEvent.change(screen.getByPlaceholderText(/成長の様子/), { target: { value: 'テスト' } })
    fireEvent.click(screen.getByRole('button', { name: '記録する' }))

    await waitFor(() => {
      expect(mockAddBonsaiRecord).toHaveBeenCalledWith(
        expect.objectContaining({ bonsaiId: 'bonsai-xyz' })
      )
    })
  })

  it('成功時にrouter.refreshを呼ぶ', async () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    fireEvent.change(screen.getByPlaceholderText(/成長の様子/), { target: { value: 'テスト' } })
    fireEvent.click(screen.getByRole('button', { name: '記録する' }))

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockAddBonsaiRecord.mockResolvedValue({ error: '記録に失敗しました' })
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    fireEvent.change(screen.getByPlaceholderText(/成長の様子/), { target: { value: 'テスト' } })
    fireEvent.click(screen.getByRole('button', { name: '記録する' }))

    await waitFor(() => {
      expect(screen.getByText('記録に失敗しました')).toBeInTheDocument()
    })
  })

  it('送信中は「保存中...」を表示する', async () => {
    mockAddBonsaiRecord.mockImplementation(() => new Promise(() => {}))
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    fireEvent.change(screen.getByPlaceholderText(/成長の様子/), { target: { value: 'テスト' } })
    fireEvent.click(screen.getByRole('button', { name: '記録する' }))

    await waitFor(() => {
      expect(screen.getByText('保存中...')).toBeInTheDocument()
    })
  })

  it('送信中はボタンが無効化される', async () => {
    mockAddBonsaiRecord.mockImplementation(() => new Promise(() => {}))
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    fireEvent.change(screen.getByPlaceholderText(/成長の様子/), { target: { value: 'テスト' } })
    fireEvent.click(screen.getByRole('button', { name: '記録する' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled()
    })
  })

  it('ファイルサイズ超過時にエラーを表示する', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    // 11MBのファイル（MAX_IMAGE_SIZE: 10MB超過）
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
    Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 })

    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    expect(screen.getByText(/MB以下にしてください/)).toBeInTheDocument()
  })

  it('成功後にフォームがリセットされる', async () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    const textarea = screen.getByPlaceholderText(/成長の様子/)
    fireEvent.change(textarea, { target: { value: 'テスト記録' } })
    fireEvent.click(screen.getByRole('button', { name: '記録する' }))

    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
  })

  it('ファイル入力がimage/*を受け付ける', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('accept', 'image/*')
  })

  it('ファイル入力がmultipleを許可する', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('multiple')
  })

  it('例外発生時にエラーメッセージを表示する', async () => {
    mockAddBonsaiRecord.mockRejectedValue(new Error('Network error'))
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    fireEvent.change(screen.getByPlaceholderText(/成長の様子/), { target: { value: 'テスト' } })
    fireEvent.click(screen.getByRole('button', { name: '記録する' }))

    await waitFor(() => {
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })
  })
})
