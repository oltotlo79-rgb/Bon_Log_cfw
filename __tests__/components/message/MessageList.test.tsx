import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { MessageList } from '@/components/message/MessageList'

// scrollIntoView モック
Element.prototype.scrollIntoView = vi.fn()

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockMessages = [
  {
    id: 'msg-1',
    content: 'こんにちは！',
    createdAt: new Date(),
    sender: {
      id: 'user-1',
      nickname: '相手ユーザー',
      avatarUrl: null,
    },
  },
  {
    id: 'msg-2',
    content: 'こんにちは！元気ですか？',
    createdAt: new Date(),
    sender: {
      id: 'current-user',
      nickname: '自分',
      avatarUrl: null,
    },
  },
]

describe('MessageList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('メッセージを表示する', () => {
    render(
      <MessageList
        initialMessages={mockMessages}
        conversationId="conv-1"
        currentUserId="current-user"
      />
    )
    expect(screen.getByText('こんにちは！')).toBeInTheDocument()
    expect(screen.getByText('こんにちは！元気ですか？')).toBeInTheDocument()
  })

  it('メッセージがない場合は空メッセージを表示', () => {
    render(
      <MessageList
        initialMessages={[]}
        conversationId="conv-1"
        currentUserId="current-user"
      />
    )
    expect(screen.getByText(/メッセージはまだありません/)).toBeInTheDocument()
    expect(screen.getByText(/最初のメッセージを送ってみましょう/)).toBeInTheDocument()
  })

  it('相手のメッセージにはアバターを表示', () => {
    render(
      <MessageList
        initialMessages={mockMessages}
        conversationId="conv-1"
        currentUserId="current-user"
      />
    )
    // 相手のメッセージにはイニシャルが表示される
    expect(screen.getByText('相')).toBeInTheDocument()
  })

  it('自分のメッセージにはアバターを表示しない', () => {
    render(
      <MessageList
        initialMessages={[
          {
            id: 'msg-1',
            content: '自分のメッセージ',
            createdAt: new Date(),
            sender: {
              id: 'current-user',
              nickname: '自分',
              avatarUrl: null,
            },
          },
        ]}
        conversationId="conv-1"
        currentUserId="current-user"
      />
    )
    // 自分のメッセージの場合、イニシャルは表示されない
    expect(screen.queryByText('自')).not.toBeInTheDocument()
  })

  it('日付でグループ化される', () => {
    const today = new Date()
    const messages = [
      {
        id: 'msg-1',
        content: '今日のメッセージ',
        createdAt: today,
        sender: {
          id: 'user-1',
          nickname: '相手',
          avatarUrl: null,
        },
      },
    ]
    render(
      <MessageList
        initialMessages={messages}
        conversationId="conv-1"
        currentUserId="current-user"
      />
    )
    // 日付ラベルが表示される
    expect(screen.getByText(/年.*月.*日/)).toBeInTheDocument()
  })

  it('メッセージに時刻を表示', () => {
    render(
      <MessageList
        initialMessages={mockMessages}
        conversationId="conv-1"
        currentUserId="current-user"
      />
    )
    // 時刻のフォーマット (HH:mm)
    const timeElements = screen.getAllByText(/\d{2}:\d{2}/)
    expect(timeElements.length).toBeGreaterThan(0)
  })
})
