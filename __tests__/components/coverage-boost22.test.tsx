import { vi } from 'vitest'
/**
 * @file coverage-boost22.test.tsx
 * @description 盆栽詳細ページ、投稿詳細ページ、DraftEditForm、ScheduledPostFormの分岐網羅率向上テスト
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ============================================================
// Bonsai Detail Page Tests
// ============================================================

vi.mock('@/lib/db', () => ({
  prisma: {
    commentThreadMute: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ isPublic: true, isSuspended: false }),
    },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/actions/bonsai', () => ({ getBonsai: vi.fn() }))
vi.mock('@/lib/actions/post', () => ({
  getPostsByBonsai: vi.fn(),
  getPost: vi.fn(),
}))
vi.mock('@/lib/actions/comment', () => ({
  getComments: vi.fn(),
  getCommentCount: vi.fn(),
}))
vi.mock('@/lib/actions/analytics', () => ({
  recordPostView: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/lib/actions/draft', () => ({
  saveDraft: vi.fn(),
  publishDraft: vi.fn(),
  deleteDraft: vi.fn(),
}))
vi.mock('@/lib/actions/scheduled-post', () => ({
  createScheduledPost: vi.fn(),
  updateScheduledPost: vi.fn(),
}))

vi.mock('@/components/bonsai/BonsaiRecordForm', () => ({
  BonsaiRecordForm: () => <div data-testid="bonsai-record-form">BonsaiRecordForm</div>,
}))
vi.mock('@/components/bonsai/BonsaiActions', () => ({
  BonsaiActions: () => <div data-testid="bonsai-actions">BonsaiActions</div>,
}))
vi.mock('@/components/bonsai/BonsaiTimeline', () => ({
  BonsaiTimeline: () => <div data-testid="bonsai-timeline">BonsaiTimeline</div>,
}))
vi.mock('@/components/post/PostCard', () => ({
  PostCard: () => <div data-testid="post-card">PostCard</div>,
}))
vi.mock('@/components/post/ShareButtons', () => ({
  ShareButtons: (props: Record<string, unknown>) => (
    <div data-testid="share-buttons" data-text={props.text}>
      ShareButtons
    </div>
  ),
}))
vi.mock('@/components/comment', () => ({
  CommentThread: () => <div data-testid="comment-thread">CommentThread</div>,
}))
vi.mock('@/components/ads', () => ({
  PostDetailAdUnit: () => <div data-testid="post-detail-ad">Ad</div>,
}))
vi.mock('@/components/seo/JsonLd', () => ({
  ArticleJsonLd: (props: Record<string, unknown>) => (
    <div
      data-testid="article-jsonld"
      data-headline={props.headline}
      data-description={props.description}
    >
      JsonLd
    </div>
  ),
}))
vi.mock('@/components/common/Breadcrumb', () => ({
  Breadcrumb: () => <div data-testid="breadcrumb">Breadcrumb</div>,
}))

vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn((file: unknown) => Promise.resolve(file)),
  isVideoFile: vi.fn().mockReturnValue(false),
  formatFileSize: vi.fn(),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  })),
}))
vi.mock('next/image', async () => {
  const { MockNextImage } = await import('../utils/mock-next-image')
  return { __esModule: true, default: MockNextImage }
})
vi.mock('next/link', () => {
  const MockLink = ({
    children,
    ...props
  }: {
    children: React.ReactNode
    [key: string]: unknown
  }) => <a {...props}>{children}</a>
  MockLink.displayName = 'MockLink'
  return { default: MockLink }
})

import BonsaiDetailPage, {
  generateMetadata as bonsaiGenerateMetadata,
} from '@/app/(main)/bonsai/[id]/page'
import PostDetailPage, {
  generateMetadata as postGenerateMetadata,
} from '@/app/(main)/posts/[id]/page'
import { DraftEditForm } from '@/components/draft/DraftEditForm'
import { ScheduledPostForm } from '@/components/post/ScheduledPostForm'
import { auth } from '@/lib/auth'
import { getBonsai } from '@/lib/actions/bonsai'
import { getPostsByBonsai } from '@/lib/actions/post'
import { getPost } from '@/lib/actions/post'
import { getComments, getCommentCount } from '@/lib/actions/comment'
import { recordPostView } from '@/lib/actions/analytics'
import { saveDraft, publishDraft } from '@/lib/actions/draft'
import { createScheduledPost, updateScheduledPost } from '@/lib/actions/scheduled-post'
import { prisma } from '@/lib/db'

/**
 * Server Action モック用ヘルパー: 任意のデータを ActionResult 成功形式で包む。
 * モック側で `{ bonsai: ... }` を渡しても自動で `{ success: true, data: { bonsai: ... } }` になる。
 */
