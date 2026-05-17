/**
 * パスワードバリデーションのテスト
 */

import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_ERRORS,
  passwordSchema,
  validatePassword,
  isValidPassword,
} from '@/lib/validations/password'

describe('password validation', () => {
  // ============================================================
  // 定数のテスト
  // ============================================================

  describe('定数', () => {
    it('PASSWORD_MIN_LENGTHは8', () => {
      expect(PASSWORD_MIN_LENGTH).toBe(8)
    })

    it('PASSWORD_ERRORSが定義されている', () => {
      expect(PASSWORD_ERRORS.MIN_LENGTH).toContain('8文字以上')
      expect(PASSWORD_ERRORS.REQUIRE_LETTER).toContain('アルファベット')
      expect(PASSWORD_ERRORS.REQUIRE_NUMBER).toContain('数字')
      expect(PASSWORD_ERRORS.REQUIRE_BOTH).toContain('両方')
    })
  })

  // ============================================================
  // passwordSchema
  // ============================================================

  describe('passwordSchema', () => {
    it('有効なパスワードを受け入れる', () => {
      const result = passwordSchema.safeParse('Password123')
      expect(result.success).toBe(true)
    })

    it('8文字未満のパスワードを拒否する', () => {
      const result = passwordSchema.safeParse('Pass1')
      expect(result.success).toBe(false)
    })

    it('アルファベットのないパスワードを拒否する', () => {
      const result = passwordSchema.safeParse('12345678')
      expect(result.success).toBe(false)
    })

    it('数字のないパスワードを拒否する', () => {
      const result = passwordSchema.safeParse('Password')
      expect(result.success).toBe(false)
    })

    it('ちょうど8文字の有効なパスワードを受け入れる', () => {
      const result = passwordSchema.safeParse('Abcdefg1')
      expect(result.success).toBe(true)
    })

    it('大文字のみでも数字があれば受け入れる', () => {
      const result = passwordSchema.safeParse('ABCDEFGH1')
      expect(result.success).toBe(true)
    })

    it('小文字のみでも数字があれば受け入れる', () => {
      const result = passwordSchema.safeParse('abcdefgh1')
      expect(result.success).toBe(true)
    })

    it('特殊文字を含むパスワードを受け入れる', () => {
      const result = passwordSchema.safeParse('Pass@word1!')
      expect(result.success).toBe(true)
    })
  })

  // ============================================================
  // validatePassword
  // ============================================================

  describe('validatePassword', () => {
    describe('有効なパスワード', () => {
      it('アルファベットと数字を含む8文字以上のパスワードは有効', () => {
        const result = validatePassword('Password123')
        expect(result.valid).toBe(true)
      })

      it('ちょうど8文字の有効なパスワードは有効', () => {
        const result = validatePassword('Abcdefg1')
        expect(result.valid).toBe(true)
      })

      it('長いパスワードでも有効', () => {
        const result = validatePassword('ThisIsAVeryLongPassword123')
        expect(result.valid).toBe(true)
      })

      it('特殊文字を含むパスワードも有効', () => {
        const result = validatePassword('Pass@word1!')
        expect(result.valid).toBe(true)
      })

      it('日本語を含むパスワードでも条件を満たせば有効', () => {
        // 日本語4文字 + A1 = 6文字(UTF-16)だが、length的には十分
        const result = validatePassword('パスワードAbc1')
        expect(result.valid).toBe(true)
      })
    })

    describe('無効なパスワード - 長さ不足', () => {
      it('7文字のパスワードは無効', () => {
        const result = validatePassword('Pass12')
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.error).toBe(PASSWORD_ERRORS.MIN_LENGTH)
        }
      })

      it('空のパスワードは無効', () => {
        const result = validatePassword('')
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.error).toBe(PASSWORD_ERRORS.MIN_LENGTH)
        }
      })

      it('1文字のパスワードは無効', () => {
        const result = validatePassword('A')
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.error).toBe(PASSWORD_ERRORS.MIN_LENGTH)
        }
      })
    })

    describe('無効なパスワード - アルファベットなし', () => {
      it('数字のみのパスワードは無効', () => {
        const result = validatePassword('12345678')
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.error).toBe(PASSWORD_ERRORS.REQUIRE_LETTER)
        }
      })

      it('数字と特殊文字のみのパスワードは無効', () => {
        const result = validatePassword('12345678!')
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.error).toBe(PASSWORD_ERRORS.REQUIRE_LETTER)
        }
      })
    })

    describe('無効なパスワード - 数字なし', () => {
      it('アルファベットのみのパスワードは無効', () => {
        const result = validatePassword('Password')
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.error).toBe(PASSWORD_ERRORS.REQUIRE_NUMBER)
        }
      })

      it('アルファベットと特殊文字のみのパスワードは無効', () => {
        const result = validatePassword('Password!')
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.error).toBe(PASSWORD_ERRORS.REQUIRE_NUMBER)
        }
      })
    })

    describe('無効なパスワード - 両方なし', () => {
      it('特殊文字のみのパスワードは無効', () => {
        const result = validatePassword('!@#$%^&*()')
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.error).toBe(PASSWORD_ERRORS.REQUIRE_BOTH)
        }
      })

      it('スペースのみのパスワードは無効', () => {
        const result = validatePassword('        ')
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.error).toBe(PASSWORD_ERRORS.REQUIRE_BOTH)
        }
      })

      it('日本語のみのパスワードは無効', () => {
        // 8文字以上の日本語のみ
        const result = validatePassword('パスワード入力確認中')
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.error).toBe(PASSWORD_ERRORS.REQUIRE_BOTH)
        }
      })
    })
  })

  // ============================================================
  // isValidPassword
  // ============================================================

  describe('isValidPassword', () => {
    it('有効なパスワードでtrueを返す', () => {
      expect(isValidPassword('Password123')).toBe(true)
    })

    it('無効なパスワードでfalseを返す', () => {
      expect(isValidPassword('pass')).toBe(false)
    })

    it('アルファベットのないパスワードでfalseを返す', () => {
      expect(isValidPassword('12345678')).toBe(false)
    })

    it('数字のないパスワードでfalseを返す', () => {
      expect(isValidPassword('Password')).toBe(false)
    })

    it('空のパスワードでfalseを返す', () => {
      expect(isValidPassword('')).toBe(false)
    })
  })

  // ============================================================
  // エッジケース
  // ============================================================

  describe('エッジケース', () => {
    it('境界値: ちょうど8文字で有効', () => {
      expect(isValidPassword('Abcdefg1')).toBe(true)
    })

    it('境界値: 7文字で無効', () => {
      expect(isValidPassword('Abcdef1')).toBe(false)
    })

    it('数字が先頭にあるパスワードは有効', () => {
      expect(isValidPassword('1Password')).toBe(true)
    })

    it('数字が末尾にあるパスワードは有効', () => {
      expect(isValidPassword('Password1')).toBe(true)
    })

    it('大文字小文字混在のパスワードは有効', () => {
      expect(isValidPassword('PassWord123')).toBe(true)
    })

    it('Unicode文字を含むが条件を満たせば有効', () => {
      expect(isValidPassword('テストAbc123')).toBe(true)
    })
  })
})
