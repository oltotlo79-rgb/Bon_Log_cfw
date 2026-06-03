import { describe, it, expect } from 'vitest'
import {
  safeJsonLdStringify,
  parseAdmissionFeeToOfferPrice,
  isSchemaOrgOpeningHours,
} from '@/components/seo/utils'

describe('safeJsonLdStringify', () => {
  it('通常のオブジェクトをJSONシリアライズする', () => {
    const data = { '@type': 'WebSite', name: 'Bonsai SNS' }
    const result = safeJsonLdStringify(data)
    // < > & がUnicodeエスケープされる
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
    expect(JSON.parse(result)).toEqual(data)
  })

  it('</script>タグをUnicodeエスケープしてXSSを防止する', () => {
    const data = { name: '</script><script>alert("xss")</script>' }
    const result = safeJsonLdStringify(data)
    // HTML特殊文字がUnicodeエスケープされていること
    expect(result).not.toContain('</script')
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
    expect(result).toContain('\\u003c')
    expect(result).toContain('\\u003e')
  })

  it('大文字小文字を問わず</Script>をエスケープする', () => {
    const data = { name: '</Script>' }
    const result = safeJsonLdStringify(data)
    // 危険な</scriptパターンが除去されていること
    expect(result).not.toMatch(/<\/script/i)
    // Unicodeエスケープされていること
    expect(result).toContain('\\u003c')
  })

  it('全て大文字の</SCRIPT>もエスケープする', () => {
    const data = { name: '</SCRIPT>' }
    const result = safeJsonLdStringify(data)
    expect(result).not.toMatch(/<\/script/i)
    expect(result).toContain('\\u003c')
  })

  it('ネストされたオブジェクト内の</script>もエスケープする', () => {
    const data = {
      '@type': 'Article',
      author: {
        name: 'Test</script><img src=x>',
      },
    }
    const result = safeJsonLdStringify(data)
    expect(result).not.toContain('</script')
    expect(result).not.toContain('<img')
    // パース可能であること（Unicodeエスケープ後も有効なJSON）
    const parsed = JSON.parse(result)
    expect(parsed.author.name).toBe('Test</script><img src=x>')
  })

  it('特殊文字を含む値を正しくシリアライズする', () => {
    const data = { description: '日本語テスト & "引用符" の <タグ>' }
    const result = safeJsonLdStringify(data)
    // &もUnicodeエスケープされる
    expect(result).toContain('\\u0026')
    expect(result).not.toContain('<タグ>')
    // パース後に元の値が復元されること
    const parsed = JSON.parse(result)
    expect(parsed.description).toBe('日本語テスト & "引用符" の <タグ>')
  })

  it('配列を含むオブジェクトを正しくシリアライズする', () => {
    const data = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { name: 'Home', position: 1 },
        { name: 'Posts', position: 2 },
      ],
    }
    const result = safeJsonLdStringify(data)
    const parsed = JSON.parse(result)
    expect(parsed.itemListElement).toHaveLength(2)
    expect(parsed.itemListElement[0].name).toBe('Home')
  })

  it('複数の</script>出現を全てエスケープする', () => {
    const data = { a: '</script>', b: '</script>' }
    const result = safeJsonLdStringify(data)
    const matches = result.match(/<\/script/gi)
    expect(matches).toBeNull()
  })
})

describe('parseAdmissionFeeToOfferPrice', () => {
  it('null / undefined / 空文字は null を返す', () => {
    expect(parseAdmissionFeeToOfferPrice(null)).toBeNull()
    expect(parseAdmissionFeeToOfferPrice(undefined)).toBeNull()
    expect(parseAdmissionFeeToOfferPrice('')).toBeNull()
    expect(parseAdmissionFeeToOfferPrice('   ')).toBeNull()
  })

  it('無料表記は "0" を返す', () => {
    expect(parseAdmissionFeeToOfferPrice('無料')).toBe('0')
    expect(parseAdmissionFeeToOfferPrice('入場無料')).toBe('0')
    expect(parseAdmissionFeeToOfferPrice('Free')).toBe('0')
    expect(parseAdmissionFeeToOfferPrice('むりょう')).toBe('0')
  })

  it('数値（カンマ区切り含む）を抽出して文字列で返す', () => {
    expect(parseAdmissionFeeToOfferPrice('1,000円')).toBe('1000')
    expect(parseAdmissionFeeToOfferPrice('前売1,000円 当日1,500円')).toBe('1000')
    expect(parseAdmissionFeeToOfferPrice('￥500')).toBe('500')
    expect(parseAdmissionFeeToOfferPrice('500円〜')).toBe('500')
  })

  it('数値を含まない自由記述は null を返す（offers を省略させる）', () => {
    expect(parseAdmissionFeeToOfferPrice('応相談')).toBeNull()
    expect(parseAdmissionFeeToOfferPrice('お問い合わせください')).toBeNull()
  })
})

describe('isSchemaOrgOpeningHours', () => {
  it('schema.org トークン形式に一致する値は true', () => {
    expect(isSchemaOrgOpeningHours('Mo-Fr 09:00-17:00')).toBe(true)
    expect(isSchemaOrgOpeningHours('Sa 10:00-15:00')).toBe(true)
    expect(isSchemaOrgOpeningHours('Mo,We,Fr 09:00-12:00')).toBe(true)
    expect(isSchemaOrgOpeningHours('Mo-Fr 09:00-12:00,13:00-17:00')).toBe(true)
    expect(isSchemaOrgOpeningHours('Mo-Fr 09:00-17:00; Sa 10:00-15:00')).toBe(true)
  })

  it('自由記述（日本語等）は false', () => {
    expect(isSchemaOrgOpeningHours('平日9:00〜18:00 土日祝休み')).toBe(false)
    expect(isSchemaOrgOpeningHours('10:00-17:00')).toBe(false) // 曜日が無い
    expect(isSchemaOrgOpeningHours('Mo-Fr')).toBe(false) // 時刻が無い
    expect(isSchemaOrgOpeningHours('年中無休')).toBe(false)
    expect(isSchemaOrgOpeningHours('')).toBe(false)
  })
})
