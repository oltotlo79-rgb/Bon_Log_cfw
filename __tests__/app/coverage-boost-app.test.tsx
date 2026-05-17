import { vi } from 'vitest'
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @file __tests__/app/coverage-boost-app.test.tsx
 * @description Coverage boost tests for multiple low-coverage app files
 *
 * This file tests:
 * 1. app/sitemap.ts (currently 73% stmts, 20% funcs)
 * 2. app/(main)/search/page.tsx (currently 64% stmts)
 * 3. app/(legal)/privacy/page.tsx (66-75% stmts)
 * 4. app/(legal)/terms/page.tsx (66-75% stmts)
 * 5. app/(legal)/tokushoho/page.tsx (66-75% stmts)
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

/**
 * === テストの目的 ===
 * このテストファイルは複数の低カバレッジファイルのテストコードをまとめています
 * テスト対象:
 * 1. app/sitemap.ts - サイトマップ生成関数（SEO用）
 * 2. app/(main)/search/page.tsx - 検索ページ
 * 3. app/(legal)/privacy/page.tsx - プライバシーポリシー
 * 4. app/(legal)/terms/page.tsx - 利用規約
 * 5. app/(legal)/tokushoho/page.tsx - 特定商取引法表記
 *
 * === Mockの概念 ===
 * Mockは「本物そっくりの偽物」です。テスト時に実際のデータベースに接続してしまうと:
 * - テストが遅い
 * - 本物のデータが変わる危険がある
 * - テスト環境に依存する
 *
 * そこで、本物の代わりに「モック」を使って、テスト専用のダミーを作ります。
 */

// Mock modules before imports
/**
 * Prisma（データベース）のMock
 *
 * WHY（なぜ必要か）:
 * - テストでは実際のデータベースに接続したくない
 * - テストの度にDB操作をするとテストが遅くなる
 * - 本物のデータを変えたくない
 *
 * WHAT（何をやっているか）:
 * - @/lib/db から import される prisma オブジェクトを偽物に置き換える
 * - user.findMany() / post.findMany() 等の関数を vi.fn() で実装
 * - vi.fn() は「呼び出された回数」「引数」などを記録できる関数
 */
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findMany: vi.fn() },
    post: { findMany: vi.fn() },
    bonsaiShop: { findMany: vi.fn() },
    event: { findMany: vi.fn() },
    bonsaiTerm: { findMany: vi.fn() },
    pesticide: { findMany: vi.fn() },
    diseasePest: { findMany: vi.fn() },
    bonsai: { findMany: vi.fn() },
    pesticideColumn: { findMany: vi.fn() },
    activeIngredient: { findMany: vi.fn() },
    spreaderType: { findMany: vi.fn() },
    fertilizerColumn: { findMany: vi.fn() },
    fertilizerNutrient: { findMany: vi.fn() },
    treeSpecies: { findMany: vi.fn() },
    hormoneType: { findMany: vi.fn() },
    hormoneColumn: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/build/db-availability', () => ({
  shouldSkipBuildTimeDbAccess: () => false,
}))

/**
 * 認証情報のMock
 *
 * WHY: auth() はサーバーのセッション情報を取得する関数
 * テスト時には「ユーザーがログイン中」「ログアウト中」などを好きに制御したい
 *
 * HOW: 各テストで (auth as ReturnType<typeof vi.fn>).mockResolvedValue(...) で上書き
 */
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

/**
 * 検索関連の関数のMock
 *
 * WHY: 検索ページは複数の検索関数を呼び出す
 * 実際にDB検索すると遅いので、ダミーデータを返すMockにする
 *
 * HOW:
 * - vi.fn().mockResolvedValue() = 非同期関数をMock（Promiseを返す）
 * - { posts: [] } 等で返り値を指定
 * - 各テストで必要に応じてカスタマイズ
 */
vi.mock('@/lib/actions/search', () => ({
  // search* 系は ActionResult 形式を返す
  searchPosts: vi.fn().mockResolvedValue({ success: true, data: { posts: [], nextCursor: undefined } }),
  searchUsers: vi.fn().mockResolvedValue({ success: true, data: { users: [], nextCursor: undefined } }),
  searchByTag: vi.fn().mockResolvedValue({ success: true, data: { posts: [], nextCursor: undefined } }),
  // get* 系（メタデータ取得）は ActionResult ではない（RSC データ取得モジュール）
  getPopularTags: vi.fn().mockResolvedValue({ tags: [] }),
  getAllGenres: vi.fn().mockResolvedValue({ genres: {} }),
}))
vi.mock('@/lib/actions/poll', () => ({ votePoll: vi.fn(), getPollResults: vi.fn() }))

/**
 * コンポーネントのMock
 *
 * WHY: 検索ページは複雑なコンポーネント（SearchBar など）を含む
 * テストの焦点は「ページが正しく組み立てられているか」
 * 「各コンポーネント内部の複雑なロジック」はテスト対象外なので簡略化する
 *
 * HOW:
 * - 実際のコンポーネントを render 可能なシンプルなJSXに置き換える
 * - data-testid= 属性をつけて「このコンポーネントが存在する」かを確認できるようにする
 * - props を data-* 属性に保存して「正しい props が渡されているか」を検証できるようにする
 *
 * 例: SearchTabs の場合、props.activeTab が正しく data-tab に入っているか確認できる
 */
vi.mock('@/components/search/SearchBar', () => ({
  SearchBar: (props: any) => <div data-testid="search-bar" data-value={props.defaultValue} />,
}))

vi.mock('@/components/search/SearchTabs', () => ({
  SearchTabs: (props: any) => <div data-testid="search-tabs" data-tab={props.activeTab} />,
}))

vi.mock('@/components/search/GenreFilter', () => ({
  GenreFilter: () => <div data-testid="genre-filter" />,
}))

