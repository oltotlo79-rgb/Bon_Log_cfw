/**
 * @module scripts/generate-openapi
 *
 * OpenAPI 3.1 ドキュメントをリポジトリルートの openapi/openapi.json に出力する。
 *
 * 使用ライブラリ: @asteasolutions/zod-to-openapi v8（zod v4 対応）
 * バージョン管理: info.version は semver に従い手動更新する。
 *   - パッチ: バグ修正・説明文修正
 *   - マイナー: 後方互換な追加（新フィールド、新エンドポイント）
 *   - メジャー: 破壊的変更（フィールド削除、型変更、エンドポイント廃止）
 *
 * 決定論性: JSON.stringify でキー順を安定させ、再実行で diff ゼロを保証する。
 *
 * extendZodWithOpenApi の適用順:
 *   zod-to-openapi は extendZodWithOpenApi(z) でプロトタイプを拡張してから
 *   スキーマをロードする必要がある。ESM の静的 import は hoist されるため、
 *   スキーマファイルを動的 import することで確実な実行順序を保証する。
 */

import fs from 'fs'
import path from 'path'
import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi'
import type { HeadersObject } from 'openapi3-ts/oas31'
import { z } from 'zod'

// CJS 環境で __dirname を使用（tsx はデフォルト CJS）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const scriptDir = __dirname

