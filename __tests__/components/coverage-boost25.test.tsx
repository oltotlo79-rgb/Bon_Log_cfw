import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ========================================
// Target 1: admin/shop-requests/page.tsx
// ========================================

const mockGetShopChangeRequests = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  getShopChangeRequests: (...args: unknown[]) => mockGetShopChangeRequests(...args),
}))
vi.mock('@/app/admin/shop-requests/ShopRequestActions', () => ({
  ShopRequestActions: () => <div data-testid="shop-request-actions">Actions</div>,
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}))
vi.mock('next/image', async () => {
  const { MockNextImage } = await import('../utils/mock-next-image')
  return { __esModule: true, default: MockNextImage }
})

// ========================================
// Target 2: messages/[conversationId]/page.tsx
// ========================================

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))
const mockGetConversation = vi.fn()
const mockGetMessages = vi.fn()
vi.mock('@/lib/actions/message', () => ({
  getConversation: (...args: unknown[]) => mockGetConversation(...args),
  getMessages: (...args: unknown[]) => mockGetMessages(...args),
}))
const mockRedirect = vi.fn(() => { throw new Error('NEXT_REDIRECT') })
const mockNotFound = vi.fn(() => { throw new Error('NEXT_NOT_FOUND') })
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...(args as [])),
  notFound: () => mockNotFound(),
}))
vi.mock('@/components/message/MessageList', () => ({
  MessageList: () => <div data-testid="message-list">MessageList</div>,
}))
vi.mock('@/components/message/MessageForm', () => ({
  MessageForm: () => <div data-testid="message-form">MessageForm</div>,
}))

import AdminShopRequestsPage from '@/app/admin/shop-requests/page'
import MessagesPage, { generateMetadata } from '@/app/(main)/messages/[conversationId]/page'
import { ImageGallery } from '@/components/post/ImageGallery'