vi.mock('@/components/search/SearchResults', () => ({
  PostSearchResults: () => <div data-testid="post-results" />,
  UserSearchResults: () => <div data-testid="user-results" />,
  TagSearchResults: () => <div data-testid="tag-results" />,
  PopularTags: () => <div data-testid="popular-tags" />,
}))

/**
 * Next.js内部モジュールのMock
 *
 * WHY: next/link と next/image は Next.js 特有の機能
 * テスト環境では動作しないので、シンプルな代替品を用意する必要がある
 *
 * next/link の役割: クライアント側で高速にページ遷移
 * → テストでは普通の <a> タグで十分
 *
 * next/image の役割: 画像を自動最適化（WebP変換、遅延読み込みなど）
 * → テストでは普通の <img> タグで十分
 */
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

vi.mock('next/image', async () => {
  const { MockNextImage } = await import('../utils/mock-next-image')
  return { __esModule: true, default: MockNextImage }
})

/**
 * === テストの基本構造 ===
 *
 * describe() = テストのカテゴリ分け（「〇〇のテスト」）
 * it() = 個別のテスト（「△△の場合、□□が起こる」）
 * beforeEach() = 各テストの前に毎回実行される準備処理
 *
 * テスト実行の流れ:
 * 1. beforeEach() で Mockを初期化
 * 2. テスト対象の関数/コンポーネント を import
 * 3. it() でテストを実行
 * 4. expect() で「期待通りか」を確認
 */
