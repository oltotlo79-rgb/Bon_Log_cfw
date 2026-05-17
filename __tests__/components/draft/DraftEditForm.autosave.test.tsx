/**
 * DraftEditForm - auto-save branch coverage
 *
 * Targets:
 * - autoSaveStatus === 'saving' display branch
 * - autoSaveStatus === 'saved' display branch with savedTime
 * - autoSave error path (saveDraft returns error)
 * - autoSave exception path (saveDraft throws)
 * - cleanup of savedDisplayTimer
 * - initial mount skip (isMountedRef)
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '../../utils/test-utils'
import { DraftEditForm } from '@/components/draft/DraftEditForm'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

const mockSaveDraft = vi.fn()
const mockPublishDraft = vi.fn()
const mockDeleteDraft = vi.fn()
vi.mock('@/lib/actions/draft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
  publishDraft: (...args: unknown[]) => mockPublishDraft(...args),
  deleteDraft: (...args: unknown[]) => mockDeleteDraft(...args),
}))

vi.mock('@/components/post/GenreSelector', () => ({
  GenreSelector: ({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) => (
    <div data-testid="genre-selector">
      <span data-testid="selected-genres">{selectedIds.join(',')}</span>
      <button data-testid="change-genres" onClick={() => onChange(['genre-new'])}>ジャンル変更</button>
    </div>
  ),
}))

vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn(),
  isVideoFile: vi.fn().mockReturnValue(false),
  formatFileSize: vi.fn().mockReturnValue('1 MB'),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: vi.fn(),
}))

window.confirm = vi.fn().mockReturnValue(true)

describe('DraftEditForm - auto-save branches', () => {
  const mockDraft = {
    id: 'draft-1',
    content: 'テスト下書き',
    media: [],
    genres: [],
  }

  const mockGenres = {
    '樹種': [
      { id: 'genre-1', name: '松柏類', category: '樹種' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockSaveDraft.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('テキスト変更後にauto-saveが発火し保存中→保存完了を表示する', async () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const textarea = screen.getByPlaceholderText('いまどうしてる？')

    // Change text to trigger auto-save
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '変更テスト' } })
    })

    // Advance past the debounce delay (3 seconds)
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled()
    })

    // After save completes, should show "自動保存しました"
    await waitFor(() => {
      expect(screen.getByText(/自動保存しました/)).toBeInTheDocument()
    })

    // After DRAFT_AUTOSAVE_SAVED_DISPLAY_MS (3000ms), status goes back to idle
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    await waitFor(() => {
      expect(screen.queryByText(/自動保存しました/)).not.toBeInTheDocument()
    })
  })

  it('auto-saveでsaveDraftがエラーを返した場合ステータスがidleに戻る', async () => {
    mockSaveDraft.mockResolvedValue({ error: '保存に失敗' })
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const textarea = screen.getByPlaceholderText('いまどうしてる？')

    await act(async () => {
      fireEvent.change(textarea, { target: { value: '変更テスト' } })
    })

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled()
    })

    // Should not show "自動保存しました" because it errored
    expect(screen.queryByText(/自動保存しました/)).not.toBeInTheDocument()
  })

  it('auto-saveでsaveDraftが例外をスローした場合ステータスがidleに戻る', async () => {
    mockSaveDraft.mockRejectedValue(new Error('Network'))
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const textarea = screen.getByPlaceholderText('いまどうしてる？')

    await act(async () => {
      fireEvent.change(textarea, { target: { value: '変更テスト' } })
    })

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled()
    })

    expect(screen.queryByText(/自動保存しました/)).not.toBeInTheDocument()
  })

  it('ジャンル変更でもauto-saveが発火する', async () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('change-genres'))
    })

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled()
    })
  })

  it('連続変更時にデバウンスが機能し最後の変更のみ保存される', async () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const textarea = screen.getByPlaceholderText('いまどうしてる？')

    // First change
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '変更1' } })
    })

    // Wait 1 second (not enough for debounce)
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    // Second change should reset the timer
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '変更2' } })
    })

    // Advance past the debounce delay
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    await waitFor(() => {
      // The last call should have '変更2' as content
      const lastCall = mockSaveDraft.mock.calls[mockSaveDraft.mock.calls.length - 1]
      expect(lastCall[0].content).toBe('変更2')
    })
  })
})
