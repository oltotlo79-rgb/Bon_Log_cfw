/**
 * @module app/(mobile-legal)/mobile/android/terms/page
 * Android アプリ版の利用規約。Native アプリの登録画面から WebBrowser/Linking で
 * 開かれる想定のため、ログイン不要・クロール可能な public ページとする。
 * 本文は Google Play 提出向けに正本化された ANDROID_LEGAL_DOCUMENTS.terms を表示する。
 */

import { Metadata } from 'next'
import { AndroidLegalDocumentView } from '@/components/legal/AndroidLegalDocumentView'
import { ANDROID_LEGAL_DOCUMENTS } from '@/lib/constants/legal'
import { ROUTE_MOBILE_ANDROID_TERMS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '利用規約（Androidアプリ版） | BON-LOG',
  description: 'BON-LOG Androidアプリ版の利用規約です。',
  alternates: { canonical: pageCanonical(ROUTE_MOBILE_ANDROID_TERMS) },
}

export default function MobileAndroidTermsPage() {
  return <AndroidLegalDocumentView doc={ANDROID_LEGAL_DOCUMENTS.terms} />
}