function ok<T>(data: T) {
  return { success: true as const, data }
}
/** Server Action モック用ヘルパー: ActionResult 失敗形式 */
function ng(error: string) {
  return { success: false as const, error }
}

describe('Bonsai Detail Page - 未カバー分岐テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(getPostsByBonsai as ReturnType<typeof vi.fn>).mockResolvedValue(ok({ posts: [] }))
  })

  describe('generateMetadata', () => {
    it('エラーが返された場合は「盆栽が見つかりません」を返す', async () => {
      ;(getBonsai as ReturnType<typeof vi.fn>).mockResolvedValue(ng('Not found'))

      const result = await bonsaiGenerateMetadata({
        params: Promise.resolve({ id: 'b1' }),
      })

      expect(result).toEqual({ title: '盆栽が見つかりません' })
    })

    it('bonsai.descriptionがnullの場合は「の成長記録」サフィックスを使用', async () => {
      ;(getBonsai as ReturnType<typeof vi.fn>).mockResolvedValue(ok({
        bonsai: {
          id: 'b1',
          name: 'テスト盆栽',
          species: '黒松',
          description: null,
          acquiredAt: null,
          records: [],
          _count: { records: 0 },
        },
      }))

      const result = await bonsaiGenerateMetadata({
        params: Promise.resolve({ id: 'b1' }),
      })

      expect(result.description).toContain('の成長記録')
    })

    it('bonsai.speciesがnullの場合はdescriptionに樹種を含めない', async () => {
      ;(getBonsai as ReturnType<typeof vi.fn>).mockResolvedValue(ok({
        bonsai: {
          id: 'b1',
          name: 'テスト盆栽',
          species: null,
          description: '美しい盆栽です',
          acquiredAt: null,
          records: [],
          _count: { records: 0 },
        },
      }))

      const result = await bonsaiGenerateMetadata({
        params: Promise.resolve({ id: 'b1' }),
      })

      expect(result.description).not.toContain('の')
      expect(result.description).toContain('盆栽「テスト盆栽」美しい盆栽です')
    })

    it('description.length <= 80の場合は切り詰めない', async () => {
      const shortDescription = 'これは短い説明です。'
      ;(getBonsai as ReturnType<typeof vi.fn>).mockResolvedValue(ok({
        bonsai: {
          id: 'b1',
          name: 'テスト盆栽',
          species: '黒松',
          description: shortDescription,
          acquiredAt: null,
          records: [],
          _count: { records: 0 },
        },
      }))

      const result = await bonsaiGenerateMetadata({
        params: Promise.resolve({ id: 'b1' }),
      })

      expect(result.description).not.toContain('...')
      expect(result.description).toContain(shortDescription)
    })

    it('recordsやimagesがない場合はogImageにデフォルトを使用', async () => {
      ;(getBonsai as ReturnType<typeof vi.fn>).mockResolvedValue(ok({
        bonsai: {
          id: 'b1',
          name: 'テスト盆栽',
          species: '黒松',
          description: 'テスト',
          acquiredAt: null,
          records: [],
          _count: { records: 0 },
        },
      }))

      const result = await bonsaiGenerateMetadata({
        params: Promise.resolve({ id: 'b1' }),
      })

      expect(result.openGraph?.images).toEqual([
        {
          url: '/api/og',
          width: 1200,
          height: 630,
          alt: 'テスト盆栽',
        },
      ])
    })
  })

  describe('BonsaiDetailPage レンダリング', () => {
    it('bonsai.speciesがnullの場合は樹種を表示しない', async () => {
      ;(getBonsai as ReturnType<typeof vi.fn>).mockResolvedValue(ok({
        bonsai: {
          id: 'b1',
          name: 'テスト盆栽',
          species: null,
          description: 'テスト説明',
          acquiredAt: new Date('2020-01-01'),
          records: [],
          _count: { records: 0 },
          userId: 'user1',
          createdAt: new Date('2020-01-01'),
          updatedAt: new Date('2020-01-01'),
          user: { id: 'user1', nickname: 'テストユーザー', avatarUrl: null },
        },
      }))

      const Component = await BonsaiDetailPage({
        params: Promise.resolve({ id: 'b1' }),
      })
      render(Component)

      expect(screen.getByText('テスト盆栽')).toBeInTheDocument()
      // speciesが表示されていないことを確認
      expect(screen.queryByText(/黒松|松/)).not.toBeInTheDocument()
    })

    it('bonsai.descriptionがnullの場合は説明を表示しない', async () => {
      ;(getBonsai as ReturnType<typeof vi.fn>).mockResolvedValue(ok({
        bonsai: {
          id: 'b1',
          name: 'テスト盆栽',
          species: '黒松',
          description: null,
          acquiredAt: new Date('2020-01-01'),
          records: [],
          _count: { records: 0 },
          userId: 'user1',
          createdAt: new Date('2020-01-01'),
          updatedAt: new Date('2020-01-01'),
          user: { id: 'user1', nickname: 'テストユーザー', avatarUrl: null },
        },
      }))

      const Component = await BonsaiDetailPage({
        params: Promise.resolve({ id: 'b1' }),
      })
      render(Component)

      expect(screen.getByText('テスト盆栽')).toBeInTheDocument()
      // description用のテキスト要素がないことを確認
      const allText = screen.getByText('テスト盆栽').parentElement?.textContent || ''
      expect(allText).not.toContain('説明')
    })

    it('bonsai.acquiredAtがnullの場合は入手日を表示しない', async () => {
      ;(getBonsai as ReturnType<typeof vi.fn>).mockResolvedValue(ok({
        bonsai: {
          id: 'b1',
          name: 'テスト盆栽',
          species: '黒松',
          description: 'テスト説明',
          acquiredAt: null,
          records: [],
          _count: { records: 0 },
          userId: 'user1',
          createdAt: new Date('2020-01-01'),
          updatedAt: new Date('2020-01-01'),
          user: { id: 'user1', nickname: 'テストユーザー', avatarUrl: null },
        },
      }))

      const Component = await BonsaiDetailPage({
        params: Promise.resolve({ id: 'b1' }),
      })
      render(Component)

      expect(screen.queryByText(/入手:/)).not.toBeInTheDocument()
    })

    it('オーナーでない場合はBonsaiActionsとBonsaiRecordFormを表示しない', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'user2' } })
      ;(getBonsai as ReturnType<typeof vi.fn>).mockResolvedValue(ok({
        bonsai: {
          id: 'b1',
          name: 'テスト盆栽',
          species: '黒松',
          description: 'テスト説明',
          acquiredAt: new Date('2020-01-01'),
          records: [],
          _count: { records: 0 },
          userId: 'user1',
          createdAt: new Date('2020-01-01'),
          updatedAt: new Date('2020-01-01'),
          user: { id: 'user1', nickname: 'テストユーザー', avatarUrl: null },
        },
      }))

      const Component = await BonsaiDetailPage({
        params: Promise.resolve({ id: 'b1' }),
      })
      render(Component)

      expect(screen.queryByTestId('bonsai-actions')).not.toBeInTheDocument()
      expect(screen.queryByTestId('bonsai-record-form')).not.toBeInTheDocument()
    })
  })
})

