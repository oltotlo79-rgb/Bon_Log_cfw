/**
 * @module lib/services/legal-service
 * モバイル API v1 向け法的文章取得サービス。
 *
 * 法的文章は DB ではなく lib/constants/legal に定数として定義されている。
 * モバイル REST は Native (Android) 専用の API であるため、常に
 * ANDROID_LEGAL_DOCUMENTS を返す（Web audience の WEB_LEGAL_DOCUMENTS は
 * このサービスからは参照しない。Web ページは独自定数を持つため、ここでの
 * 選択が Web の表示へ影響することはない）。将来 iOS を区別する必要が
 * 生じた場合のみ、後方互換な optional platform 引数の追加を検討する。
 *
 * 'use server' を付けない（API route から呼ばれる services 層）。
 * import 'server-only' で誤った client 側利用を防ぐ。
 */
import 'server-only'

import {
  ANDROID_LEGAL_DOCUMENTS,
  LEGAL_SLUGS,
  type LegalDocument,
  type LegalSlug,
} from '@/lib/constants/legal'

/** slug が許可リストの値かを確認する型ガード */
function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value)
}

/** getLegalDocument の戻り値 */
type GetLegalDocumentResult =
  | { ok: true; document: LegalDocument }
  | { ok: false; notFound: true }

/** slug から法的文章を取得する */
export function getLegalDocument(slug: string): GetLegalDocumentResult {
  if (!isLegalSlug(slug)) {
    return { ok: false, notFound: true }
  }
  return { ok: true, document: ANDROID_LEGAL_DOCUMENTS[slug] }
}

/** 利用可能な法的文章の slug/title 一覧を返す */
export function listLegalDocuments(): Array<{ slug: string; title: string; updatedAt: string }> {
  return LEGAL_SLUGS.map((slug) => {
    const doc = ANDROID_LEGAL_DOCUMENTS[slug]
    return { slug: doc.slug, title: doc.title, updatedAt: doc.updatedAt }
  })
}
