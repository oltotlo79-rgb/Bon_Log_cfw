/**
 * @module app/(mobile-legal)/mobile/android/privacy/page
 * Android アプリ版のプライバシーポリシー。Native アプリの登録画面から
 * WebBrowser/Linking で開かれる想定のため、ログイン不要・クロール可能な
 * public ページとする。本文は ANDROID_LEGAL_DOCUMENTS.privacy を表示する
 * （Web 版とは異なり Stripe/AdSense 等 Web 固有の記述を含まない）。
 */

import { Metadata } from 'next'
import { AndroidLegalDocumentView } from '@/components/legal/AndroidLegalDocumentView'
import { ANDROID_LEGAL_DOCUMENTS } from '@/lib/constants/legal'
import { ROUTE_MOBILE_ANDROID_PRIVACY } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: 'プライバシーポリシー（Androidアプリ版） | BON-LOG',
  description: 'BON-LOG Androidアプリ版のプライバシーポリシーです。',
  alternates: { canonical: pageCanonical(ROUTE_MOBILE_ANDROID_PRIVACY) },
}

export default function MobileAndroidPrivacyPage() {
  return <AndroidLegalDocumentView doc={ANDROID_LEGAL_DOCUMENTS.privacy} />
}