async function main() {
  // extendZodWithOpenApi を静的 import のスキーマより先に実行する必要がある。
  // 動的 import でスキーマをロードすることで実行順序を保証する。
  extendZodWithOpenApi(z)

  const {
    loginRequestSchema,
    verify2FARequestSchema,
    refreshRequestSchema,
    logoutRequestSchema,
    googleRequestSchema,
    passwordResetRequestSchema,
    passwordResetConfirmSchema,
  } = await import('../lib/api/v1/schemas/request')

  const {
    tokenPairSchema,
    requires2FASchema,
    successSchema,
    usersMeSchema,
    apiErrorResponseSchema,
    mobileApiErrorCodeSchema,
  } = await import('../lib/api/v1/schemas/response')

  const registry = new OpenAPIRegistry()

  // ──────────────────────────────────────────────────
  // securitySchemes
  // ──────────────────────────────────────────────────

  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'アクセストークン（JWT HS256, TTL 15 分）。期限切れ時は /api/v1/auth/refresh でトークンペアを更新する。',
  })

  // ──────────────────────────────────────────────────
  // Zod スキーマを OpenAPI components/schemas に登録
  // ──────────────────────────────────────────────────

  const TokenPair = registry.register(
    'TokenPair',
    tokenPairSchema.openapi({
      description: 'アクセストークン + リフレッシュトークン + 有効期間（秒）のペア。',
    }),
  )

  const Requires2FAResponse = registry.register(
    'Requires2FAResponse',
    requires2FASchema.openapi({
      description: '2FA が必要な場合の 202 レスポンス。ticket を /api/v1/auth/2fa/verify に渡す。',
    }),
  )

  const SuccessResponse = registry.register(
    'SuccessResponse',
    successSchema.openapi({ description: '処理成功を示す汎用レスポンス。' }),
  )

  const UsersMeResponse = registry.register(
    'UsersMeResponse',
    usersMeSchema.openapi({ description: '認証ユーザーの基本情報。' }),
  )

  const ApiErrorResponse = registry.register(
    'ApiErrorResponse',
    apiErrorResponseSchema.openapi({
      description: '全エンドポイント共通エラーレスポンス形式。',
    }),
  )

  registry.register(
    'MobileApiErrorCode',
    mobileApiErrorCodeSchema.openapi({
      description:
        'エラーコード enum（18 値）。モバイル側はこの enum からコード→メッセージ対応表を導出できる。',
    }),
  )

  const LoginRequest = registry.register(
    'LoginRequest',
    loginRequestSchema.openapi({ description: 'メール/パスワード認証のリクエスト。' }),
  )

  const Verify2FARequest = registry.register(
    'Verify2FARequest',
    verify2FARequestSchema.openapi({
      description: '2FA コード検証のリクエスト。',
    }),
  )

  const RefreshRequest = registry.register(
    'RefreshRequest',
    refreshRequestSchema.openapi({ description: 'トークンリフレッシュのリクエスト。' }),
  )

  const LogoutRequest = registry.register(
    'LogoutRequest',
    logoutRequestSchema.openapi({ description: 'ログアウトのリクエスト。' }),
  )

  const GoogleRequest = registry.register(
    'GoogleRequest',
    googleRequestSchema.openapi({ description: 'Google ID トークン認証のリクエスト。' }),
  )

  const PasswordResetRequest = registry.register(
    'PasswordResetRequest',
    passwordResetRequestSchema.openapi({
      description: 'パスワードリセットメール送信のリクエスト。',
    }),
  )

  const PasswordResetConfirm = registry.register(
    'PasswordResetConfirm',
    passwordResetConfirmSchema.openapi({ description: 'パスワードリセット確定のリクエスト。' }),
  )

  // ──────────────────────────────────────────────────
  // 共通エラーレスポンス定義ヘルパー
  // ──────────────────────────────────────────────────

  function errorResponse(description: string) {
    return {
      description,
      content: {
        'application/json': {
          schema: ApiErrorResponse,
        },
      },
    }
  }

  // HeadersObject 型を明示することで openapi3-ts の index signature と互換させる
  const retryAfterHeaders: HeadersObject = {
    'Retry-After': {
      description: '次のリクエストまでの待機秒数',
      schema: { type: 'integer' },
    },
  }

  const rateLimitedResponse = {
    description: 'レート制限超過。Retry-After ヘッダー（秒）が返却される。自動リトライ禁止。',
    headers: retryAfterHeaders,
    content: {
      'application/json': {
        schema: ApiErrorResponse,
      },
    },
  }

  // ──────────────────────────────────────────────────
  // パス登録
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/login',
    tags: ['auth'],
    summary: 'メール/パスワードでログイン',
    description: [
      'パスワード照合後、2FA の有効/無効によってレスポンスが分岐する。',
      '',
      '- 2FA 無効: 200 + TokenPair',
      '- 2FA 有効: 202 + { requires2FA: true, ticket } — ticket は /api/v1/auth/2fa/verify に渡す',
      '  - チケット TTL: 300 秒（5 分）、単回使用（成功・失敗いずれの場合も消費）',
      '  - コード不正時もチケットが消費されるため /login からやり直すこと',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: LoginRequest },
        },
      },
    },
    responses: {
      200: {
        description: 'ログイン成功（2FA 無効）',
        content: { 'application/json': { schema: TokenPair } },
      },
      202: {
        description: '2FA が必要。ticket を /api/v1/auth/2fa/verify に渡す',
        content: { 'application/json': { schema: Requires2FAResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('資格情報が不正 (AUTH_INVALID_CREDENTIALS)'),
      403: errorResponse(
        'アカウント停止 (ACCOUNT_SUSPENDED) またはゲストアカウント不可 (GUEST_NOT_ALLOWED)',
      ),
      429: rateLimitedResponse,
      503: errorResponse('サーバー設定エラー (SERVER_MISCONFIGURED)'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/2fa/verify',
    tags: ['auth'],
    summary: '2FA コードを検証してトークンペアを取得',
    description: [
      '/api/v1/auth/login の 202 で返却された ticket と TOTP コード（またはバックアップコード）を検証する。',
      '',
      '重要仕様:',
      '- チケットは成功・失敗いずれの場合も GETDEL でアトミックに消費される（単回使用）',
      '- コード不正の場合もチケットは消費済みになるため /api/v1/auth/login からやり直すこと',
      '- チケット TTL は 300 秒（5 分）',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: Verify2FARequest },
        },
      },
    },
    responses: {
      200: {
        description: '2FA 検証成功。TokenPair を返却',
        content: { 'application/json': { schema: TokenPair } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse(
        'チケット期限切れ (AUTH_2FA_TICKET_EXPIRED) または コード不正 (AUTH_2FA_INVALID_CODE)',
      ),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
      503: errorResponse('サーバー設定エラー (SERVER_MISCONFIGURED)'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/refresh',
    tags: ['auth'],
    summary: 'リフレッシュトークンでトークンペアを更新',
    description: [
      'ローテーション + 再利用検知方式:',
      '- 有効トークン提示 → 旧トークンを revoke し新ペアを発行（トランザクション）',
      '- revoked 済みトークン再提示 → 盗難とみなし当該ユーザーの全トークンを即時失効 (AUTH_REFRESH_TOKEN_REUSE_DETECTED)',
      '  - モバイルはこのコードで専用の「セキュリティ警告」画面を表示すること',
      '',
      'リフレッシュトークン TTL は 30 日。',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: RefreshRequest },
        },
      },
    },
    responses: {
      200: {
        description: 'トークン更新成功。新しい TokenPair を返却',
        content: { 'application/json': { schema: TokenPair } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse(
        'トークン無効/期限切れ (AUTH_REFRESH_TOKEN_INVALID) または 再利用検知 (AUTH_REFRESH_TOKEN_REUSE_DETECTED)',
      ),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
      503: errorResponse('サーバー設定エラー (SERVER_MISCONFIGURED)'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/logout',
    tags: ['auth'],
    summary: 'ログアウト（リフレッシュトークン失効）',
    description: [
      '冪等設計: トークンが存在しない・既に失効済みでも 200 を返す。',
      'ネットワークエラー時のリトライを妨げない fail-safe ログアウトを実現する。',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: LogoutRequest },
        },
      },
    },
    responses: {
      200: {
        description: 'ログアウト成功（冪等）',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/google',
    tags: ['auth'],
    summary: 'Google ID トークンでログイン',
    description: [
      'Google Sign-In で取得した ID トークンを検証し、TokenPair を発行する。',
      '',
      'ユーザー解決フロー:',
      "1. Account(provider='google', providerAccountId=sub) を検索",
      '2. なければ email で User を検索し Account を作成してリンク',
      '3. User も存在しなければ新規作成',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: GoogleRequest },
        },
      },
    },
    responses: {
      200: {
        description: 'Google 認証成功。TokenPair を返却',
        content: { 'application/json': { schema: TokenPair } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('ID トークン不正 (AUTH_INVALID_TOKEN)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
      503: errorResponse('サーバー設定エラー (SERVER_MISCONFIGURED)'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/password-reset/request',
    tags: ['auth'],
    summary: 'パスワードリセットメールを送信',
    description: [
      '列挙攻撃対策: メールアドレスの存在有無に関わらず常に 200 を返す。',
      'バリデーションエラーも 200 を返す（この仕様は意図的）。',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: PasswordResetRequest },
        },
      },
    },
    responses: {
      200: {
        description: 'リクエスト受付（メールアドレス存在有無に関わらず常に 200）',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/password-reset/confirm',
    tags: ['auth'],
    summary: 'パスワードリセットを確定',
    description: [
      'メールで受け取ったトークンと新しいパスワードを送信してリセットを確定する。',
      'トークン無効・ユーザー不在は一律 401 を返す（列挙攻撃防止）。',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: PasswordResetConfirm },
        },
      },
    },
    responses: {
      200: {
        description: 'パスワードリセット成功',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('トークン無効または資格情報不正 (AUTH_INVALID_CREDENTIALS)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/users/me',
    tags: ['users'],
    summary: '認証ユーザーの基本情報を取得',
    description: [
      'Authorization: Bearer <accessToken> ヘッダーで認証する。',
      '',
      'エラーフロー:',
      '- Bearer ヘッダー無し → 401 AUTH_REQUIRED',
      '- トークン期限切れ → 401 AUTH_TOKEN_EXPIRED（このコードでのみ /refresh を試みること）',
      '- トークン不正 → 401 AUTH_INVALID_TOKEN（リフレッシュ不可）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: '認証ユーザーの基本情報',
        content: { 'application/json': { schema: UsersMeResponse } },
      },
      401: errorResponse(
        'Bearer トークンなし (AUTH_REQUIRED)、期限切れ (AUTH_TOKEN_EXPIRED)、不正 (AUTH_INVALID_TOKEN)',
      ),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('ユーザーが見つからない (NOT_FOUND)'),
      503: errorResponse('サーバー設定エラー (SERVER_MISCONFIGURED)'),
    },
  })

  // ──────────────────────────────────────────────────
  // ドキュメント生成 + 出力
  // ──────────────────────────────────────────────────

  const generator = new OpenApiGeneratorV31(registry.definitions)

  const document = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Bon_Log Mobile API',
      version: '1.0.0',
      description: [
        '盆栽 SNS「Bon_Log」のモバイルアプリ向け API。',
        '',
        '## 認証フロー',
        '',
        '1. POST /api/v1/auth/login でトークンペアを取得',
        '2. API リクエストに Authorization: Bearer <accessToken> を付与',
        '3. 401 AUTH_TOKEN_EXPIRED を受け取ったら POST /api/v1/auth/refresh でペアを更新',
        '4. 401 AUTH_REFRESH_TOKEN_REUSE_DETECTED はセキュリティ警告画面を表示して再ログインを促す',
        '',
        '## レート制限',
        '',
        '429 レスポンスには Retry-After ヘッダー（秒）が付与される。自動リトライは禁止。',
      ].join('\n'),
    },
    servers: [{ url: 'https://www.bon-log.com', description: '本番サーバー' }],
  })

  const outPath = path.join(scriptDir, '..', 'openapi', 'openapi.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  // JSON.stringify のキー順は挿入順が保証されるため、再実行で diff ゼロを実現できる
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2) + '\n', 'utf-8')

  console.log(`OpenAPI spec generated: ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
