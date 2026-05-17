// @vitest-environment node

/**
 * UI メッセージ定数のテスト
 *
 * `lib/constants/messages.ts` は Client Component 側の toast / setError / alert 等で
 * 表示するメッセージを一元管理するファイル。
 *
 * テスト観点:
 * - 静的メッセージ: 空でない日本語文字列であること（誤って空文字をコミットしない）
 * - テンプレート関数: 引数を反映した文字列を返し、全ての分岐を踏むこと
 * - 公開 API の形状（型）が退行していないこと（関数 vs. 文字列の取り違え検知）
 */

import { describe, it, expect } from 'vitest'
import * as messages from '@/lib/constants/messages'

describe('lib/constants/messages', () => {
  describe('静的文字列メッセージ', () => {
    // 静的メッセージ = 関数ではない export。全ての静的メッセージについて、
    // 「空でない文字列」という最低限の invariant を全数検証することで、
    // 誤って空文字やundefinedをコミットする退行を防ぐ。
    const staticEntries = Object.entries(messages).filter(
      ([, value]) => typeof value === 'string',
    ) as [string, string][]

    it('静的メッセージが 1 件以上 export されている', () => {
      expect(staticEntries.length).toBeGreaterThan(0)
    })

    it.each(staticEntries)('%s は空でない文字列である', (_name, value) => {
      expect(value).toBeTypeOf('string')
      expect(value.length).toBeGreaterThan(0)
      expect(value.trim()).not.toBe('')
    })

    it('代表的な成功メッセージが日本語で定義されている', () => {
      expect(messages.MSG_POST_SUCCESS).toBe('投稿しました')
      expect(messages.MSG_LIKE_ADDED).toBe('いいねしました')
      expect(messages.MSG_LIKE_REMOVED).toBe('いいねを取り消しました')
      expect(messages.MSG_BOOKMARK_ADDED).toBe('ブックマークに追加しました')
      expect(messages.MSG_BOOKMARK_REMOVED).toBe('ブックマークを解除しました')
    })

    it('代表的な失敗メッセージが日本語で定義されている', () => {
      expect(messages.MSG_POST_FAILED).toBe('投稿に失敗しました')
      expect(messages.MSG_LIKE_FAILED).toMatch(/いいね/)
      expect(messages.MSG_BOOKMARK_FAILED).toMatch(/ブックマーク/)
      expect(messages.MSG_UPLOAD_FAILED).toBe('アップロードに失敗しました')
    })

    it('汎用エラーメッセージが定義されている', () => {
      expect(messages.MSG_ERROR_TITLE).toBe('エラー')
      expect(messages.MSG_GENERIC_ERROR).toMatch(/エラー/)
      expect(messages.MSG_NETWORK_ERROR).toMatch(/ネットワーク/)
    })
  })

  describe('テンプレート関数', () => {
    describe('MSG_POST_CHARACTER_OVERFLOW', () => {
      it('超過文字数を含む文字列を返す', () => {
        expect(messages.MSG_POST_CHARACTER_OVERFLOW(10)).toBe('文字数が10文字超過しています')
      })

      it('0 超過も文字列として返る（境界）', () => {
        expect(messages.MSG_POST_CHARACTER_OVERFLOW(0)).toBe('文字数が0文字超過しています')
      })

      it('大きな数値でも文字列化される', () => {
        expect(messages.MSG_POST_CHARACTER_OVERFLOW(99999)).toBe('文字数が99999文字超過しています')
      })
    })

    describe('MSG_BLOCK_ADDED_DESCRIPTION / MSG_BLOCK_REMOVED_DESCRIPTION', () => {
      it('ニックネームを含むメッセージを返す', () => {
        expect(messages.MSG_BLOCK_ADDED_DESCRIPTION('盆栽太郎')).toBe('盆栽太郎さんをブロックしました')
        expect(messages.MSG_BLOCK_REMOVED_DESCRIPTION('盆栽太郎')).toBe('盆栽太郎さんのブロックを解除しました')
      })

      it('空文字ニックネームも受け取る（ガードは呼び出し側の責務）', () => {
        // 定数側では入力検証を行わない。呼び出し側で validate 済み前提。
        expect(messages.MSG_BLOCK_ADDED_DESCRIPTION('')).toBe('さんをブロックしました')
      })

      it('特殊文字を含むニックネームもそのまま差し込む', () => {
        expect(messages.MSG_BLOCK_ADDED_DESCRIPTION('A&B')).toContain('A&B')
      })
    })

    describe('MSG_MUTE_REMOVED_DESCRIPTION', () => {
      it('ニックネームを含むメッセージを返す', () => {
        expect(messages.MSG_MUTE_REMOVED_DESCRIPTION('山田')).toBe('山田さんのミュートを解除しました')
      })
    })

    describe('MSG_REVIEW_IMAGE_LIMIT', () => {
      it('画像上限枚数を含むメッセージを返す', () => {
        expect(messages.MSG_REVIEW_IMAGE_LIMIT(3)).toBe('画像は3枚までです')
        expect(messages.MSG_REVIEW_IMAGE_LIMIT(10)).toBe('画像は10枚までです')
      })
    })

    describe('MSG_IMAGE_SIZE_LIMIT', () => {
      it('ファイル名なしのフォーマット', () => {
        expect(messages.MSG_IMAGE_SIZE_LIMIT(5, 7.89)).toBe('画像は5MB以下にしてください（現在: 7.9MB）')
      })

      it('ファイル名ありのフォーマット', () => {
        expect(messages.MSG_IMAGE_SIZE_LIMIT(5, 7.89, 'photo.jpg')).toBe(
          '画像は5MB以下にしてください（photo.jpg: 7.9MB）',
        )
      })

      it('name が空文字の場合はファイル名なし扱い（falsy 分岐）', () => {
        // template 関数は `name ? ... : ...` で分岐する。空文字は falsy なので
        // ファイル名なしのフォーマットが選択される。
        expect(messages.MSG_IMAGE_SIZE_LIMIT(5, 1, '')).toBe('画像は5MB以下にしてください（現在: 1.0MB）')
      })

      it('小数点以下 1 桁に丸められる（toFixed(1)）', () => {
        // JS の `Number.toFixed` は IEEE 754 の表現に依存するため、
        // 3.14159 → '3.1', 3.25 → '3.3'（切り上げ方向）で安定する値を選ぶ。
        expect(messages.MSG_IMAGE_SIZE_LIMIT(10, 3.14159)).toContain('3.1MB')
        expect(messages.MSG_IMAGE_SIZE_LIMIT(10, 3.25)).toContain('3.3MB')
      })

      it('整数の実サイズも小数点 1 桁で表示される', () => {
        expect(messages.MSG_IMAGE_SIZE_LIMIT(10, 2)).toContain('2.0MB')
      })
    })

    describe('MSG_CONTACT_MESSAGE_MIN_LENGTH', () => {
      it('最小文字数を含むメッセージを返す', () => {
        expect(messages.MSG_CONTACT_MESSAGE_MIN_LENGTH(10)).toBe('お問い合わせ内容は10文字以上で入力してください')
      })
    })

    it('テンプレート関数は全て関数型で export されている', () => {
      const templates: Array<(...args: never[]) => string> = [
        messages.MSG_POST_CHARACTER_OVERFLOW as unknown as (n: number) => string,
        messages.MSG_BLOCK_ADDED_DESCRIPTION as unknown as (n: string) => string,
        messages.MSG_BLOCK_REMOVED_DESCRIPTION as unknown as (n: string) => string,
        messages.MSG_MUTE_REMOVED_DESCRIPTION as unknown as (n: string) => string,
        messages.MSG_REVIEW_IMAGE_LIMIT as unknown as (n: number) => string,
        messages.MSG_IMAGE_SIZE_LIMIT as unknown as (a: number, b: number) => string,
        messages.MSG_CONTACT_MESSAGE_MIN_LENGTH as unknown as (n: number) => string,
      ]
      for (const fn of templates) {
        expect(typeof fn).toBe('function')
      }
    })
  })

  describe('カテゴリ別のメッセージ群', () => {
    it('認証系のメッセージが揃っている', () => {
      expect(messages.MSG_AUTH_NOT_FOUND).toMatch(/認証/)
      expect(messages.MSG_AUTH_ERROR).toMatch(/認証/)
      expect(messages.MSG_LOGIN_ERROR).toMatch(/ログイン/)
      expect(messages.MSG_2FA_AUTH_ERROR).toMatch(/認証/)
      expect(messages.MSG_LOGIN_RATE_LIMITED).toMatch(/ログイン試行/)
      expect(messages.MSG_PASSWORD_MISMATCH).toMatch(/パスワード/)
    })

    it('位置情報系のメッセージが揃っている', () => {
      expect(messages.MSG_GEO_NOT_SUPPORTED).toMatch(/位置情報/)
      expect(messages.MSG_GEO_JAPAN_REQUIRED).toMatch(/日本国内/)
      expect(messages.MSG_GEO_REGISTERED).toMatch(/位置情報/)
      expect(messages.MSG_GEO_PERMISSION_REQUIRED_TITLE).toMatch(/位置情報/)
    })

    it('プッシュ通知系のメッセージが揃っている', () => {
      expect(messages.MSG_PUSH_ENABLED).toMatch(/プッシュ通知/)
      expect(messages.MSG_PUSH_DISABLED).toMatch(/プッシュ通知/)
      expect(messages.MSG_PUSH_PERMISSION_REQUIRED_TITLE).toMatch(/通知/)
    })
  })
})
