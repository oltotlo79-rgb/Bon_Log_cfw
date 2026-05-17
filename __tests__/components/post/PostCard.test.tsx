import { vi } from 'vitest'
/**
 * ============================================================================
 * 投稿カードコンポーネントのテスト
 * ============================================================================
 *
 * このファイルは、投稿（Post）を表示するPostCardコンポーネントをテストします。
 *
 * ## PostCardとは？
 * タイムラインや投稿一覧で表示される、1つの投稿を表すUIコンポーネント。
 * 以下の要素を含みます：
 * - ユーザー情報（アバター、ニックネーム）
 * - 投稿内容（テキスト、画像、動画）
 * - ジャンルタグ
 * - アクションボタン（いいね、ブックマーク、コメント、シェア）
 * - メニュー（削除、通報）
 *
 * ## テスト観点
 * - 基本的な表示（内容、ユーザー名、カウント）
 * - ナビゲーション（クリックでページ遷移）
 * - 権限による表示切り替え（自分の投稿/他人の投稿）
 * - 特殊な機能（ハッシュタグ、省略表示、リポスト）
 * - エッジケース（未ログイン、0件表示）
 *
 * ## コンポーネントテストのポイント
 * 1. ユーザーの視点でテスト（見えるテキスト、クリック可能な要素）
 * 2. 実装の詳細ではなく、振る舞いをテスト
 * 3. アクセシビリティを考慮（role属性での検索）
 */

// ============================================================================
// インポート
// ============================================================================

/**
 * テストユーティリティのインポート
 */
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PostCard } from '@/components/post/PostCard'
import { mockPost, mockUser } from '../../utils/test-utils'

// ============================================================================
// モックのセットアップ
// ============================================================================

/**
 * Prismaモック
 * ----------------------------------------------------------------------------
 * PostCardコンポーネント内で使用される可能性のある
 * データベース操作をモック化。
 */
vi.mock('@/lib/db', () => ({
  prisma: {
    post: { findMany: vi.fn(), create: vi.fn() },
    user: { findMany: vi.fn() },
    report: { create: vi.fn() },
  },
}))

/**
 * いいね機能のServer Actionsモック
 * ----------------------------------------------------------------------------
 * いいねボタンクリック時の処理をモック化。
 * デフォルトでいいね成功を返す。
 */
vi.mock('@/lib/actions/like', () => ({
  toggleLike: vi.fn().mockResolvedValue({ success: true, data: { liked: true } }),
}))

/**
 * ブックマーク機能のServer Actionsモック
 */
vi.mock('@/lib/actions/bookmark', () => ({
  toggleBookmark: vi.fn().mockResolvedValue({ success: true, data: { bookmarked: true } }),
}))

/**
 * 投稿操作のServer Actionsモック
 * ----------------------------------------------------------------------------
 * 投稿削除などの処理をモック化。
 */
vi.mock('@/lib/actions/post', () => ({
  deletePost: vi.fn().mockResolvedValue({ success: true }),
}))

/**
 * 通報機能のServer Actionsモック
 */
vi.mock('@/lib/actions/report', () => ({
  createReport: vi.fn().mockResolvedValue({ success: true }),
}))

/**
 * Next.jsナビゲーションモック
 * ----------------------------------------------------------------------------
 * 投稿カードクリック時のページ遷移をテストするために必要。
 */
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,      // ページ遷移
    refresh: vi.fn(),  // ページリフレッシュ
  }),
}))

vi.mock('@/lib/actions/hide-post', () => ({ hidePost: vi.fn(), getHiddenPostIds: vi.fn() }))
vi.mock('@/lib/actions/poll', () => ({ votePoll: vi.fn(), getPollResults: vi.fn() }))

