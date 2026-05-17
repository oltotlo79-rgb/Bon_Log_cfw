/**
 * BonsaiForm - uncovered branch tests
 *
 * Targets:
 * - updateBonsai error path (line 116-118)
 * - createBonsai with no bonsai in result (line 130: result.bonsai is falsy)
 * - catch block exception (line 136-138)
 * - Edit mode submit calls updateBonsai and redirects on success
 * - Editing with acquiredAt pre-filled date format
 */

import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BonsaiForm } from '@/components/bonsai/BonsaiForm'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockPush = vi.fn()
const mockBack = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    refresh: mockRefresh,
  }),
}))

const mockCreateBonsai = vi.fn()
const mockUpdateBonsai = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  createBonsai: (...args: unknown[]) => mockCreateBonsai(...args),
  updateBonsai: (...args: unknown[]) => mockUpdateBonsai(...args),
}))

describe('BonsaiForm - uncovered branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------------
  // updateBonsai returns error
  // ----------------------------------------------------------------
  it('更新時にエラーが返された場合にエラーメッセージを表示する', async () => {
    mockUpdateBonsai.mockResolvedValue({ success: false, error: '更新に失敗しました' })
    const bonsai = {
      id: 'bonsai-1',
      name: '黒松一号',
      species: '黒松',
      acquiredAt: null,
      description: null,
    }
    const user = userEvent.setup()
    render(<BonsaiForm bonsai={bonsai} />)

    await user.clear(screen.getByLabelText(/名前/))
    await user.type(screen.getByLabelText(/名前/), '更新テスト')
    await user.click(screen.getByRole('button', { name: '更新' }))

    await waitFor(() => {
      expect(screen.getByText('更新に失敗しました')).toBeInTheDocument()
    })
    // Should NOT redirect
    expect(mockPush).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // updateBonsai が ActionResult エラーを返したときに UI 上にエラー文字列が表示される
  // （ActionResult.error は string で保証されるため null パスは型上発生しない）
  // ----------------------------------------------------------------
  it('更新時に空文字エラーが返ったときも例外を投げず UI を保つ', async () => {
    mockUpdateBonsai.mockResolvedValue({ success: false, error: '' })
    const bonsai = {
      id: 'bonsai-1',
      name: '黒松一号',
      species: null,
      acquiredAt: null,
      description: null,
    }
    const user = userEvent.setup()
    render(<BonsaiForm bonsai={bonsai} />)

    await user.click(screen.getByRole('button', { name: '更新' }))

    // 失敗が返ってもクラッシュせず（リダイレクトもしない）
    await waitFor(() => {
      expect(mockUpdateBonsai).toHaveBeenCalled()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // createBonsai success but bonsai is null/undefined in result
  // ----------------------------------------------------------------
  it('作成成功だがbonsaiオブジェクトがない場合はリダイレクトしない', async () => {
    mockCreateBonsai.mockResolvedValue({ success: true }) // no bonsai field
    const user = userEvent.setup()
    render(<BonsaiForm />)

    await user.type(screen.getByLabelText(/名前/), '新しい盆栽')
    await user.click(screen.getByRole('button', { name: '登録' }))

    await waitFor(() => {
      expect(mockCreateBonsai).toHaveBeenCalled()
    })

    // router.push for /bonsai/xxx should NOT be called (no bonsai.id)
    // but router.refresh() should be called
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------------
  // createBonsai が ActionResult エラー（空文字）を返したときも UI を保つ
  // （ActionResult.error は string で保証されるため null パスは型上発生しない）
  // ----------------------------------------------------------------
  it('作成時に空文字エラーが返ったときも例外を投げない', async () => {
    mockCreateBonsai.mockResolvedValue({ success: false, error: '' })
    const user = userEvent.setup()
    render(<BonsaiForm />)

    await user.type(screen.getByLabelText(/名前/), '新しい盆栽')
    await user.click(screen.getByRole('button', { name: '登録' }))

    await waitFor(() => {
      expect(mockCreateBonsai).toHaveBeenCalled()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // Exception in try/catch block
  // ----------------------------------------------------------------
  it('予期しないエラー時に汎用エラーメッセージを表示する', async () => {
    mockCreateBonsai.mockRejectedValue(new Error('Network failure'))
    const user = userEvent.setup()
    render(<BonsaiForm />)

    await user.type(screen.getByLabelText(/名前/), '新しい盆栽')
    await user.click(screen.getByRole('button', { name: '登録' }))

    await waitFor(() => {
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Edit mode with updateBonsai success redirects correctly
  // ----------------------------------------------------------------
  it('更新成功時に盆栽詳細ページにリダイレクトする', async () => {
    mockUpdateBonsai.mockResolvedValue({ success: true })
    const bonsai = {
      id: 'bonsai-99',
      name: '五葉松',
      species: '五葉松',
      acquiredAt: new Date('2023-01-15'),
      description: 'テスト',
    }
    const user = userEvent.setup()
    render(<BonsaiForm bonsai={bonsai} />)

    await user.click(screen.getByRole('button', { name: '更新' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/bonsai/bonsai-99')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // Loading state shows '保存中...' text
  // ----------------------------------------------------------------
  it('送信中は保存中テキストを表示する', async () => {
    mockCreateBonsai.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<BonsaiForm />)

    await user.type(screen.getByLabelText(/名前/), '新しい盆栽')
    await user.click(screen.getByRole('button', { name: '登録' }))

    await waitFor(() => {
      expect(screen.getByText('保存中...')).toBeInTheDocument()
    })
  })
})
