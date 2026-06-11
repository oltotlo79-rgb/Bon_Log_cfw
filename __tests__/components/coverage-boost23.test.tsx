import { vi } from 'vitest'
 
import * as nextNavigation from 'next/navigation'
/**
 * @file coverage-boost23.test.tsx
 * @description MaintenanceForm, ShopSearchForm, ReviewCard, MentionTextarea のブランチカバレッジ向上テスト
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import _userEvent from '@testing-library/user-event'

// ============================================================
// Target 1: MaintenanceForm
// ============================================================

const mockUpdateMaintenanceSettings = vi.fn()
const mockRouterRefresh = vi.fn()

vi.mock('@/lib/actions/maintenance', () => ({
  updateMaintenanceSettings: (...args: unknown[]) => mockUpdateMaintenanceSettings(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: mockRouterRefresh, push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

vi.mock('@/lib/prefectures', () => ({
  REGIONS: [
    { id: 'kanto', name: '関東', prefectures: ['東京都', '神奈川県'] },
    { id: 'kansai', name: '関西', prefectures: ['大阪府', '京都府'] },
  ],
  PREFECTURES: ['東京都', '神奈川県', '大阪府', '京都府'],
}))

vi.mock('@/lib/actions/review', () => ({
  deleteReview: vi.fn(),
  updateReview: vi.fn(),
}))

vi.mock('@/lib/actions/mention', () => ({
  searchMentionUsers: vi.fn(),
}))

vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn(),
  formatFileSize: vi.fn((size: number) => `${(size / 1024 / 1024).toFixed(1)}MB`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
}))

vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: () => <button>通報</button>,
}))

vi.mock('@/components/shop/StarRating', () => ({
  StarRatingDisplay: ({ rating }: { rating: number }) => <div>★{rating}</div>,
  StarRatingInput: ({ value, onChange }: { value: number; onChange: (val: number) => void }) => (
    <button onClick={() => onChange(value === 5 ? 1 : 5)}>評価変更</button>
  ),
}))

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '3時間前',
}))

vi.mock('date-fns/locale', () => ({
  ja: {},
}))

vi.mock('next/image', () => ({
  __esModule: true,
  // Why: `fill` などの next/image 固有 boolean props を img へ流すと React が
  // `Received true for a non-boolean attribute fill` 警告を出すため除去する。
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
    <img src={src} alt={alt} {...props} />
  ),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ ref: _ref, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: unknown }) => <textarea {...props} />,
}))

vi.mock('@/lib/mention-utils', () => ({
  insertMention: (text: string, userId: string, cursorPosition: number, triggerPosition: number) => {
    const before = text.slice(0, triggerPosition)
    const after = text.slice(cursorPosition)
    const newText = `${before}<@${userId}> ${after}`
    return { text: newText, cursor: triggerPosition + userId.length + 4 }
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, type = 'button', disabled, className }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}))

import { MaintenanceForm } from '@/app/admin/maintenance/MaintenanceForm'

describe('MaintenanceForm', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('null の startTime/endTime で toLocalDateTimeString が空文字を返す', () => {
    const { container } = render(
      <MaintenanceForm
        settings={{
          enabled: false,
          startTime: null,
          endTime: null,
          message: 'メンテナンス中',
        }}
      />
    )

    const datetimeInputs = container.querySelectorAll('input[type="datetime-local"]')
    const startTimeInput = datetimeInputs[0] as HTMLInputElement
    const endTimeInput = datetimeInputs[1] as HTMLInputElement

    expect(startTimeInput.value).toBe('')
    expect(endTimeInput.value).toBe('')
  })

  it('メンテナンス開始ボタンで enabled が true になり、startTime/endTime がクリアされる', () => {
    const { container } = render(
      <MaintenanceForm
        settings={{
          enabled: false,
          startTime: '2024-01-01T12:00:00.000Z',
          endTime: '2024-01-02T12:00:00.000Z',
          message: 'テスト',
        }}
      />
    )

    const startButton = screen.getByText('メンテナンス開始')
    fireEvent.click(startButton)

    // startTime/endTime が空になる
    const datetimeInputs = container.querySelectorAll('input[type="datetime-local"]')
    const startTimeInput = datetimeInputs[0] as HTMLInputElement
    const endTimeInput = datetimeInputs[1] as HTMLInputElement

    expect(startTimeInput.value).toBe('')
    expect(endTimeInput.value).toBe('')
  })

  it('通常運用に戻すボタンで enabled が false になる', () => {
    render(
      <MaintenanceForm
        settings={{
          enabled: true,
          startTime: null,
          endTime: null,
          message: 'メンテナンス中',
        }}
      />
    )

    const disableButton = screen.getByText('通常運用に戻す')
    fireEvent.click(disableButton)

    // enabled が false になることを確認（ボタンのスタイルで判定）
    expect(disableButton.className).toContain('bg-foreground')
  })

  it('フォーム送信成功時に成功メッセージが表示される', async () => {
    mockUpdateMaintenanceSettings.mockResolvedValue({ success: true })

    render(
      <MaintenanceForm
        settings={{
          enabled: false,
          startTime: null,
          endTime: null,
          message: '',
        }}
      />
    )

    const saveButton = screen.getByText('設定を保存')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('設定を保存しました')).toBeInTheDocument()
    })

    expect(mockRouterRefresh).toHaveBeenCalled()
  })

  it('フォーム送信失敗時にエラーメッセージが表示される', async () => {
    mockUpdateMaintenanceSettings.mockResolvedValue({ success: false, error: 'エラーが発生しました' })

    render(
      <MaintenanceForm
        settings={{
          enabled: false,
          startTime: null,
          endTime: null,
          message: '',
        }}
      />
    )

    const saveButton = screen.getByText('設定を保存')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })
  })

  it('success が false で error が undefined の場合、デフォルトエラーメッセージが表示される', async () => {
    mockUpdateMaintenanceSettings.mockResolvedValue({ success: false })

    render(
      <MaintenanceForm
        settings={{
          enabled: false,
          startTime: null,
          endTime: null,
          message: '',
        }}
      />
    )

    const saveButton = screen.getByText('設定を保存')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('更新に失敗しました')).toBeInTheDocument()
    })
  })

  it('空文字の localDateTime で toISOString が null を返す', async () => {
    mockUpdateMaintenanceSettings.mockImplementation((settings) => {
      expect(settings.startTime).toBe(null)
      expect(settings.endTime).toBe(null)
      return Promise.resolve({ success: true })
    })

    render(
      <MaintenanceForm
        settings={{
          enabled: false,
          startTime: null,
          endTime: null,
          message: '',
        }}
      />
    )

    const saveButton = screen.getByText('設定を保存')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockUpdateMaintenanceSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: null,
          endTime: null,
        })
      )
    })
  })
})

// ============================================================
// Target 2: ShopSearchForm
// ============================================================

import { ShopSearchForm } from '@/app/(main)/shops/ShopSearchForm'

describe('ShopSearchForm', async () => {
  const mockPush = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
     
    vi.mocked(nextNavigation.useRouter).mockReturnValue({ push: mockPush, refresh: vi.fn() } as any)
     
    vi.mocked(nextNavigation.useSearchParams).mockReturnValue(new URLSearchParams() as any)
  })

  const genres = [
    { id: 'bonsai', name: '盆栽', category: '植物' },
    { id: 'tools', name: '道具', category: '用品' },
  ]

  it('地方選択時に都道府県がリセットされる', async () => {
    render(
      <ShopSearchForm
        genres={genres}
        initialRegion=""
        initialPrefecture=""
      />
    )

    const selects = screen.getAllByRole('combobox')
    const regionSelect = selects[1]! // 0: ジャンル, 1: 地方, 2: 都道府県, 3: ソート
    fireEvent.change(regionSelect, { target: { value: 'kanto' } })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('region=kanto'))
      expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('prefecture='))
    })
  })

  it('地方選択後に利用可能な都道府県が絞り込まれる', () => {
    render(
      <ShopSearchForm
        genres={genres}
        initialRegion="kanto"
        initialPrefecture=""
      />
    )

    const selects = screen.getAllByRole('combobox')
    const prefectureSelect = selects[2]! // 0: ジャンル, 1: 地方, 2: 都道府県, 3: ソート
    const options = Array.from(prefectureSelect!.querySelectorAll('option')).map((opt) => opt.textContent)

    expect(options).toContain('東京都')
    expect(options).toContain('神奈川県')
    expect(options).not.toContain('大阪府')
  })

  it('地方が未選択の場合、全都道府県が表示される', () => {
    render(
      <ShopSearchForm
        genres={genres}
        initialRegion=""
        initialPrefecture=""
      />
    )

    const selects = screen.getAllByRole('combobox')
    const prefectureSelect = selects[2]! // 0: ジャンル, 1: 地方, 2: 都道府県, 3: ソート
    const options = Array.from(prefectureSelect!.querySelectorAll('option')).map((opt) => opt.textContent)

    expect(options).toContain('東京都')
    expect(options).toContain('大阪府')
  })

  it('都道府県選択時に自動で検索が実行される', async () => {
    render(
      <ShopSearchForm
        genres={genres}
        initialRegion="kanto"
        initialPrefecture=""
      />
    )

    const selects = screen.getAllByRole('combobox')
    const prefectureSelect = selects[2]!
    fireEvent.change(prefectureSelect, { target: { value: '東京都' } })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('prefecture='))
    })
  })

  it('ソート順が location 以外の場合、URLパラメータに追加される', async () => {
    render(<ShopSearchForm genres={genres} initialSort="newest" />)

    const selects = screen.getAllByRole('combobox')
    const sortSelect = selects[3]!
    fireEvent.change(sortSelect, { target: { value: 'rating' } })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('sort=rating'))
    })
  })

  it('ソート順が location の場合、URLパラメータから削除される', async () => {
    render(<ShopSearchForm genres={genres} initialSort="newest" />)

    const selects = screen.getAllByRole('combobox')
    const sortSelect = selects[3]!
    fireEvent.change(sortSelect, { target: { value: 'location' } })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.not.stringContaining('sort='))
    })
  })

  it('リセットボタンで全フィルターがクリアされる', async () => {
    render(
      <ShopSearchForm
        genres={genres}
        initialSearch="test"
        initialGenre="bonsai"
        initialRegion="kanto"
        initialPrefecture="東京都"
        initialSort="newest"
      />
    )

    const resetButton = screen.getByText('リセット')
    fireEvent.click(resetButton)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/shops')
    })
  })

  it('Enter キーで検索が実行される', async () => {
    render(<ShopSearchForm genres={genres} />)

    const searchInput = screen.getByPlaceholderText('名前または住所で検索...')
    fireEvent.change(searchInput, { target: { value: 'テスト' } })
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled()
      const lastCall = mockPush.mock.calls[mockPush.mock.calls.length - 1]![0]!
      expect(lastCall).toContain('search=')
    })
  })

  it('ジャンル選択時に自動で検索が実行される', async () => {
    render(<ShopSearchForm genres={genres} />)

    const selects = screen.getAllByRole('combobox')
    const genreSelect = selects[0]!
    fireEvent.change(genreSelect, { target: { value: 'bonsai' } })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('genre=bonsai'))
    })
  })

  it('ジャンルをすべてに戻すと URLパラメータから削除される', async () => {
    render(<ShopSearchForm genres={genres} initialGenre="bonsai" />)

    const selects = screen.getAllByRole('combobox')
    const genreSelect = selects[0]!
    fireEvent.change(genreSelect, { target: { value: '' } })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.not.stringContaining('genre='))
    })
  })

  it('リセットボタンは条件が指定されている場合のみ表示される', () => {
    render(
      <ShopSearchForm genres={genres} initialSearch="test" />
    )

    expect(screen.getByText('リセット')).toBeInTheDocument()
  })
})

// ============================================================
// Target 3: ReviewCard
// ============================================================

import { ReviewCard } from '@/components/shop/ReviewCard'

describe('ReviewCard', async () => {
  const mockDeleteReview = vi.fn()
  const mockUpdateReview = vi.fn()
  const mockPrepareFileForUpload = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    const reviewActions = await import('@/lib/actions/review')
    reviewActions.deleteReview = mockDeleteReview
    reviewActions.updateReview = mockUpdateReview

    const clientImageCompression = await import('@/lib/client-image-compression')
    clientImageCompression.prepareFileForUpload = mockPrepareFileForUpload
  })

  const baseReview = {
    id: 'review1',
    rating: 5,
    content: 'とても良いです',
    createdAt: new Date('2024-01-01'),
    user: { id: 'user1', nickname: 'テストユーザー', avatarUrl: null },
    images: [],
  }

  it('画像がない場合、画像セクションが表示されない', () => {
    render(<ReviewCard review={baseReview} currentUserId="user1" />)

    expect(screen.queryByAltText('レビュー画像')).not.toBeInTheDocument()
  })

  it('コメントがない場合、コメントセクションが表示されない', () => {
    render(<ReviewCard review={{ ...baseReview, content: null }} currentUserId="user1" />)

    expect(screen.queryByText('とても良いです')).not.toBeInTheDocument()
  })

  it('オーナーでない場合、通報ボタンが表示される', () => {
    render(<ReviewCard review={baseReview} currentUserId="user2" />)

    expect(screen.getByText('通報')).toBeInTheDocument()
  })

  it('編集モードに切り替わる', () => {
    render(<ReviewCard review={baseReview} currentUserId="user1" />)

    const editButton = screen.getByTitle('編集')
    fireEvent.click(editButton)

    expect(screen.getByText('保存')).toBeInTheDocument()
    expect(screen.getByText('キャンセル')).toBeInTheDocument()
  })

  it('編集キャンセルで元に戻る', () => {
    render(<ReviewCard review={baseReview} currentUserId="user1" />)

    const editButton = screen.getByTitle('編集')
    fireEvent.click(editButton)

    const cancelButton = screen.getByText('キャンセル')
    fireEvent.click(cancelButton)

    expect(screen.queryByText('保存')).not.toBeInTheDocument()
  })

  it('削除確認キャンセルでダイアログが閉じる', () => {
    render(<ReviewCard review={baseReview} currentUserId="user1" />)

    const deleteButton = screen.getByTitle('削除')
    fireEvent.click(deleteButton)

    expect(screen.getByText('削除する')).toBeInTheDocument()

    const cancelButton = screen.getByText('キャンセル')
    fireEvent.click(cancelButton)

    expect(screen.queryByText('削除する')).not.toBeInTheDocument()
  })

  it('削除が実行される', async () => {
    mockDeleteReview.mockResolvedValue({ success: true })

    render(<ReviewCard review={baseReview} currentUserId="user1" />)

    const deleteButton = screen.getByTitle('削除')
    fireEvent.click(deleteButton)

    const confirmButton = screen.getByText('削除する')
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockDeleteReview).toHaveBeenCalledWith('review1')
    })
  })

  it('既存画像を削除マークして復元できる', () => {
    const reviewWithImages = {
      ...baseReview,
      images: [{ id: 'img1', url: '/image1.jpg' }],
    }

    render(<ReviewCard review={reviewWithImages} currentUserId="user1" />)

    const editButton = screen.getByTitle('編集')
    fireEvent.click(editButton)

    const deleteImageButton = screen.getAllByRole('button').find((btn) => btn.querySelector('svg'))
    if (deleteImageButton) {
      fireEvent.click(deleteImageButton)
    }

    const restoreButton = screen.getByText('元に戻す')
    fireEvent.click(restoreButton)

    expect(screen.queryByText('元に戻す')).not.toBeInTheDocument()
  })

  it('画像アップロードが3枚を超える場合エラーが表示される', async () => {
    const reviewWithImages = {
      ...baseReview,
      images: [
        { id: 'img1', url: '/image1.jpg' },
        { id: 'img2', url: '/image2.jpg' },
        { id: 'img3', url: '/image3.jpg' },
      ],
    }

    const { container } = render(<ReviewCard review={reviewWithImages} currentUserId="user1" />)

    const editButton = screen.getByTitle('編集')
    fireEvent.click(editButton)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('画像は3枚までです')).toBeInTheDocument()
    })
  })

  it('画像サイズが大きすぎる場合エラーが表示される', async () => {
    const { container } = render(<ReviewCard review={baseReview} currentUserId="user1" />)

    const editButton = screen.getByTitle('編集')
    fireEvent.click(editButton)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })

    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    await waitFor(() => {
      expect(screen.getByText(/画像は10MB以下にしてください/)).toBeInTheDocument()
    })
  })

  it('画像アップロード成功で新規画像が追加される', async () => {
    mockPrepareFileForUpload.mockResolvedValue(new File(['compressed'], 'compressed.jpg', { type: 'image/jpeg' }))

    // XMLHttpRequest のモック
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      addEventListener: vi.fn((event, handler) => {
        if (event === 'load') {
          setTimeout(() => {
            Object.defineProperty(mockXHR, 'status', { value: 200 })
            Object.defineProperty(mockXHR, 'responseText', { value: JSON.stringify({ url: '/uploaded.jpg' }) })
            handler()
          }, 0)
        }
      }),
    }
    global.XMLHttpRequest = vi.fn(function() { return mockXHR }) as unknown as typeof XMLHttpRequest

    const { container } = render(<ReviewCard review={baseReview} currentUserId="user1" />)

    const editButton = screen.getByTitle('編集')
    fireEvent.click(editButton)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('新規')).toBeInTheDocument()
    })
  })

  it('編集内容が保存される', async () => {
    mockUpdateReview.mockResolvedValue({ success: true })

    render(<ReviewCard review={baseReview} currentUserId="user1" />)

    const editButton = screen.getByTitle('編集')
    fireEvent.click(editButton)

    const commentInput = screen.getByPlaceholderText('レビューコメント（任意）')
    fireEvent.change(commentInput, { target: { value: '更新しました' } })

    const saveButton = screen.getByText('保存')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockUpdateReview).toHaveBeenCalledWith('review1', expect.any(FormData))
    })
  })

  it('編集時のエラーが表示される', async () => {
    mockUpdateReview.mockResolvedValue({ success: false, error: '保存に失敗しました' })

    render(<ReviewCard review={baseReview} currentUserId="user1" />)

    const editButton = screen.getByTitle('編集')
    fireEvent.click(editButton)

    const saveButton = screen.getByText('保存')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()
    })
  })

  it('currentUserId がない場合、通報ボタンが表示されない', () => {
    render(<ReviewCard review={baseReview} />)

    expect(screen.queryByText('通報')).not.toBeInTheDocument()
  })
})

// ============================================================
// Target 4: MentionTextarea
// ============================================================

import { MentionTextarea } from '@/components/common/MentionTextarea'

describe('MentionTextarea', async () => {
  const mockSearchMentionUsers = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    const mentionActions = await import('@/lib/actions/mention')
    mentionActions.searchMentionUsers = mockSearchMentionUsers
  })

  it('@ 入力で候補が表示される', async () => {
    mockSearchMentionUsers.mockResolvedValue([
      { id: 'user1', nickname: 'テストユーザー', avatarUrl: null, isFollowing: true },
    ])

    const handleChange = vi.fn()
    render(<MentionTextarea value="" onChange={handleChange} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@テスト' } })

    await waitFor(() => {
      expect(screen.getByText('@テストユーザー')).toBeInTheDocument()
    })
  })

  it('候補が空の場合、ドロップダウンが表示されない', async () => {
    mockSearchMentionUsers.mockResolvedValue([])

    const handleChange = vi.fn()
    render(<MentionTextarea value="" onChange={handleChange} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@存在しない' } })

    await waitFor(() => {
      expect(mockSearchMentionUsers).toHaveBeenCalled()
    })

    expect(screen.queryByText('検索中...')).not.toBeInTheDocument()
  })

  it('Escape キーでドロップダウンが閉じる', async () => {
    mockSearchMentionUsers.mockResolvedValue([
      { id: 'user1', nickname: 'テストユーザー', avatarUrl: null, isFollowing: true },
    ])

    const handleChange = vi.fn()
    render(<MentionTextarea value="" onChange={handleChange} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@テスト' } })

    await waitFor(() => {
      expect(screen.getByText('@テストユーザー')).toBeInTheDocument()
    })

    fireEvent.keyDown(textarea, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('@テストユーザー')).not.toBeInTheDocument()
    })
  })

  it('ArrowDown キーで選択が移動する', async () => {
    mockSearchMentionUsers.mockResolvedValue([
      { id: 'user1', nickname: 'ユーザー1', avatarUrl: null, isFollowing: true },
      { id: 'user2', nickname: 'ユーザー2', avatarUrl: null, isFollowing: false },
    ])

    const handleChange = vi.fn()
    render(<MentionTextarea value="" onChange={handleChange} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@' } })

    await waitFor(() => {
      expect(screen.getByText('@ユーザー1')).toBeInTheDocument()
    })

    fireEvent.keyDown(textarea, { key: 'ArrowDown' })

    // bg-muted クラスが2番目の要素に適用されるか確認
    const buttons = screen.getAllByRole('button').filter((btn) => btn.textContent?.includes('@'))
    expect(buttons[1]!.className).toContain('bg-muted')
  })

  it('ArrowUp キーで選択がラップする', async () => {
    mockSearchMentionUsers.mockResolvedValue([
      { id: 'user1', nickname: 'ユーザー1', avatarUrl: null, isFollowing: true },
      { id: 'user2', nickname: 'ユーザー2', avatarUrl: null, isFollowing: false },
    ])

    const handleChange = vi.fn()
    render(<MentionTextarea value="" onChange={handleChange} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@' } })

    await waitFor(() => {
      expect(screen.getByText('@ユーザー1')).toBeInTheDocument()
    })

    fireEvent.keyDown(textarea, { key: 'ArrowUp' })

    // 最初の要素から上に行くと最後の要素に移動
    const buttons = screen.getAllByRole('button').filter((btn) => btn.textContent?.includes('@'))
    expect(buttons[1]!.className).toContain('bg-muted')
  })

  it('Enter キーで選択が確定される', async () => {
    mockSearchMentionUsers.mockResolvedValue([
      { id: 'user1', nickname: 'テストユーザー', avatarUrl: null, isFollowing: true },
    ])

    const handleChange = vi.fn()
    render(<MentionTextarea value="" onChange={handleChange} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@テスト' } })

    await waitFor(() => {
      expect(screen.getByText('@テストユーザー')).toBeInTheDocument()
    })

    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith(expect.stringContaining('<@user1>'))
    })
  })

  it('Tab キーで選択が確定される', async () => {
    mockSearchMentionUsers.mockResolvedValue([
      { id: 'user1', nickname: 'テストユーザー', avatarUrl: null, isFollowing: true },
    ])

    const handleChange = vi.fn()
    render(<MentionTextarea value="" onChange={handleChange} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@テスト' } })

    await waitFor(() => {
      expect(screen.getByText('@テストユーザー')).toBeInTheDocument()
    })

    fireEvent.keyDown(textarea, { key: 'Tab' })

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith(expect.stringContaining('<@user1>'))
    })
  })

  it('クリックで選択が確定される', async () => {
    mockSearchMentionUsers.mockResolvedValue([
      { id: 'user1', nickname: 'テストユーザー', avatarUrl: null, isFollowing: true },
    ])

    const handleChange = vi.fn()
    render(<MentionTextarea value="" onChange={handleChange} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@テスト' } })

    await waitFor(() => {
      expect(screen.getByText('@テストユーザー')).toBeInTheDocument()
    })

    const userButton = screen.getByText('@テストユーザー')
    fireEvent.click(userButton)

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith(expect.stringContaining('<@user1>'))
    })
  })

  it('候補がない場合、キーボード操作が無効になる', async () => {
    mockSearchMentionUsers.mockResolvedValue([])

    const handleChange = vi.fn()
    render(<MentionTextarea value="" onChange={handleChange} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@' } })

    await waitFor(() => {
      expect(mockSearchMentionUsers).toHaveBeenCalled()
    })

    // 候補がないので Enter を押しても何も起きない
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(handleChange).toHaveBeenCalledTimes(1) // onChange は1回のみ（Enterは無効）
  })

  it('@ の前に空白がない場合、メンションが発動しない', async () => {
    mockSearchMentionUsers.mockResolvedValue([
      { id: 'user1', nickname: 'テストユーザー', avatarUrl: null, isFollowing: true },
    ])

    const handleChange = vi.fn()
    render(<MentionTextarea value="" onChange={handleChange} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'test@' } })

    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(mockSearchMentionUsers).not.toHaveBeenCalled()
  })

  it('@ の後にスペースがある場合、メンションが発動しない', async () => {
    mockSearchMentionUsers.mockResolvedValue([])

    const handleChange = vi.fn()
    render(<MentionTextarea value="" onChange={handleChange} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@ ' } })

    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(mockSearchMentionUsers).not.toHaveBeenCalled()
  })
})