// ============================================================
// Post Detail Page Tests
// ============================================================

describe('Post Detail Page - 未カバー分岐テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(getComments as ReturnType<typeof vi.fn>).mockResolvedValue({ comments: [] })
    ;(getCommentCount as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    ;(prisma.commentThreadMute.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  })

  describe('generateMetadata', () => {
    it('エラーが返された場合は「投稿が見つかりません」を返す', async () => {
      ;(getPost as ReturnType<typeof vi.fn>).mockResolvedValue({ error: 'Not found' })

      const result = await postGenerateMetadata({
        params: Promise.resolve({ id: 'p1' }),
      })

      expect(result).toEqual({ title: '投稿が見つかりません' })
    })

    it('post.contentがnullの場合はフォールバック「投稿」を使用', async () => {
      ;(getPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { post: {
          id: 'p1',
          content: null,
          user: { id: 'user1', nickname: 'テストユーザー' },
          media: [],
          createdAt: new Date(),
        } },
      })

      const result = await postGenerateMetadata({
        params: Promise.resolve({ id: 'p1' }),
      })

      expect(result.description).toBe('投稿')
    })

    it('content.length <= 100の場合は切り詰めない', async () => {
      const shortContent = 'これは短い投稿です。'
      ;(getPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { post: {
          id: 'p1',
          content: shortContent,
          user: { id: 'user1', nickname: 'テストユーザー' },
          media: [],
          createdAt: new Date(),
        } },
      })

      const result = await postGenerateMetadata({
        params: Promise.resolve({ id: 'p1' }),
      })

      expect(result.description).toBe(shortContent)
      expect(result.description).not.toContain('...')
    })

    it('post.mediaが空の場合はogImageにデフォルトを使用', async () => {
      ;(getPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { post: {
          id: 'p1',
          content: 'テスト投稿',
          user: { id: 'user1', nickname: 'テストユーザー' },
          media: [],
          createdAt: new Date(),
        } },
      })

      const result = await postGenerateMetadata({
        params: Promise.resolve({ id: 'p1' }),
      })

      expect(result.openGraph?.images).toEqual([
        {
          url: '/api/og',
          width: 1200,
          height: 630,
          alt: 'テストユーザーさんの投稿',
        },
      ])
    })
  })

  describe('PostDetailPage レンダリング', () => {
    it('セッションがない場合はミュートスレッド取得と閲覧記録をスキップ', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      ;(getPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { post: {
          id: 'p1',
          content: 'テスト投稿',
          user: { id: 'user1', nickname: 'テストユーザー' },
          media: [],
          createdAt: new Date(),
        } },
      })
      ;(getComments as ReturnType<typeof vi.fn>).mockResolvedValue({
        comments: [{ id: 'c1', content: 'コメント1' }],
      })

      const Component = await PostDetailPage({
        params: Promise.resolve({ id: 'p1' }),
      })
      render(Component)

      expect(prisma.commentThreadMute.findMany).not.toHaveBeenCalled()
      expect(recordPostView).not.toHaveBeenCalled()
    })

    it('自分の投稿の場合は閲覧記録をスキップ', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'user1' } })
      ;(getPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { post: {
          id: 'p1',
          content: 'テスト投稿',
          user: { id: 'user1', nickname: 'テストユーザー' },
          media: [],
          createdAt: new Date(),
        } },
      })

      const Component = await PostDetailPage({
        params: Promise.resolve({ id: 'p1' }),
      })
      render(Component)

      expect(recordPostView).not.toHaveBeenCalled()
    })

    it('commentIds.length === 0の場合はfindManyをスキップ', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'user2' } })
      ;(getPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { post: {
          id: 'p1',
          content: 'テスト投稿',
          user: { id: 'user1', nickname: 'テストユーザー' },
          media: [],
          createdAt: new Date(),
        } },
      })
      ;(getComments as ReturnType<typeof vi.fn>).mockResolvedValue({ comments: [] })

      const Component = await PostDetailPage({
        params: Promise.resolve({ id: 'p1' }),
      })
      render(Component)

      expect(prisma.commentThreadMute.findMany).not.toHaveBeenCalled()
    })

    it('commentsResult.commentsがnullの場合はミュートスレッドロジックをスキップ', async () => {
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'user2' } })
      ;(getPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { post: {
          id: 'p1',
          content: 'テスト投稿',
          user: { id: 'user1', nickname: 'テストユーザー' },
          media: [],
          createdAt: new Date(),
        } },
      })
      ;(getComments as ReturnType<typeof vi.fn>).mockResolvedValue({ comments: null })

      const Component = await PostDetailPage({
        params: Promise.resolve({ id: 'p1' }),
      })
      render(Component)

      expect(prisma.commentThreadMute.findMany).not.toHaveBeenCalled()
    })

    it('contentが短い場合はShareButtonsとArticleJsonLdで切り詰めない', async () => {
      const shortContent = '短いテスト投稿'
      ;(getPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { post: {
          id: 'p1',
          content: shortContent,
          user: { id: 'user1', nickname: 'テストユーザー' },
          media: [],
          createdAt: new Date(),
        } },
      })

      const Component = await PostDetailPage({
        params: Promise.resolve({ id: 'p1' }),
      })
      render(Component)

      const shareButtons = screen.getByTestId('share-buttons')
      expect(shareButtons.getAttribute('data-text')).toBe(shortContent)

      const jsonLd = screen.getByTestId('article-jsonld')
      expect(jsonLd.getAttribute('data-headline')).toBe(shortContent)
      expect(jsonLd.getAttribute('data-description')).toBe(shortContent)
    })

    it('contentがnullの場合はShareButtonsで空文字列、ArticleJsonLdで「投稿」を使用', async () => {
      ;(getPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { post: {
          id: 'p1',
          content: null,
          user: { id: 'user1', nickname: 'テストユーザー' },
          media: [],
          createdAt: new Date(),
        } },
      })

      const Component = await PostDetailPage({
        params: Promise.resolve({ id: 'p1' }),
      })
      render(Component)

      const shareButtons = screen.getByTestId('share-buttons')
      expect(shareButtons.getAttribute('data-text')).toBe('')

      const jsonLd = screen.getByTestId('article-jsonld')
      expect(jsonLd.getAttribute('data-headline')).toBe('投稿')
      expect(jsonLd.getAttribute('data-description')).toBeNull()
    })
  })
})

