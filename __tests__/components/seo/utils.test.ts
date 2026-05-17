import { describe, it, expect } from 'vitest'
import { safeJsonLdStringify } from '@/components/seo/utils'

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
