import { vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { redirect as _mockRedirect } from 'next/navigation'

/**
 * Next.jsモジュールのモック設定
 * テスト環境ではNext.jsの機能を実際に実行できないため、モック（偽物）を作成します
 */

/**
 * next/link のモック
 * 本来: ページ遷移を自動でプリフェッチする<Link>コンポーネント
 * テスト環境では: 通常のHTMLの<a>タグとして動作させる
 * WHY: テスト環境でページ遷移機能を実行する必要がないため、シンプルに<a>タグに置き換える
 */
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

/**
 * next/navigation のモック
 * 本来: リダイレクト（別ページへの移動）やnotFound（404表示）などの機能
 * テスト環境では: vi.fn()で関数として記録するだけにする
 * WHY: 実際にリダイレクトしたり404を表示したりする必要がないため、呼び出しをトラッキングするだけでOK
 */
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

/**
 * Server Actions（サーバー側で実行される関数）のモック
 * これらはテスト内で呼び出されるため、モック化して挙動を制御します
 */

/**
 * @/lib/actions/admin モック
 * 本来: 管理者権限チェック関数 (isAdmin)
 * テスト環境では: vi.fn()で関数を記録 → mockResolvedValue()で返り値を制御できる
 * WHY: テスト内でisAdminの戻り値（true/false）を自由に変えて、異なるシナリオをテストしたい
 */
vi.mock('@/lib/actions/admin', () => ({
  isAdmin: vi.fn(),
}))

/**
 * @/lib/actions/maintenance モック
 * 本来: メンテナンス設定を取得する関数 (getMaintenanceSettings)
 * テスト環境では: mockResolvedValue()で異なる設定データを返す
 * WHY: メンテナンス有効/無効、時間設定など複数パターンをテストしたい
 */
vi.mock('@/lib/actions/maintenance', () => ({
  getMaintenanceSettings: vi.fn(),
}))

/**
 * Client Components（React hooks使用など）のモック
 * Server Componentsのテストでは、その内部で使用されるClient Componentsもモック化する必要があります
 */

/**
 * EventImportClient のモック
 * 本来: イベントインポート機能を持つClient Component
 * テスト環境では: data-testid="event-import-client"を持つ<div>として表示
 * WHY: Server Componentを単独でテストするため、内部のClient Componentは動作確認不要 → 単純なdivで置き換える
 */
vi.mock('@/app/admin/events/import/EventImportClient', () => ({
  EventImportClient: () => <div data-testid="event-import-client" />,
}))

/**
 * MaintenanceForm のモック
 * 本来: メンテナンス設定フォーム
 * テスト環境では: settingsプロパティのenabled値をdata属性として保持する<div>
 * WHY: Server Component内でMaintenanceFormが正しく渡されているか確認するため、propsを検証可能にする
 */
vi.mock('@/app/admin/maintenance/MaintenanceForm', () => ({
  MaintenanceForm: ({ settings }: any) => (
    <div data-testid="maintenance-form" data-enabled={settings?.enabled} />
  ),
}))

/**
 * UsageCards のモック
 * 本来: 使用量情報を表示するClient Component
 * テスト環境では: シンプルなマーカー<div>で置き換える
 */
vi.mock('@/app/admin/usage/UsageCards', () => ({
  UsageCards: () => <div data-testid="usage-cards" />,
}))

/**
 * 広告関連コンポーネントのモック
 * これらは「バレルエクスポート」（index.tsから複数コンポーネントを再エクスポート）のテストに必要です
 * バレルエクスポートは、使いやすさのため複数ファイルの機能を1つのindex.tsにまとめたもの
 */

/**
 * GoogleAdSense のモック
 * 本来: Google AdSense広告表示コンポーネント
 * テスト環境では: nullで何も表示しない
 * WHY: 広告関連テストではバレルエクスポートが正しく全コンポーネントをエクスポートしているか確認するだけで、
 *      個別の広告コンポーネントの動作テストは不要
 */
vi.mock('@/components/ads/GoogleAdSense', () => ({
  GoogleAdSense: () => null,
}))

/**
 * AdBanner のモック（複数エクスポート対応）
 * 本来: 複数の広告バナーバリエーション（AdBanner, InFeedAd, SidebarAd）
 * テスト環境では: 全て null として返す
 * WHY: バレルエクスポート（index.ts）から全て正しくエクスポートされているか確認するテストなので、
 *      実装詳細は不要 → nullで十分
 */
vi.mock('@/components/ads/AdBanner', () => ({
  AdBanner: () => null,
  InFeedAd: () => null,
  SidebarAd: () => null,
}))

/**
 * NinjaAdMax のモック（複数エクスポート対応）
 * 本来: Ninja Ads広告の複数バリエーション（NinjaAd, NinjaInFeedAd, NinjaSidebarAd）
 * テスト環境では: 全て null として返す
 */
vi.mock('@/components/ads/NinjaAdMax', () => ({
  NinjaAd: () => null,
  NinjaInFeedAd: () => null,
  NinjaSidebarAd: () => null,
}))

/**
 * AdProvider のモック（複数エクスポート対応）
 * 本来: 広告プロバイダーと複数の広告ユニット（AdProvider, InFeedAdUnit, SidebarAdUnit, PostDetailAdUnit）
 * テスト環境では: 全て null として返す
 */
vi.mock('@/components/ads/AdProvider', () => ({
  AdProvider: () => null,
  InFeedAdUnit: () => null,
  SidebarAdUnit: () => null,
  PostDetailAdUnit: () => null,
}))

/**
 * コメント関連コンポーネントのモック
 * 広告と同様に、バレルエクスポートのテスト用です
 */

/**
 * CommentForm のモック
 * 本来: コメント入力フォーム
 * テスト環境では: null として返す
 * WHY: バレルエクスポートが正しくエクスポートしているか確認するだけが目的
 */
vi.mock('@/components/comment/CommentForm', () => ({
  CommentForm: () => null,
}))

/**
 * CommentCard のモック
 * 本来: 単一のコメント表示カード
 */
vi.mock('@/components/comment/CommentCard', () => ({
  CommentCard: () => null,
}))

/**
 * CommentList のモック
 * 本来: コメント一覧を表示するコンポーネント
 */
vi.mock('@/components/comment/CommentList', () => ({
  CommentList: () => null,
}))

/**
 * CommentThread のモック
 * 本来: コメントスレッド（返信を含めた会話）を表示
 */
vi.mock('@/components/comment/CommentThread', () => ({
  CommentThread: () => null,
}))

/**
 * CommentLikeButton のモック
 * 本来: コメントにいいねする機能
 */
vi.mock('@/components/comment/CommentLikeButton', () => ({
  CommentLikeButton: () => null,
}))

/**
 * テストスイート全体の説明
 * このファイルは「カバレッジを上げるための補助テスト」です
 * つまり、実装がされているが直接テストされていない機能をテストして、コードカバレッジ%を増やします
 */
describe('Admin Pages Coverage Boost', async () => {
  /**
   * beforeEachは各テストの前に実行される関数
   * vi.clearAllMocks() - 前のテストでのmockの呼び出し記録をリセットする
   * WHY: 各テストが独立した状態で実行されるよう、前のテストの影響を取り除く
   */
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * AdminEventImportPage（イベント管理ページ）のテスト群
   */
  describe('AdminEventImportPage', async () => {
    /**
     * テストケース1: 管理者がアクセスした場合にページが表示されることを確認
     *
     * テスト方法:
     * 1. isAdminをtrueを返すようにモック設定 (管理者権限あり)
     * 2. ページコンポーネント（Server Component）を動的インポート（await import）
     * 3. コンポーネント関数を呼び出す（await AdminEventImportPage()）
     * 4. 返ってきたJSXをrenderで画面に描画する
     * 5. 期待したテキストが存在することを確認
     *
     * Server ComponentはNode.js環境で実行されるため、通常と異なる方法（await import + await呼び出し）が必要
     * WHY: Next.js 13+のApp Routerでは、ページファイル（page.tsx）はデフォルトでServer Component
     *      Server Componentは非同期処理（async/await）を直接書けるため、テストもawait必須
     */
    it('renders page when admin', async () => {
      // isAdminモックを取得して、返り値をtrueに設定
      const { isAdmin } = await import('@/lib/actions/admin')
      isAdmin.mockResolvedValue(true)

      // 動的インポート: import文では実行時のモックが反映されないため、require/await importを使う
      // .defaultで、デフォルトエクスポートのコンポーネント関数を取得
      const AdminEventImportPage = (
        await import('@/app/admin/events/import/page')
      ).default

      // Server Componentのためawaitで呼び出す（通常のComponent呼び出しではない）
      const jsx = await AdminEventImportPage()

      // JSXを画面に描画してDOMテストを可能にする
      render(jsx)

      // ページのタイトルが表示されているか確認
      expect(screen.getByText('外部イベントインポート')).toBeInTheDocument()

      // モックされたEventImportClientコンポーネントが正しく描画されたか確認
      expect(screen.getByTestId('event-import-client')).toBeInTheDocument()
    })

    /**
     * テストケース2: 非管理者がアクセスした場合にリダイレクトされることを確認
     *
     * テスト方法:
     * 1. isAdminをfalseを返すようにモック設定 (管理者権限なし)
     * 2. ページを実行
     * 3. redirect('/feed')が呼ばれたことを確認（redirect関数のmockCallsで追跡）
     *
     * WHY: 権限チェックの確認。管理者のみアクセス可能なページを守る
     */
    it('redirects to /feed when not admin', async () => {
      const { isAdmin } = await import('@/lib/actions/admin')
      const redirect = _mockRedirect as unknown as ReturnType<typeof vi.fn>

      // 非管理者を模擬
      isAdmin.mockResolvedValue(false)

      const AdminEventImportPage = (
        await import('@/app/admin/events/import/page')
      ).default

      // ページを実行（renderせず、redirectが呼ばれるだけ）
      await AdminEventImportPage()

      // redirect関数が'/feed'引数で呼ばれたか確認
      expect(redirect).toHaveBeenCalledWith('/feed')
    })
  })

  /**
   * MaintenancePage（メンテナンス管理ページ）のテスト群
   */
  describe('MaintenancePage', async () => {
    /**
     * テストケース1: メンテナンスが無効（enabled=false）の場合、通常運用表示を確認
     *
     * テスト方法:
     * 1. getMaintenanceSettingsをモック化、enabled=false（運用中）のデータを返す設定
     * 2. MaintenancePageを実行
     * 3. 「通常運用」というテキストが表示されることを確認
     * 4. MaintenanceFormのdata-enabled属性が'false'であることを確認
     *
     * WHY: メンテナンス無効時の表示が正しいか確認。デフォルト状態では通常運用すること
     */
    it('renders with enabled=false (通常運用, green indicator)', async () => {
      const { getMaintenanceSettings } = await import('@/lib/actions/maintenance')

      // メンテナンス無効のデータをモック
      getMaintenanceSettings.mockResolvedValue({
        enabled: false,
        message: 'Test message',
        startTime: null,
        endTime: null,
      })

      const MaintenancePage = (
        await import('@/app/admin/maintenance/page')
      ).default

      const jsx = await MaintenancePage()
      render(jsx)

      // ページタイトルを確認
      expect(screen.getByText('メンテナンスモード')).toBeInTheDocument()

      // 通常運用テキストが表示されている（=メンテナンス無効）
      expect(screen.getByText('通常運用')).toBeInTheDocument()

      // フォームコンポーネント内のdata-enabled属性で有効状態を確認
      const maintenanceForm = screen.getByTestId('maintenance-form')
      expect(maintenanceForm).toHaveAttribute('data-enabled', 'false')
    })

    /**
     * テストケース2: メンテナンスが有効（enabled=true）の場合、メンテナンス中表示と終了時刻を確認
     *
     * テスト方法:
     * 1. getMaintenanceSettingsをモック化、enabled=true（メンテナンス中）のデータを返す設定
     * 2. 終了予定時刻（endTime）を含める
     * 3. MaintenancePageを実行
     * 4. 「メンテナンス中」テキスト表示を確認
     * 5. 終了予定時刻が表示されることを確認（正規表現 /終了予定:/ で部分マッチ）
     * 6. MaintenanceFormのdata-enabled属性が'true'であることを確認
     *
     * WHY: メンテナンス有効時の表示が正しいか、終了時刻が適切に表示されるか確認
     */
    it('renders with enabled=true (メンテナンス中, red indicator, shows endTime)', async () => {
      const { getMaintenanceSettings } = await import('@/lib/actions/maintenance')

      // テスト用の終了時刻を定義
      const endTime = new Date('2026-02-01T12:00:00Z')

      // メンテナンス有効のデータをモック
      getMaintenanceSettings.mockResolvedValue({
        enabled: true,
        message: 'Maintenance in progress',
        startTime: new Date('2026-01-31T12:00:00Z'),
        endTime,
      })

      const MaintenancePage = (
        await import('@/app/admin/maintenance/page')
      ).default

      const jsx = await MaintenancePage()
      render(jsx)

      // ページタイトルを確認
      expect(screen.getByText('メンテナンスモード')).toBeInTheDocument()

      // メンテナンス中テキストが表示されている
      expect(screen.getByText('メンテナンス中')).toBeInTheDocument()

      // 終了予定時刻を示すテキスト「終了予定:」が表示されている
      // /正規表現/ で部分一致検索 → 完全なテキストでなくても、含まれていればOK
      expect(screen.getByText(/終了予定:/)).toBeInTheDocument()

      // フォームコンポーネント内のdata-enabled属性で有効状態を確認
      const maintenanceForm = screen.getByTestId('maintenance-form')
      expect(maintenanceForm).toHaveAttribute('data-enabled', 'true')
    })
  })

  /**
   * AdminUsagePage（サービス使用量ページ）のテスト群
   */
  describe('AdminUsagePage', async () => {
    /**
     * テストケース: ページタイトルとUsageCardsコンポーネントが表示されることを確認
     *
     * テスト方法:
     * 1. AdminUsagePageを動的インポート
     * 2. ページを実行
     * 3. ページタイトル「サービス使用量」が表示されているか確認
     * 4. UsageCardsコンポーネントがdata-testid="usage-cards"で表示されているか確認
     *
     * WHY: ページレイアウトが正しく表示されるか基本確認
     */
    it('renders heading and UsageCards', async () => {
      // 動的インポートでデフォルトエクスポートを取得
      const AdminUsagePage = (await import('@/app/admin/usage/page')).default

      const jsx = await AdminUsagePage()
      render(jsx)

      // ページタイトルが表示されている
      expect(screen.getByText('サービス使用量')).toBeInTheDocument()

      // UsageCardsコンポーネントが表示されている
      // data-testidはモックで付与したマーカーで、実際のコンポーネント描画を確認
      expect(screen.getByTestId('usage-cards')).toBeInTheDocument()
    })
  })

  /**
   * バレルエクスポート（Barrel Export）のテスト
   *
   * バレルエクスポートとは:
   * - 複数の小さなコンポーネントファイルを、1つのindex.tsでまとめてエクスポートする技法
   * - 使う側は @/components/ads 1行で、その中の全コンポーネントをインポートできる
   * - 例: import { AdBanner, InFeedAd } from '@/components/ads'
   *
   * このテストの目的:
   * - index.ts側で全コンポーネントが正しく再エクスポートされているか確認
   * - コンポーネントを削除した時、index.tsでの削除漏れを検出
   *
   * WHY: バレルエクスポート自体はバグりやすい（再エクスポート漏れ）ため、テストして検証
   */
  describe('ads barrel exports', async () => {
    /**
     * テストケース: ads/index.tsから全広告コンポーネントがエクスポートされているか確認
     *
     * テスト方法:
     * 1. @/components/ads/index をインポート
     * 2. 各コンポーネント（GoogleAdSense, AdBanner, InFeedAd等）が定義されているか（toBeDefined）で確認
     *
     * toBeInTheDocument() = undefined でない = エクスポートされている という意味
     * toBeInTheDocument() と toEqual(undefined) は反対の意味
     *
     * WHY: index.tsで誤って「import」だけして「export」を忘れていないか検証
     */
    it('exports all components', async () => {
      // @/components/ads/index を動的インポート
      const adsIndex = await import('@/components/ads/index')

      // 各コンポーネントが存在することを確認（存在しなければ undefined となり、テスト失敗）
      expect(adsIndex.GoogleAdSense).toBeDefined()
      expect(adsIndex.AdBanner).toBeDefined()
      expect(adsIndex.InFeedAd).toBeDefined()
      expect(adsIndex.SidebarAd).toBeDefined()
      expect(adsIndex.NinjaAd).toBeDefined()
      expect(adsIndex.NinjaInFeedAd).toBeDefined()
      expect(adsIndex.NinjaSidebarAd).toBeDefined()
      expect(adsIndex.AdProvider).toBeDefined()
      expect(adsIndex.InFeedAdUnit).toBeDefined()
      expect(adsIndex.SidebarAdUnit).toBeDefined()
      expect(adsIndex.PostDetailAdUnit).toBeDefined()
    })
  })

  /**
   * コメント関連コンポーネントのバレルエクスポートテスト
   */
  describe('comment barrel exports', async () => {
    /**
     * テストケース: comment/index.tsから全コメントコンポーネントがエクスポートされているか確認
     *
     * テスト方法: 広告関連のテストと同じ
     * 1. @/components/comment/index をインポート
     * 2. 各コンポーネントがエクスポートされているか toBeInTheDocument() で確認
     *
     * WHY: コンポーネント削除時の漏れ防止、バレルエクスポート設定の検証
     */
    it('exports all components', async () => {
      // @/components/comment/index を動的インポート
      const commentIndex = await import('@/components/comment/index')

      // 各コンポーネントが存在することを確認
      expect(commentIndex.CommentForm).toBeDefined()
      expect(commentIndex.CommentCard).toBeDefined()
      expect(commentIndex.CommentList).toBeDefined()
      expect(commentIndex.CommentThread).toBeDefined()
      expect(commentIndex.CommentLikeButton).toBeDefined()
    })
  })
})
