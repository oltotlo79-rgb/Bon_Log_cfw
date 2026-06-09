// @vitest-environment node

import { vi } from 'vitest'
// テストユーティリティからモックデータとヘルパー関数をインポート
// createMockPrismaClient: Prismaクライアントのモック（DB操作を模擬）
// mockUser: テスト用のダミーユーザーデータ
// mockPasswordResetToken: テスト用のパスワードリセットトークン
import { createMockPrismaClient, mockUser, mockPasswordResetToken } from '../../utils/test-utils'

// ============================================================================
// モックのセットアップ
// ============================================================================
// モック（Mock）とは：
// 実際の依存関係（データベース、外部API等）の代わりに使う偽物のオブジェクト。
// テストを高速化し、外部要因に依存しない再現可能なテストを実現します。

/**
 * Prismaクライアントのモック
 * ----------------------------------------------------------------------------
 * データベース操作を模擬するためのモックオブジェクトを作成。
 * 実際のデータベースに接続せずにテストできるようになります。
 *
 * createMockPrismaClient()は以下のようなメソッドを持つオブジェクトを返します：
 * - prisma.user.findUnique() - ユーザーの検索
 * - prisma.user.create() - ユーザーの作成
 * - prisma.passwordResetToken.create() - トークンの作成
 * など
 */
const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

/**
 * bcryptjsのモック
 * ----------------------------------------------------------------------------
 * bcryptjsはパスワードのハッシュ化に使うライブラリです。
 *
 * パスワードハッシュとは：
 * パスワードを不可逆な文字列に変換すること。
 * データベースに平文パスワードを保存するのは危険なので、
 * ハッシュ化して保存します。
 *
 * - hash: パスワード → ハッシュ値（例: "password" → "hashed-password"）
 * - compare: パスワードとハッシュ値を比較（ログイン時に使用）
 */
const mockBcrypt = {
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn().mockResolvedValue(true),
}
vi.mock('bcryptjs', () => ({ default: mockBcrypt, ...mockBcrypt }))

/**
 * Node.js cryptoモジュールのモック
 * ----------------------------------------------------------------------------
 * 暗号化関連の機能を提供するNode.js標準モジュール。
 *
 * - randomBytes: ランダムなバイト列を生成（トークン生成用）
 * - createHash: ハッシュ関数を作成（SHA256など）
 *
 * パスワードリセットの流れ：
 * 1. randomBytesでランダムなトークンを生成
 * 2. トークンをユーザーにメールで送信
 * 3. トークンをハッシュ化してDBに保存（セキュリティのため）
 * 4. ユーザーがトークンを使ってパスワードリセット
 */
const mockCrypto = {
  randomBytes: vi.fn().mockReturnValue({
    toString: vi.fn().mockReturnValue('random-token-123'),
  }),
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnValue({
      digest: vi.fn().mockReturnValue('hashed-token-123'),
    }),
  }),
}
vi.mock('crypto', () => ({ default: mockCrypto, ...mockCrypto }))

/**
 * Next.js headersのモック
 * ----------------------------------------------------------------------------
 * HTTPリクエストのヘッダー情報を取得するNext.jsの関数。
 * IPアドレスの取得などに使用されます（レート制限、セキュリティログ用）。
 */
const mockHeaders = {
  get: vi.fn().mockReturnValue('127.0.0.1'), // ローカルホストIPを返す
}
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(mockHeaders),
}))

/**
 * メール送信機能のモック
 * ----------------------------------------------------------------------------
 * パスワードリセットメールを送信する関数のモック。
 * 実際にはメールを送信せず、成功/失敗をシミュレートします。
 */
const mockSendPasswordResetEmail = vi.fn().mockResolvedValue({ success: true })
const mockSendVerificationEmail = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
  sendVerificationEmail: mockSendVerificationEmail,
}))

/**
 * ロガーのモック
 * ----------------------------------------------------------------------------
 * アプリケーションのログ出力機能のモック。
 * テスト中にコンソールが汚れるのを防ぎます。
 *
 * __esModule: true について：
 * ESモジュールとしてインポートされることを示すフラグ。
 * default exportを持つモジュールをモックする際に必要。
 */
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

