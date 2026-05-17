import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnalogClockPicker } from '@/components/ui/AnalogClockPicker'

// Mock dependencies for PostForm and PostFormModal
const mockCreatePost = vi.fn()
const mockSaveDraft = vi.fn()
const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('@/lib/actions/post', () => ({
  createPost: (...args: unknown[]) => mockCreatePost(...args),
}))

vi.mock('@/lib/actions/draft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
}))

vi.mock('@/lib/actions/mention', () => ({
  searchMentionUsers: vi.fn().mockResolvedValue([]),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh
  }),
}))

// Mock toast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
  useToast: () => ({
    toast: mockToast,
    toasts: [],
  }),
}))

// Mock client image compression
const mockPrepareFileForUpload = vi.fn()
const mockIsVideoFile = vi.fn()
const mockUploadVideoToR2 = vi.fn()

vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: (...args: unknown[]) => mockPrepareFileForUpload(...args),
  isVideoFile: (...args: unknown[]) => mockIsVideoFile(...args),
  formatFileSize: vi.fn().mockReturnValue('1 MB'),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: (...args: unknown[]) => mockUploadVideoToR2(...args),
}))

vi.mock('@/components/post/GenreSelector', () => ({
  GenreSelector: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button data-testid="genre-selector" onClick={() => onChange(['g1'])}>GenreSelector</button>
  ),
}))

vi.mock('@/components/post/PollForm', () => ({
  PollForm: ({
    isActive,
    onToggle,
    options: _options,
    onOptionsChange
  }: {
    isActive: boolean;
    onToggle: () => void;
    options: string[];
    onOptionsChange: (opts: string[]) => void
  }) => (
    <div data-testid="poll-form">
      {!isActive ? (
        <button
          data-testid="activate-poll"
          onClick={onToggle}
        >
          アンケート
        </button>
      ) : (
        <button
          data-testid="clear-poll"
          onClick={() => onOptionsChange(['', ''])}
        >
          Clear Poll
        </button>
      )}
    </div>
  ),
}))