describe('coverage-boost25', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ========================================
  // Target 1: admin/shop-requests/page.tsx
  // ========================================

  describe('AdminShopRequestsPage', () => {
    it('エラーが返された場合、エラーメッセージを表示する', async () => {
      mockGetShopChangeRequests.mockResolvedValue({ error: 'データ取得エラー' })

      const Component = await AdminShopRequestsPage({
        searchParams: Promise.resolve({ status: 'pending' }),
      })
      render(Component)

      expect(screen.getByText('データ取得エラー')).toBeInTheDocument()
    })

    it('保留中のリクエストが0件の場合、専用メッセージを表示する', async () => {
      mockGetShopChangeRequests.mockResolvedValue({ requests: [] })

      const Component = await AdminShopRequestsPage({
        searchParams: Promise.resolve({ status: 'pending' }),
      })
      render(Component)

      expect(screen.getByText('保留中のリクエストはありません')).toBeInTheDocument()
    })

    it('承認済みリクエストが0件の場合、一般的なメッセージを表示する', async () => {
      mockGetShopChangeRequests.mockResolvedValue({ requests: [] })

      const Component = await AdminShopRequestsPage({
        searchParams: Promise.resolve({ status: 'approved' }),
      })
      render(Component)

      expect(screen.getByText('リクエストはありません')).toBeInTheDocument()
    })

    it('avatarUrlがある場合、画像を表示する', async () => {
      mockGetShopChangeRequests.mockResolvedValue({
        requests: [
          {
            id: 'req1',
            shopId: 'shop1',
            userId: 'user1',
            status: 'approved',
            requestedChanges: { name: '新名称' },
            reason: null,
            adminComment: null,
            createdAt: new Date('2026-01-01'),
            user: {
              id: 'user1',
              nickname: 'テストユーザー',
              avatarUrl: 'https://example.com/avatar.jpg',
            },
            shop: { id: 'shop1', name: 'テスト盆栽園', address: '東京都' },
          },
        ],
      })

      const Component = await AdminShopRequestsPage({
        searchParams: Promise.resolve({ status: 'approved' }),
      })
      render(Component)

      const img = screen.getByAltText('テストユーザー')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
    })

    it('avatarUrlがない場合、イニシャルを表示する', async () => {
      mockGetShopChangeRequests.mockResolvedValue({
        requests: [
          {
            id: 'req2',
            shopId: 'shop2',
            userId: 'user2',
            status: 'rejected',
            requestedChanges: { address: '新住所' },
            reason: null,
            adminComment: null,
            createdAt: new Date('2026-01-02'),
            user: {
              id: 'user2',
              nickname: 'ユーザーB',
              avatarUrl: null,
            },
            shop: { id: 'shop2', name: '盆栽園B', address: '旧住所' },
          },
        ],
      })

      const Component = await AdminShopRequestsPage({
        searchParams: Promise.resolve({ status: 'rejected' }),
      })
      render(Component)

      expect(screen.getByText('ユ')).toBeInTheDocument()
    })

    it('reasonがある場合、理由を表示する', async () => {
      mockGetShopChangeRequests.mockResolvedValue({
        requests: [
          {
            id: 'req3',
            shopId: 'shop3',
            userId: 'user3',
            status: 'pending',
            requestedChanges: { phone: '111-1111-1111' },
            reason: '電話番号が変更されたため',
            adminComment: null,
            createdAt: new Date('2026-01-03'),
            user: { id: 'user3', nickname: 'ユーザーC', avatarUrl: null },
            shop: { id: 'shop3', name: '盆栽園C', address: '大阪府', phone: '000-0000-0000' },
          },
        ],
      })

      const Component = await AdminShopRequestsPage({
        searchParams: Promise.resolve({ status: 'pending' }),
      })
      render(Component)

      expect(screen.getByText('電話番号が変更されたため')).toBeInTheDocument()
      expect(screen.getByTestId('shop-request-actions')).toBeInTheDocument()
    })

    it('adminCommentがある場合、管理者コメントを表示する', async () => {
      mockGetShopChangeRequests.mockResolvedValue({
        requests: [
          {
            id: 'req4',
            shopId: 'shop4',
            userId: 'user4',
            status: 'approved',
            requestedChanges: { website: 'https://new.example.com' },
            reason: 'サイトリニューアル',
            adminComment: '確認済み、承認しました',
            createdAt: new Date('2026-01-04'),
            user: { id: 'user4', nickname: 'ユーザーD', avatarUrl: null },
            shop: { id: 'shop4', name: '盆栽園D', address: '京都府', website: 'https://old.example.com' },
          },
        ],
      })

      const Component = await AdminShopRequestsPage({
        searchParams: Promise.resolve({ status: 'approved' }),
      })
      render(Component)

      expect(screen.getByText('確認済み、承認しました')).toBeInTheDocument()
      expect(screen.queryByTestId('shop-request-actions')).not.toBeInTheDocument()
    })

    it('currentValueがnullの場合、（未設定）を表示する', async () => {
      mockGetShopChangeRequests.mockResolvedValue({
        requests: [
          {
            id: 'req5',
            shopId: 'shop5',
            userId: 'user5',
            status: 'pending',
            requestedChanges: { website: 'https://example.com' },
            reason: null,
            adminComment: null,
            createdAt: new Date('2026-01-05'),
            user: { id: 'user5', nickname: 'ユーザーE', avatarUrl: null },
            shop: { id: 'shop5', name: '盆栽園E', address: '福岡県', website: null },
          },
        ],
      })

      const Component = await AdminShopRequestsPage({
        searchParams: Promise.resolve({ status: 'pending' }),
      })
      render(Component)

      expect(screen.getByText('（未設定）')).toBeInTheDocument()
    })

    it('statusがpendingでないリクエストはアクションボタンを表示しない', async () => {
      mockGetShopChangeRequests.mockResolvedValue({
        requests: [
          {
            id: 'req6',
            shopId: 'shop6',
            userId: 'user6',
            status: 'approved',
            requestedChanges: { website: 'https://new.example.com' },
            reason: null,
            adminComment: null,
            createdAt: new Date('2026-01-06'),
            user: { id: 'user6', nickname: 'ユーザーF', avatarUrl: null },
            shop: { id: 'shop6', name: '盆栽園F', address: '札幌市', website: 'https://old.example.com' },
          },
        ],
      })

      const Component = await AdminShopRequestsPage({
        searchParams: Promise.resolve({ status: 'approved' }),
      })
      render(Component)

      // status !== 'pending' なのでアクションボタンは表示されない
      expect(screen.queryByTestId('shop-request-actions')).not.toBeInTheDocument()
    })
  })

  // ========================================
  // Target 2: messages/[conversationId]/page.tsx
  // ========================================

  describe('MessagesPage', () => {
    it('未認証の場合、ログインページにリダイレクトする', async () => {
      mockAuth.mockResolvedValue(null)

      await expect(
        MessagesPage({ params: Promise.resolve({ conversationId: 'conv1' }) })
      ).rejects.toThrow('NEXT_REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith('/login')
    })

    it('会話の取得でエラーが返された場合、notFoundを呼ぶ', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user1' } })
      mockGetConversation.mockResolvedValue({ success: false, error: '会話が見つかりません' })

      await expect(
        MessagesPage({ params: Promise.resolve({ conversationId: 'conv1' }) })
      ).rejects.toThrow('NEXT_NOT_FOUND')

      expect(mockNotFound).toHaveBeenCalled()
    })

    it('メッセージの取得でエラーが返された場合、notFoundを呼ぶ', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user1' } })
      mockGetConversation.mockResolvedValue({
        success: true,
        data: {
          conversation: {
            id: 'conv1',
            otherUser: { id: 'user2', nickname: 'ユーザーB', avatarUrl: null },
          },
        },
      })
      mockGetMessages.mockResolvedValue({ success: false, error: 'メッセージ取得エラー' })

      await expect(
        MessagesPage({ params: Promise.resolve({ conversationId: 'conv1' }) })
      ).rejects.toThrow('NEXT_NOT_FOUND')

      expect(mockNotFound).toHaveBeenCalled()
    })

    it('otherUserにavatarUrlがある場合、画像を表示する', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user1' } })
      mockGetConversation.mockResolvedValue({
        success: true,
        data: {
          conversation: {
            id: 'conv1',
            otherUser: {
              id: 'user2',
              nickname: 'ユーザーB',
              avatarUrl: 'https://example.com/avatar.jpg',
            },
          },
        },
      })
      mockGetMessages.mockResolvedValue({ success: true, data: { messages: [] } })

      const Component = await MessagesPage({
        params: Promise.resolve({ conversationId: 'conv1' }),
      })
      render(Component)

      const img = screen.getByAltText('ユーザーB')
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
    })

    it('otherUserにavatarUrlがない場合、イニシャルを表示する', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user1' } })
      mockGetConversation.mockResolvedValue({
        success: true,
        data: {
          conversation: {
            id: 'conv1',
            otherUser: { id: 'user2', nickname: 'ユーザーB', avatarUrl: null },
          },
        },
      })
      mockGetMessages.mockResolvedValue({ success: true, data: { messages: [] } })

      const Component = await MessagesPage({
        params: Promise.resolve({ conversationId: 'conv1' }),
      })
      render(Component)

      expect(screen.getByText('ユ')).toBeInTheDocument()
    })

    it('otherUserのnicknameがnullの場合、?を表示する', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user1' } })
      mockGetConversation.mockResolvedValue({
        success: true,
        data: {
          conversation: {
            id: 'conv1',
            otherUser: { id: 'user2', nickname: null, avatarUrl: null },
          },
        },
      })
      mockGetMessages.mockResolvedValue({ success: true, data: { messages: [] } })

      const Component = await MessagesPage({
        params: Promise.resolve({ conversationId: 'conv1' }),
      })
      render(Component)

      expect(screen.getByText('?')).toBeInTheDocument()
      expect(screen.getByText('削除されたユーザー')).toBeInTheDocument()
    })

    it('otherUserがnullの場合、リンクは#になる', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user1' } })
      mockGetConversation.mockResolvedValue({
        success: true,
        data: { conversation: { id: 'conv1', otherUser: null } },
      })
      mockGetMessages.mockResolvedValue({ success: true, data: { messages: [] } })

      const Component = await MessagesPage({
        params: Promise.resolve({ conversationId: 'conv1' }),
      })
      render(Component)

      const links = screen.getAllByRole('link')
      const userLink = links.find(link => link.getAttribute('href') === '#')
      expect(userLink).toBeInTheDocument()
      expect(screen.getByText('削除されたユーザー')).toBeInTheDocument()
    })
  })

  describe('generateMetadata', () => {
    it('エラーまたは会話がない場合、デフォルトタイトルを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user1' } })
      mockGetConversation.mockResolvedValue({ success: false, error: 'エラー' })

      const metadata = await generateMetadata({
        params: Promise.resolve({ conversationId: 'conv1' }),
      })

      expect(metadata.title).toBe('メッセージ - BON-LOG')
    })

    it('otherUserのnicknameがnullの場合、ユーザーと表示する', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user1' } })
      mockGetConversation.mockResolvedValue({
        success: true,
        data: { conversation: { id: 'conv1', otherUser: { id: 'user2', nickname: null } } },
      })

      const metadata = await generateMetadata({
        params: Promise.resolve({ conversationId: 'conv1' }),
      })

      expect(metadata.title).toBe('ユーザーとのメッセージ - BON-LOG')
    })

    it('正常な場合、相手のニックネームをタイトルに含める', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user1' } })
      mockGetConversation.mockResolvedValue({
        success: true,
        data: {
          conversation: {
            id: 'conv1',
            otherUser: { id: 'user2', nickname: 'テストユーザー' },
          },
        },
      })

      const metadata = await generateMetadata({
        params: Promise.resolve({ conversationId: 'conv1' }),
      })

      expect(metadata.title).toBe('テストユーザーとのメッセージ - BON-LOG')
    })
  })

  // ========================================
  // Target 3: ImageGallery
  // ========================================

  describe('ImageGallery', () => {
    it('画像が1枚の場合、グリッドクラスを適用しない', () => {
      const images = [{ id: '1', url: '/image1.jpg', type: 'image' as const, sortOrder: 0 }]
      const { container } = render(<ImageGallery images={images} />)

      const gridContainer = container.querySelector('div')
      expect(gridContainer?.className).not.toContain('grid')
    })

    it('画像が3枚の場合、最初の画像にrow-span-2を適用する', () => {
      const images = [
        { id: '1', url: '/image1.jpg', type: 'image' as const, sortOrder: 0 },
        { id: '2', url: '/image2.jpg', type: 'image' as const, sortOrder: 1 },
        { id: '3', url: '/image3.jpg', type: 'image' as const, sortOrder: 2 },
      ]
      const { container } = render(<ImageGallery images={images} />)

      const firstImageWrapper = container.querySelector('[class*="row-span-2"]')
      expect(firstImageWrapper).toBeInTheDocument()
    })

    it('typeがvideoの場合、video要素をレンダリングする', () => {
      const images = [
        { id: '1', url: '/video1.mp4', type: 'video' as const, sortOrder: 0 },
      ]
      const { container } = render(<ImageGallery images={images} />)

      const video = container.querySelector('video')
      expect(video).toBeInTheDocument()
      expect(video).toHaveAttribute('src', '/video1.mp4')
    })

    it('メディアをクリックするとモーダルが開く', () => {
      const images = [
        { id: '1', url: '/image1.jpg', type: 'image' as const, sortOrder: 0 },
        { id: '2', url: '/image2.jpg', type: 'image' as const, sortOrder: 1 },
      ]
      render(<ImageGallery images={images} />)

      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0])

      // モーダルが開いたことを確認（閉じるボタンの存在で確認）
      const modal = document.querySelector('.fixed.inset-0.z-50')
      expect(modal).toBeInTheDocument()
    })

    it('モーダル内でvideoを表示する', () => {
      const images = [
        { id: '1', url: '/video1.mp4', type: 'video' as const, sortOrder: 0 },
      ]
      render(<ImageGallery images={images} />)

      // 動画の拡大ボタンをクリック
      const expandButton = screen.getByTitle('拡大表示')
      fireEvent.click(expandButton)

      const modalVideos = document.querySelectorAll('video')
      const modalVideo = Array.from(modalVideos).find(v =>
        v.className.includes('max-w-full') && v.className.includes('max-h-full')
      )
      expect(modalVideo).toBeInTheDocument()
      expect(modalVideo).toHaveAttribute('src', '/video1.mp4')
      expect(modalVideo).toHaveAttribute('controls')
    })

    it('onMediaClickが提供された場合、カスタムハンドラーを呼ぶ', () => {
      const handleMediaClick = vi.fn()
      const images = [
        { id: '1', url: '/image1.jpg', type: 'image' as const, sortOrder: 0 },
      ]
      render(<ImageGallery images={images} onMediaClick={handleMediaClick} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(handleMediaClick).toHaveBeenCalledWith(images[0])
      // モーダルが開かないことを確認
      const modal = document.querySelector('.fixed.inset-0.z-50')
      expect(modal).not.toBeInTheDocument()
    })

    it('モーダルで前へボタンをクリックする', () => {
      const images = [
        { id: '1', url: '/image1.jpg', type: 'image' as const, sortOrder: 0 },
        { id: '2', url: '/image2.jpg', type: 'image' as const, sortOrder: 1 },
        { id: '3', url: '/image3.jpg', type: 'image' as const, sortOrder: 2 },
      ]
      render(<ImageGallery images={images} />)

      // 2番目の画像をクリックして開く
      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[1])

      // 前へボタンが表示されることを確認
      const prevButton = document.querySelector('.absolute.left-4')
      expect(prevButton).toBeInTheDocument()

      // 前へボタンをクリック
      fireEvent.click(prevButton as Element)

      // 1枚目が表示されたら前へボタンは消える
      const prevButtonAfter = document.querySelector('.absolute.left-4')
      expect(prevButtonAfter).not.toBeInTheDocument()
    })

    it('モーダルで次へボタンをクリックする', () => {
      const images = [
        { id: '1', url: '/image1.jpg', type: 'image' as const, sortOrder: 0 },
        { id: '2', url: '/image2.jpg', type: 'image' as const, sortOrder: 1 },
      ]
      render(<ImageGallery images={images} />)

      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0])

      // 次へボタンが表示されることを確認
      const nextButton = document.querySelector('.absolute.right-4.top-1\\/2')
      expect(nextButton).toBeInTheDocument()

      // 次へボタンをクリック
      fireEvent.click(nextButton as Element)

      // 2枚目（最後）が表示されたら次へボタンは消える
      const nextButtonAfter = document.querySelector('.absolute.right-4.top-1\\/2')
      expect(nextButtonAfter).not.toBeInTheDocument()
    })

    it('モーダルのドットをクリックして画像を切り替える', () => {
      const images = [
        { id: '1', url: '/image1.jpg', type: 'image' as const, sortOrder: 0 },
        { id: '2', url: '/image2.jpg', type: 'image' as const, sortOrder: 1 },
        { id: '3', url: '/image3.jpg', type: 'image' as const, sortOrder: 2 },
      ]
      render(<ImageGallery images={images} />)

      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0])

      // ナビゲーションドットを取得
      const dots = screen.getAllByRole('button').filter(btn =>
        btn.className.includes('w-2') && btn.className.includes('h-2')
      )
      expect(dots).toHaveLength(3)

      // 3番目のドットをクリック
      fireEvent.click(dots[2])

      // 3番目が選択されたことを確認（前へボタンが表示される）
      const prevButton = document.querySelector('.absolute.left-4')
      expect(prevButton).toBeInTheDocument()

      // 次へボタンは表示されない（最後の画像なので）
      const nextButton = document.querySelector('.absolute.right-4.top-1\\/2')
      expect(nextButton).not.toBeInTheDocument()
    })

    it('3枚画像で最初が動画の場合もrow-span-2を適用する', () => {
      const images = [
        { id: '1', url: '/video1.mp4', type: 'video' as const, sortOrder: 0 },
        { id: '2', url: '/image2.jpg', type: 'image' as const, sortOrder: 1 },
        { id: '3', url: '/image3.jpg', type: 'image' as const, sortOrder: 2 },
      ]
      const { container } = render(<ImageGallery images={images} />)

      const firstVideoWrapper = container.querySelector('[class*="row-span-2"]')
      expect(firstVideoWrapper).toBeInTheDocument()
    })
  })
})
