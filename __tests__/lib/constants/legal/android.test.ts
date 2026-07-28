// @vitest-environment node
/**
 * lib/constants/legal/android (ANDROID_LEGAL_DOCUMENTS) の構造テスト
 *
 * Google Play 提出向けの denylist（Stripe・固定円価格・checkout URL 等の
 * Web 決済導線が Android 本文に混入していないこと）と、
 * 必須 processor 開示（Sentry/RevenueCat/Google Sign-In/FCM/OpenStreetMap/Cloudflare R2）
 * が privacy に含まれることを検証する。
 *
 * 「クレジットカード」「無料トライアル」という文字列そのものは、Google が管理する旨・
 * Google Play の表示に従う旨のディスクロージャーとして privacy/terms に正当に登場する
 * （例: 「クレジットカード番号等の決済手段情報は Google が管理し、当方が取得・保存する
 * ことはありません」）。これらは断定的な Web 決済導線ではないため、単純な substring
 * 不在チェックにはせず、Web 限定の確定的フレーズ（当方が Stripe でカード決済する・
 * 無料トライアルの提供を保証する）が混入していないことを検証する。
 */
import { describe, it, expect } from 'vitest'
import { ANDROID_LEGAL_DOCUMENTS, LEGAL_SLUGS } from '@/lib/constants/legal'
import { WEB_LEGAL_DOCUMENTS } from '@/lib/constants/legal/web'

function allSectionsText(): string {
  return LEGAL_SLUGS.flatMap((slug) =>
    ANDROID_LEGAL_DOCUMENTS[slug].sections.map((s) => `${s.heading}\n${s.body}`),
  ).join('\n')
}

describe('ANDROID_LEGAL_DOCUMENTS: denylist（Web 決済導線の混入防止）', () => {
  it('Stripe という語を一切含まない', () => {
    expect(allSectionsText()).not.toContain('Stripe')
  })

  it('固定円価格（数字+円）を含まない', () => {
    // 「円建て価格は定めていません」のように数字を伴わない "円" は許容する。
    // 誤反応しないことの根拠として、実際の tokushoho body にこの非価格文が
    // 含まれることを確認する。
    const text = allSectionsText()
    expect(text).toContain('円建て価格は定めていません')
    expect(text).not.toMatch(/[0-9,]+\s*円/)
  })

  it('価格 regex は「Google Play の購入確認画面に表示される金額」のような非価格文には反応しない', () => {
    const priceRegex = /[0-9,]+\s*円/
    const nonPriceSentence =
      '金額は Google Play の購入確認画面および商品ページに表示される金額を正とします。'
    expect(priceRegex.test(nonPriceSentence)).toBe(false)
  })

  it('「料金ページ」という Web 固有の導線文言を含まない', () => {
    expect(allSectionsText()).not.toContain('料金ページ')
  })

  it('checkout / stripe.com 等の決済 URL を含まない', () => {
    const text = allSectionsText().toLowerCase()
    expect(text).not.toContain('checkout')
    expect(text).not.toContain('stripe.com')
  })

  it('tokushoho.支払方法 に Web 限定表現「クレジットカード（Stripe決済）」を含まない', () => {
    const android = ANDROID_LEGAL_DOCUMENTS.tokushoho.sections.find(
      (s) => s.heading === '支払方法',
    )
    expect(android?.body).not.toContain('クレジットカード（Stripe決済）')
    // Web 側には引き続きこの表現が残っていること（比較対象として存在を確認）
    const web = WEB_LEGAL_DOCUMENTS.tokushoho.sections.find((s) => s.heading === '支払方法')
    expect(web?.body).toContain('クレジットカード（Stripe決済）')
  })

  it('terms.第7条 に Web 限定の無料トライアル確定表現を含まない', () => {
    const android = ANDROID_LEGAL_DOCUMENTS.terms.sections.find(
      (s) => s.heading === '第7条（解約と返金）',
    )
    expect(android?.body).not.toContain('無料トライアル期間中に解約した場合、料金は発生しません')
    // Android は Google Play 表示に従う非断定的な文言であること
    expect(android?.body).toContain('Google Play の商品ページに表示される内容によります')

    const web = WEB_LEGAL_DOCUMENTS.terms.sections.find(
      (s) => s.heading === '第7条（解約と返金）',
    )
    expect(web?.body).toContain('無料トライアル期間中に解約した場合、料金は発生しません')
  })

  it('terms.第6条 に Web 限定の固定料金請求ロジック（料金変更の30日前通知）を含まない', () => {
    const android = ANDROID_LEGAL_DOCUMENTS.terms.sections.find(
      (s) => s.heading === '第6条（有料サービスの料金と支払い）',
    )
    expect(android?.body).not.toContain('料金を変更する場合、変更の30日前まで')
  })
})

describe('ANDROID_LEGAL_DOCUMENTS: 必須 processor 開示（privacy）', () => {
  const privacyText = ANDROID_LEGAL_DOCUMENTS.privacy.sections
    .map((s) => `${s.heading}\n${s.body}`)
    .join('\n')

  it('Sentry を含む', () => {
    expect(privacyText).toContain('Sentry')
  })

  it('RevenueCat を含む', () => {
    expect(privacyText).toContain('RevenueCat')
  })

  it('Google Play Billing を含む', () => {
    expect(privacyText).toContain('Google Play Billing')
  })

  it('Google Sign-In を含む', () => {
    expect(privacyText).toContain('Google Sign-In')
  })

  it('FCM または Expo Push のいずれかを含む', () => {
    expect(/FCM|Firebase Cloud Messaging|Expo\s*Push/.test(privacyText)).toBe(true)
  })

  it('OpenStreetMap を含む', () => {
    expect(privacyText).toContain('OpenStreetMap')
  })

  it('Cloudflare R2 を含む', () => {
    expect(privacyText).toContain('Cloudflare')
    expect(privacyText).toContain('R2')
  })
})

describe('ANDROID_LEGAL_DOCUMENTS: 解約導線', () => {
  it('terms / tokushoho ともに解約は Google Play の「お支払いと定期購入」から行う旨を記載する', () => {
    const termsCancel = ANDROID_LEGAL_DOCUMENTS.terms.sections.find(
      (s) => s.heading === '第7条（解約と返金）',
    )
    const tokushohoCancel = ANDROID_LEGAL_DOCUMENTS.tokushoho.sections.find(
      (s) => s.heading === '解約・キャンセル',
    )
    expect(termsCancel?.body).toContain('お支払いと定期購入')
    expect(tokushohoCancel?.body).toContain('お支払いと定期購入')
  })

  it('Web 版の設定ページ (/settings) からの解約導線を記載しない', () => {
    expect(allSectionsText()).not.toContain('設定ページからいつでも解約可能です')
  })
})
