// @vitest-environment node

import { vi, type Mocked } from 'vitest'
// ============================================================================
// Prismaモックの設定（ホイスティング対策版）
// ============================================================================
/**
 * モックをvi.mock()内で直接定義
 *
 * これにより、ホイスティング（巻き上げ）の問題を回避できます。
 * vi.mock()はテストファイルの実行前に処理されるため、
 * 外部で定義した変数を参照することができません。
 */
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),  // ユーザー検索
      update: vi.fn(),      // ユーザー更新
      updateMany: vi.fn(),  // 複数ユーザー一括更新
    },
  },
}))

/**
 * モックへの参照を取得
 *
 * vi.mock()で置き換えられたモジュールをインポートし、
 * TypeScriptの型情報を付与します。
 *
 * Mocked<typeof prisma>:
 * - prismaの型を保持しつつ、すべてのメソッドがReturnType<typeof vi.fn>になっている型
 * - これにより、mockResolvedValue()などのモック関数が使える
 */
import { prisma } from '@/lib/db'
const mockPrisma = prisma as Mocked<typeof prisma>

/**
 * テスト対象の関数と定数をインポート
 */
import {
  isPremiumUser,       // プレミアム会員判定
  getMembershipLimits, // 会員制限値取得
  getMembershipType,   // 会員種別取得
  getPremiumStatus,    // プレミアム状態詳細取得
  checkPremiumExpiry,  // 期限切れチェック
  FREE_LIMITS,         // 無料会員の制限値
  PREMIUM_LIMITS,      // プレミアム会員の制限値
} from '@/lib/premium'