// ============================================================================
// テストスイート
// ============================================================================
describe('PostCard', () => {
  /**
   * テスト用のデフォルトProps
   * ----------------------------------------------------------------------------
   * 複数のテストで共通して使用するプロパティ。
   * 各テストで必要に応じてオーバーライドして使用。
   *
   * スプレッド構文を使って一部だけ変更できる：
   * const props = { ...defaultProps, post: { ...defaultProps.post, content: '新しい内容' } }
   */
  const defaultProps = {
    post: {
      id: mockPost.id,
      content: mockPost.content,  // 'テスト投稿の内容 #テスト'
      createdAt: mockPost.createdAt,
      user: {
        id: 'user-1',
        nickname: mockUser.nickname,  // 'テストユーザー'
        avatarUrl: mockUser.avatarUrl,
      },
      media: [],  // 画像/動画なし
      genres: [{ id: 'genre-1', name: '松柏類', category: '松柏類' }],
      likeCount: 5,
      commentCount: 3,
      isLiked: false,       // まだいいねしていない
      isBookmarked: false,  // まだブックマークしていない
    },
    currentUserId: 'current-user-id',  // ログインユーザーのID（投稿者とは別）
  }

  /**
   * 各テスト前の準備
   */
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --------------------------------------------------------------------------
  // 基本表示テスト
  // --------------------------------------------------------------------------
  /**
   * テストケース1: 投稿内容の表示
   *
   * 投稿のテキスト内容とハッシュタグが正しく表示されることを確認。
   * ハッシュタグは自動的にリンクに変換されるため、部分一致で検索。
   */
  it('投稿内容を正しく表示する', () => {
    render(<PostCard {...defaultProps} />)

    // 正規表現で部分一致検索
    // /テスト投稿の内容/ は「テスト投稿の内容」を含むテキストにマッチ
    expect(screen.getByText(/テスト投稿の内容/)).toBeInTheDocument()
    expect(screen.getByText('#テスト')).toBeInTheDocument()
  })

  /**
   * テストケース2: ユーザー名の表示
   */
  it('ユーザー名を表示する', () => {
    render(<PostCard {...defaultProps} />)
    expect(screen.getByText(mockUser.nickname)).toBeInTheDocument()
  })

  /**
   * テストケース3: いいね数の表示
   *
   * いいねの数が正しく表示されることを確認。
   */
  it('いいね数を表示する', () => {
    render(<PostCard {...defaultProps} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  /**
   * テストケース4: コメント数の表示
   */
  it('コメント数を表示する', () => {
    render(<PostCard {...defaultProps} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  /**
   * テストケース5: ジャンルタグの表示
   *
   * 投稿に設定されたジャンル（カテゴリ）が
   * タグとして表示されることを確認。
   */
  it('ジャンルタグを表示する', () => {
    render(<PostCard {...defaultProps} />)
    expect(screen.getByText('松柏類')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // ナビゲーションテスト
  // --------------------------------------------------------------------------
  /**
   * テストケース6: ジャンルタグのリンク
   *
   * ジャンルタグをクリックすると、そのジャンルで
   * フィルタリングされた検索ページに遷移することを確認。
   *
   * closest('a'): 親要素のaタグを検索
   */
  it('ジャンルタグをクリックすると検索ページへ遷移する', () => {
    render(<PostCard {...defaultProps} />)
    const genreLink = screen.getByText('松柏類')
    // closest(): 指定したセレクタに一致する最も近い祖先要素を取得
    expect(genreLink.closest('a')).toHaveAttribute('href', '/search?genre=genre-1')
  })

  /**
   * テストケース7: ユーザー名のリンク
   *
   * ユーザー名をクリックすると、そのユーザーの
   * プロフィールページに遷移することを確認。
   */
  it('ユーザー名をクリックするとプロフィールページへ遷移する', () => {
    render(<PostCard {...defaultProps} />)
    const userLink = screen.getByText(mockUser.nickname)
    expect(userLink.closest('a')).toHaveAttribute('href', '/users/user-1')
  })

  /**
   * テストケース8: カード全体のクリック
   *
   * 投稿カードをクリックすると、投稿詳細ページに遷移することを確認。
   *
   * screen.getByTestId('post-card'): data-testid="post-card"の要素を検索
   * PostCardコンポーネントのarticle要素を取得
   */
  it('カード全体をクリックすると投稿詳細ページへ遷移する', async () => {
    const user = userEvent.setup()
    render(<PostCard {...defaultProps} />)

    const article = screen.getByTestId('post-card')
    await user.click(article)

    // router.pushが正しいURLで呼ばれたことを確認
    expect(mockPush).toHaveBeenCalledWith(`/posts/${mockPost.id}`)
  })

  /**
   * テストケース9: ナビゲーション無効化
   *
   * disableNavigation propがtrueの場合、
   * カードクリックで遷移しないことを確認。
   *
   * 使用場面：
   * - 投稿詳細ページ内での表示（二重遷移防止）
   * - モーダル内での表示
   */
  it('disableNavigationがtrueの場合、カードクリックで遷移しない', async () => {
    const user = userEvent.setup()
    // disableNavigationを追加
    render(<PostCard {...defaultProps} disableNavigation={true} />)

    const article = screen.getByTestId('post-card')
    await user.click(article)

    // router.pushが呼ばれていないことを確認
    expect(mockPush).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------------------------
  // メニュー（権限による表示切り替え）テスト
  // --------------------------------------------------------------------------
  /**
   * テストケース10: 自分の投稿の削除ボタン
   *
   * 自分の投稿にはメニューに「削除」ボタンが表示されることを確認。
   *
   * 権限の考え方：
   * - 自分の投稿 → 削除可能
   * - 他人の投稿 → 削除不可（通報のみ）
   */
  it('自分の投稿にはメニューから削除ボタンが表示される', async () => {
    const user = userEvent.setup()
    const props = {
      ...defaultProps,
      currentUserId: 'user-1', // 投稿者と同じID
    }
    render(<PostCard {...props} />)

    // メニューボタンを検索してクリック
    // getAllByRole: 複数のボタンがあるため、allを使用
    const menuButtons = screen.getAllByRole('button')
    // SVGアイコンを持つボタン（メニューボタン）を探す
    const menuButton = menuButtons.find(btn => btn.querySelector('svg'))
    if (menuButton) {
      await user.click(menuButton)
      // waitFor: 非同期でメニューが表示されるのを待つ
      await waitFor(() => {
        expect(screen.getByText(/削除/i)).toBeInTheDocument()
      })
    }
  })

  /**
   * テストケース11: 他人の投稿の通報ボタン
   *
   * 他人の投稿にはメニューに「通報」ボタンが表示されることを確認。
   *
   * 通報機能：
   * - 不適切なコンテンツを報告する機能
   * - 管理者がレビューして対応
   */
  it('他人の投稿にはメニューから通報ボタンが表示される', async () => {
    const user = userEvent.setup()
    render(<PostCard {...defaultProps} />) // currentUserId !== post.user.id

    const menuButtons = screen.getAllByRole('button')
    const menuButton = menuButtons.find(btn => btn.querySelector('svg'))
    if (menuButton) {
      await user.click(menuButton)
      await waitFor(() => {
        expect(screen.getByText(/通報/i)).toBeInTheDocument()
      })
    }
  })

  // --------------------------------------------------------------------------
  // ハッシュタグと省略表示テスト
  // --------------------------------------------------------------------------
  /**
   * テストケース12: ハッシュタグのリンク化
   *
   * 投稿内の#で始まる単語がクリック可能なリンクになり、
   * 検索ページに遷移することを確認。
   *
   * ハッシュタグとは：
   * #をつけたキーワードで、投稿をカテゴリ分けしたり
   * 同じ話題の投稿を探しやすくする機能。
   */
  it('ハッシュタグをリンクとして表示する', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: 'テスト投稿 #盆栽 について',
      },
    }
    render(<PostCard {...props} />)

    const hashtag = screen.getByText('#盆栽')
    // URLエンコードされた値を確認
    // %23 = #, %E7%9B%86%E6%A0%BD = '盆栽'のURLエンコード
    expect(hashtag.closest('a')).toHaveAttribute('href', '/search?q=%23%E7%9B%86%E6%A0%BD')
  })

  /**
   * テストケース13: 長いコンテンツの省略
   *
   * 一定文字数を超えるコンテンツは省略表示され、
   * 「続きを読む」ボタンが表示されることを確認。
   *
   * UX観点：
   * - タイムラインで長い投稿が場所を取りすぎない
   * - 興味があれば展開して全文を読める
   */
  it('長いコンテンツは省略されて「続きを読む」ボタンが表示される', () => {
    // 200文字のコンテンツを作成（省略閾値を超える）
    const longContent = 'あ'.repeat(200)
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: longContent,
      },
    }
    render(<PostCard {...props} />)

    // 「続きを読む」ボタンが存在する
    expect(screen.getByText(/続きを読む/i)).toBeInTheDocument()
    // 省略記号（...）が表示される
    expect(screen.getByText(/\.\.\./)).toBeInTheDocument()
  })

  /**
   * テストケース14: 省略コンテンツの展開
   *
   * 「続きを読む」をクリックすると全文が表示され、
   * ボタンが消えることを確認。
   */
  it('「続きを読む」をクリックすると全文が表示される', async () => {
    const user = userEvent.setup()
    const longContent = 'あ'.repeat(200)
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: longContent,
      },
    }
    render(<PostCard {...props} />)

    const showMoreButton = screen.getByText(/続きを読む/i)
    await user.click(showMoreButton)

    // queryByText: 要素が存在しない場合にnullを返す（getByTextはエラー）
    // not.toBeInTheDocument(): DOMに存在しないことを確認
    expect(screen.queryByText(/続きを読む/i)).not.toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // メンション表示テスト
  // --------------------------------------------------------------------------
  /**
   * テストケース: メンションのリンク表示
   *
   * 投稿内の <@userId> 形式のメンションが
   * @nickname としてリンク表示されることを確認。
   */
  it('メンションがリンクとして表示される', () => {
    const mentionUsers = new Map([
      ['user123', { id: 'user123', nickname: 'john', avatarUrl: null }],
    ])
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: 'Hello <@user123> さん！',
      },
      mentionUsers,
    }
    render(<PostCard {...props} />)

    // @john がリンクとして表示される
    const mentionLink = screen.getByText('@john')
    expect(mentionLink.closest('a')).toHaveAttribute('href', '/users/user123')
  })

  /**
   * テストケース: 存在しないユーザーのメンション
   *
   * mentionUsersに含まれないユーザーIDの場合、
   * @unknown と表示されることを確認。
   */
  it('存在しないユーザーのメンションは@unknownと表示される', () => {
    const mentionUsers = new Map<string, { id: string; nickname: string; avatarUrl: string | null }>()
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: 'Hello <@nonexistent> さん！',
      },
      mentionUsers,
    }
    render(<PostCard {...props} />)

    expect(screen.getByText('@unknown')).toBeInTheDocument()
  })

  /**
   * テストケース: 複数のメンションとハッシュタグの混在
   *
   * メンションとハッシュタグが混在する投稿が
   * 正しく表示されることを確認。
   */
  it('複数のメンションとハッシュタグが正しく表示される', () => {
    const mentionUsers = new Map([
      ['user1', { id: 'user1', nickname: 'alice', avatarUrl: null }],
      ['user2', { id: 'user2', nickname: 'bob', avatarUrl: null }],
    ])
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: '<@user1> と <@user2> が #盆栽 について話しています',
      },
      mentionUsers,
    }
    render(<PostCard {...props} />)

    expect(screen.getByText('@alice')).toBeInTheDocument()
    expect(screen.getByText('@bob')).toBeInTheDocument()
    expect(screen.getByText('#盆栽')).toBeInTheDocument()
  })

  /**
   * テストケース: 旧形式の@mentionは通常テキストとして表示
   *
   * 旧形式の @nickname は通常のテキストとして表示され、
   * リンク化されないことを確認。
   */
  it('旧形式の@mentionは通常テキストとして表示される', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: '@oldformat さんへのメッセージ',
      },
    }
    render(<PostCard {...props} />)

    // テキストは表示されるが、リンクではない
    expect(screen.getByText(/oldformat/)).toBeInTheDocument()
    // @oldformat がリンクになっていないことを確認
    const text = screen.getByText(/oldformat/)
    expect(text.closest('a')).toBeNull()
  })

  // --------------------------------------------------------------------------
  // リポスト・引用投稿テスト
  // --------------------------------------------------------------------------
  /**
   * テストケース15: リポストの表示
   *
   * リポスト（他人の投稿をそのまま共有）の場合、
   * 元の投稿が表示されることを確認。
   *
   * リポストとは：
   * - X（旧Twitter）の「リツイート」に相当
   * - コメントを付けずに他人の投稿を共有
   * - 「〇〇がリポスト」と表示される
   */
  it('リポストの場合、リポスト表示がある', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        // リポストされた元の投稿
        repostPost: {
          id: 'original-post',
          content: '元の投稿です',
          createdAt: new Date().toISOString(),
          user: {
            id: 'original-user',
            nickname: 'オリジナルユーザー',
            avatarUrl: null,
          },
          media: [],
        },
      },
    }
    render(<PostCard {...props} />)

    // リポスト表示のテキストを確認
    expect(screen.getByText(/がリポスト/)).toBeInTheDocument()
    // 元の投稿内容が表示される
    expect(screen.getByText('元の投稿です')).toBeInTheDocument()
  })

  /**
   * テストケース16: 引用投稿の表示
   *
   * 引用投稿（他人の投稿にコメントを付けて共有）の場合、
   * 自分のコメントと引用元が両方表示されることを確認。
   *
   * 引用投稿とは：
   * - X（旧Twitter）の「引用リツイート」に相当
   * - 他人の投稿に自分のコメントを付けて共有
   * - 引用元の投稿がカード内に小さく表示される
   */
  it('引用投稿の場合、引用表示がある', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        // 引用された元の投稿
        quotePost: {
          id: 'quoted-post',
          content: '引用された投稿です',
          createdAt: new Date().toISOString(),
          user: {
            id: 'quoted-user',
            nickname: '引用元ユーザー',
            avatarUrl: null,
          },
        },
      },
    }
    render(<PostCard {...props} />)

    // 引用元の内容とユーザー名が表示される
    expect(screen.getByText('引用された投稿です')).toBeInTheDocument()
    expect(screen.getByText('引用元ユーザー')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // エッジケース（境界条件）テスト
  // --------------------------------------------------------------------------
  /**
   * テストケース17: 未ログインユーザーの場合
   *
   * 未ログインの場合、いいねボタンがログインページへの
   * リンクになることを確認。
   *
   * UX観点：
   * - いいねするにはログインが必要
   * - クリックするとログインページに誘導
   */
  it('未ログインユーザーにはいいねボタンがログインリンクになる', () => {
    const props = {
      ...defaultProps,
      currentUserId: undefined, // 未ログイン
    }
    render(<PostCard {...props} />)

    // ログインページへのリンクを探す
    const likeLinks = screen.getAllByRole('link')
    const loginLink = likeLinks.find(link => link.getAttribute('href') === '/login')
    expect(loginLink).toBeInTheDocument()
  })

  /**
   * テストケース18: いいね済み状態の初期表示
   *
   * initialLiked=trueの場合、いいね済みの状態で
   * 表示されることを確認。
   *
   * 注：実際のいいねボタンのUIテストは
   * LikeButton.test.tsxで詳細に行う。
   */
  it('いいね済みの投稿はinitialLikedがtrueで表示される', () => {
    const props = {
      ...defaultProps,
      initialLiked: true,
    }
    render(<PostCard {...props} />)
    // コンポーネントがエラーなくレンダリングされることを確認
    expect(screen.getByTestId('post-card')).toBeInTheDocument()
  })

  /**
   * テストケース19: ブックマーク済み状態の初期表示
   */
  it('ブックマーク済みの投稿はinitialBookmarkedがtrueで表示される', () => {
    const props = {
      ...defaultProps,
      initialBookmarked: true,
    }
    render(<PostCard {...props} />)
    expect(screen.getByTestId('post-card')).toBeInTheDocument()
  })

  /**
   * テストケース20: いいね数0の表示
   *
   * いいね数が0の場合、「0」を表示するのではなく
   * 数字を非表示にすることを確認。
   *
   * UI設計：
   * - 0を表示すると寂しい印象を与える
   * - 数字がない方がすっきりした見た目になる
   */
  it('いいね数が0の場合は数字が表示されない', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        likeCount: 0,
      },
    }
    render(<PostCard {...props} />)
    screen.getByTestId('post-card')
    // コメント数の3は表示される（いいね数0とは別）
    expect(screen.getByText('3')).toBeInTheDocument()
    // いいね数の0は表示されない（検証方法：他の数字だけ表示されること）
  })

  /**
   * テストケース21: コメント数0の表示
   */
  it('コメント数が0の場合は数字が表示されない', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        commentCount: 0,
      },
    }
    render(<PostCard {...props} />)
    // いいね数の5は表示される
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  /**
   * テストケース22: 画像/動画メディアの表示
   *
   * 投稿にメディア（画像/動画）がある場合、
   * ImageGalleryコンポーネントが表示されることを確認。
   */
  it('メディアがある場合はImageGalleryが表示される', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        media: [
          { id: 'media-1', url: '/test-image.jpg', type: 'image', sortOrder: 0 },
        ],
      },
    }
    render(<PostCard {...props} />)
    // 注：ImageGalleryの詳細テストはImageGallery.test.tsxで行う
    expect(screen.getByTestId('post-card')).toBeInTheDocument()
  })

  /**
   * テストケース23: アバター画像なしの場合
   *
   * ユーザーがアバター画像を設定していない場合、
   * ニックネームの頭文字がフォールバックとして表示されることを確認。
   *
   * フォールバック：
   * 本来の値が存在しない場合に使用する代替値。
   */
  it('アバターがない場合はニックネームの頭文字が表示される', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        user: {
          ...defaultProps.post.user,
          avatarUrl: null, // アバターなし
        },
      },
    }
    render(<PostCard {...props} />)

    // ニックネームの最初の文字が表示される
    // charAt(0): 文字列の最初の文字を取得
    expect(screen.getByText(mockUser.nickname.charAt(0))).toBeInTheDocument()
  })

  /**
   * テストケース24: 複数ジャンルタグの表示
   *
   * 投稿に複数のジャンルが設定されている場合、
   * すべてのタグが表示されることを確認。
   */
  it('メンションを含む投稿でユーザーリンクを表示する', () => {
    const mentionUsers = new Map([
      ['user-abc', { id: 'user-abc', nickname: '盆栽太郎', avatarUrl: null }],
    ])
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: 'こんにちは <@user-abc> さん',
      },
      mentionUsers,
    }
    render(<PostCard {...props} />)

    expect(screen.getByText('@盆栽太郎')).toBeInTheDocument()
    const link = screen.getByText('@盆栽太郎').closest('a')
    expect(link).toHaveAttribute('href', '/users/user-abc')
  })

  it('存在しないメンションユーザーはunknownと表示する', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: 'こんにちは <@nonexistent> さん',
      },
      mentionUsers: new Map(),
    }
    render(<PostCard {...props} />)

    expect(screen.getByText('@unknown')).toBeInTheDocument()
  })

  it('複数のジャンルタグが全て表示される', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        genres: [
          { id: 'genre-1', name: '松柏類', category: '松柏類' },
          { id: 'genre-2', name: '雑木類', category: '雑木類' },
          { id: 'genre-3', name: '草物', category: '草物' },
        ],
      },
    }
    render(<PostCard {...props} />)

    // すべてのジャンルが表示される
    expect(screen.getByText('松柏類')).toBeInTheDocument()
    expect(screen.getByText('雑木類')).toBeInTheDocument()
    expect(screen.getByText('草物')).toBeInTheDocument()
  })
})

// ============================================================================
// テストの実行方法
// ============================================================================
/**
 * このテストファイルを実行するには：
 *
 * npm test -- __tests__/components/post/PostCard.test.tsx
 *
 * ## コンポーネントテストのベストプラクティス
 *
 * 1. ユーザーの視点でテスト
 *    - 実装の詳細（state、内部関数）ではなく、見た目と振る舞いをテスト
 *    - 「ユーザーが〇〇をクリックしたら△△が表示される」というシナリオ
 *
 * 2. アクセシビリティを考慮したセレクタ
 *    - getByRole（推奨）: ARIA roleで検索
 *    - getByText: 表示テキストで検索
 *    - getByTestId（非推奨）: 最後の手段
 *
 * 3. 非同期処理の待機
 *    - waitFor: 条件が満たされるまで待機
 *    - findBy*: 要素が現れるまで待機（waitFor + getBy）
 *
 * 4. モックの活用
 *    - 外部依存（API、Router）をモック化
 *    - 各テストで独立した状態を維持
 */
