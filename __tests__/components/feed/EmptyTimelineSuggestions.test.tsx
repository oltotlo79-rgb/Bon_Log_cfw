import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { EmptyTimelineSuggestions } from '@/components/feed/EmptyTimelineSuggestions'
import { ONBOARDING_RECOMMENDED_USERS_LIMIT } from '@/lib/constants/limits'

const mockGetRecommendedUsers = vi.fn()
vi.mock('@/lib/actions/feed', () => ({
  getRecommendedUsers: (...args: unknown[]) => mockGetRecommendedUsers(...args),
}))

vi.mock('@/components/user/RecommendedUserList', () => ({
  RecommendedUserList: ({ users }: { users: { id: string; nickname: string }[] }) => (
    <ul data-testid="recommended-user-list-stub">
      {users.map((u) => (
        <li key={u.id}>{u.nickname}</li>
      ))}
    </ul>
  ),
}))

/**
 * vitest.setup.tsx がグローバルに `useQuery` を data:undefined 固定でモックしているため、
 * 実クエリの queryFn (getRecommendedUsers 呼び出し) や「取得成功」分岐が一切実行されない。
 * このファイルではローカルに上書きし、data を制御可能にする。
 */
const mockUseQuery = vi.fn()
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: (options: unknown) => mockUseQuery(options),
  }
})

describe('EmptyTimelineSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('データ未取得 (data undefined) の場合は何も描画しない', () => {
    mockUseQuery.mockReturnValue({ data: undefined })
    const { container } = render(<EmptyTimelineSuggestions />)

    expect(container).toBeEmptyDOMElement()
  })

  it('取得結果が空配列の場合は何も描画しない', () => {
    mockUseQuery.mockReturnValue({ data: { users: [] } })
    const { container } = render(<EmptyTimelineSuggestions />)

    expect(container).toBeEmptyDOMElement()
  })

  it('users フィールドが無い場合も空配列として扱い何も描画しない', () => {
    mockUseQuery.mockReturnValue({ data: {} })
    const { container } = render(<EmptyTimelineSuggestions />)

    expect(container).toBeEmptyDOMElement()
  })

  it('推薦ユーザーがいる場合は見出しと一覧を表示する', () => {
    mockUseQuery.mockReturnValue({
      data: {
        users: [
          { id: 'u1', nickname: '盆栽太郎', avatarUrl: null, followersCount: 3 },
          { id: 'u2', nickname: '盆栽花子', avatarUrl: null, followersCount: 1 },
        ],
      },
    })
    render(<EmptyTimelineSuggestions />)

    expect(screen.getByTestId('empty-timeline-suggestions')).toBeInTheDocument()
    expect(screen.getByText('おすすめのユーザー')).toBeInTheDocument()
    expect(screen.getByText('盆栽太郎')).toBeInTheDocument()
    expect(screen.getByText('盆栽花子')).toBeInTheDocument()
  })

  it('useQuery に正しい queryKey / staleTime / queryFn が設定される', () => {
    mockUseQuery.mockImplementation((options: {
      queryKey: unknown[]
      queryFn: () => unknown
      staleTime: number
    }) => {
      expect(options.queryKey).toEqual(['recommended-users', 'empty-timeline'])
      expect(typeof options.queryFn).toBe('function')
      expect(typeof options.staleTime).toBe('number')
      options.queryFn()
      return { data: undefined }
    })

    render(<EmptyTimelineSuggestions />)

    expect(mockGetRecommendedUsers).toHaveBeenCalledWith(ONBOARDING_RECOMMENDED_USERS_LIMIT)
  })
})