// ============================================================
// DraftEditForm Tests
// ============================================================

describe('DraftEditForm - 未カバー分岐テスト', () => {
  const mockDraft = {
    id: 'draft1',
    content: 'テスト下書き',
    media: [],
    genres: [],
  }

  const mockGenres = {
    盆栽: [
      { id: 'g1', name: '松柏類', category: '盆栽' },
      { id: 'g2', name: '雑木類', category: '盆栽' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handlePublish内でsaveDraft.errorが返された場合、エラーを表示し投稿を中断', async () => {
    ;(saveDraft as ReturnType<typeof vi.fn>).mockResolvedValue({ error: '保存に失敗しました' })
    const user = userEvent.setup()

    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    await user.click(screen.getByRole('button', { name: /投稿/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()
    })

    expect(publishDraft).not.toHaveBeenCalled()
  })

  it('XHR JSON parse catch: responseTextが不正な場合', async () => {
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      status: 200,
      responseText: 'invalid json',
      upload: { addEventListener: vi.fn() },
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === 'load') {
          setTimeout(handler, 0)
        }
      }),
    }

    global.XMLHttpRequest = vi.fn(function() { return mockXHR }) as unknown as typeof XMLHttpRequest

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(
      () => {
        expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  it('画像圧縮でratio === 0の場合、console.logをスキップ', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      status: 200,
      responseText: JSON.stringify({ url: 'http://test.com/image.jpg', type: 'image' }),
      upload: { addEventListener: vi.fn() },
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === 'load') {
          setTimeout(handler, 0)
        }
      }),
    }

    global.XMLHttpRequest = vi.fn(function() { return mockXHR }) as unknown as typeof XMLHttpRequest

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(
      () => {
        expect(mockXHR.send).toHaveBeenCalled()
      },
      { timeout: 3000 }
    )

    const compressionLogCalls = consoleSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('圧縮完了')
    )
    expect(compressionLogCalls).toHaveLength(0)

    consoleSpy.mockRestore()
  })
})

