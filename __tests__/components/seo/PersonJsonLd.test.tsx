import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PersonJsonLd } from '@/components/seo/PersonJsonLd'

describe('PersonJsonLd', () => {
  it('必須プロパティのみで構造化データを出力する', () => {
    const { container } = render(
      <PersonJsonLd name="山田太郎" url="https://bon-log.com/users/xxx" />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()
    const data = JSON.parse(script!.textContent!)
    expect(data['@type']).toBe('Person')
    expect(data.name).toBe('山田太郎')
    expect(data.url).toBe('https://bon-log.com/users/xxx')
    expect(data.image).toBeUndefined()
    expect(data.description).toBeUndefined()
    expect(data.worksFor).toBeUndefined()
    expect(data.homeLocation).toBeUndefined()
  })

  it('全オプションプロパティ付きで出力する', () => {
    const { container } = render(
      <PersonJsonLd
        name="山田太郎"
        url="https://bon-log.com/users/xxx"
        image="https://example.com/avatar.jpg"
        description="盆栽歴10年"
        worksFor="盆栽園"
        location="東京都"
      />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.textContent!)
    expect(data.image).toBe('https://example.com/avatar.jpg')
    expect(data.description).toBe('盆栽歴10年')
    expect(data.worksFor).toEqual({ '@type': 'Organization', name: '盆栽園' })
    expect(data.homeLocation).toEqual({ '@type': 'Place', name: '東京都' })
  })

  it('image のみ指定した場合', () => {
    const { container } = render(
      <PersonJsonLd name="テスト" url="https://test.com" image="https://test.com/img.jpg" />
    )
    const data = JSON.parse(container.querySelector('script')!.textContent!)
    expect(data.image).toBe('https://test.com/img.jpg')
    expect(data.worksFor).toBeUndefined()
  })

  it('worksFor のみ指定した場合', () => {
    const { container } = render(
      <PersonJsonLd name="テスト" url="https://test.com" worksFor="テスト組織" />
    )
    const data = JSON.parse(container.querySelector('script')!.textContent!)
    expect(data.worksFor).toEqual({ '@type': 'Organization', name: 'テスト組織' })
    expect(data.image).toBeUndefined()
  })
})
