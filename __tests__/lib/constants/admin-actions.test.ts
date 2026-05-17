// @vitest-environment node

/**
 * lib/constants/admin-actions.ts のスナップショット・整合性テスト
 *
 * このファイルは AdminLog.action に書き込む文字列を一元管理する。
 * - すべての値が一意（重複したアクション名がログ集計を破壊しない）
 * - 全エクスポートが小文字スネークケース or アンダースコア混在パターン
 * - SECURITY_EVENT_* と ACTION_* は同名空間で衝突しない
 *
 * 後方互換が壊れる変更（既存のアクション名を変えるなど）を検知するためのテスト。
 */

import { describe, it, expect } from 'vitest'
import * as adminActions from '@/lib/constants/admin-actions'

describe('admin-actions constants', () => {
  it('全ての値が文字列', () => {
    for (const [name, value] of Object.entries(adminActions)) {
      expect(typeof value, `${name} should be string`).toBe('string')
    }
  })

  it('全ての値が空でない', () => {
    for (const [name, value] of Object.entries(adminActions)) {
      expect((value as string).length, `${name} should not be empty`).toBeGreaterThan(0)
    }
  })

  it('全ての値が一意（重複したアクション名はログ集計を破壊する）', () => {
    const values = Object.values(adminActions)
    const uniqueValues = new Set(values)
    expect(uniqueValues.size).toBe(values.length)
  })

  it('全ての値が小文字 + 数字 + アンダースコアのみ（DB集計のキー安定性）', () => {
    for (const [name, value] of Object.entries(adminActions)) {
      expect(value as string, `${name} should match snake_case pattern`).toMatch(/^[a-z0-9_]+$/)
    }
  })

  it('NGワード関連の定数を含む', () => {
    expect(adminActions.ACTION_CREATE_NG_WORD).toBe('create_ng_word')
    expect(adminActions.ACTION_DELETE_NG_WORD).toBe('delete_ng_word')
  })

  it('モデレーション関連の定数を含む', () => {
    expect(adminActions.ACTION_MODERATION_APPROVED).toBe('moderation_approved')
    expect(adminActions.ACTION_MODERATION_REJECTED).toBe('moderation_rejected')
    expect(adminActions.ACTION_BULK_MODERATION_APPROVED).toBe('bulk_moderation_approved')
    expect(adminActions.ACTION_BULK_MODERATION_REJECTED).toBe('bulk_moderation_rejected')
  })

  it('Bulk アクション群（4種）が揃っている', () => {
    expect(adminActions.ACTION_BULK_DELETE_POSTS).toBe('bulk_delete_posts')
    expect(adminActions.ACTION_BULK_SUSPEND_USERS).toBe('bulk_suspend_users')
  })

  it('警告関連の定数を含む', () => {
    expect(adminActions.ACTION_ISSUE_WARNING).toBe('issue_warning')
    expect(adminActions.ACTION_DEACTIVATE_WARNING).toBe('deactivate_warning')
  })

  it('お知らせ関連の定数を含む', () => {
    expect(adminActions.ACTION_CREATE_ANNOUNCEMENT).toBe('create_announcement')
    expect(adminActions.ACTION_DELETE_ANNOUNCEMENT).toBe('delete_announcement')
  })

  it('CMS 関連の定数を含む', () => {
    expect(adminActions.ACTION_UPDATE_CMS_PAGE).toBe('update_cms_page')
    expect(adminActions.ACTION_DELETE_CMS_PAGE).toBe('delete_cms_page')
  })

  it('ロール管理関連の定数を含む', () => {
    expect(adminActions.ACTION_UPDATE_ADMIN_ROLE).toBe('update_admin_role')
    expect(adminActions.ACTION_ADD_ADMIN).toBe('add_admin')
    expect(adminActions.ACTION_REMOVE_ADMIN).toBe('remove_admin')
  })

  it('農薬データ関連の定数を含む', () => {
    expect(adminActions.ACTION_CREATE_PESTICIDE).toBe('create_pesticide')
    expect(adminActions.ACTION_UPDATE_PESTICIDE).toBe('update_pesticide')
    expect(adminActions.ACTION_DELETE_PESTICIDE).toBe('delete_pesticide')
  })

  it('セキュリティイベント定数を含む', () => {
    expect(adminActions.SECURITY_EVENT_FAILED_LOGIN).toBe('failed_login')
    expect(adminActions.SECURITY_EVENT_PASSWORD_CHANGE).toBe('password_change')
    expect(adminActions.SECURITY_EVENT_2FA_TOGGLE).toBe('2fa_toggle')
    expect(adminActions.SECURITY_EVENT_EMAIL_CHANGE).toBe('email_change')
  })

  it('ACTION_* と SECURITY_EVENT_* が値空間で衝突しない', () => {
    const actionValues = Object.entries(adminActions)
      .filter(([name]) => name.startsWith('ACTION_'))
      .map(([, value]) => value as string)
    const securityValues = Object.entries(adminActions)
      .filter(([name]) => name.startsWith('SECURITY_EVENT_'))
      .map(([, value]) => value as string)

    const intersection = actionValues.filter((v) => securityValues.includes(v))
    expect(intersection).toEqual([])
  })
})
