/**
 * セキュリティ関連イベントのログ記録。
 * 認証・認可・不審行動などを構造化 JSON で出力する（`[SECURITY]` プレフィックス付き）。
 *
 * SIEM 転送拡張ポイント:
 *   `registerSecuritySink()` で追加 sink を登録できる。本番運用では
 *   `instrumentation.ts` から CloudWatch / Datadog / Splunk への送信処理を登録し、
 *   ローカルの console 出力に加えて外部に転送する。
 *
 * @module lib/security-logger
 */

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGIN_LOCKOUT'
  | 'REGISTER_SUCCESS'
  | 'REGISTER_FAILURE'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_SUCCESS'
  | 'ADMIN_ACTION'
  | 'SUSPICIOUS_ACTIVITY'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED_ACCESS'

export interface SecurityLogEntry {
  timestamp: string
  type: SecurityEventType
  userId?: string
  ip?: string
  userAgent?: string
  details?: Record<string, unknown>
  /** low = 通常, medium = 注意, high = 警告, critical = 緊急 */
  severity: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * SIEM などの外部 sink に転送するためのフック型。
 *
 * - 例外はライブラリ側で握りつぶす（追加の障害を発生させないため）。
 * - I/O は呼び出し側でバッチ化することを推奨。書き込みごとに HTTP リクエストを
 *   投げると認証フローが遅くなるため、`setTimeout(... , 0)` 等で非同期化する。
 */
export type SecuritySink = (entry: SecurityLogEntry, formatted: string) => void | Promise<void>

const sinks: SecuritySink[] = []

/**
 * SIEM / 外部監視ツール送信用の sink を登録する。
 *
 * @example
 * ```ts
 * registerSecuritySink((_entry, json) => {
 *   void fetch(process.env.DATADOG_LOGS_URL!, { method: 'POST', body: json }).catch(() => {})
 * })
 * ```
 */
export function registerSecuritySink(sink: SecuritySink): () => void {
  sinks.push(sink)
  return () => {
    const idx = sinks.indexOf(sink)
    if (idx >= 0) sinks.splice(idx, 1)
  }
}

/** テスト用: 登録済み sink を全クリアする。production code から呼ばないこと。 */
export function _clearSecuritySinksForTest(): void {
  sinks.length = 0
}

function formatLogEntry(entry: SecurityLogEntry): string {
  return JSON.stringify({
    ...entry,
    env: process.env.NODE_ENV,
    app: 'bon-log',
  })
}

/** 重大度に応じて console.error / warn / log に振り分け、登録された sink にも転送する。 */
function writeLog(entry: SecurityLogEntry): void {
  const formatted = formatLogEntry(entry)

  switch (entry.severity) {
    case 'critical':
    case 'high':
      console.error(`[SECURITY] ${formatted}`)
      break
    case 'medium':
      console.warn(`[SECURITY] ${formatted}`)
      break
    default:
      console.log(`[SECURITY] ${formatted}`)
  }

  // 外部 sink 転送。sink 側の例外は他の sink・呼び出し側に伝播させない。
  for (const sink of sinks) {
    try {
      const result = sink(entry, formatted)
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => {})
      }
    } catch {
      // 追加の障害を引き起こさないため握りつぶす
    }
  }
}

export function logLoginSuccess(userId: string, ip?: string, userAgent?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'LOGIN_SUCCESS',
    userId,
    ip,
    userAgent,
    severity: 'low',
  })
}

/** ログイン失敗（medium）。連発時はブルートフォース検知のシグナルになる。 */
export function logLoginFailure(email: string, ip?: string, reason?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'LOGIN_FAILURE',
    ip,
    // プライバシー保護のため email はマスキングしてから保存する
    details: { email: maskEmail(email), reason },
    severity: 'medium',
  })
}

/** ログインロックアウト（high）。本番ではアラート通知を連携すること。 */
export function logLoginLockout(email: string, ip?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'LOGIN_LOCKOUT',
    ip,
    details: { email: maskEmail(email) },
    severity: 'high',
  })
}

export function logRegisterSuccess(userId: string, ip?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'REGISTER_SUCCESS',
    userId,
    ip,
    severity: 'low',
  })
}

/** 管理操作の監査証跡（medium）。誰が・何を・どの対象に、を記録する。 */
export function logAdminAction(
  adminId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, unknown>
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'ADMIN_ACTION',
    userId: adminId,
    details: {
      action,
      targetType,
      targetId,
      ...details,
    },
    severity: 'medium',
  })
}

/** 異常な挙動の検知（high）。攻撃パターン照合や異常頻度検知などから呼ぶ。 */
export function logSuspiciousActivity(
  description: string,
  ip?: string,
  userId?: string,
  details?: Record<string, unknown>
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'SUSPICIOUS_ACTIVITY',
    userId,
    ip,
    details: { description, ...details },
    severity: 'high',
  })
}

export function logRateLimitExceeded(
  limitType: string,
  ip?: string,
  userId?: string
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'RATE_LIMIT_EXCEEDED',
    userId,
    ip,
    details: { limitType },
    severity: 'medium',
  })
}

export function logInvalidInput(
  field: string,
  reason: string,
  ip?: string,
  userId?: string
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'INVALID_INPUT',
    userId,
    ip,
    details: { field, reason },
    severity: 'low',
  })
}

/** 権限外リソースへのアクセス（high）。権限昇格攻撃の可能性がある。 */
export function logUnauthorizedAccess(
  resource: string,
  ip?: string,
  userId?: string
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'UNAUTHORIZED_ACCESS',
    userId,
    ip,
    details: { resource },
    severity: 'high',
  })
}

export function logPasswordResetRequest(email: string, ip?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'PASSWORD_RESET_REQUEST',
    ip,
    details: { email: maskEmail(email) },
    severity: 'low',
  })
}

export function logPasswordResetSuccess(userId: string, ip?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'PASSWORD_RESET_SUCCESS',
    userId,
    ip,
    severity: 'medium',
  })
}

/**
 * ログ出力時に email をマスキングする（ログ漏洩時のリスク軽減・GDPR 配慮）。
 * ローカル部: 2 文字以下は全マスク、3 文字以上は先頭と末尾のみ残して中間をマスク。
 *   "test@example.com" → "t**t@example.com"
 *   "ab@example.com"   → "**@example.com"
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')

  if (!local || !domain) return '***@***'

  const maskedLocal =
    local.length <= 2
      ? '*'.repeat(local.length)
      : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]

  return `${maskedLocal}@${domain}`
}
