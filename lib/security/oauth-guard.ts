/**
 * OAuth プロバイダー設定のランタイム検証ユーティリティ。
 *
 * `allowDangerousEmailAccountLinking: true` はメール検証を保証する
 * 信頼済みプロバイダー（Google 等）にのみ許可されるべき設定。
 * 未信頼のプロバイダーに適用されるとアカウント乗っ取りのリスクがある。
 *
 * このモジュールは auth.ts から分離されているため、テスト時に
 * NextAuth 全体の初期化を走らせずに検証ロジックだけをテストできる。
 *
 * @module lib/security/oauth-guard
 */

/**
 * `allowDangerousEmailAccountLinking: true` を許容する OAuth プロバイダー ID。
 *
 * プロバイダーが「検証済みメールのみ返す」ことを契約レベルで保証している場合のみ
 * ここに追加する。未検証メールを返し得るプロバイダー（Twitter/X 等）を
 * 追加するとアカウント乗っ取りのリスクがある。
 */
export const VERIFIED_EMAIL_OAUTH_PROVIDERS: ReadonlySet<string> = new Set<string>(['google'])

/**
 * OAuth プロバイダー配列を検証し、同じ配列をそのまま返す。
 *
 * `allowDangerousEmailAccountLinking: true` を指定するプロバイダーが
 * `VERIFIED_EMAIL_OAUTH_PROVIDERS` に含まれていない場合、Error を投げる。
 *
 * ジェネリック `T` で入力型を保持することで、NextAuth のプロバイダー
 * 配列型推論を壊さない（パススルー）。
 *
 * @param providers NextAuth の providers 配列（任意の形状でも可）
 * @returns 検証に通過した `providers`（参照同一性を保持）
 * @throws 未信頼プロバイダーが危険リンクを有効にしている場合
 */
/** unknown 値が object かつ key を property として持つことを判定する narrowing helper。 */
function hasOwnProperty<K extends string>(
  value: unknown,
  key: K,
): value is Record<K, unknown> {
  return typeof value === 'object' && value !== null && key in value
}

export function assertSafeOAuthLinking<T extends readonly unknown[]>(providers: T): T {
  for (const provider of providers) {
    if (!hasOwnProperty(provider, 'id')) continue
    const { id } = provider
    if (typeof id !== 'string') continue

    if (!hasOwnProperty(provider, 'options')) continue
    const { options } = provider
    if (!hasOwnProperty(options, 'allowDangerousEmailAccountLinking')) continue

    const linksDangerously = options.allowDangerousEmailAccountLinking === true
    if (linksDangerously && !VERIFIED_EMAIL_OAUTH_PROVIDERS.has(id)) {
      throw new Error(
        `[auth] Provider '${id}' has allowDangerousEmailAccountLinking=true but is not ` +
        `whitelisted in VERIFIED_EMAIL_OAUTH_PROVIDERS. Verify that the provider guarantees ` +
        `verified email addresses before adding it.`
      )
    }
  }
  return providers
}
