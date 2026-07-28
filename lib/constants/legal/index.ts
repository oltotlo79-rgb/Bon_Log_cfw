/**
 * @module lib/constants/legal
 * モバイル API v1 向け法的文章の構造化データ定数。
 *
 * audience（web / android）別に完全分離した正本を持つ。文字列定数は共有しない。
 * - `web.ts` の `WEB_LEGAL_DOCUMENTS`: 従来から GET /api/v1/legal/{slug} が返して
 *   いた内容と同一（Stripe 決済等 Web の法的開示を含む）。変更していない。
 * - `android.ts` の `ANDROID_LEGAL_DOCUMENTS`: Google Play 提出向けの新設内容。
 *   Stripe・クレジットカード・固定 Web 価格を含まず、Google Play Billing を
 *   正としたうえで Native の実 SDK（Sentry, RevenueCat, Google Sign-In,
 *   Expo Push/FCM, Cloudflare R2, OpenStreetMap 等）を反映する。
 *
 * GET /api/v1/legal/{slug}（モバイル REST）は android 向け内容を返す
 * （lib/services/legal-service.ts 参照）。Web ページ（app/(legal)/*.tsx）は
 * これらの定数を一切参照せず、独自の JSX で本文を保持している（二重管理）。
 * `ANDROID_LEGAL_DOCUMENTS` は Android 専用 public ページ（frontend 側で
 * /mobile/android/terms 等に実装予定）からも参照可能な named export である。
 */

/** 1 法的文章セクション */
export interface LegalSection {
  heading: string
  body: string
}

/** 1 法的文章ドキュメント */
export interface LegalDocument {
  slug: string
  title: string
  updatedAt: string
  sections: LegalSection[]
}

/**
 * 許可済みの法的文章 slug の許可リスト。
 * GET /api/v1/legal/{slug} の slug パラメータ検証に使用する。
 */
export const LEGAL_SLUGS = ['tokushoho', 'terms', 'privacy'] as const
export type LegalSlug = (typeof LEGAL_SLUGS)[number]

export { WEB_LEGAL_DOCUMENTS } from './web'
export { ANDROID_LEGAL_DOCUMENTS } from './android'
