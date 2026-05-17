import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  cuidSchema,
  emailSchema,
  fingerprintSchema,
  reasonSchema,
  paginationSchema,
  datetimeStringSchema,
  mediaTypeSchema,
  mediaTypeListSchema,
  mediaUrlListSchema,
  actionZodError,
} from '@/lib/actions/schemas/common'
import { ERR_INVALID_INPUT } from '@/lib/constants/errors'

describe('共通Zodバリデーションスキーマ', () => {
  // ============================================================
  // cuidSchema
  // ============================================================
  describe('cuidSchema', () => {
    it('有効なCUID文字列を受け入れる', () => {
      expect(cuidSchema.parse('clh1234567890abcdef')).toBe('clh1234567890abcdef')
    })

    it('1文字の文字列を受け入れる', () => {
      expect(cuidSchema.parse('a')).toBe('a')
    })

    it('30文字の文字列を受け入れる', () => {
      const str = 'a'.repeat(30)
      expect(cuidSchema.parse(str)).toBe(str)
    })

    it('空文字列を拒否する', () => {
      expect(() => cuidSchema.parse('')).toThrow()
    })

    it('31文字以上の文字列を拒否する', () => {
      expect(() => cuidSchema.parse('a'.repeat(31))).toThrow()
    })

    it('文字列以外の値を拒否する', () => {
      expect(() => cuidSchema.parse(123)).toThrow()
      expect(() => cuidSchema.parse(null)).toThrow()
      expect(() => cuidSchema.parse(undefined)).toThrow()
    })
  })

  // ============================================================
  // emailSchema
  // ============================================================
  describe('emailSchema', () => {
    it('有効なメールアドレスを受け入れる', () => {
      const result = emailSchema.parse('user@example.com')
      expect(result).toBe('user@example.com')
    })

    it('大文字を小文字に変換する', () => {
      const result = emailSchema.parse('User@Example.COM')
      expect(result).toBe('user@example.com')
    })

    it('前後に空白がある場合は不正なメールとして拒否される（trimはparse後に適用）', () => {
      // Zodのemail()バリデーションは空白を含む文字列を拒否する
      expect(() => emailSchema.parse('  user@example.com  ')).toThrow()
    })

    it('空白なしの大文字メールは小文字に変換される', () => {
      const result = emailSchema.parse('TEST@Example.COM')
      expect(result).toBe('test@example.com')
    })

    it('不正なメールアドレスを拒否する', () => {
      expect(() => emailSchema.parse('invalid')).toThrow()
      expect(() => emailSchema.parse('missing@')).toThrow()
      expect(() => emailSchema.parse('@nodomain.com')).toThrow()
    })

    it('256文字以上のメールアドレスを拒否する', () => {
      const longLocal = 'a'.repeat(250)
      expect(() => emailSchema.parse(`${longLocal}@x.com`)).toThrow()
    })

    it('空文字列を拒否する', () => {
      expect(() => emailSchema.parse('')).toThrow()
    })
  })

  // ============================================================
  // fingerprintSchema
  // ============================================================
  describe('fingerprintSchema', () => {
    it('16文字のフィンガープリントを受け入れる', () => {
      const fp = 'a'.repeat(16)
      expect(fingerprintSchema.parse(fp)).toBe(fp)
    })

    it('64文字のフィンガープリントを受け入れる', () => {
      const fp = 'b'.repeat(64)
      expect(fingerprintSchema.parse(fp)).toBe(fp)
    })

    it('32文字のフィンガープリント（一般的なハッシュ長）を受け入れる', () => {
      const fp = 'abcdef0123456789abcdef0123456789'
      expect(fingerprintSchema.parse(fp)).toBe(fp)
    })

    it('9文字以下の文字列を拒否する', () => {
      expect(() => fingerprintSchema.parse('a'.repeat(9))).toThrow()
    })

    it('65文字以上の文字列を拒否する', () => {
      expect(() => fingerprintSchema.parse('a'.repeat(65))).toThrow()
    })

    it('空文字列を拒否する', () => {
      expect(() => fingerprintSchema.parse('')).toThrow()
    })
  })

  // ============================================================
  // reasonSchema
  // ============================================================
  describe('reasonSchema', () => {
    it('有効な理由テキストを受け入れる', () => {
      expect(reasonSchema.parse('スパム行為のため')).toBe('スパム行為のため')
    })

    it('undefinedを受け入れる（optional）', () => {
      expect(reasonSchema.parse(undefined)).toBeUndefined()
    })

    it('空文字列を受け入れる', () => {
      expect(reasonSchema.parse('')).toBe('')
    })

    it('500文字ちょうどの文字列を受け入れる', () => {
      const str = 'あ'.repeat(500)
      expect(reasonSchema.parse(str)).toBe(str)
    })

    it('501文字以上の文字列を拒否する', () => {
      expect(() => reasonSchema.parse('あ'.repeat(501))).toThrow()
    })
  })

  // ============================================================
  // paginationSchema
  // ============================================================
  describe('paginationSchema', () => {
    it('cursorとlimitの両方を指定できる', () => {
      const result = paginationSchema.parse({ cursor: 'abc123', limit: 20 })
      expect(result.cursor).toBe('abc123')
      expect(result.limit).toBe(20)
    })

    it('空オブジェクトを受け入れる（両方optional）', () => {
      const result = paginationSchema.parse({})
      expect(result.cursor).toBeUndefined()
      expect(result.limit).toBeUndefined()
    })

    it('cursorのみを指定できる', () => {
      const result = paginationSchema.parse({ cursor: 'someid' })
      expect(result.cursor).toBe('someid')
      expect(result.limit).toBeUndefined()
    })

    it('limitのみを指定できる', () => {
      const result = paginationSchema.parse({ limit: 50 })
      expect(result.cursor).toBeUndefined()
      expect(result.limit).toBe(50)
    })

    it('limitの最小値1を受け入れる', () => {
      expect(paginationSchema.parse({ limit: 1 }).limit).toBe(1)
    })

    it('limitの最大値100を受け入れる', () => {
      expect(paginationSchema.parse({ limit: 100 }).limit).toBe(100)
    })

    it('limit=0を拒否する', () => {
      expect(() => paginationSchema.parse({ limit: 0 })).toThrow()
    })

    it('limit=101を拒否する', () => {
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow()
    })

    it('小数のlimitを拒否する', () => {
      expect(() => paginationSchema.parse({ limit: 1.5 })).toThrow()
    })

    it('空文字列のcursorを拒否する（cuidSchemaのmin(1)）', () => {
      expect(() => paginationSchema.parse({ cursor: '' })).toThrow()
    })
  })

  // ============================================================
  // datetimeStringSchema
  // ============================================================
  describe('datetimeStringSchema', () => {
    it('ISO 8601形式の日時文字列を受け入れる', () => {
      expect(datetimeStringSchema.parse('2024-01-15T10:30:00.000Z')).toBe('2024-01-15T10:30:00.000Z')
    })

    it('日付のみの文字列を受け入れる', () => {
      expect(datetimeStringSchema.parse('2024-01-15')).toBe('2024-01-15')
    })

    it('タイムゾーン付きの日時を受け入れる', () => {
      expect(datetimeStringSchema.parse('2024-01-15T10:30:00+09:00')).toBe('2024-01-15T10:30:00+09:00')
    })

    it('不正な日時文字列を拒否する', () => {
      expect(() => datetimeStringSchema.parse('not-a-date')).toThrow('有効な日時を指定してください')
    })

    it('空文字列を拒否する', () => {
      expect(() => datetimeStringSchema.parse('')).toThrow()
    })

    it('数値を拒否する', () => {
      expect(() => datetimeStringSchema.parse(12345)).toThrow()
    })

    it('無効な月の日付を拒否する', () => {
      // "Invalid Date" は NaN を返す
      expect(() => datetimeStringSchema.parse('2024-13-45')).toThrow()
    })
  })

  // ============================================================
  // mediaTypeSchema / mediaTypeListSchema / mediaUrlListSchema
  // ============================================================
  describe('mediaTypeSchema', () => {
    it('image / video のリテラルを受け入れる', () => {
      expect(mediaTypeSchema.parse('image')).toBe('image')
      expect(mediaTypeSchema.parse('video')).toBe('video')
    })
    it('それ以外の文字列は拒否される', () => {
      expect(() => mediaTypeSchema.parse('audio')).toThrow()
      expect(() => mediaTypeSchema.parse('')).toThrow()
    })
    it('文字列以外は拒否される', () => {
      expect(() => mediaTypeSchema.parse(1)).toThrow()
      expect(() => mediaTypeSchema.parse(null)).toThrow()
    })
  })

  describe('mediaTypeListSchema', () => {
    it('未指定（undefined）の場合は空配列にデフォルトされる', () => {
      expect(mediaTypeListSchema.parse(undefined)).toEqual([])
    })
    it('image/video の配列を受け入れる', () => {
      expect(mediaTypeListSchema.parse(['image', 'video', 'image'])).toEqual([
        'image',
        'video',
        'image',
      ])
    })
    it('不正な要素を含む配列は拒否される', () => {
      expect(() => mediaTypeListSchema.parse(['image', 'audio'])).toThrow()
    })
  })

  describe('mediaUrlListSchema', () => {
    it('未指定（undefined）の場合は空配列にデフォルトされる', () => {
      expect(mediaUrlListSchema.parse(undefined)).toEqual([])
    })
    it('文字列配列を受け入れる', () => {
      const urls = ['https://a.example/1.jpg', 'https://a.example/2.mp4']
      expect(mediaUrlListSchema.parse(urls)).toEqual(urls)
    })
    it('文字列以外を含むと拒否される', () => {
      expect(() => mediaUrlListSchema.parse(['https://x', 1])).toThrow()
    })
  })

  // ============================================================
  // actionZodError ヘルパー
  // ============================================================
  describe('actionZodError', () => {
    it('スキーマで指定したカスタムメッセージを露出する', () => {
      const schema = z.string().min(5, 'too short')
      const result = schema.safeParse('a')
      expect(result.success).toBe(false)
      // safeParse の error は ZodError なので非 success 確認後にアクセス
      const out = actionZodError((result as { success: false; error: import('zod').ZodError }).error)
      expect(out).toEqual({ success: false, error: 'too short' })
    })

    it('issues 配列が空のとき (issues[0] === undefined → ?? の右辺) ERR_INVALID_INPUT にフォールバックする', () => {
      const fakeError = { issues: [] } as unknown as import('zod').ZodError
      const out = actionZodError(fakeError)
      expect(out).toEqual({ success: false, error: ERR_INVALID_INPUT })
    })

    it('issues[0]?.message が undefined のとき ERR_INVALID_INPUT にフォールバックする', () => {
      // `?? ERR_INVALID_INPUT` は nullish coalescing。message プロパティ未定義 → undefined → 右辺へ。
      const fakeError = { issues: [{}] } as unknown as import('zod').ZodError
      const out = actionZodError(fakeError)
      expect(out).toEqual({ success: false, error: ERR_INVALID_INPUT })
    })

    it('issues[0].message が空文字のときは ?? が素通りするため空文字がそのまま返る (nullish-only 挙動の固定)', () => {
      // 仕様メモ: ?? は null/undefined のみフォールバック対象。空文字は falsy だが素通る。
      // この挙動が変わる場合はエラーメッセージ取り扱いポリシーを再検討する必要がある。
      const fakeError = {
        issues: [{ message: '' }],
      } as unknown as import('zod').ZodError
      const out = actionZodError(fakeError)
      expect(out).toEqual({ success: false, error: '' })
    })
  })
})