// ============================================================
// ScheduledPostForm Tests
// ============================================================

describe('ScheduledPostForm - 未カバー分岐テスト', () => {
  const mockGenres = {
    盆栽: [
      { id: 'g1', name: '松柏類', category: '盆栽' },
      { id: 'g2', name: '雑木類', category: '盆栽' },
    ],
  }

  const mockLimits = {
    maxPostLength: 1000,
    maxImages: 8,
    maxVideos: 4,
    maxDailyPosts: 20,
    canSchedulePost: true,
    canViewAnalytics: false,
  }

  const mockEditData = {
    id: 'scheduled1',
    content: '予約投稿のテスト',
    scheduledAt: new Date('2026-12-01T10:00:00'),
    genreIds: ['g1'],
    media: [{ url: 'http://test.com/image.jpg', type: 'image' }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('編集モード（editData提供）の場合、updateScheduledPostが呼ばれる', async () => {
    ;(updateScheduledPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true })

    render(
      <ScheduledPostForm
        genres={mockGenres}
        limits={mockLimits}
        editData={mockEditData}
      />
    )

    // 既存データが表示されていることを確認
    expect(screen.getByDisplayValue('予約投稿のテスト')).toBeInTheDocument()

    // 日付と時間が既に入力されていることを確認
    const dateInput = screen.getByDisplayValue('2026-12-01')
    const timeInput = screen.getByDisplayValue('10:00')
    expect(dateInput).toBeInTheDocument()
    expect(timeInput).toBeInTheDocument()

    // 送信
    const submitButton = screen.getByRole('button', { name: /更新/ })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(updateScheduledPost).toHaveBeenCalledWith(
        'scheduled1',
        expect.any(FormData)
      )
    })

    expect(createScheduledPost).not.toHaveBeenCalled()
  })

  it('新規作成モード（editDataなし）の場合、createScheduledPostが呼ばれる', async () => {
    ;(createScheduledPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true })

    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    // コンテンツ入力
    const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
    fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

    // 未来の日時を設定
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-12-31' } })
    fireEvent.change(timeInput, { target: { value: '15:30' } })

    // 送信
    const submitButton = screen.getByRole('button', { name: /予約/ })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(createScheduledPost).toHaveBeenCalledWith(expect.any(FormData))
    })

    expect(updateScheduledPost).not.toHaveBeenCalled()
  })

  it('editData.contentがnullの場合、空文字列で初期化される', async () => {
    const editDataWithNullContent = {
      ...mockEditData,
      content: null,
    }

    render(
      <ScheduledPostForm
        genres={mockGenres}
        limits={mockLimits}
        editData={editDataWithNullContent}
      />
    )

    const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
    expect(textarea).toHaveValue('')
  })
})
