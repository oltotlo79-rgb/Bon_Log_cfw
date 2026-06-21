/**
 * @module lib/services/legal-service
 * モバイル API v1 向け法的文章取得サービス。
 *
 * 法的文章は DB ではなく lib/constants/legal に定数として定義されている。
 * 'use server' を付けない（API route から呼ばれる services 層）。
 * import 'server-only' で誤った client 側利用を防ぐ。
 */
import 'server-only'

import {
  LEGAL_DOCUMENTS,
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
  return { ok: true, document: LEGAL_DOCUMENTS[slug] }
}

/** 利用可能な法的文章の slug/title 一覧を返す */
export function listLegalDocuments(): Array<{ slug: string; title: string; updatedAt: string }> {
  return LEGAL_SLUGS.map((slug) => {
    const doc = LEGAL_DOCUMENTS[slug]
    return { slug: doc.slug, title: doc.title, updatedAt: doc.updatedAt }
  })
}
