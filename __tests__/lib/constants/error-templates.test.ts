// @vitest-environment node
/**
 * エラーメッセージテンプレート関数のテスト
 *
 * lib/constants/errors.ts のテンプレート関数（引数を受け取ってフォーマットされた
 * エラーメッセージを返す関数）を検証する。
 */

import { describe, it, expect } from 'vitest'
import {
  ERR_MESSAGE_TOO_LONG,
  ERR_NG_WORD_TOO_LONG,
  ERR_NG_WORD_REGEX_TOO_LONG,
  ERR_CONTENT_TOO_LONG,
  ERR_POST_CONTENT_TOO_LONG,
  ERR_COMMENT_CONTENT_TOO_LONG,
  ERR_DAILY_POST_LIMIT,
  ERR_DAILY_COMMENT_LIMIT,
  ERR_DAILY_UPLOAD_LIMIT,
} from '@/lib/constants/errors'

describe('エラーメッセージテンプレート関数', () => {
  describe('文字数超過エラー', () => {
    it('ERR_MESSAGE_TOO_LONG は文字数上限を含む文字列を返す', () => {
      expect(ERR_MESSAGE_TOO_LONG(1000)).toBe('メッセージは1000文字以内で入力してください')
      expect(ERR_MESSAGE_TOO_LONG(500)).toBe('メッセージは500文字以内で入力してください')
    })

    it('ERR_CONTENT_TOO_LONG は汎用の文字数超過メッセージを返す', () => {
      expect(ERR_CONTENT_TOO_LONG(2000)).toBe('2000文字以内で入力してください')
    })

    it('ERR_POST_CONTENT_TOO_LONG は投稿用の文字数超過メッセージを返す', () => {
      expect(ERR_POST_CONTENT_TOO_LONG(500)).toBe('投稿は500文字以内で入力してください')
    })

    it('ERR_COMMENT_CONTENT_TOO_LONG はコメント用の文字数超過メッセージを返す', () => {
      expect(ERR_COMMENT_CONTENT_TOO_LONG(300)).toBe('コメントは300文字以内で入力してください')
    })
  })

  describe('NGワード関連エラー', () => {
    it('ERR_NG_WORD_TOO_LONG はNGワード文字数上限を含む文字列を返す', () => {
      expect(ERR_NG_WORD_TOO_LONG(255)).toBe('NGワードは255文字以内で入力してください')
    })

    it('ERR_NG_WORD_REGEX_TOO_LONG は正規表現文字数上限を含む文字列を返す', () => {
      expect(ERR_NG_WORD_REGEX_TOO_LONG(200)).toBe('正規表現は200文字以内で入力してください')
    })
  })

  describe('日次制限エラー', () => {
    it('ERR_DAILY_POST_LIMIT は投稿上限数を含む文字列を返す', () => {
      expect(ERR_DAILY_POST_LIMIT(20)).toBe('1日の投稿上限（20件）に達しました')
      expect(ERR_DAILY_POST_LIMIT(50)).toBe('1日の投稿上限（50件）に達しました')
    })

    it('ERR_DAILY_COMMENT_LIMIT はコメント上限数を含む文字列を返す', () => {
      expect(ERR_DAILY_COMMENT_LIMIT(100)).toBe('1日のコメント上限（100件）に達しました')
    })

    it('ERR_DAILY_UPLOAD_LIMIT はアップロード上限回数を含む文字列を返す', () => {
      expect(ERR_DAILY_UPLOAD_LIMIT(10)).toBe('1日のアップロード上限（10回）に達しました')
    })
  })
})
