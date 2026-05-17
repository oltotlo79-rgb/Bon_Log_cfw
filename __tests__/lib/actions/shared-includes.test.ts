// @vitest-environment node

/**
 * lib/actions/shared-includes.ts の直接テスト
 *
 * `as const` の安定性とフィールド集合に対する回帰テスト。
 * これらの定数は Prisma include / select として複数の Server Action で
 * 共有されるため、不用意なフィールド追加・削除を検知する。
 *
 * 機密情報（email / password / isSuspended など）を誤って公開設定に
 * 加えないことも、ホワイトリスト的に検証する。
 */

import { describe, it, expect } from 'vitest'
import {
  USER_MINIMAL_SELECT,
  USER_MINIMAL_RELATION,
  GENRE_MINIMAL_SELECT,
  POST_GENRE_RELATION,
} from '@/lib/prisma/shared-includes'

describe('USER_MINIMAL_SELECT', () => {
  it('id / nickname / avatarUrl のみを true にする', () => {
    expect(USER_MINIMAL_SELECT).toEqual({
      id: true,
      nickname: true,
      avatarUrl: true,
    })
  })

  it('機密フィールドを含まない（ホワイトリスト確認）', () => {
    const select = USER_MINIMAL_SELECT as Record<string, unknown>
    expect(select.email).toBeUndefined()
    expect(select.password).toBeUndefined()
    expect(select.isSuspended).toBeUndefined()
    expect(select.passwordResetToken).toBeUndefined()
    expect(select.twoFactorSecret).toBeUndefined()
    expect(select.fingerprint).toBeUndefined()
  })

  it('全フィールドが true（false / null は許可しない）', () => {
    for (const value of Object.values(USER_MINIMAL_SELECT)) {
      expect(value).toBe(true)
    }
  })
})

describe('USER_MINIMAL_RELATION', () => {
  it('USER_MINIMAL_SELECT を select でラップする', () => {
    expect(USER_MINIMAL_RELATION).toEqual({ select: USER_MINIMAL_SELECT })
  })

  it('select 以外のキー（include / where / orderBy）を持たない', () => {
    expect(Object.keys(USER_MINIMAL_RELATION)).toEqual(['select'])
  })
})

describe('GENRE_MINIMAL_SELECT', () => {
  it('id / name / category のみを true にする', () => {
    expect(GENRE_MINIMAL_SELECT).toEqual({
      id: true,
      name: true,
      category: true,
    })
  })

  it('sortOrder などは含まない（必要ない場面で読まないため）', () => {
    const select = GENRE_MINIMAL_SELECT as Record<string, unknown>
    expect(select.sortOrder).toBeUndefined()
    expect(select.description).toBeUndefined()
  })
})

describe('POST_GENRE_RELATION', () => {
  it('genre リレーション越しに GENRE_MINIMAL_SELECT を引く構造', () => {
    expect(POST_GENRE_RELATION).toEqual({
      select: {
        genre: { select: GENRE_MINIMAL_SELECT },
      },
    })
  })

  it('PostGenre 中間テーブルのフィールド（postId など）は select しない', () => {
    const select = (POST_GENRE_RELATION.select as Record<string, unknown>)
    expect(select.postId).toBeUndefined()
    expect(select.genreId).toBeUndefined()
  })

  it('ネスト先の genre.select には id / name / category のみ含む', () => {
    const inner = (POST_GENRE_RELATION.select.genre.select as Record<string, unknown>)
    expect(Object.keys(inner).sort()).toEqual(['category', 'id', 'name'])
  })
})

describe('immutability (as const)', () => {
  it('USER_MINIMAL_SELECT は同一参照（モジュール定数）', () => {
    const ref1 = USER_MINIMAL_SELECT
    const ref2 = USER_MINIMAL_SELECT
    expect(ref1).toBe(ref2)
  })

  it('USER_MINIMAL_RELATION.select は USER_MINIMAL_SELECT と同一参照', () => {
    expect(USER_MINIMAL_RELATION.select).toBe(USER_MINIMAL_SELECT)
  })
})