vi.mock('@/components/common/MentionTextarea', () => ({
  MentionTextarea: ({
    value,
    onChange,
    placeholder
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string
  }) => (
    <textarea
      data-testid="mention-textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}))

vi.mock('lucide-react', () => {
  const icon = (name: string) => { const Icon = (props: Record<string, unknown>) => <span data-testid={`icon-${name}`} {...props}>{name}</span>; Icon.displayName = name; return Icon }
  return {
    __esModule: true,
    Heart: icon('Heart'), MessageSquare: icon('MessageSquare'), Search: icon('Search'),
    Bell: icon('Bell'), BellOff: icon('BellOff'), Crown: icon('Crown'), Check: icon('Check'),
    Star: icon('Star'), Settings: icon('Settings'), User: icon('User'), Users: icon('Users'),
    Shield: icon('Shield'), Ban: icon('Ban'), VolumeX: icon('VolumeX'),
    Bookmark: icon('Bookmark'), Plus: icon('Plus'), MoreHorizontal: icon('MoreHorizontal'),
    Edit: icon('Edit'), Trash2: icon('Trash2'), Flag: icon('Flag'), Share: icon('Share'),
    X: icon('X'), Image: icon('Image'), ImageIcon: icon('ImageIcon'), Camera: icon('Camera'),
    Clock: icon('Clock'), Loader2: icon('Loader2'), AlertCircle: icon('AlertCircle'),
    FileText: icon('FileText'), Calendar: icon('Calendar'), MapPin: icon('MapPin'),
    Home: icon('Home'), ArrowLeft: icon('ArrowLeft'), ChevronDown: icon('ChevronDown'),
    ChevronUp: icon('ChevronUp'), MessageCircle: icon('MessageCircle'),
    TrendingUp: icon('TrendingUp'), BarChart3: icon('BarChart3'),
    CheckCircle: icon('CheckCircle'), XCircle: icon('XCircle'),
    ExternalLink: icon('ExternalLink'), Receipt: icon('Receipt'),
  }
})

// Import after mocks
import { PostForm } from '@/components/post/PostForm'
import { PostFormModal } from '@/components/post/PostFormModal'

describe('AnalogClockPicker', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('不正な時間値の処理', () => {
    it('不正な時間文字列を内部でデフォルト値に変換する', async () => {
      render(
        <AnalogClockPicker
          value="ab:cd"
          onChange={mockOnChange}
          label="時間選択"
        />
      )

      // Button displays the raw value
      expect(screen.getByText('ab:cd')).toBeInTheDocument()

      // Open picker - internally parseTime converts to default values (9:00)
      const button = screen.getByRole('button')
      await userEvent.click(button)

      // Check that the picker opened (contains OK button)
      await waitFor(() => {
        expect(screen.getByText('OK')).toBeInTheDocument()
      })
      // The clock should show hour numbers including 9
      expect(screen.getByText('9')).toBeInTheDocument()
    })

    it('空の値を--:--として表示する', () => {
      render(
        <AnalogClockPicker
          value=""
          onChange={mockOnChange}
          label="時間選択"
        />
      )

      expect(screen.getByText('--:--')).toBeInTheDocument()
    })
  })

  describe('ラベル表示', () => {
    it('ラベルなしで正しく表示される', () => {
      const { container } = render(
        <AnalogClockPicker
          value="10:30"
          onChange={mockOnChange}
        />
      )

      const label = container.querySelector('label')
      expect(label).not.toBeInTheDocument()
    })

    it('ラベルありで正しく表示される', () => {
      render(
        <AnalogClockPicker
          value="10:30"
          onChange={mockOnChange}
          label="開始時刻"
        />
      )

      expect(screen.getByText('開始時刻')).toBeInTheDocument()
    })
  })

  describe('無効化状態', () => {
    it('無効化時はクリックしてもピッカーが開かない', async () => {
      render(
        <AnalogClockPicker
          value="10:30"
          onChange={mockOnChange}
          label="時間選択"
          disabled={true}
        />
      )

      const button = screen.getByRole('button')
      await userEvent.click(button)

      // Clock container should not appear
      const clockContainer = screen.queryByRole('presentation')
      expect(clockContainer).not.toBeInTheDocument()
    })
  })

  describe('時計の操作', () => {
    it('時計を開くことができる', async () => {
      render(
        <AnalogClockPicker
          value="09:00"
          onChange={mockOnChange}
          label="時間選択"
        />
      )

      const button = screen.getByRole('button')
      await userEvent.click(button)

      // Wait for picker to open (verify OK and Cancel buttons are present)
      await waitFor(() => {
        expect(screen.getByText('OK')).toBeInTheDocument()
        expect(screen.getByText('キャンセル')).toBeInTheDocument()
      })
    })

    it('キャンセルボタンでピッカーが閉じる', async () => {
      render(
        <AnalogClockPicker
          value="10:30"
          onChange={mockOnChange}
          label="時間選択"
        />
      )

      const button = screen.getByRole('button')
      await userEvent.click(button)

      // Wait for picker to open
      await waitFor(() => {
        expect(screen.getByText('キャンセル')).toBeInTheDocument()
      })

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: 'キャンセル' })
      await userEvent.click(cancelButton)

      // Picker should close
      await waitFor(() => {
        expect(screen.queryByText('OK')).not.toBeInTheDocument()
      })

      // Should NOT call onChange
      expect(mockOnChange).not.toHaveBeenCalled()
    })
  })
})

// XMLHttpRequest モック
class MockXHR {
  status = 200
  responseText = '{}'
  upload = { addEventListener: vi.fn() }
  addEventListener = vi.fn()
  open = vi.fn()
  send = vi.fn()
  abort = vi.fn()
}

const mockXHRInstances: MockXHR[] = []

describe('PostForm', () => {
  const defaultLimits = {
    maxPostLength: 500,
    maxImages: 4,
    maxVideos: 1,
    maxDailyPosts: 20,
    maxDailyComments: 100,
    maxMessageLength: 1000,
    maxDailyMessages: 50,
    maxBookmarks: 100,
    maxFollows: 500,
    maxBonsaiRecords: 50,
    canCreateEvents: false,
    canUseAnalytics: false,
    canCreateShops: false,
    maxReviewLength: 500,
  }

  const defaultGenres = {
    '松柏類': [
      { id: 'g1', name: '黒松', category: '松柏類' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsVideoFile.mockReturnValue(false)
    mockPrepareFileForUpload.mockResolvedValue(new File(['test'], 'test.jpg', { type: 'image/jpeg' }))
    mockXHRInstances.length = 0
    global.XMLHttpRequest = vi.fn(function() {
      const instance = new MockXHR()
      mockXHRInstances.push(instance)
      return instance as unknown as XMLHttpRequest
    }) as unknown as typeof XMLHttpRequest
  })

  describe('下書きカウント表示', () => {
    it('下書きが0件の場合は下書き一覧リンクが表示されない', () => {
      const { container } = render(
        <PostForm
          genres={defaultGenres}
          limits={defaultLimits}
          draftCount={0}
        />
      )

      // Should not show the draft list link (but draft save button is always present)
      const link = container.querySelector('a[href="/drafts"]')
      expect(link).not.toBeInTheDocument()
    })

    it('下書きが1件以上の場合は下書き一覧リンクが表示される', () => {
      const { container } = render(
        <PostForm
          genres={defaultGenres}
          limits={defaultLimits}
          draftCount={3}
        />
      )

      // The link has href="/drafts" and title="下書き一覧"
      const link = container.querySelector('a[href="/drafts"]')
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('title', '下書き一覧')
    })
  })

  describe('プレミアムバッジ表示', () => {
    it('maxPostLengthが500以下の場合はバッジが表示されない', () => {
      render(
        <PostForm
          genres={defaultGenres}
          limits={{ ...defaultLimits, maxPostLength: 500 }}
          draftCount={0}
        />
      )

      expect(screen.queryByText(/Premium/i)).not.toBeInTheDocument()
    })

    it('maxPostLengthが500より大きい場合はバッジが表示される', () => {
      render(
        <PostForm
          genres={defaultGenres}
          limits={{ ...defaultLimits, maxPostLength: 1000 }}
          draftCount={0}
        />
      )

      expect(screen.getByText(/Premium/i)).toBeInTheDocument()
    })
  })

})

describe('PostFormModal', () => {
  const defaultLimits = {
    maxPostLength: 500,
    maxImages: 4,
    maxVideos: 1,
    maxDailyPosts: 20,
    maxDailyComments: 100,
    maxMessageLength: 1000,
    maxDailyMessages: 50,
    maxBookmarks: 100,
    maxFollows: 500,
    maxBonsaiRecords: 50,
    canCreateEvents: false,
    canUseAnalytics: false,
    canCreateShops: false,
    maxReviewLength: 500,
  }

  const defaultGenres = {
    '松柏類': [
      { id: 'g1', name: '黒松', category: '松柏類' },
    ],
  }

  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('盆栽ドロップダウン表示', () => {
    it('盆栽が0件の場合はドロップダウンが表示されない', () => {
      render(
        <PostFormModal
          isOpen={true}
          onClose={mockOnClose}
          genres={defaultGenres}
          bonsais={[]}
          limits={defaultLimits}
        />
      )

      expect(screen.queryByText(/関連する盆栽/)).not.toBeInTheDocument()
    })

    it('盆栽が1件以上の場合はドロップダウンが表示される', () => {
      render(
        <PostFormModal
          isOpen={true}
          onClose={mockOnClose}
          genres={defaultGenres}
          bonsais={[
            { id: 'b1', name: '黒松', species: '松' },
          ]}
          limits={defaultLimits}
        />
      )

      expect(screen.getByText(/関連する盆栽/)).toBeInTheDocument()
    })

    it('盆栽のspeciesがnullの場合は品種表示がない', () => {
      render(
        <PostFormModal
          isOpen={true}
          onClose={mockOnClose}
          genres={defaultGenres}
          bonsais={[
            { id: 'b1', name: '黒松', species: null },
          ]}
          limits={defaultLimits}
        />
      )

      // Find the option element
      const option = screen.getByRole('option', { name: '黒松' })
      expect(option).toBeInTheDocument()
      // Should not contain parentheses (no species)
      expect(option.textContent).not.toContain('(')
    })

    it('盆栽のspeciesがある場合は品種が表示される', () => {
      render(
        <PostFormModal
          isOpen={true}
          onClose={mockOnClose}
          genres={defaultGenres}
          bonsais={[
            { id: 'b1', name: '黒松', species: 'Pinus thunbergii' },
          ]}
          limits={defaultLimits}
        />
      )

      // Find the option and check it contains both name and species
      const options = screen.getAllByRole('option')
      const bonsaiOption = options.find(opt => opt.textContent?.includes('黒松'))
      expect(bonsaiOption).toBeDefined()
      expect(bonsaiOption?.textContent).toContain('(Pinus thunbergii)')
    })
  })

  describe('モーダルクローズ処理', () => {
    it('コンテンツなし・アップロードなしの場合は確認なしで閉じる', async () => {
      render(
        <PostFormModal
          isOpen={true}
          onClose={mockOnClose}
          genres={defaultGenres}
          bonsais={[]}
          limits={defaultLimits}
        />
      )

      // Close button (first button in header)
      const buttons = screen.getAllByRole('button')
      const closeButton = buttons[0]
      await userEvent.click(closeButton)

      // Should close immediately without confirmation
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('コンテンツありの場合は確認ダイアログが表示される（キャンセル）', async () => {
      // Mock window.confirm to return false (cancel)
      const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

      render(
        <PostFormModal
          isOpen={true}
          onClose={mockOnClose}
          genres={defaultGenres}
          bonsais={[]}
          limits={defaultLimits}
        />
      )

      // Type content
      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      await userEvent.type(textarea, 'Some content')

      // Try to close (first button in header)
      const buttons = screen.getAllByRole('button')
      const closeButton = buttons[0] // First button is the close button
      await userEvent.click(closeButton)

      // Confirm should be called
      expect(mockConfirm).toHaveBeenCalled()

      // Should NOT close
      expect(mockOnClose).not.toHaveBeenCalled()

      mockConfirm.mockRestore()
    })

    it('コンテンツありの場合は確認ダイアログが表示される（OK）', async () => {
      // Mock window.confirm to return true (OK)
      const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

      render(
        <PostFormModal
          isOpen={true}
          onClose={mockOnClose}
          genres={defaultGenres}
          bonsais={[]}
          limits={defaultLimits}
        />
      )

      // Type content
      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      await userEvent.type(textarea, 'Some content')

      // Try to close (first button in header)
      const buttons = screen.getAllByRole('button')
      const closeButton = buttons[0] // First button is the close button
      await userEvent.click(closeButton)

      // Confirm should be called
      expect(mockConfirm).toHaveBeenCalled()

      // Should close
      expect(mockOnClose).toHaveBeenCalled()

      mockConfirm.mockRestore()
    })
  })
})
