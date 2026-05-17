import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BonsaiForm } from '@/components/bonsai/BonsaiForm'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
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

// Server Actions モック
const mockCreateBonsai = vi.fn()
const mockUpdateBonsai = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  createBonsai: (...args: unknown[]) => mockCreateBonsai(...args),
  updateBonsai: (...args: unknown[]) => mockUpdateBonsai(...args),
}))

describe('BonsaiForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('新規作成フォームを表示する', () => {
    render(<BonsaiForm />)
    expect(screen.getByLabelText(/名前/)).toBeInTheDocument()
    expect(screen.getByLabelText(/樹種/)).toBeInTheDocument()
    expect(screen.getByLabelText(/入手日/)).toBeInTheDocument()
    expect(screen.getByLabelText(/メモ/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登録' })).toBeInTheDocument()
  })

  it('編集フォームに初期値を設定する', () => {
    const bonsai = {
      id: 'bonsai-1',
      name: '黒松一号',
      species: '黒松',
      acquiredAt: new Date('2020-04-01'),
      description: 'お気に入りの黒松',
    }
    render(<BonsaiForm bonsai={bonsai} />)
    expect(screen.getByDisplayValue('黒松一号')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '更新' })).toBeInTheDocument()
  })

  it('名前が必須', () => {
    render(<BonsaiForm />)
    const nameInput = screen.getByLabelText(/名前/)
    expect(nameInput).toBeRequired()
  })

  it('キャンセルボタンで戻る', async () => {
    const user = userEvent.setup()
    render(<BonsaiForm />)

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(mockBack).toHaveBeenCalled()
  })

  it('樹種選択に松柏類がある', () => {
    render(<BonsaiForm />)
    const speciesSelect = screen.getByLabelText(/樹種/)
    expect(speciesSelect).toBeInTheDocument()
    // optgroup内のオプションを確認
    expect(screen.getByText('黒松')).toBeInTheDocument()
    expect(screen.getByText('五葉松')).toBeInTheDocument()
  })

  it('樹種選択に雑木類がある', () => {
    render(<BonsaiForm />)
    expect(screen.getByText('紅葉')).toBeInTheDocument()
    expect(screen.getByText('欅')).toBeInTheDocument()
  })

  it('新規作成でServer Actionが呼ばれる', async () => {
    mockCreateBonsai.mockResolvedValue({ success: true, data: { bonsai: { id: 'new-bonsai-id' } } })
    const user = userEvent.setup()
    render(<BonsaiForm />)

    await user.type(screen.getByLabelText(/名前/), '新しい盆栽')
    await user.click(screen.getByRole('button', { name: '登録' }))

    await waitFor(() => {
      expect(mockCreateBonsai).toHaveBeenCalled()
    })
  })

  it('編集でServer Actionが呼ばれる', async () => {
    mockUpdateBonsai.mockResolvedValue({ success: true })
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
    await user.type(screen.getByLabelText(/名前/), '黒松一号改')
    await user.click(screen.getByRole('button', { name: '更新' }))

    await waitFor(() => {
      expect(mockUpdateBonsai).toHaveBeenCalledWith('bonsai-1', expect.anything())
    })
  })

  it('成功時に詳細ページにリダイレクトする', async () => {
    mockCreateBonsai.mockResolvedValue({ success: true, data: { bonsai: { id: 'new-bonsai-id' } } })
    const user = userEvent.setup()
    render(<BonsaiForm />)

    await user.type(screen.getByLabelText(/名前/), '新しい盆栽')
    await user.click(screen.getByRole('button', { name: '登録' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/bonsai/new-bonsai-id')
    })
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockCreateBonsai.mockResolvedValue({ success: false, error: '盆栽の登録に失敗しました' })
    const user = userEvent.setup()
    render(<BonsaiForm />)

    await user.type(screen.getByLabelText(/名前/), '新しい盆栽')
    await user.click(screen.getByRole('button', { name: '登録' }))

    await waitFor(() => {
      expect(screen.getByText('盆栽の登録に失敗しました')).toBeInTheDocument()
    })
  })
})