// ============================================================================
// テストスイート
// ============================================================================
describe('Premium Module', () => {
  /**
   * 各テスト前にモックをクリア
   *
   * モックの呼び出し履歴をリセットして、
   * テスト間の干渉を防ぎます。
   */
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // FREE_LIMITS（無料会員の制限値）
  // ============================================================
  /**
   * FREE_LIMITSのテスト
   *
   * 無料会員に適用される制限値が正しく定義されているかを確認します。
   *
   * 制限値の意味：
   * - maxPostLength: 1投稿の最大文字数
   * - maxImages: 1投稿に添付できる最大画像数
   * - maxVideos: 1投稿に添付できる最大動画数
   * - maxDailyPosts: 1日に投稿できる最大数
   * - canSchedulePost: 予約投稿機能が使えるか
   * - canViewAnalytics: 詳細な分析機能が使えるか
   */
  describe('FREE_LIMITS', () => {
    /**
     * テストケース: 無料会員の制限値が正しい
     *
     * 定数の値が仕様通りであることを確認します。
     * 仕様変更時にテストが失敗することで、
     * 意図しない変更を検知できます。
     */
    it('無料会員の制限値が正しく設定されている', () => {
      // toEqual(): オブジェクトの内容が完全に一致することを確認
      expect(FREE_LIMITS).toEqual({
        maxPostLength: 500,        // 500文字まで
        maxImages: 4,              // 画像4枚まで
        maxVideos: 1,              // 動画1本まで
        maxDailyPosts: 20,         // 1日20投稿まで
        canSchedulePost: false,    // 予約投稿は使えない
        canViewAnalytics: false,   // 詳細分析は使えない
      })
    })
  })

  // ============================================================
  // PREMIUM_LIMITS（プレミアム会員の制限値）
  // ============================================================
  /**
   * PREMIUM_LIMITSのテスト
   *
   * プレミアム会員（有料会員）に適用される制限値が
   * 正しく定義されているかを確認します。
   *
   * プレミアム会員の特典：
   * - より長い投稿が可能
   * - より多くのメディアを添付可能
   * - より多くの投稿が可能
   * - 予約投稿機能が使える
   * - 詳細な分析機能が使える
   */
  describe('PREMIUM_LIMITS', () => {
    /**
     * テストケース: プレミアム会員の制限値が正しい
     */
    it('プレミアム会員の制限値が正しく設定されている', () => {
      expect(PREMIUM_LIMITS).toEqual({
        maxPostLength: 2000,       // 2000文字まで（無料の4倍）
        maxImages: 6,              // 画像6枚まで
        maxVideos: 3,              // 動画3本まで
        maxDailyPosts: 40,         // 1日40投稿まで（無料の2倍）
        canSchedulePost: true,     // 予約投稿が使える
        canViewAnalytics: true,    // 詳細分析が使える
      })
    })
  })

  // ============================================================
  // isPremiumUser（プレミアム会員判定）
  // ============================================================
  /**
   * isPremiumUser関数のテスト
   *
   * この関数は、指定されたユーザーIDのユーザーが
   * プレミアム会員かどうかを判定します。
   *
   * 判定ロジック：
   * 1. ユーザーが存在するか
   * 2. isPremiumフラグがtrueか
   * 3. 有効期限が設定されている場合、期限内か
   *
   * 副作用：
   * - 期限切れの場合、isPremiumフラグをfalseに更新
   */
  describe('isPremiumUser', () => {
    /**
     * テストケース1: ユーザーが存在しない場合
     *
     * 無効なユーザーIDが渡された場合の動作を確認。
     * セキュリティ上、存在しないユーザーはプレミアムではない。
     */
    it('ユーザーが存在しない場合はfalseを返す', async () => {
      // ユーザーが見つからない
      // セミコロン(;)を先頭に置くのは、JavaScriptの自動セミコロン挿入問題を回避するため
      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await isPremiumUser('non-existent-user')

      // プレミアムではない
      expect(result).toBe(false)

      // 正しいクエリが実行されたことを確認
      // select: 必要なフィールドのみ取得（パフォーマンス最適化）
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-user' },
        select: { isPremium: true, premiumExpiresAt: true },
      })
    })

    /**
     * テストケース2: isPremiumがfalseの場合
     *
     * 無料会員（プレミアム未購入）の場合の動作を確認。
     */
    it('isPremiumがfalseの場合はfalseを返す', async () => {
      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        isPremium: false,      // プレミアムではない
        premiumExpiresAt: null, // 有効期限なし
      })

      const result = await isPremiumUser('user-1')

      expect(result).toBe(false)
    })

    /**
     * テストケース3: isPremiumがtrueで期限が設定されていない場合
     *
     * 永久プレミアム会員（有効期限なし）の場合の動作を確認。
     * 例：運営からの特典付与、無期限プランなど
     */
    it('isPremiumがtrueで期限が設定されていない場合はtrueを返す', async () => {
      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        isPremium: true,
        premiumExpiresAt: null, // 期限なし = 永久プレミアム
      })

      const result = await isPremiumUser('user-1')

      expect(result).toBe(true)
    })

    /**
     * テストケース4: isPremiumがtrueで期限内の場合
     *
     * 有効なサブスクリプション会員の場合の動作を確認。
     */
    it('isPremiumがtrueで期限内の場合はtrueを返す', async () => {
      // 30日後の日付を設定
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        isPremium: true,
        premiumExpiresAt: futureDate, // まだ期限内
      })

      const result = await isPremiumUser('user-1')

      expect(result).toBe(true)
    })

    /**
     * テストケース5: 期限切れの場合
     *
     * サブスクリプションが期限切れになった場合の動作を確認。
     *
     * 重要な副作用：
     * - isPremiumフラグをfalseに自動更新
     * - これにより、次回からDBを見ずに判定可能（パフォーマンス向上）
     */
    it('期限切れの場合はfalseを返し、フラグを更新する', async () => {
      // 1日前（期限切れ）の日付を設定
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)

      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        isPremium: true,           // まだtrueになっている
        premiumExpiresAt: pastDate, // 期限切れ
      })
      ;(mockPrisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({})

      const result = await isPremiumUser('user-1')

      // プレミアムではない
      expect(result).toBe(false)

      // isPremiumフラグがfalseに更新されたことを確認
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isPremium: false },
      })
    })
  })

  // ============================================================
  // getMembershipLimits（会員制限値の取得）
  // ============================================================
  /**
   * getMembershipLimits関数のテスト
   *
   * この関数は、ユーザーの会員種別に応じた制限値を返します。
   *
   * 使用場面：
   * - 投稿作成時の文字数制限チェック
   * - 画像/動画アップロード時の枚数制限チェック
   * - 予約投稿機能の利用可否判定
   */
  describe('getMembershipLimits', () => {
    /**
     * テストケース1: プレミアム会員の制限値
     *
     * 有効なプレミアム会員には、PREMIUM_LIMITSが適用される。
     */
    it('プレミアム会員の場合はPREMIUM_LIMITSを返す', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        isPremium: true,
        premiumExpiresAt: futureDate,
      })

      const result = await getMembershipLimits('user-1')

      // PREMIUM_LIMITSと完全に一致することを確認
      expect(result).toEqual(PREMIUM_LIMITS)
    })

    /**
     * テストケース2: 無料会員の制限値
     *
     * 無料会員には、FREE_LIMITSが適用される。
     */
    it('無料会員の場合はFREE_LIMITSを返す', async () => {
      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        isPremium: false,
        premiumExpiresAt: null,
      })

      const result = await getMembershipLimits('user-1')

      expect(result).toEqual(FREE_LIMITS)
    })

    /**
     * テストケース3: 存在しないユーザーの制限値
     *
     * 安全側に倒して、FREE_LIMITSを返す。
     * 不正なリクエストでプレミアム機能を使われないようにする。
     */
    it('ユーザーが存在しない場合はFREE_LIMITSを返す', async () => {
      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await getMembershipLimits('non-existent-user')

      expect(result).toEqual(FREE_LIMITS)
    })
  })

  // ============================================================
  // getMembershipType（会員種別の取得）
  // ============================================================
  /**
   * getMembershipType関数のテスト
   *
   * この関数は、ユーザーの会員種別を文字列で返します。
   *
   * 戻り値：
   * - 'premium': プレミアム会員
   * - 'free': 無料会員
   *
   * 使用場面：
   * - UIでの会員バッジ表示
   * - 機能の有効/無効判定
   */
  describe('getMembershipType', () => {
    /**
     * テストケース1: プレミアム会員
     */
    it('プレミアム会員の場合は"premium"を返す', async () => {
      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        isPremium: true,
        premiumExpiresAt: null,
      })

      const result = await getMembershipType('user-1')

      // toBe(): プリミティブ値（文字列、数値など）の比較
      expect(result).toBe('premium')
    })

    /**
     * テストケース2: 無料会員
     */
    it('無料会員の場合は"free"を返す', async () => {
      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        isPremium: false,
        premiumExpiresAt: null,
      })

      const result = await getMembershipType('user-1')

      expect(result).toBe('free')
    })

    /**
     * テストケース3: 存在しないユーザー
     *
     * デフォルトで'free'を返す（安全側に倒す）。
     */
    it('ユーザーが存在しない場合は"free"を返す', async () => {
      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await getMembershipType('non-existent-user')

      expect(result).toBe('free')
    })
  })

  // ============================================================
  // getPremiumStatus（プレミアム状態の詳細取得）
  // ============================================================
  /**
   * getPremiumStatus関数のテスト
   *
   * この関数は、プレミアム会員の詳細情報を返します。
   * 設定画面やマイページで会員情報を表示する際に使用。
   *
   * 戻り値の内容：
   * - isPremium: プレミアム会員かどうか
   * - premiumExpiresAt: 有効期限（nullなら無期限）
   * - hasStripeSubscription: Stripeでのサブスクリプションがあるか
   *
   * Stripeとは：
   * オンライン決済サービス。サブスクリプション（定期課金）の
   * 管理に使用されています。
   */
  describe('getPremiumStatus', () => {
    /**
     * テストケース1: 存在しないユーザー
     *
     * nullを返す（エラーではなく、データなしを示す）。
     */
    it('ユーザーが存在しない場合はnullを返す', async () => {
      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await getPremiumStatus('non-existent-user')

      // toBeNull(): nullであることを確認
      expect(result).toBeNull()
    })

    /**
     * テストケース2: 完全なプレミアム会員情報
     *
     * Stripeサブスクリプションありのプレミアム会員。
     */
    it('プレミアム会員の詳細情報を返す', async () => {
      const expiresAt = new Date('2025-12-31')

      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        isPremium: true,
        premiumExpiresAt: expiresAt,
        stripeCustomerId: 'cus_123',    // Stripe顧客ID
        stripeSubscriptionId: 'sub_123', // Stripeサブスクリプション（定期課金）ID
      })

      const result = await getPremiumStatus('user-1')

      expect(result).toEqual({
        isPremium: true,
        premiumExpiresAt: expiresAt,
        hasStripeSubscription: true,  // サブスクリプションがある
      })
    })

    /**
     * テストケース3: Stripeサブスクリプションなしのプレミアム会員
     *
     * シナリオ：
     * - 管理者から手動でプレミアム権限を付与された
     * - サブスクリプションがキャンセルされたが、期間は残っている
     */
    it('Stripeサブスクリプションがない場合はhasStripeSubscriptionがfalse', async () => {
      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        isPremium: true,
        premiumExpiresAt: null,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: null,  // サブスクリプションなし
      })

      const result = await getPremiumStatus('user-1')

      expect(result).toEqual({
        isPremium: true,
        premiumExpiresAt: null,
        hasStripeSubscription: false, // サブスクリプションがない
      })
    })

    /**
     * テストケース4: 無料会員の情報
     */
    it('無料会員の情報を返す', async () => {
      ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        isPremium: false,
        premiumExpiresAt: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      })

      const result = await getPremiumStatus('user-1')

      expect(result).toEqual({
        isPremium: false,
        premiumExpiresAt: null,
        hasStripeSubscription: false,
      })
    })
  })

  // ============================================================
  // checkPremiumExpiry（期限切れ会員の一括処理）
  // ============================================================
  /**
   * checkPremiumExpiry関数のテスト
   *
   * この関数は、期限切れのプレミアム会員を一括で無効化します。
   *
   * 使用タイミング：
   * - 定期的なバッチ処理（cronジョブなど）
   * - 毎日深夜に実行して、期限切れをチェック
   *
   * なぜ一括処理が必要か：
   * - isPremiumUserは個別チェック時に更新するが、
   *   アクセスしていないユーザーの状態は更新されない
   * - 定期バッチで全員をチェックすることで、
   *   データの整合性を保つ
   */
  describe('checkPremiumExpiry', () => {
    /**
     * テストケース1: 期限切れユーザーがいる場合
     *
     * 複数の期限切れユーザーを一括で無効化。
     */
    it('期限切れのプレミアム会員を一括で無効化する', async () => {
      // 5人のユーザーが更新された
      ;(mockPrisma.user.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 5 })

      const result = await checkPremiumExpiry()

      // 更新されたユーザー数を返す
      expect(result).toBe(5)

      // 正しいクエリが実行されたことを確認
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          isPremium: true,           // プレミアム会員のみ
          premiumExpiresAt: {
            lt: expect.any(Date),    // 有効期限が現在日時より前
          },
        },
        data: {
          isPremium: false,          // プレミアムを無効化
        },
      })
    })

    /**
     * テストケース2: 期限切れユーザーがいない場合
     *
     * 全員期限内、または無料会員のみの場合。
     */
    it('期限切れのユーザーがいない場合は0を返す', async () => {
      ;(mockPrisma.user.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })

      const result = await checkPremiumExpiry()

      expect(result).toBe(0)
    })
  })
})

// ============================================================================
// テストの実行方法
// ============================================================================
/**
 * このテストファイルを実行するには：
 *
 * 1. 単一ファイルのテスト
 *    npm test -- __tests__/lib/premium.test.ts
 *
 * 2. ウォッチモード（ファイル変更時に自動再実行）
 *    npm test -- --watch __tests__/lib/premium.test.ts
 *
 * 3. カバレッジ付き
 *    npm test -- --coverage __tests__/lib/premium.test.ts
 *
 * 4. 特定のテストだけ実行
 *    npm test -- -t "isPremiumUser"
 */
