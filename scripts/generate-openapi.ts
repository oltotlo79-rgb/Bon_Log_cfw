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
    readPaginationQuerySchema,
    searchQuerySchema,
    registerRequestSchema,
  } = await import('../lib/api/v1/schemas/request')

  const {
    tokenPairSchema,
    requires2FASchema,
    successSchema,
    usersMeSchema,
    apiErrorResponseSchema,
    mobileApiErrorCodeSchema,
    feedResponseSchema,
    postSchema,
    commentsListResponseSchema,
    userProfileSchema,
    searchPostsResponseSchema,
    searchUsersResponseSchema,
    notificationsListResponseSchema,
    unreadCountResponseSchema,
    mentionedUserSchema,
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

  const RegisterRequest = registry.register(
    'RegisterRequest',
    registerRequestSchema.openapi({
      description: '新規ユーザー登録のリクエスト。termsAccepted は true のみ受け付ける（利用規約同意の強制）。',
    }),
  )

  registry.register(
    'ReadPaginationQuery',
    readPaginationQuerySchema.openapi({
      description: 'カーソルベースページネーションのクエリパラメータ（cursor, limit）。',
    }),
  )

  registry.register(
    'SearchQuery',
    searchQuerySchema.openapi({
      description: '検索クエリパラメータ（q, cursor, limit）。',
    }),
  )

  // ──────────────────────────────────────────────────
  // 書き込み系エンドポイントのスキーマ
  // ──────────────────────────────────────────────────

  const LikeResponse = registry.register(
    'LikeResponse',
    z.object({
      liked: z.boolean(),
      likeCount: z.number().int(),
    }).openapi({
      description: 'いいね操作後の最新状態。liked は操作後の状態、likeCount は操作後の総いいね数。',
    }),
  )

  const FollowResponse = registry.register(
    'FollowResponse',
    z.object({
      following: z.boolean(),
      requested: z.boolean(),
      followerCount: z.number().int(),
    }).openapi({
      description: 'フォロー操作後の統一レスポンス。following/requested は同時に true にならない。followerCount は操作後の実数。',
    }),
  )

  const NotificationReadRequest = registry.register(
    'NotificationReadRequest',
    z.object({
      ids: z.array(z.string()).optional(),
    }).openapi({
      description: '既読化する通知 ID の配列。省略または空配列の場合は全未読を既読化する。最大 100 件。',
    }),
  )

  const NotificationReadResponse = registry.register(
    'NotificationReadResponse',
    z.object({
      success: z.literal(true),
      unreadCount: z.number().int(),
    }).openapi({
      description: '通知既読化後のレスポンス。unreadCount はミュートユーザーを除いた操作後の未読数。',
    }),
  )

  registry.register(
    'MentionedUser',
    mentionedUserSchema.openapi({
      description: 'メンション解決済みユーザー情報。content 内の `<@userId>` トークンに対応する表示情報。',
    }),
  )

  const FeedResponse = registry.register(
    'FeedResponse',
    feedResponseSchema.openapi({ description: 'タイムライン取得レスポンス。各投稿に mentionedUsers が含まれる。' }),
  )

  const PostResponse = registry.register(
    'PostResponse',
    postSchema.openapi({ description: '単一投稿の詳細レスポンス。mentionedUsers が含まれる。' }),
  )

  const CommentsListResponse = registry.register(
    'CommentsListResponse',
    commentsListResponseSchema.openapi({ description: 'コメント一覧取得レスポンス。' }),
  )

  const UserProfileResponse = registry.register(
    'UserProfileResponse',
    userProfileSchema.openapi({ description: 'ユーザープロフィール取得レスポンス。' }),
  )

  const SearchPostsResponse = registry.register(
    'SearchPostsResponse',
    searchPostsResponseSchema.openapi({ description: '投稿検索結果レスポンス。' }),
  )

  const SearchUsersResponse = registry.register(
    'SearchUsersResponse',
    searchUsersResponseSchema.openapi({ description: 'ユーザー検索結果レスポンス。' }),
  )

  const NotificationsListResponse = registry.register(
    'NotificationsListResponse',
    notificationsListResponseSchema.openapi({ description: '通知一覧取得レスポンス。' }),
  )

  const UnreadCountResponse = registry.register(
    'UnreadCountResponse',
    unreadCountResponseSchema.openapi({ description: '未読通知件数レスポンス。' }),
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
    method: 'post',
    path: '/api/v1/auth/register',
    tags: ['auth'],
    summary: '新規ユーザー登録',
    description: [
      'ニックネーム・メールアドレス・パスワードで新規ユーザーを作成し、確認メールを送信する。',
      '',
      'フロー:',
      '1. バリデーション通過後、レート制限チェック（IP ベース）',
      '2. ユーザー作成 + メール確認トークン発行',
      '3. 確認メール送信（リンク有効期間: 24 時間）',
      '4. 201 { success: true } を返す',
      '',
      'モバイルはこのレスポンスを受け取ったら verify-email-sent 画面へ遷移し、',
      'ユーザーに確認メールのリンクをクリックするよう促す。',
      '',
      '列挙攻撃方針: Web の登録フォームはメール重複を明示的にユーザーに返すため、',
      'API も一貫して 409 CONFLICT で同じ情報量を返す（片方だけ隠すと一貫性が失われる）。',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: RegisterRequest },
        },
      },
    },
    responses: {
      201: {
        description: '登録成功。確認メールを送信済み。モバイルは verify-email-sent 画面へ遷移すること',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — nickname/email/password の形式不正または termsAccepted が true でない'),
      409: errorResponse('メールアドレス重複 (CONFLICT)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー — 確認メール送信失敗など (INTERNAL_ERROR)'),
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
  // 読み取り系エンドポイント
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/api/v1/feed',
    tags: ['feed'],
    summary: 'タイムライン取得',
    description: [
      '認証ユーザーのタイムライン（フォロー中ユーザーの投稿）をカーソルページネーションで返す。',
      '',
      'ゲストユーザーの場合は公開投稿の直近 N 件のみ返し nextCursor は null になる。',
      '',
      'ブロック・ミュート・停止済み著者の投稿は除外される。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: 'カーソル（前回レスポンスの nextCursor 値）' }),
        limit: z.number().int().optional().openapi({ description: '1 回の取得上限件数' }),
      }),
    },
    responses: {
      200: {
        description: 'タイムライン取得成功',
        content: { 'application/json': { schema: FeedResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/posts/{id}',
    tags: ['posts'],
    summary: '投稿詳細取得',
    description: [
      '指定 ID の投稿を取得する。',
      '',
      '非公開アカウントの投稿はフォロワーのみ閲覧可能。',
      'ブロックされている場合は 404 を返す。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '投稿 ID' }) }),
    },
    responses: {
      200: {
        description: '投稿詳細',
        content: { 'application/json': { schema: PostResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('投稿が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/posts/{id}/comments',
    tags: ['posts'],
    summary: 'コメント一覧取得',
    description: [
      '指定投稿のトップレベルコメント一覧をカーソルページネーションで返す。',
      '',
      'ブロック済みユーザーのコメントは isBlockedUser: true として含まれる（非表示はクライアント側で判断）。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '投稿 ID' }) }),
      query: z.object({
        cursor: z.string().optional().openapi({ description: 'カーソル' }),
        limit: z.number().int().optional().openapi({ description: '取得上限件数' }),
      }),
    },
    responses: {
      200: {
        description: 'コメント一覧',
        content: { 'application/json': { schema: CommentsListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('投稿が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/users/{id}',
    tags: ['users'],
    summary: 'ユーザープロフィール取得',
    description: [
      '指定 ID のユーザープロフィールを返す。',
      '',
      'メールアドレスは返却しない。',
      '非公開アカウントはフォロワー以外には公開情報のみ返す（フォロワー数等は含む）。',
      'ゲストアカウントは 404 として扱う。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'ユーザー ID' }) }),
    },
    responses: {
      200: {
        description: 'ユーザープロフィール',
        content: { 'application/json': { schema: UserProfileResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('ユーザーが存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/search/posts',
    tags: ['search'],
    summary: '投稿検索',
    description: [
      'キーワードで投稿を全文検索する。',
      '',
      '2 文字以上: pg_bigm trigram 検索。1 文字: LIKE フォールバック。',
      'ブロック・ミュート・非公開・停止ユーザーの投稿は除外される。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        q: z.string().optional().openapi({ description: '検索キーワード' }),
        cursor: z.string().optional().openapi({ description: 'カーソル' }),
        limit: z.number().int().optional().openapi({ description: '取得上限件数' }),
      }),
    },
    responses: {
      200: {
        description: '投稿検索結果',
        content: { 'application/json': { schema: SearchPostsResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/search/users',
    tags: ['search'],
    summary: 'ユーザー検索',
    description: [
      'ニックネームでユーザーを検索する。',
      '',
      'ブロック・ミュート・停止済みユーザーは除外される。',
      'ゲストアカウントは結果に含まれない。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        q: z.string().optional().openapi({ description: '検索キーワード' }),
        cursor: z.string().optional().openapi({ description: 'カーソル' }),
        limit: z.number().int().optional().openapi({ description: '取得上限件数' }),
      }),
    },
    responses: {
      200: {
        description: 'ユーザー検索結果',
        content: { 'application/json': { schema: SearchUsersResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/notifications',
    tags: ['notifications'],
    summary: '通知一覧取得',
    description: [
      '認証ユーザーの通知をカーソルページネーションで返す。',
      '',
      'ゲストユーザーは利用不可（403 GUEST_NOT_ALLOWED）。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: 'カーソル' }),
        limit: z.number().int().optional().openapi({ description: '取得上限件数' }),
      }),
    },
    responses: {
      200: {
        description: '通知一覧',
        content: { 'application/json': { schema: NotificationsListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse(
        'アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)',
      ),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // 書き込み系エンドポイント
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/api/v1/posts/{id}/like',
    tags: ['posts'],
    summary: '投稿にいいねを付ける（冪等）',
    description: [
      '対象投稿にいいねを付与する。既にいいね済みでも 200 を返す（冪等設計）。',
      '',
      '重要仕様:',
      '- 不存在・非公開・非表示の投稿は 404 NOT_FOUND を返す',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- likeCount は操作後の最新値（楽観更新の確定値として使用できる）',
      '- 通知（like）は同一ユーザーへの重複通知を防ぐ重複排除が働く',
      '- レート制限: toggle_like（30/分）、超過時は 429 + Retry-After ヘッダー',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '投稿 ID' }) }),
    },
    responses: {
      200: {
        description: 'いいね付与成功（既にいいね済みでも 200）',
        content: { 'application/json': { schema: LikeResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('投稿が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/posts/{id}/like',
    tags: ['posts'],
    summary: '投稿のいいねを解除する（冪等）',
    description: [
      '対象投稿のいいねを解除する。いいねしていなくても 200 を返す（冪等設計）。',
      '',
      '重要仕様:',
      '- 不存在・非公開・非表示の投稿は 404 NOT_FOUND を返す',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- likeCount は操作後の最新値',
      '- レート制限: toggle_like（30/分）、超過時は 429 + Retry-After ヘッダー',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '投稿 ID' }) }),
    },
    responses: {
      200: {
        description: 'いいね解除成功（いいねしていなくても 200）',
        content: { 'application/json': { schema: LikeResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('投稿が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/users/{id}/follow',
    tags: ['users'],
    summary: 'ユーザーをフォロー（公開: フォロー確立 / 非公開: リクエスト送信）',
    description: [
      '対象ユーザーの公開設定に応じてフォローまたはフォローリクエストを送信する。',
      '',
      '重要仕様:',
      '- 公開アカウント → フォロー確立（冪等: 既にフォロー済みでも 200）→ { following:true, requested:false }',
      '- 非公開アカウント → フォローリクエスト送信（冪等: 既に送信済みでも 200）→ { following:false, requested:true }',
      '- HTTP は 200 に統一（202 は使用しない）',
      '- 自分自身へのフォローは 400 VALIDATION_ERROR',
      '- ブロック関係・存在しない・停止済みユーザーは 404 NOT_FOUND（ブロック有無を秘匿）',
      '- followerCount は操作後の実数',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'フォロー対象ユーザー ID' }) }),
    },
    responses: {
      200: {
        description: 'フォロー確立またはリクエスト送信成功',
        content: { 'application/json': { schema: FollowResponse } },
      },
      400: errorResponse('自己フォロー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('ユーザーが存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/users/{id}/follow',
    tags: ['users'],
    summary: 'フォロー解除またはフォローリクエスト取消（同一エンドポイント、冪等）',
    description: [
      'フォロー中の場合はフォロー解除、リクエスト中の場合はリクエスト取消を行う。',
      'どちらでもない場合は no-op として { following:false, requested:false } を返す（冪等設計）。',
      '',
      '重要仕様:',
      '- フォロー中 → フォロー解除',
      '- リクエスト中 → リクエスト取消',
      '- どちらでもない → no-op（200）',
      '- 全ケースで { following:false, requested:false, followerCount } を返す',
      '- followerCount は操作後の実数',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'フォロー対象ユーザー ID' }) }),
    },
    responses: {
      200: {
        description: 'フォロー解除またはリクエスト取消成功（どちらでもない場合も 200）',
        content: { 'application/json': { schema: FollowResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/notifications/read',
    tags: ['notifications'],
    summary: '通知を既読化',
    description: [
      '通知を既読状態に更新する。',
      '',
      '重要仕様:',
      '- ids 指定: その通知群を既読化（userId 一致でのみ更新し、他ユーザーの通知は変更不可）',
      '- ids 省略または空配列: 当該ユーザーの全未読を既読化',
      '- ids は最大 100 件（MAX_NOTIFICATION_READ_IDS）',
      '- unreadCount はミュートユーザーを除いた操作後の未読数（バッジ即時更新に使用）',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: false,
        content: {
          'application/json': { schema: NotificationReadRequest },
        },
      },
    },
    responses: {
      200: {
        description: '既読化成功。unreadCount は操作後の未読数',
        content: { 'application/json': { schema: NotificationReadResponse } },
      },
      400: errorResponse('バリデーションエラー: ids が配列でないか 100 件超 (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/notifications/unread-count',
    tags: ['notifications'],
    summary: '未読通知件数取得',
    description: [
      '認証ユーザーの未読通知件数を返す。',
      '',
      'ゲストユーザーは利用不可（403 GUEST_NOT_ALLOWED）。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: '未読通知件数',
        content: { 'application/json': { schema: UnreadCountResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse(
        'アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)',
      ),
      429: rateLimitedResponse,
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
      version: '1.4.0',
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