describe('Coverage Boost Tests', async () => {
  /**
   * === sitemap.ts のテスト ===
   *
   * 役割: サイトマップを生成する関数
   * なぜテストが必要か:
   * - SEO（検索エンジン最適化）に重要
   * - DBから取得したユーザー、投稿、店舗、イベントの情報を正しく変換できているか確認
   * - 静的ページが全て含まれているか確認
   */
  describe('app/sitemap.ts', async () => {
    let sitemap: any

    /**
     * === beforeEach の説明 ===
     *
     * WHY（なぜ毎回実行するのか）:
     * - Mockの状態をリセットしないと、前のテストの結果が次のテストに影響する
     * - 例: テスト1で user.findMany が「2個返す」と設定したら、
     *       テスト2でも「2個返す」になってしまう
     * - 各テストを独立させるため、毎回初期化する
     *
     * HOW（何をしているか）:
     * - vi.clearAllMocks() = 全Mockの呼び出し記録をリセット
     * - Mockの返り値を設定（.mockResolvedValue()）
     * - テスト対象のモジュールをdynamic import（実行時に読み込み）
     */
    beforeEach(async () => {
      vi.clearAllMocks()
      const { prisma } = await import('@/lib/db')

      /**
       * === Mock の返り値設定 ===
       *
       * WHY: sitemap関数がDB検索を行う際に、
       *      「ユーザーが2人、投稿が2つ、店舗が1つ...」という
       *      テスト用のダミーデータを返したい
       *
       * HOW:
       * - .mockResolvedValue([...]) = 非同期関数の返り値を指定
       * - user1, user2... などのダミーオブジェクトを配列で用意
       * - 実際に sitemap() が これらのMockを呼ぶと、
       *   ここで指定したダミーデータが返される
       */
      ;(prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'user1', updatedAt: new Date('2026-01-15') },
        { id: 'user2', updatedAt: new Date('2026-01-20') },
      ])

      ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'post1', createdAt: new Date('2026-01-18') },
        { id: 'post2', createdAt: new Date('2026-01-22') },
      ])

      ;(prisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'shop1', updatedAt: new Date('2026-01-10') },
      ])

      ;(prisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'event1', createdAt: new Date('2026-01-25') },
      ])

      ;(prisma.bonsaiTerm.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      ;(prisma.pesticide.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      ;(prisma.diseasePest.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      ;(prisma.bonsai.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      ;(prisma.pesticideColumn.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      ;(prisma.activeIngredient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      ;(prisma.spreaderType.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      ;(prisma.fertilizerColumn.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      ;(prisma.fertilizerNutrient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      ;(prisma.treeSpecies.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      ;(prisma.hormoneType.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      ;(prisma.hormoneColumn.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

      /**
       * === Dynamic Import のパターン ===
       *
       * WHY: vi.mock() は「モジュール読み込み時」に実行される
       * だから、import の前に vi.mock() を書く必要がある
       * つまり:
       * 1. vi.mock() で Mock定義
       * 2. await import() で実際にモジュール読み込み（この時 Mock が有効になる）
       * 3. このタイミングで、テスト対象の sitemap関数 が「Mockされたprisma」を使って実装される
       *
       * HOW: await import('@/app/sitemap') で遅延読み込み
       *      default export を sitemap 変数に保存
       */
      const sitemapModule = await import('@/app/sitemap')
      sitemap = sitemapModule.default
    })

    /**
     * === 最初のテスト ===
     *
     * テスト名: 「should generate sitemap with static pages」
     * 意味: 「サイトマップが生成され、静的ページが含まれている」
     *
     * テスト内容:
     * 1. sitemap() 関数を実行
     * 2. 返り値が「配列か」「空でないか」確認
     * 3. 返り値から URL を抽出（map）
     * 4. 必須の静的ページ（プライバシー、利用規約など）が含まれているか確認
     *
     * expect() の種類:
     * - expect(result).toBeDefined() = null でない
     * - expect(Array.isArray(result)).toBe(true) = 配列型である
     * - expect(result.length).toBeGreaterThan(0) = 要素が1個以上
     * - expect(urls).toContain(url) = その URL が配列に含まれている
     */
    it('should generate sitemap with static pages', async () => {
      const result = await sitemap()

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)

      // Check for static pages (baseUrl is from sitemap's BASE_URL / getAppUrl())
      const urls = result.map((entry: any) => entry.url)
      const baseUrl = result[0]?.url ? new URL(result[0].url).origin : 'http://localhost:3000'

      // 重要なページが全て含まれているか確認
      expect(urls).toContain(baseUrl)
      expect(urls).toContain(`${baseUrl}/privacy`)
      expect(urls).toContain(`${baseUrl}/terms`)
      expect(urls).toContain(`${baseUrl}/help`)
      expect(urls).toContain(`${baseUrl}/tokushoho`)
      expect(urls).toContain(`${baseUrl}/shops`)
      expect(urls).toContain(`${baseUrl}/events`)
    })

    /**
     * === ユーザーページのテスト ===
     *
     * テスト対象: sitemap に ユーザープロフィールページ（/users/user1 など）が含まれているか
     *
     * HOW:
     * 1. sitemap() 実行結果から /users/ を含む URL をフィルタ
     * 2. 「beforeEach で Mock 設定した 2ユーザー分のページが含まれている」か確認
     * 3. 各ページのメタデータ確認:
     *    - changeFrequency = 「どのくらいの頻度で更新されるか」（weekly = 週1回）
     *    - priority = 「このページの重要度」（0.6 = 中程度）
     *    - これらは SEO に使われる
     */
    it('should include user pages in sitemap', async () => {
      const result = await sitemap()
      const baseUrl = result[0]?.url ? new URL(result[0].url).origin : 'http://localhost:3000'

      // /users/ を含む URL だけを抽出
      const userUrls = result.filter((entry: any) => entry.url.includes('/users/'))
      expect(userUrls.length).toBe(2)
      expect(userUrls[0].url).toBe(`${baseUrl}/users/user1`)
      expect(userUrls[0].changeFrequency).toBe('weekly')
      expect(userUrls[0].priority).toBe(0.6)
    })

    /**
     * === 投稿ページのテスト ===
     *
     * テスト対象: 各投稿ページ（/posts/post1 など）がサイトマップに含まれているか
     *
     * 注意: 投稿は頻繁に更新されるが、ユーザープロフィールより優先度は低い
     * - changeFrequency: 'monthly' = 月に1回程度の更新
     * - priority: 0.5 = 低い優先度
     */
    it('should include post pages in sitemap', async () => {
      const result = await sitemap()
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'

      const postUrls = result.filter((entry: any) => entry.url.includes('/posts/'))
      expect(postUrls.length).toBe(2)
      expect(postUrls[0].changeFrequency).toBe('monthly')
      expect(postUrls[0].priority).toBe(0.5)
    })

    /**
     * === 盆栽園ページのテスト ===
     *
     * 注意: フィルタで `/shops/` を含む場合はどうする？
     * - `/shops` と `/shops/shop1` が両方含まれる可能性がある
     * - フィルタで `entry.url !== baseUrl/shops` として、
     *   「一覧ページ」を除いて「個別ページ」だけを抽出
     *
     * 優先度が 0.7 と高い = ビジネス上重要なコンテンツ
     */
    it('should include shop pages in sitemap', async () => {
      const result = await sitemap()
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'

      // /shops/shop1 等の個別ページのみを抽出（/shops の一覧ページを除く）
      const shopUrls = result.filter((entry: any) => entry.url.includes('/shops/') && entry.url !== `${baseUrl}/shops`)
      expect(shopUrls.length).toBe(1)
      expect(shopUrls[0].changeFrequency).toBe('weekly')
      expect(shopUrls[0].priority).toBe(0.7)
    })

    /**
     * === イベントページのテスト ===
     *
     * 構造は盆栽園ページと同じ
     * 一覧ページを除いて個別ページをテスト
     */
    it('should include event pages in sitemap', async () => {
      const result = await sitemap()
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'

      // /events/event1 等の個別ページのみを抽出
      const eventUrls = result.filter((entry: any) => entry.url.includes('/events/') && entry.url !== `${baseUrl}/events`)
      expect(eventUrls.length).toBe(1)
      expect(eventUrls[0].changeFrequency).toBe('weekly')
      expect(eventUrls[0].priority).toBe(0.7)
    })

    /**
     * === Mock の呼び出し検証テスト ===
     *
     * これまでのテスト: 「sitemap() の返り値が正しいか」
     * 今回のテスト: 「sitemap() が正しい方法で DB にアクセスしているか」
     *
     * WHY（なぜ重要か）:
     * - 返り値が正しくても、DB クエリが間違っていたら本番では失敗する
     * - 例: `take: 1000` のはずが `take: 100` になってたら、
     *       本番で取得漏れが発生する可能性
     *
     * HOW:
     * - vi.fn() の特性: 呼び出されたときの引数を記録している
     * - toHaveBeenCalledWith() で「この引数で呼ばれたか」を検証
     *
     * 各フィールドの説明:
     * - where: 「どのデータを取得するか」のフィルタ
     * - select: 「どのカラムを取得するか」（必要なもののみ）
     * - take: 「最大何件取得するか」（1000件まで、等）
     * - orderBy: 「どの順序で並べるか」（新しい順など）
     */
    it('should call prisma methods with correct parameters', async () => {
      const { prisma } = await import('@/lib/db')
      await sitemap()

      // ユーザー取得時のクエリ検証
      // 「公開ユーザーで、停止されていない、ゲスト除外」という条件で取得
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          isPublic: true,
          isSuspended: false,
          email: { not: 'guest@example.com' },
        },
        select: { id: true, updatedAt: true },
        take: 1000,
        orderBy: { updatedAt: 'desc' },
      })

      // 投稿取得時のクエリ検証
      // 「公開ユーザーの投稿で、リポスト（引用ツイート）ではなく、隠し投稿でない」という条件
      expect(prisma.post.findMany).toHaveBeenCalledWith({
        where: {
          user: { isPublic: true, isSuspended: false },
          repostPostId: null,
          isHidden: false,
        },
        select: { id: true, createdAt: true },
        take: 5000,
        orderBy: { createdAt: 'desc' },
      })

      // 盆栽園取得時のクエリ検証（isHidden=false のみ含める）
      expect(prisma.bonsaiShop.findMany).toHaveBeenCalledWith({
        where: { isHidden: false },
        select: { id: true, updatedAt: true },
        take: 500,
        orderBy: { updatedAt: 'desc' },
      })

      // イベント取得時のクエリ検証
      // 「終了していない、または終了日が未来、かつ isHidden=false」という条件
      // expect.any(Date) = 「任意の Date 型」という意味（具体的な日付は検証しない）
      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: {
          isHidden: false,
          OR: [
            { endDate: { gte: expect.any(Date) } },
            { endDate: null, startDate: { gte: expect.any(Date) } },
          ],
        },
        select: { id: true, createdAt: true },
        take: 1000,
        orderBy: { startDate: 'asc' },
      })
    })
  })

  /**
   * === 検索ページ（Server Component）のテスト ===
   *
   * Server Component の特徴:
   * - サーバー上で実行される（クライアント JS が実行されない）
   * - 直接 DB にアクセス可能
   * - async/await が使える
   *
   * テストするポイント:
   * 1. 検索パラメータ（q, tab, genre）に応じて異なるUIが表示される
   * 2. 検索関数が正しい引数で呼ばれている
   * 3. 複数のコンポーネント（SearchBar, SearchTabs等）が正しく組み立てられている
   */
  describe('app/(main)/search/page.tsx', async () => {
    let SearchPage: any

    /**
     * === 検索ページの beforeEach ===
     *
     * Server Component をテストするには:
     * 1. auth() を Mock（現在のユーザーを設定）
     * 2. 検索関数を Mock（検索結果を返す）
     * 3. SearchPage コンポーネントを動的に import
     */
    beforeEach(async () => {
      vi.clearAllMocks()
      const { auth } = await import('@/lib/auth')
      // 「user123 というユーザーがログイン中」という状態を Mock
      ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'user123' } })

      const searchPageModule = await import('@/app/(main)/search/page')
      SearchPage = searchPageModule.default
    })

    /**
     * === Server Component のテスト方法 ===
     *
     * 通常のコンポーネント: render(<Component />)
     * Server Component: render(await Component({ props }))
     *
     * WHY:
     * - Server Component は async 関数
     * - await で Promise を待つ必要がある
     * - その後、JSX を render() に渡す
     *
     * searchParams について:
     * - URL クエリ文字列（?q=test&tab=posts）をオブジェクトに変換したもの
     * - Promise でラップされている（Next.js の仕様）
     * - Promise.resolve({}) = 「パラメータなし（デフォルト状態）」
     */
    it('should render with default posts tab', async () => {
      // SearchPage を実行して JSX を取得
      // searchParams = {（パラメータなし）}
      const jsx = await SearchPage({ searchParams: Promise.resolve({}) })
      const { container } = render(jsx)

      // デフォルト状態では、以下のコンポーネントが表示される
      expect(screen.getByTestId('search-bar')).toBeInTheDocument()
      expect(screen.getByTestId('search-tabs')).toBeInTheDocument()
      expect(screen.getByTestId('genre-filter')).toBeInTheDocument() // タブがデフォルト（posts）のため表示

      // Suspense 境界により、非同期コンテンツはローディングスケルトンが表示される
      // 構造が正しく組み立てられているか確認（space-y-4 = Tailwind の margin クラス）
      expect(container.querySelector('.space-y-4')).toBeInTheDocument()
    })

    /**
     * === タブ切り替えのテスト（users タブ）===
     *
     * URL クエリ: ?tab=users&q=test
     * 期待される動作:
     * - SearchTabs の data-tab 属性が 'users' になる
     * - GenreFilter は表示されない（ジャンルフィルタは投稿検索の時だけ）
     * - PopularTags は表示されない
     * - bg-card クラス（背景色）を持つ要素が存在
     */
    it('should render users tab when tab=users', async () => {
      const jsx = await SearchPage({
        searchParams: Promise.resolve({ tab: 'users', q: 'test' }),
      })
      const { container } = render(jsx)

      // 渡された tab パラメータが正しく data-tab に入っているか確認
      expect(screen.getByTestId('search-tabs')).toHaveAttribute('data-tab', 'users')
      // users タブではジャンルフィルタは不要
      expect(screen.queryByTestId('genre-filter')).not.toBeInTheDocument()
      // users タブではトレンディングタグは不要
      expect(screen.queryByTestId('popular-tags')).not.toBeInTheDocument()
      // UI構造が正しい（bg-card クラスで背景が適用されている）
      expect(container.querySelector('.bg-card')).toBeInTheDocument()
    })

    /**
     * === タブ切り替えのテスト（tags タブ）===
     *
     * URL クエリ: ?tab=tags&q=nature
     * タグ検索では:
     * - ジャンルフィルタは不要（タグ検索は自由な文字列）
     * - data-tab が 'tags' に設定される
     */
    it('should render tags tab when tab=tags', async () => {
      const jsx = await SearchPage({
        searchParams: Promise.resolve({ tab: 'tags', q: 'nature' }),
      })
      const { container } = render(jsx)

      expect(screen.getByTestId('search-tabs')).toHaveAttribute('data-tab', 'tags')
      expect(screen.queryByTestId('genre-filter')).not.toBeInTheDocument()
      expect(container.querySelector('.bg-card')).toBeInTheDocument()
    })

    /**
     * === エッジケースのテスト（タグタブで検索キーがない）===
     *
     * URL クエリ: ?tab=tags（q パラメータなし）
     * 期待される動作:
     * - 「検索キーを入力してください」的なメッセージが表示される
     * - もしくは、トレンディングタグが表示される
     * - 検索結果は表示されない
     */
    it('should show message when tags tab has no query', async () => {
      const jsx = await SearchPage({
        searchParams: Promise.resolve({ tab: 'tags' }),
      })
      const { container } = render(jsx)

      expect(screen.getByTestId('search-tabs')).toHaveAttribute('data-tab', 'tags')
      expect(container.querySelector('.space-y-4')).toBeInTheDocument()
    })

    /**
     * === ジャンルフィルタの表示条件テスト ===
     *
     * ジャンルフィルタは投稿タブでのみ表示される
     * WHY: ユーザーやタグ検索にはジャンルという概念がないから
     */
    it('should render genre filter only on posts tab', async () => {
      const jsx = await SearchPage({
        searchParams: Promise.resolve({ tab: 'posts' }),
      })
      render(jsx)

      expect(screen.getByTestId('genre-filter')).toBeInTheDocument()
    })

    /**
     * === トレンディングタグの表示テスト ===
     *
     * ユーザーが検索キーを入力していない（空文字列 q: ''）場合、
     * トレンディングタグを表示してユーザーを導く
     */
    it('should show popular tags on tags tab with no query', async () => {
      const jsx = await SearchPage({
        searchParams: Promise.resolve({ tab: 'tags', q: '' }),
      })
      render(jsx)

      expect(screen.getByTestId('popular-tags')).toBeInTheDocument()
    })

    /**
     * === ジャンルフィルタのパラメータテスト（単一）===
     *
     * URL クエリ: ?tab=posts&genre=genre1
     * 期待: searchPosts( '', ['genre1'] ) が呼ばれる
     *
     * WHY このテストが重要か:
     * - ジャンルパラメータが正しく searchPosts 関数に渡されているか確認
     * - URL から取得した文字列が正しく配列に変換されているか確認
     */
    it('should handle single genre parameter', async () => {
      const { searchPosts } = await import('@/lib/actions/search')

      const jsx = await SearchPage({
        searchParams: Promise.resolve({ tab: 'posts', genre: 'genre1' }),
      })
      render(jsx)

      // searchPosts が、第1引数：検索キー（空），第2引数：ジャンル配列 で呼ばれたか確認
      expect(searchPosts).toHaveBeenCalledWith('', ['genre1'], undefined, 20, undefined)
    })

    /**
     * === ジャンルフィルタのパラメータテスト（複数）===
     *
     * URL クエリ: ?tab=posts&genre=genre1&genre=genre2
     * Next.js では複数の同じパラメータが自動的に配列に変換される
     * 期待: searchPosts( '', ['genre1', 'genre2'] ) が呼ばれる
     *
     * 複数ジャンルで絞り込みできることが重要
     */
    it('should handle multiple genre parameters', async () => {
      const { searchPosts } = await import('@/lib/actions/search')

      const jsx = await SearchPage({
        searchParams: Promise.resolve({ tab: 'posts', genre: ['genre1', 'genre2'] }),
      })
      render(jsx)

      expect(searchPosts).toHaveBeenCalledWith('', ['genre1', 'genre2'], undefined, 20, undefined)
    })

    /**
     * === 補助関数の呼び出しテスト ===
     *
     * SearchPage は以下の補助関数を呼び出す:
     * 1. getAllGenres() - 全ジャンル一覧を取得（ジャンルフィルタで使用）
     * 2. getPopularTags(10) - 人気タグトップ10を取得（トレンディング表示用）
     *
     * テストのポイント:
     * - これらの関数が初回レンダリング時に「必ず」呼ばれることを確認
     * - getPopularTags が引数 10 で呼ばれることを確認（10件取得）
     */
    it('should call getPopularTags and getAllGenres', async () => {
      const { getPopularTags, getAllGenres } = await import('@/lib/actions/search')

      await SearchPage({ searchParams: Promise.resolve({}) })

      expect(getAllGenres).toHaveBeenCalled()
      expect(getPopularTags).toHaveBeenCalledWith(10)
    })

    /**
     * === エラーハンドリングのテスト（不正なタブ値）===
     *
     * URL に存在しないタブ（?tab=unknown）が指定された場合:
     * - アプリがクラッシュしない
     * - SearchTabs コンポーネントが存在する（デフォルト動作）
     *
     * Defensive Programming = 予期しない入力にも対応する
     */
    it('should handle null return for unknown tab', async () => {
      const jsx = await SearchPage({
        searchParams: Promise.resolve({ tab: 'unknown' }),
      })
      render(jsx)

      // クラッシュせず、通常通りレンダリングされることを確認
      expect(screen.getByTestId('search-tabs')).toBeInTheDocument()
    })
  })

  /**
   * === 法律ページのテスト戦略 ===
   *
   * プライバシーポリシー、利用規約、特定商取引法表記などは:
   * - 静的な内容（ほぼ変わらない）
   * - 複雑なロジックがない（単なる情報表示）
   *
   * テスト方法:
   * 1. ページがクラッシュしないか確認
   * 2. 必須のセクションが全て含まれているか確認
   * 3. 重要な情報が正しく表示されているか確認
   *
   * WHY このテストが重要か:
   * - 法律ページの削除/変更は、ビジネス・法的リスク
   * - スクリーンショットで視認できる内容だけでなく、
   *   自動テストで「必須セクションの存在」を担保する
   */
  describe('app/(legal)/privacy/page.tsx', async () => {
    /**
     * === プライバシーポリシーページの基本テスト ===
     *
     * 確認項目:
     * - ページがレンダリングできる
     * - タイトルが表示される
     * - 最終更新日が表示される
     */
    it('should render privacy policy page without crashing', async () => {
      const PrivacyPage = (await import('@/app/(legal)/privacy/page')).default
      render(<PrivacyPage />)

      expect(screen.getByText('プライバシーポリシー')).toBeInTheDocument()
      expect(screen.getByText('最終更新日: 2026年1月1日')).toBeInTheDocument()
    })

    /**
     * === プライバシーポリシーの主要セクションテスト ===
     *
     * 法律ページで重要な確認:
     * - 「情報収集」について書かれている
     * - 「利用目的」が明記されている
     * - 「決済情報」の取り扱いが説明されている
     * - 「情報共有」のルールが書かれている
     * - 「セキュリティ対策」について記載
     * - 「ユーザー権利」が明示されている
     *
     * WHY: これらは法的に必須の項目
     * 不足すると、JAPCやPPC（個人情報保護委員会）から指導される可能性
     */
    it('should contain key privacy sections', async () => {
      const PrivacyPage = (await import('@/app/(legal)/privacy/page')).default
      render(<PrivacyPage />)

      expect(screen.getByText('第1条（収集する情報）')).toBeInTheDocument()
      expect(screen.getByText('第2条（情報の利用目的）')).toBeInTheDocument()
      expect(screen.getByText('第3条（有料会員の決済情報）')).toBeInTheDocument()
      expect(screen.getByText('第4条（情報の共有・第三者提供）')).toBeInTheDocument()
      expect(screen.getByText('第5条（情報の保管と安全管理）')).toBeInTheDocument()
      expect(screen.getByText('第6条（ユーザーの権利）')).toBeInTheDocument()
    })

    /**
     * === プライバシーポリシー詳細セクションテスト ===
     *
     * さらに細かい確認項目:
     * - 情報収集の具体例（直接提供、自動収集、Cookie）
     * - 公開情報についての取り扱い
     * - 児童情報への配慮
     * - 国際転送の説明
     * - 分析ツール（Google Analytics等）の明示
     * - ポリシー変更時の対応
     * - ユーザーからのお問い合わせ窓口
     *
     * これらが不足すると、透明性が欠ける
     */
    it('should contain all required information sections', async () => {
      const PrivacyPage = (await import('@/app/(legal)/privacy/page')).default
      render(<PrivacyPage />)

      expect(screen.getByText('1.1 ユーザーから直接提供される情報')).toBeInTheDocument()
      expect(screen.getByText('1.2 自動的に収集される情報')).toBeInTheDocument()
      expect(screen.getByText('1.3 Cookie および類似技術')).toBeInTheDocument()
      expect(screen.getByText('第7条（公開情報）')).toBeInTheDocument()
      expect(screen.getByText('第8条（子どもの個人情報）')).toBeInTheDocument()
      expect(screen.getByText('第9条（国際的なデータ転送）')).toBeInTheDocument()
      expect(screen.getByText('第10条（分析ツール）')).toBeInTheDocument()
      expect(screen.getByText('第11条（プライバシーポリシーの変更）')).toBeInTheDocument()
      expect(screen.getByText('第12条（お問い合わせ）')).toBeInTheDocument()
    })

    /**
     * === プライバシーポリシーの要約セクションテスト ===
     *
     * UX の観点から、長いプライバシーポリシーの最後に「要約」を配置
     * ユーザーが「結局何をされるのか」を簡潔に理解できるようにする
     *
     * 要約に含まれるべき内容:
     * - データの利用目的
     * - セキュリティ対策
     * - ユーザーの権利
     */
    it('should have summary section at the bottom', async () => {
      const PrivacyPage = (await import('@/app/(legal)/privacy/page')).default
      render(<PrivacyPage />)

      expect(screen.getByText('個人情報の取り扱いに関する要約')).toBeInTheDocument()
      expect(screen.getByText('収集した情報はサービス提供と改善のために使用します')).toBeInTheDocument()
      expect(screen.getByText('決済情報は安全な決済代行会社で処理されます')).toBeInTheDocument()
    })
  })

  /**
   * === 利用規約ページのテスト ===
   *
   * プライバシーポリシーとの違い:
   * - プライバシーポリシー = 「個人情報をどう扱うか」（個人情報保護）
   * - 利用規約 = 「サービスをどう使ってもいいか」（利用ルール）
   *
   * テスト戦略は同じ：必須セクションの存在確認
   */
  describe('app/(legal)/terms/page.tsx', async () => {
    /**
     * === 利用規約ページの基本テスト ===
     */
    it('should render terms of service page without crashing', async () => {
      const TermsPage = (await import('@/app/(legal)/terms/page')).default
      render(<TermsPage />)

      expect(screen.getByText('利用規約')).toBeInTheDocument()
      expect(screen.getByText('最終更新日: 2026年1月1日')).toBeInTheDocument()
    })

    /**
     * === 利用規約の主要セクションテスト ===
     *
     * 重要な項目:
     * - 規約がいつ適用されるか（第1条）
     * - ユーザー登録のルール
     * - アカウント責任
     * - 投稿コンテンツの著作権
     * - 料金体系（無料/有料）
     * - 禁止事項（スパム、違法行為など）
     */
    it('should contain key terms sections', async () => {
      const TermsPage = (await import('@/app/(legal)/terms/page')).default
      render(<TermsPage />)

      expect(screen.getByText('第1条（適用）')).toBeInTheDocument()
      expect(screen.getByText('第2条（利用登録）')).toBeInTheDocument()
      expect(screen.getByText('第3条（アカウント管理）')).toBeInTheDocument()
      expect(screen.getByText('第4条（投稿コンテンツ）')).toBeInTheDocument()
      expect(screen.getByText('第5条（無料会員と有料会員）')).toBeInTheDocument()
      expect(screen.getByText('第8条（禁止事項）')).toBeInTheDocument()
    })

    /**
     * === 会員体系の詳細テスト ===
     *
     * サービスが無料/有料の2階層で構成されているため、
     * それぞれの違いを明確に説明する必要がある
     * （利用できる機能、制限、料金など）
     */
    it('should contain membership tiers information', async () => {
      const TermsPage = (await import('@/app/(legal)/terms/page')).default
      render(<TermsPage />)

      expect(screen.getByText('5.1 無料会員')).toBeInTheDocument()
      expect(screen.getByText('5.2 有料会員（プレミアム会員）')).toBeInTheDocument()
    })

    /**
     * === 決済と解約のポリシーテスト ===
     *
     * 有料会員サービスを提供する場合、必ず記載が必要:
     * - 具体的な料金
     * - 支払い方法
     * - 解約方法
     * - 返金ポリシー
     * - いつから課金されるか
     *
     * これらが不明確だと、契約トラブルや消費者からの苦情につながる
     */
    it('should contain payment and cancellation policies', async () => {
      const TermsPage = (await import('@/app/(legal)/terms/page')).default
      render(<TermsPage />)

      expect(screen.getByText('第6条（有料サービスの料金と支払い）')).toBeInTheDocument()
      expect(screen.getByText('第7条（解約と返金）')).toBeInTheDocument()
    })

    /**
     * === サービス運営に関するポリシーテスト ===
     *
     * トラブル発生時のルール定義:
     * - サービス停止時の対応（メンテナンス、緊急停止など）
     * - 利用制限（スパム、違法行為時の対応）
     * - アカウント削除のルール
     * - ユーザーの退会手続き
     * - 免責事項（「我々は責任を負わない」という明記）
     *
     * 免責事項は法的に重要 = サービス障害時に訴訟を避けるため
     */
    it('should contain service operation policies', async () => {
      const TermsPage = (await import('@/app/(legal)/terms/page')).default
      render(<TermsPage />)

      expect(screen.getByText('第9条（本サービスの提供の停止等）')).toBeInTheDocument()
      expect(screen.getByText('第10条（利用制限およびアカウント削除）')).toBeInTheDocument()
      expect(screen.getByText('第11条（退会）')).toBeInTheDocument()
      expect(screen.getByText('第12条（保証の否認および免責事項）')).toBeInTheDocument()
    })

    /**
     * === その他の法的セクションテスト ===
     *
     * 契約変更や紛争対応についてのルール:
     * - サービス内容を変更できるか
     * - 規約を変更できるか（ユーザーへの通知は？）
     * - プライバシーポリシーへの言及
     * - ユーザーへの通知方法
     * - 規約上の権利を売却できるか（通常は禁止）
     * - トラブル時はどこの裁判所で争うか（準拠法）
     *
     * これらは「小さいことのように見えるが」企業法務では超重要
     */
    it('should contain legal sections', async () => {
      const TermsPage = (await import('@/app/(legal)/terms/page')).default
      render(<TermsPage />)

      expect(screen.getByText('第13条（サービス内容の変更等）')).toBeInTheDocument()
      expect(screen.getByText('第14条（利用規約の変更）')).toBeInTheDocument()
      expect(screen.getByText('第15条（個人情報の取扱い）')).toBeInTheDocument()
      expect(screen.getByText('第16条（通知または連絡）')).toBeInTheDocument()
      expect(screen.getByText('第17条（権利義務の譲渡の禁止）')).toBeInTheDocument()
      expect(screen.getByText('第18条（準拠法・裁判管轄）')).toBeInTheDocument()
    })
  })

  /**
   * === 特定商取引法表記ページのテスト ===
   *
   * 特定商取引法（特商法）について:
   * - 日本の法律で、有料サービスを提供する企業に記載義務がある
   * - 記載がないと、消費者庁から停止命令の可能性
   * - プライバシーポリシー、利用規約とは「別の法的要件」
   *
   * 記載すべき情報:
   * - 販売業者（企業名）
   * - 住所
   * - 連絡先
   * - 代表者名
   * - 商品（サービス）説明
   * - 料金（税込み）
   * - 支払い方法
   * - 支払い時期
   * - 返金・キャンセルポリシー
   * - 動作環境
   *
   * テスト戦略: 各情報が表示されているか、リンクが正しいか確認
   */
  describe('app/(legal)/tokushoho/page.tsx', async () => {
    /**
     * === 特商法ページの基本テスト ===
     */
    it('should render tokushoho page without crashing', async () => {
      const TokushohoPage = (await import('@/app/(legal)/tokushoho/page')).default
      render(<TokushohoPage />)

      expect(screen.getByText('特定商取引法に基づく表記')).toBeInTheDocument()
    })

    /**
     * === 企業情報・代表者情報のテスト ===
     *
     * 特商法で必ず記載する情報:
     * - 販売業者の正式名称
     * - 運営統括責任者の氏名
     *
     * WHY: ユーザーが「この企業は本物か」を判断するため
     * 架空企業だったら訴訟されるリスク
     */
    it('should contain all required business information', async () => {
      const TokushohoPage = (await import('@/app/(legal)/tokushoho/page')).default
      render(<TokushohoPage />)

      expect(screen.getByText('販売業者')).toBeInTheDocument()
      expect(screen.getByText('BON-LOG運営')).toBeInTheDocument()
      expect(screen.getByText('運営統括責任者')).toBeInTheDocument()
      expect(screen.getByText('野村侑矢')).toBeInTheDocument()
    })

    /**
     * === 料金情報のテスト ===
     *
     * 特商法で重要な確認:
     * - 価格が「税込み」であることを明記
     * - 複数プランがある場合は全て表示
     * - 「後から追加料金がかかるのか」も明記が必要
     *
     * 不明確な価格表記は、消費者トラブルの最大要因
     */
    it('should contain pricing information', async () => {
      const TokushohoPage = (await import('@/app/(legal)/tokushoho/page')).default
      render(<TokushohoPage />)

      expect(screen.getByText('販売価格')).toBeInTheDocument()
      expect(screen.getByText('月額プラン: 350円（税込）')).toBeInTheDocument()
      expect(screen.getByText('年額プラン: 3,500円（税込）')).toBeInTheDocument()
    })

    /**
     * === 支払い方法・タイミングのテスト ===
     *
     * 特商法で記載必須:
     * - どの支払い方法が使えるか（クレジットカード、銀行振込など）
     * - いつ課金されるのか（登録時、毎月何日など）
     * - 決済会社の情報
     *
     * ユーザーが「いつお金が引かれるのか」を事前に知る権利
     */
    it('should contain payment information', async () => {
      const TokushohoPage = (await import('@/app/(legal)/tokushoho/page')).default
      render(<TokushohoPage />)

      expect(screen.getByText('支払方法')).toBeInTheDocument()
      expect(screen.getByText('クレジットカード（Stripe決済）')).toBeInTheDocument()
      expect(screen.getByText('支払時期')).toBeInTheDocument()
    })

    /**
     * === 契約期間・解約・返金のテスト ===
     *
     * ユーザーが最も関心を持つ情報:
     * - いつから契約が始まるか
     * - いつから解約できるか
     * - キャンセル方法は？
     * - 返金は？（全額？部分？いつ？）
     *
     * これが不明確 = 「辞めたいのに辞められない」という消費者被害
     * → 特商法違反で停止命令の対象
     */
    it('should contain contract and cancellation policies', async () => {
      const TokushohoPage = (await import('@/app/(legal)/tokushoho/page')).default
      render(<TokushohoPage />)

      expect(screen.getByText('契約期間')).toBeInTheDocument()
      expect(screen.getByText('解約・キャンセル')).toBeInTheDocument()
      expect(screen.getByText('返金ポリシー')).toBeInTheDocument()
    })

    /**
     * === 連絡先情報のテスト ===
     *
     * 特商法で必須:
     * - 顧客が問い合わせできるメールアドレスまたは電話番号
     * - 実在しない連絡先の記載は違法
     *
     * テストの工夫:
     * - メールアドレスのテキストが存在するか確認
     * - そのテキストが <a href="mailto:..." > で囲まれているか確認
     * - クリックするとメールが送信できる状態か確認
     *
     * expect(emailLink.closest('a')) は「この要素の祖先から最初の <a> タグを探す」
     */
    it('should contain contact information', async () => {
      const TokushohoPage = (await import('@/app/(legal)/tokushoho/page')).default
      render(<TokushohoPage />)

      expect(screen.getByText('メールアドレス')).toBeInTheDocument()
      const emailLink = screen.getByText('bon.log2026@gmail.com')
      expect(emailLink).toBeInTheDocument()
      // メールアドレスが mailto: リンクで実装されているか確認
      expect(emailLink.closest('a')).toHaveAttribute('href', 'mailto:bon.log2026@gmail.com')
    })

    /**
     * === サービス提供時期のテスト ===
     *
     * 特商法の確認項目:
     * - 「商品・サービスをいつから使えるのか」を明記
     * - 例: 「決済完了後、即時」「翌営業日」「3営業日以内」など
     * - デジタルコンテンツ（今回の場合サブスク）は「即時」が一般的
     */
    it('should contain service timing information', async () => {
      const TokushohoPage = (await import('@/app/(legal)/tokushoho/page')).default
      render(<TokushohoPage />)

      expect(screen.getByText('サービス提供時期')).toBeInTheDocument()
      expect(screen.getByText('決済完了後、即時ご利用いただけます')).toBeInTheDocument()
    })

    /**
     * === システム要件のテスト ===
     *
     * デジタルサービスの場合、特商法で記載が必要:
     * - 使用可能なOS（Windows、Mac、iOS、Android等）
     * - 推奨ブラウザ
     * - インターネット接続が必須かどうか
     *
     * WHY: ユーザーが「自分のデバイスで使えるか」を判断するため
     * 「買ったけど使えない」というクレームを防ぐため
     *
     * screen.getByText(/正規表現/) = 「〇〇を含むテキスト」を検索
     */
    it('should contain system requirements', async () => {
      const TokushohoPage = (await import('@/app/(legal)/tokushoho/page')).default
      render(<TokushohoPage />)

      expect(screen.getByText('動作環境')).toBeInTheDocument()
      // /.../ の正規表現で「このテキストを含む」という条件で検索
      expect(screen.getByText(/最新版のChrome、Firefox、Safari、Edgeを推奨/)).toBeInTheDocument()
    })

    /**
     * === UXテスト：ナビゲーションリンク ===
     *
     * 特商法ページから「設定ページ（サブスク管理）」へのリンクがあるか確認
     * ユーザーが「解約したい」と思ったときに、
     * この法律ページから設定ページに遷移できることが重要
     *
     * テスト内容:
     * - リンク「設定ページ」が存在
     * - それが /settings/subscription に指している
     */
    it('should have link to settings page', async () => {
      const TokushohoPage = (await import('@/app/(legal)/tokushoho/page')).default
      render(<TokushohoPage />)

      const settingsLink = screen.getByText('設定ページ')
      expect(settingsLink).toBeInTheDocument()
      expect(settingsLink.closest('a')).toHaveAttribute('href', '/settings/subscription')
    })
  })
})
