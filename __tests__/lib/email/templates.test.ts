// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { buildPasswordResetEmail } from '@/lib/email/templates/password-reset'
import { buildVerificationEmail } from '@/lib/email/templates/verification'
import { buildSubscriptionExpiringEmail } from '@/lib/email/templates/subscription-expiring'
import { buildSubscriptionExpiredEmail } from '@/lib/email/templates/subscription-expired'
import {
  EMAIL_BRAND,
  renderCard,
  renderCtaButton,
  renderEmailShell,
  renderFallbackUrlNote,
} from '@/lib/email/templates/shared'

describe('email templates', () => {
  describe('shared helpers', () => {
    it('renderEmailShell: title と body を含む HTML を返す', () => {
      const html = renderEmailShell('テスト', '<p>hello</p>')
      expect(html).toContain('<title>テスト</title>')
      expect(html).toContain('<p>hello</p>')
      expect(html).toContain('<!DOCTYPE html>')
    })

    it('renderEmailShell: ブランド名とタグラインがヘッダーに含まれる', () => {
      const html = renderEmailShell('x', 'y')
      expect(html).toContain(EMAIL_BRAND.name)
      expect(html).toContain(EMAIL_BRAND.tagline)
    })

    it('renderCard: 渡した inner を白背景カード内に含む', () => {
      const html = renderCard('<p>inner</p>')
      expect(html).toContain('<p>inner</p>')
      expect(html).toContain('background: #fff')
    })

    it('renderCtaButton: href とラベルが含まれる', () => {
      const html = renderCtaButton('https://example.com/go', 'クリック')
      expect(html).toContain('href="https://example.com/go"')
      expect(html).toContain('クリック')
    })

    it('renderFallbackUrlNote: URL が本文中にそのまま出力される', () => {
      const url = 'https://example.com/fallback'
      const html = renderFallbackUrlNote(url)
      expect(html).toContain(url)
    })
  })

  describe('buildPasswordResetEmail', () => {
    it('resetUrl を HTML とテキストの両方に含む', () => {
      const url = 'https://app.example.com/password-reset/confirm?token=abc'
      const { html, text } = buildPasswordResetEmail(url)
      expect(html).toContain(url)
      expect(text).toContain(url)
    })

    it('1時間有効期限の案内を含む', () => {
      const { html, text } = buildPasswordResetEmail('https://x/')
      expect(html).toContain('1時間')
      expect(text).toContain('1時間')
    })

    it('CTA ボタンラベル「パスワードを再設定する」を含む', () => {
      const { html } = buildPasswordResetEmail('https://x/')
      expect(html).toContain('パスワードを再設定する')
    })
  })

  describe('buildVerificationEmail', () => {
    it('verifyUrl を HTML とテキストの両方に含む', () => {
      const url = 'https://app.example.com/verify-email?token=xyz'
      const { html, text } = buildVerificationEmail(url)
      expect(html).toContain(url)
      expect(text).toContain(url)
    })

    it('24時間有効期限の案内を含む', () => {
      const { html, text } = buildVerificationEmail('https://x/')
      expect(html).toContain('24時間')
      expect(text).toContain('24時間')
    })
  })

  describe('buildSubscriptionExpiringEmail', () => {
    it('nickname をエスケープして含む（XSS 防御）', () => {
      const { html } = buildSubscriptionExpiringEmail({
        nickname: '<script>alert(1)</script>',
        expirationDate: '2026年5月1日',
        daysRemaining: 3,
        settingsUrl: 'https://x/settings',
      })
      expect(html).not.toContain('<script>alert(1)</script>')
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    })

    it('expirationDate と daysRemaining を HTML とテキストに反映', () => {
      const { html, text } = buildSubscriptionExpiringEmail({
        nickname: 'Alice',
        expirationDate: '2026年5月1日',
        daysRemaining: 7,
        settingsUrl: 'https://x/settings',
      })
      expect(html).toContain('2026年5月1日')
      expect(html).toContain('7日')
      expect(text).toContain('2026年5月1日')
      expect(text).toContain('残り7日')
    })

    it('settingsUrl を CTA リンクに設定', () => {
      const { html } = buildSubscriptionExpiringEmail({
        nickname: 'Alice',
        expirationDate: '2026年5月1日',
        daysRemaining: 7,
        settingsUrl: 'https://app.example.com/settings/subscription',
      })
      expect(html).toContain('href="https://app.example.com/settings/subscription"')
    })
  })

  describe('buildSubscriptionExpiredEmail', () => {
    it('nickname をエスケープして含む（XSS 防御）', () => {
      const { html } = buildSubscriptionExpiredEmail({
        nickname: '"><img>',
        settingsUrl: 'https://x/settings',
      })
      expect(html).not.toContain('"><img>')
      expect(html).toContain('&quot;&gt;&lt;img&gt;')
    })

    it('settingsUrl を CTA リンクに設定', () => {
      const { html } = buildSubscriptionExpiredEmail({
        nickname: 'Bob',
        settingsUrl: 'https://app.example.com/settings/subscription',
      })
      expect(html).toContain('href="https://app.example.com/settings/subscription"')
    })

    it('期限切れの赤バナー（#f8d7da 背景）を含む', () => {
      const { html } = buildSubscriptionExpiredEmail({
        nickname: 'Bob',
        settingsUrl: 'https://x/',
      })
      expect(html).toContain('#f8d7da')
    })
  })
})