/**
 * ログイントラッカーのモック
 * ----------------------------------------------------------------------------
 * ブルートフォース攻撃（総当たり攻撃）を防ぐための機能。
 *
 * ブルートフォース攻撃とは：
 * パスワードを片っ端から試して不正ログインを試みる攻撃。
 * 対策として、一定回数以上失敗するとアカウントをロックします。
 *
 * - checkLoginAttempt: ログイン試行が許可されているかチェック
 * - recordFailedLogin: ログイン失敗を記録
 * - resetLoginAttempts: 成功時に試行回数をリセット
 * - getLoginKey: キャッシュキーの生成（IPアドレス + メールアドレス）
 */
const mockLoginTracker = {
  checkLoginAttempt: vi.fn().mockResolvedValue({
    allowed: true,        // ログイン試行が許可されている
    message: '',          // エラーメッセージなし
    remainingAttempts: 5, // 残り試行回数
  }),
  recordFailedLogin: vi.fn().mockResolvedValue({
    allowed: true,
    message: '',
    remainingAttempts: 4, // 失敗したので残り4回
  }),
  resetLoginAttempts: vi.fn().mockResolvedValue(undefined),
  getLoginKey: vi.fn().mockReturnValue('login-key'),
}
vi.mock('@/lib/login-tracker', () => mockLoginTracker)

/**
 * 入力サニタイズのモック
 * ----------------------------------------------------------------------------
 * ユーザー入力から危険な文字を除去する機能。
 * XSS（クロスサイトスクリプティング）攻撃を防ぐために重要。
 *
 * 例：<script>alert('hack')</script> → &lt;script&gt;alert('hack')&lt;/script&gt;
 *
 * このモックでは単純に入力をそのまま返します（テスト用）。
 */
vi.mock('@/lib/sanitize', () => ({
  sanitizeInput: vi.fn((input: string) => input),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {},
}))

vi.mock('@/lib/services/blacklist-check', () => ({
  isEmailBlacklisted: vi.fn().mockResolvedValue(false),
  isDeviceBlacklisted: vi.fn().mockResolvedValue(false),
}))

/**
 * セキュリティロガーのモック
 * ----------------------------------------------------------------------------
 * セキュリティ関連のイベントを記録する機能。
 * 不正アクセスの検知や監査のために使用されます。
 *
 * - logLoginFailure: ログイン失敗を記録
 * - logLoginLockout: アカウントロックを記録
 * - logRegisterSuccess: 新規登録成功を記録
 * - logPasswordResetRequest: パスワードリセット要求を記録
 * - logPasswordResetSuccess: パスワードリセット成功を記録
 */
vi.mock('@/lib/security-logger', () => ({
  logLoginFailure: vi.fn(),
  logLoginLockout: vi.fn(),
  logRegisterSuccess: vi.fn(),
  logPasswordResetRequest: vi.fn(),
  logPasswordResetSuccess: vi.fn(),
}))

// ============================================================================
// テストスイートのメイン部分
// ============================================================================
/**
 * describe()について：
 * テストをグループ化するための関数。
 * 関連するテストをまとめることで、テスト結果が読みやすくなります。
 *
 * 構造：
 * describe('機能名', () => {
 *   describe('サブ機能1', () => {
 *     it('テストケース1', () => { ... })
 *     it('テストケース2', () => { ... })
 *   })
 * })
 */
