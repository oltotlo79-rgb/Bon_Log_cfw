import {
  ACTION_META,
  CATEGORY_LABELS,
  ROLE_LABELS,
  ROLE_PRIORITY,
  ROLE_PRIORITY_ADMIN_THRESHOLD,
  getRoleCapabilities,
  type AdminActionCategory,
} from '@/lib/admin-permissions'
import type { AdminRole } from '@prisma/client'
import { CheckCircle2, XCircle } from 'lucide-react'

const ROLE_ACCENT: Record<AdminRole, string> = {
  super_admin: 'border-purple-200 dark:border-purple-900/50',
  admin: 'border-blue-200 dark:border-blue-900/50',
  moderator: 'border-green-200 dark:border-green-900/50',
  support: 'border-yellow-200 dark:border-yellow-900/50',
  readonly: 'border-gray-200 dark:border-gray-700',
}

const ROLE_BADGE: Record<AdminRole, string> = {
  super_admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  moderator: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  support: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  readonly: 'bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300',
}

/**
 * 各ロールの「特に重要な特徴」を一文で説明する補助テキスト。
 * ABILITY 詳細とは別に、設計上の意図を補足する。
 */
const ROLE_OVERVIEW: Record<AdminRole, string> = {
  super_admin:
    '全権限を持つ最上位ロール。admin を含む他ロールの付与・変更・剥奪ができる唯一の存在。バックアップ／セキュリティ／メンテナンスなど運用基盤も担当。',
  admin:
    'super_admin を除くすべての操作が可能。日常運用の最終責任者。ただし他の admin / super_admin に対するロール変更はできない（権限の横取り防止）。',
  moderator:
    'コンテンツ秩序維持の中核。投稿削除・ユーザー停止・通報対応・NGワード管理を担当。アカウント完全削除やロール付与・システム設定は不可。',
  support:
    'ユーザー対応専任。お問い合わせ対応と通報・ユーザー情報の閲覧が可能。書き込み系の管理操作（削除・停止・付与）はできない。',
  readonly:
    '監査・第三者レビュー向け。ほぼすべての管理画面を「閲覧のみ」できるが、変更・実行系の操作は一切不可。コンプライアンス担当者などに付与する想定。',
}

const CATEGORY_ORDER: AdminActionCategory[] = [
  'moderation',
  'users',
  'content',
  'support',
  'analytics',
  'system',
]

/** ロール優先度の高い順（super_admin → readonly） */
const ROLES_BY_PRIORITY: AdminRole[] = (Object.keys(ROLE_PRIORITY) as AdminRole[]).sort(
  (a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a],
)

export function RoleAbilityDetails() {
  return (
    <section aria-labelledby="role-abilities-heading" className="space-y-4">
      <div>
        <h2 id="role-abilities-heading" className="text-lg font-semibold">
          ロール別 権限詳細
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          各ロールが実際に何を「できる／できない」かを、機能カテゴリ別に一覧表示します。
          権限定義（<code className="text-xs bg-muted px-1 py-0.5 rounded">lib/admin-permissions.ts</code>）に
          変更があると、この表示も自動的に追従します。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ROLES_BY_PRIORITY.map((role) => {
          const capabilities = getRoleCapabilities(role)
          const totalAllowed = CATEGORY_ORDER.reduce(
            (sum, c) => sum + capabilities[c].allowed.length,
            0,
          )
          const totalActions = CATEGORY_ORDER.reduce(
            (sum, c) => sum + capabilities[c].allowed.length + capabilities[c].denied.length,
            0,
          )

          return (
            <article
              key={role}
              className={`rounded-lg border-2 bg-card p-4 ${ROLE_ACCENT[role]}`}
              aria-labelledby={`role-${role}-title`}
            >
              <header className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span
                    id={`role-${role}-title`}
                    className={`inline-block px-2 py-1 rounded-full text-sm font-semibold ${ROLE_BADGE[role]}`}
                  >
                    {ROLE_LABELS[role]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    優先度 {ROLE_PRIORITY[role]}
                  </span>
                </div>
                <span
                  className="text-xs text-muted-foreground"
                  aria-label={`${totalActions} 件中 ${totalAllowed} 件の権限を保有`}
                >
                  {totalAllowed} / {totalActions} 権限
                </span>
              </header>

              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {ROLE_OVERVIEW[role]}
              </p>

              <div className="space-y-3">
                {CATEGORY_ORDER.map((category) => {
                  const { allowed, denied } = capabilities[category]
                  if (allowed.length === 0 && denied.length === 0) return null

                  return (
                    <details
                      key={category}
                      className="group rounded-md border bg-background"
                      // 上位ロールでは初期展開、下位ロールでは折りたたみ
                      open={ROLE_PRIORITY[role] >= ROLE_PRIORITY_ADMIN_THRESHOLD}
                    >
                      <summary className="flex items-center justify-between cursor-pointer px-3 py-2 text-sm font-medium hover:bg-muted/50 rounded-md list-none">
                        <span>{CATEGORY_LABELS[category]}</span>
                        <span className="text-xs text-muted-foreground">
                          <span className="text-green-600 dark:text-green-400">
                            {allowed.length}
                          </span>
                          {' / '}
                          <span>{allowed.length + denied.length}</span>
                        </span>
                      </summary>

                      <div className="px-3 pb-3 pt-1 space-y-2">
                        {allowed.length > 0 && (
                          <ul className="space-y-1" aria-label={`${CATEGORY_LABELS[category]}でできる操作`}>
                            {allowed.map((action) => (
                              <li
                                key={action}
                                className="flex items-start gap-2 text-xs"
                              >
                                <CheckCircle2
                                  className="w-3.5 h-3.5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="text-foreground">
                                  {ACTION_META[action].label}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {denied.length > 0 && (
                          <ul className="space-y-1" aria-label={`${CATEGORY_LABELS[category]}でできない操作`}>
                            {denied.map((action) => (
                              <li
                                key={action}
                                className="flex items-start gap-2 text-xs opacity-60"
                              >
                                <XCircle
                                  className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="text-muted-foreground line-through">
                                  {ACTION_META[action].label}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </details>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>

      <aside
        className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 p-4 text-sm"
        aria-labelledby="role-hierarchy-note"
      >
        <h3 id="role-hierarchy-note" className="font-semibold mb-2">
          ロール階層と自己保全ルール
        </h3>
        <ul className="space-y-1 text-muted-foreground list-disc list-inside">
          <li>
            自分より優先度が低いロールのみ操作可能（
            <code className="text-xs bg-muted px-1 py-0.5 rounded">canManageRole</code>
            ）。同位・上位ロールには手出しできない。
          </li>
          <li>
            <strong>super_admin（100）</strong> のみが <strong>admin（80）</strong> の
            付与・剥奪が可能。admin 同士は互いに権限変更できない（権限横取りの防止）。
          </li>
          <li>
            super_admin と admin は権限自体は同等（全アクション許可）だが、ロール管理の
            到達範囲が異なるため、最後の砦として <strong>super_admin を 1 名以上</strong>{' '}
            維持することが推奨される。
          </li>
        </ul>
      </aside>
    </section>
  )
}