describe('Auth Actions', async () => {
  /**
   * beforeEach()について：
   * 各テスト（it()）が実行される前に呼ばれる関数。
   * テスト間の独立性を保つために、モックの状態をリセットします。
   *
   * なぜリセットが必要か：
   * 前のテストでモックが特定の値を返すように設定されていると、
   * 次のテストに影響を与える可能性があるため。
   */
  beforeEach(() => {
    // vi.clearAllMocks(): すべてのモック関数の呼び出し履歴をクリア
    // 注意: mockResolvedValue等の設定はクリアされません
    vi.clearAllMocks()
  })

  // checkLoginAllowed / recordLoginFailure / clearLoginAttempts は server-only サービス
  // `lib/services/login-throttle` へ移設した（公開 RPC 露出の排除）。
  // ロジック検証は `__tests__/lib/services/login-throttle.test.ts` 側で行う。

  // ============================================================
  // registerUser（新規ユーザー登録）
  // ============================================================
  /**
   * registerUser関数のテスト
   *
   * この関数は、新しいユーザーをデータベースに登録します。
   *
   * 処理の流れ：
   * 1. メールアドレスが既に使われていないかチェック
   * 2. パスワードをハッシュ化（bcrypt.hash）
   * 3. ユーザーをデータベースに保存
   *
   * セキュリティ考慮事項：
   * - パスワードは平文で保存せず、必ずハッシュ化する
   * - 入力値のバリデーション（形式チェック）を行う
   */
  describe('registerUser', async () => {
    /**
     * テストケース1: 正常系 - 新規ユーザーを登録
     *
     * シナリオ：
     * - メールアドレスが未使用
     * - パスワードが要件を満たしている
     *
     * 期待結果：
     * - success: true
     * - userId: 作成されたユーザーのID
     * - パスワードがハッシュ化されてDBに保存される
     */
    it('新規ユーザーを登録できる', async () => {
      // 既存ユーザーが存在しない（メールアドレスが未使用）
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)
      // ユーザー作成が成功する
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'new-user-id',
        email: 'newuser@example.com',
        nickname: '新規ユーザー',
      })
      // メール確認トークン作成（登録後に確認メール送信のため）
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.emailVerificationToken.create.mockResolvedValueOnce({
        id: 'ev-id',
        email: 'newuser@example.com',
        token: 'hashed-token-123',
        expires: new Date(),
        created_at: new Date(),
      })

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'newuser@example.com',
        password: 'Password123',
        nickname: '新規ユーザー',
      })

      // 成功を確認（ActionResult形式）
      expect(result.success).toBe(true)
      expect(result).toMatchObject({ success: true, data: { userId: 'new-user-id' } })

      // DBへの保存内容を確認
      // toHaveBeenCalledWith(): モック関数が特定の引数で呼ばれたことを確認
      // 注意: パスワードは'hashed-password'になっている（bcrypt.hashのモック値）
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@example.com',
          password: 'hashed-password', // ハッシュ化されている
          nickname: '新規ユーザー',
        },
      })
      expect(mockSendVerificationEmail).toHaveBeenCalled()
    })

    /**
     * テストケース2: 異常系 - メールアドレスが既に使用されている
     *
     * シナリオ：
     * - 同じメールアドレスのユーザーが既に存在する
     *
     * 期待結果：
     * - error: エラーメッセージ
     * - ユーザーは作成されない（user.createが呼ばれない）
     */
    it('既存のメールアドレスの場合、エラーを返す', async () => {
      // 既存ユーザーが存在する
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'test@example.com',
        password: 'Password123',
        nickname: 'テストユーザー',
      })

      // エラーが返されることを確認（ActionResult形式）
      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('このメールアドレスは既に登録されています')

      // user.createが呼ばれていないことを確認
      // not.toHaveBeenCalled(): モック関数が呼ばれていないことを確認
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('予約済みニックネーム（E2E用等）の場合はエラーを返す', async () => {
      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'someone@example.com',
        password: 'Password123',
        nickname: 'E2Eテストユーザー',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('このユーザー名は利用できません。別のユーザー名をご利用ください。')
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('ニックネームに改行や<>が含まれる場合はエラーを返す', async () => {
      const { registerUser } = await import('@/lib/actions/auth')
      const resultNewline = await registerUser({
        email: 'a@example.com',
        password: 'Password123',
        nickname: '改行\n入り',
      })
      expect(resultNewline).toMatchObject({
        error: 'ニックネームに改行や < > は使えません',
      })
      expect(mockPrisma.user.create).not.toHaveBeenCalled()

      const resultLt = await registerUser({
        email: 'b@example.com',
        password: 'Password123',
        nickname: 'script<script>',
      })
      expect(resultLt).toMatchObject({
        error: 'ニックネームに改行や < > は使えません',
      })
    })

    it('無効なメール形式の場合はエラーを返す', async () => {
      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'not-an-email',
        password: 'Password123',
        nickname: 'ユーザー',
      })
      expect(result).toMatchObject({ error: '有効なメールアドレスを入力してください' })
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('ニックネームが空の場合はエラーを返す', async () => {
      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'a@example.com',
        password: 'Password123',
        nickname: '',
      })
      expect(result).toMatchObject({ error: 'ニックネームを入力してください' })
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('ニックネームが50文字を超える場合はエラーを返す', async () => {
      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'a@example.com',
        password: 'Password123',
        nickname: 'あ'.repeat(51),
      })
      expect(result).toMatchObject({ error: 'ニックネームは50文字以内で入力してください' })
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('メールアドレスが100文字を超える場合はエラーを返す', async () => {
      const { registerUser } = await import('@/lib/actions/auth')
      const longLocal = 'a'.repeat(90)
      const result = await registerUser({
        email: `${longLocal}@example.com`,
        password: 'Password123',
        nickname: 'ユーザー',
      })
      expect(result).toMatchObject({ error: 'メールアドレスは100文字以内で入力してください' })
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // requestPasswordReset（パスワードリセット要求）
  // ============================================================
  /**
   * requestPasswordReset関数のテスト
   *
   * この関数は、パスワードリセットのメールを送信します。
   *
   * 処理の流れ：
   * 1. ユーザーが存在するかチェック
   * 2. 古いリセットトークンを削除
   * 3. 新しいトークンを生成してDBに保存
   * 4. トークン付きのリセットURLをメールで送信
   *
   * セキュリティ考慮事項：
   * - ユーザーが存在しなくても「成功」を返す（ユーザー列挙攻撃の防止）
   * - トークンには有効期限を設定
   * - 新規リクエスト時に古いトークンを無効化
   */
  describe('requestPasswordReset', async () => {
    /**
     * テストケース1: 正常系 - パスワードリセットメールを送信
     *
     * シナリオ：
     * - ユーザーが存在する
     * - メール送信が成功する
     *
     * 期待結果：
     * - success: true
     * - 古いトークンが削除される
     * - 新しいトークンが作成される
     * - メールが送信される
     */
    it('パスワードリセットメールを送信する', async () => {
      // ユーザーが存在する
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)
      // 古いトークンの削除が成功
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      // 新しいトークンの作成が成功
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce(mockPasswordResetToken)
      // メール送信が成功
      mockSendPasswordResetEmail.mockResolvedValueOnce({ success: true })

      const { requestPasswordReset } = await import('@/lib/actions/auth')
      const result = await requestPasswordReset('test@example.com')

      // 成功を確認
      expect(result).toEqual({ success: true })

      // 古いトークンが削除されたことを確認
      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })

      // 新しいトークンが作成されたことを確認
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled()

      // メールが送信されたことを確認
      expect(mockSendPasswordResetEmail).toHaveBeenCalled()
    })

    /**
     * テストケース2: ユーザーが存在しない場合でも成功を返す
     *
     * シナリオ：
     * - 入力されたメールアドレスのユーザーが存在しない
     *
     * 期待結果：
     * - success: true（攻撃者にユーザーの存在を知らせない）
     * - トークンは作成されない
     *
     * なぜ成功を返すのか？（重要なセキュリティ対策）
     * もしエラーを返すと、攻撃者は「このメールアドレスは登録されていない」
     * という情報を得られます。これを「ユーザー列挙攻撃」と呼びます。
     * 成功を返すことで、ユーザーの存在有無を隠蔽します。
     */
    it('ユーザーが存在しなくても成功を返す（セキュリティ対策）', async () => {
      // ユーザーが存在しない
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { requestPasswordReset } = await import('@/lib/actions/auth')
      const result = await requestPasswordReset('nonexistent@example.com')

      // 成功を返す（エラーではない）
      expect(result).toEqual({ success: true })

      // トークンは作成されていない（実際の処理は行われない）
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled()
    })

    /**
     * テストケース3: メール送信が失敗した場合
     *
     * シナリオ：
     * - ユーザーは存在する
     * - トークン作成は成功
     * - メール送信でエラーが発生（SMTPエラーなど）
     *
     * 期待結果：
     * - error: エラーメッセージ
     */
    it('メール送信失敗時、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce(mockPasswordResetToken)
      // メール送信が失敗
      mockSendPasswordResetEmail.mockResolvedValueOnce({ success: false, error: 'SMTP error' })

      const { requestPasswordReset } = await import('@/lib/actions/auth')
      const result = await requestPasswordReset('test@example.com')

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('メールの送信に失敗しました。しばらく経ってからお試しください。')
    })
  })

  // ============================================================
  // resetPassword（パスワードリセット実行）
  // ============================================================
  /**
   * resetPassword関数のテスト
   *
   * この関数は、リセットトークンを使って新しいパスワードを設定します。
   *
   * 処理の流れ：
   * 1. パスワードのバリデーション（8文字以上、英数字混合）
   * 2. トークンの有効性をチェック
   * 3. ユーザーが存在するかチェック
   * 4. 新しいパスワードをハッシュ化してDBに保存
   * 5. 使用済みトークンを削除
   *
   * パスワード要件（一般的なベストプラクティス）：
   * - 最低8文字以上
   * - アルファベットと数字を両方含む
   * - （このシステムでは実装されていないが）記号も含むとより安全
   */
  describe('resetPassword', async () => {
    /**
     * テストケース1: 正常系 - パスワードのリセットに成功
     *
     * シナリオ：
     * - 有効なトークンがある
     * - ユーザーが存在する
     * - 新しいパスワードが要件を満たす
     *
     * 期待結果：
     * - success: true
     * - パスワードが更新される
     * - トークンが削除される（再利用防止）
     */
    it('パスワードをリセットする', async () => {
      // 有効なトークン（有効期限が1時間後）
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce({
        ...mockPasswordResetToken,
        expires: new Date(Date.now() + 3600000), // 3600000ms = 1時間
      })
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, password: 'new-hashed-password' })
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 1 })

      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: 'NewPassword123',
      })

      // 成功を確認
      expect(result).toEqual({ success: true })

      // パスワードが更新されたことを確認
      expect(mockPrisma.user.update).toHaveBeenCalled()

      // トークンが削除されたことを確認
      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
    })

    /**
     * テストケース2: バリデーションエラー - パスワードが短すぎる
     *
     * パスワードの長さは最も基本的なセキュリティ要件。
     * 短いパスワードは総当たり攻撃に弱い。
     */
    it('8文字未満のパスワードでエラーを返す', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: 'Short1', // 6文字しかない
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('パスワードは8文字以上で入力してください')
    })

    /**
     * テストケース3: バリデーションエラー - 数字が含まれていない
     *
     * 英字のみのパスワードは辞書攻撃に弱い。
     * 数字を含めることで複雑性が増す。
     */
    it('アルファベットのみのパスワードでエラーを返す', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: 'OnlyLetters', // 数字がない
      })

      expect(result.success).toBe(false)
      // 共有 validatePassword は不足要素を個別に通知する（より具体的な UX）
      expect('error' in result && result.error).toBe('パスワードは数字を含めてください')
    })

    /**
     * テストケース4: バリデーションエラー - アルファベットが含まれていない
     *
     * 数字のみのパスワードは、桁数が少ないと
     * 総当たり攻撃で簡単に破られる。
     */
    it('数字のみのパスワードでエラーを返す', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: '12345678', // 英字がない
      })

      expect(result.success).toBe(false)
      // 共有 validatePassword は不足要素を個別に通知する（より具体的な UX）
      expect('error' in result && result.error).toBe('パスワードはアルファベットを含めてください')
    })

    /**
     * テストケース5: 無効なトークン
     *
     * シナリオ：
     * - トークンが存在しない（間違っている）
     * - トークンの有効期限が切れている
     *
     * 攻撃者がランダムなトークンを試すことを防ぐ。
     */
    it('無効なトークンでエラーを返す', async () => {
      // トークンが見つからない
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(null)

      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'invalid-token',
        newPassword: 'ValidPass123',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('リセットリンクが無効または期限切れです。もう一度お試しください。')
    })

    /**
     * テストケース6: ユーザーが見つからない
     *
     * シナリオ：
     * - トークンは有効だが、対応するユーザーが削除されている
     *
     * 稀なケースだが、エッジケースとしてテスト。
     */
    it('ユーザーが見つからない場合エラーを返す', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce({
        ...mockPasswordResetToken,
        expires: new Date(Date.now() + 3600000),
      })
      // ユーザーが存在しない
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: 'ValidPass123',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('ユーザーが見つかりません')
    })
  })

  // ============================================================
  // verifyPasswordResetToken（トークン検証）
  // ============================================================
  /**
   * verifyPasswordResetToken関数のテスト
   *
   * この関数は、パスワードリセットトークンが有効かどうかを検証します。
   *
   * 使用タイミング：
   * - パスワードリセットページを表示する前
   * - トークンの有効性を事前にチェックしてUXを向上
   *
   * 検証内容：
   * - トークンが存在するか
   * - トークンの有効期限が切れていないか
   * - トークンとメールアドレスが一致するか
   */
  describe('verifyPasswordResetToken', async () => {
    /**
     * テストケース1: 有効なトークン
     *
     * シナリオ：
     * - トークンが存在する
     * - 有効期限内
     *
     * 期待結果：
     * - valid: true
     */
    it('有効なトークンの場合、valid: trueを返す', async () => {
      // 有効期限が1時間後のトークン
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce({
        ...mockPasswordResetToken,
        expires: new Date(Date.now() + 3600000),
      })

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')
      const result = await verifyPasswordResetToken('test@example.com', 'valid-token')

      expect(result).toEqual({ success: true, data: { valid: true } })
    })

    /**
     * テストケース2: 無効なトークン
     *
     * シナリオ：
     * - トークンが存在しない
     * - または有効期限切れ
     *
     * 期待結果：
     * - valid: false
     */
    it('無効なトークンの場合、valid: falseを返す', async () => {
      // トークンが見つからない
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(null)

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')
      const result = await verifyPasswordResetToken('test@example.com', 'invalid-token')

      expect(result).toEqual({ success: true, data: { valid: false } })
    })
  })

  // ============================================================
  // verifyEmailToken（メール確認トークン検証）
  // ============================================================
  describe('verifyEmailToken', () => {
    it('有効なトークンでメール確認を完了する', async () => {
      const futureExpiry = new Date(Date.now() + 86400000)
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValueOnce({
        id: 'ev-1',
        email: 'user@example.com',
        token: 'hashed-token-123',
        expires: futureExpiry,
        created_at: new Date(),
      })
      mockPrisma.$transaction.mockResolvedValueOnce([{}, {}])

      const { verifyEmailToken } = await import('@/lib/actions/auth')
      const result = await verifyEmailToken('plain-token-123')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it('トークンが空や短い場合はエラーを返す', async () => {
      const { verifyEmailToken } = await import('@/lib/actions/auth')

      const r1 = await verifyEmailToken('')
      expect(r1.success).toBe(false)
      expect('error' in r1 && r1.error).toBe('無効なトークンです。')
      const r2 = await verifyEmailToken('short')
      expect(r2.success).toBe(false)
      expect('error' in r2 && r2.error).toBe('無効なトークンです。')
    })

    it('トークンが存在しない場合はエラーを返す', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValueOnce(null)

      const { verifyEmailToken } = await import('@/lib/actions/auth')
      const result = await verifyEmailToken('unknown-token')

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('無効または期限切れのリンクです。確認メールの再送をお試しください。')
    })

    it('トークンの有効期限切れの場合はエラーを返す', async () => {
      const pastExpiry = new Date(Date.now() - 1000)
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValueOnce({
        id: 'ev-1',
        email: 'user@example.com',
        token: 'hashed-token-123',
        expires: pastExpiry,
        created_at: new Date(),
      })
      mockPrisma.emailVerificationToken.delete.mockResolvedValueOnce({} as never)

      const { verifyEmailToken } = await import('@/lib/actions/auth')
      const result = await verifyEmailToken('expired-token')

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('リンクの有効期限が切れています。確認メールの再送をお試しください。')
    })
  })

  // ============================================================
  // resendVerificationEmail（確認メール再送）
  // ============================================================
  describe('resendVerificationEmail', () => {
    it('未確認ユーザーに確認メールを再送する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        emailVerified: null,
      })
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.emailVerificationToken.create.mockResolvedValueOnce({})
      mockSendVerificationEmail.mockResolvedValueOnce({ success: true })

      const { resendVerificationEmail } = await import('@/lib/actions/auth')
      const result = await resendVerificationEmail('user@example.com')

      expect(result).toEqual({ success: true })
      expect(mockSendVerificationEmail).toHaveBeenCalled()
    })

    it('ユーザーが存在しない場合は成功を返す（列挙防止）', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { resendVerificationEmail } = await import('@/lib/actions/auth')
      const result = await resendVerificationEmail('nonexistent@example.com')

      expect(result).toEqual({ success: true })
    })

    it('既に確認済みのユーザーは成功を返す（再送しない）', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        emailVerified: new Date(),
      })

      const { resendVerificationEmail } = await import('@/lib/actions/auth')
      const result = await resendVerificationEmail('verified@example.com')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.emailVerificationToken.create).not.toHaveBeenCalled()
    })
  })

  // getEmailVerificationStatus は列挙耐性のため撤去し、メール未確認の判定は
  // verifyCredentials（パスワード一致後のみ ERR_EMAIL_NOT_VERIFIED を返す）に統合した。
})

// ============================================================================
// テストの実行方法
// ============================================================================
/**
 * このテストファイルを実行するには：
 *
 * 1. 単一ファイルのテスト
 *    npm test -- __tests__/lib/actions/auth.test.ts
 *
 * 2. ウォッチモード（ファイル変更時に自動再実行）
 *    npm test -- --watch __tests__/lib/actions/auth.test.ts
 *
 * 3. カバレッジ付き
 *    npm test -- --coverage __tests__/lib/actions/auth.test.ts
 *
 * 4. 特定のテストだけ実行
 *    npm test -- -t "registerUser"
 */
