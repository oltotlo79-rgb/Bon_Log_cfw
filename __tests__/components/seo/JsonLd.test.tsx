import { render } from '../../utils/test-utils'
import {
  OrganizationJsonLd,
  LocalBusinessJsonLd,
  EventJsonLd,
  ArticleJsonLd,
  BreadcrumbJsonLd,
  WebSiteJsonLd,
  DefinedTermJsonLd,
} from '@/components/seo/JsonLd'

describe('OrganizationJsonLd', () => {
  it('組織情報を含むJSON-LDを出力する', () => {
    const { container } = render(
      <OrganizationJsonLd
        name="BON-LOG"
        url="https://bon-log.com"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeInTheDocument()

    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd['@context']).toBe('https://schema.org')
    expect(jsonLd['@type']).toBe('Organization')
    expect(jsonLd.name).toBe('BON-LOG')
    expect(jsonLd.url).toBe('https://bon-log.com')
  })

  it('ロゴを含める', () => {
    const { container } = render(
      <OrganizationJsonLd
        name="BON-LOG"
        url="https://bon-log.com"
        logo="https://bon-log.com/logo.png"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.logo).toBe('https://bon-log.com/logo.png')
  })

  it('説明を含める', () => {
    const { container } = render(
      <OrganizationJsonLd
        name="BON-LOG"
        url="https://bon-log.com"
        description="盆栽愛好家のためのSNS"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.description).toBe('盆栽愛好家のためのSNS')
  })

  it('オプションフィールドがない場合は含めない', () => {
    const { container } = render(
      <OrganizationJsonLd
        name="BON-LOG"
        url="https://bon-log.com"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.logo).toBeUndefined()
    expect(jsonLd.description).toBeUndefined()
  })
})

describe('LocalBusinessJsonLd', () => {
  it('ローカルビジネス情報を含むJSON-LDを出力する', () => {
    const { container } = render(
      <LocalBusinessJsonLd
        name="○○盆栽園"
        address="東京都渋谷区1-2-3"
        url="https://bon-log.com/shops/xxx"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeInTheDocument()

    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd['@context']).toBe('https://schema.org')
    expect(jsonLd['@type']).toBe('Store')
    expect(jsonLd.name).toBe('○○盆栽園')
    expect(jsonLd.url).toBe('https://bon-log.com/shops/xxx')
  })

  it('住所を構造化形式で出力する', () => {
    const { container } = render(
      <LocalBusinessJsonLd
        name="○○盆栽園"
        address="東京都渋谷区1-2-3"
        url="https://bon-log.com/shops/xxx"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.address['@type']).toBe('PostalAddress')
    expect(jsonLd.address.streetAddress).toBe('東京都渋谷区1-2-3')
    expect(jsonLd.address.addressCountry).toBe('JP')
  })

  it('電話番号を含める', () => {
    const { container } = render(
      <LocalBusinessJsonLd
        name="○○盆栽園"
        address="東京都渋谷区1-2-3"
        url="https://bon-log.com/shops/xxx"
        telephone="03-1234-5678"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.telephone).toBe('03-1234-5678')
  })

  it('評価を含める', () => {
    const { container } = render(
      <LocalBusinessJsonLd
        name="○○盆栽園"
        address="東京都渋谷区1-2-3"
        url="https://bon-log.com/shops/xxx"
        aggregateRating={{ ratingValue: 4.5, reviewCount: 10 }}
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.aggregateRating['@type']).toBe('AggregateRating')
    expect(jsonLd.aggregateRating.ratingValue).toBe(4.5)
    expect(jsonLd.aggregateRating.reviewCount).toBe(10)
    expect(jsonLd.aggregateRating.bestRating).toBe(5)
    expect(jsonLd.aggregateRating.worstRating).toBe(1)
  })

  it('位置情報を含める', () => {
    const { container } = render(
      <LocalBusinessJsonLd
        name="○○盆栽園"
        address="東京都渋谷区1-2-3"
        url="https://bon-log.com/shops/xxx"
        geo={{ latitude: 35.6762, longitude: 139.6503 }}
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.geo['@type']).toBe('GeoCoordinates')
    expect(jsonLd.geo.latitude).toBe(35.6762)
    expect(jsonLd.geo.longitude).toBe(139.6503)
  })

  it('schema.org 形式の openingHours は含める', () => {
    const { container } = render(
      <LocalBusinessJsonLd
        name="○○盆栽園"
        address="東京都渋谷区1-2-3"
        url="https://bon-log.com/shops/xxx"
        openingHours="Mo-Fr 09:00-17:00"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.openingHours).toBe('Mo-Fr 09:00-17:00')
  })

  it('自由記述の openingHours は無効な構造化データを避けるため省略する', () => {
    const { container } = render(
      <LocalBusinessJsonLd
        name="○○盆栽園"
        address="東京都渋谷区1-2-3"
        url="https://bon-log.com/shops/xxx"
        openingHours="平日9:00〜18:00 土日祝休み"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.openingHours).toBeUndefined()
  })
})

describe('EventJsonLd', () => {
  it('イベント情報を含むJSON-LDを出力する', () => {
    const { container } = render(
      <EventJsonLd
        name="盆栽展示会2026"
        startDate="2026-04-01T10:00:00+09:00"
        url="https://bon-log.com/events/xxx"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeInTheDocument()

    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd['@context']).toBe('https://schema.org')
    expect(jsonLd['@type']).toBe('Event')
    expect(jsonLd.name).toBe('盆栽展示会2026')
    expect(jsonLd.startDate).toBe('2026-04-01T10:00:00+09:00')
  })

  it('終了日を含める', () => {
    const { container } = render(
      <EventJsonLd
        name="盆栽展示会2026"
        startDate="2026-04-01T10:00:00+09:00"
        endDate="2026-04-03T17:00:00+09:00"
        url="https://bon-log.com/events/xxx"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.endDate).toBe('2026-04-03T17:00:00+09:00')
  })

  it('開催場所を含める', () => {
    const { container } = render(
      <EventJsonLd
        name="盆栽展示会2026"
        startDate="2026-04-01T10:00:00+09:00"
        url="https://bon-log.com/events/xxx"
        location={{ name: '東京ドーム', address: '東京都文京区' }}
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.location['@type']).toBe('Place')
    expect(jsonLd.location.name).toBe('東京ドーム')
    expect(jsonLd.location.address.streetAddress).toBe('東京都文京区')
  })

  it('主催者を含める', () => {
    const { container } = render(
      <EventJsonLd
        name="盆栽展示会2026"
        startDate="2026-04-01T10:00:00+09:00"
        url="https://bon-log.com/events/xxx"
        organizer="日本盆栽協会"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.organizer['@type']).toBe('Organization')
    expect(jsonLd.organizer.name).toBe('日本盆栽協会')
  })

  it('説明を含める', () => {
    const { container } = render(
      <EventJsonLd
        name="盆栽展示会2026"
        startDate="2026-04-01T10:00:00+09:00"
        url="https://bon-log.com/events/xxx"
        description="年に一度の盆栽の祭典"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.description).toBe('年に一度の盆栽の祭典')
  })

  it('チケット情報を含める', () => {
    const { container } = render(
      <EventJsonLd
        name="盆栽展示会2026"
        startDate="2026-04-01T10:00:00+09:00"
        url="https://bon-log.com/events/xxx"
        offers={{ price: '1000', priceCurrency: 'JPY' }}
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.offers['@type']).toBe('Offer')
    expect(jsonLd.offers.price).toBe('1000')
    expect(jsonLd.offers.priceCurrency).toBe('JPY')
  })

  it('場所名のみ指定の場合は場所名を使う', () => {
    const { container } = render(
      <EventJsonLd
        name="盆栽展示会2026"
        startDate="2026-04-01T10:00:00+09:00"
        url="https://bon-log.com/events/xxx"
        location={{ name: '東京ドーム' }}
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.location.name).toBe('東京ドーム')
  })
})

describe('ArticleJsonLd', () => {
  it('記事情報を含むJSON-LDを出力する', () => {
    const { container } = render(
      <ArticleJsonLd
        headline="盆栽の育て方入門"
        datePublished="2026-01-01T12:00:00+09:00"
        author={{ name: '山田太郎' }}
        url="https://bon-log.com/posts/xxx"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeInTheDocument()

    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd['@context']).toBe('https://schema.org')
    expect(jsonLd['@type']).toBe('Article')
    expect(jsonLd.headline).toBe('盆栽の育て方入門')
    expect(jsonLd.datePublished).toBe('2026-01-01T12:00:00+09:00')
  })

  it('著者情報を構造化形式で出力する', () => {
    const { container } = render(
      <ArticleJsonLd
        headline="盆栽の育て方入門"
        datePublished="2026-01-01T12:00:00+09:00"
        author={{ name: '山田太郎', url: 'https://bon-log.com/users/xxx' }}
        url="https://bon-log.com/posts/xxx"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.author['@type']).toBe('Person')
    expect(jsonLd.author.name).toBe('山田太郎')
    expect(jsonLd.author.url).toBe('https://bon-log.com/users/xxx')
  })

  it('更新日時を含める', () => {
    const { container } = render(
      <ArticleJsonLd
        headline="盆栽の育て方入門"
        datePublished="2026-01-01T12:00:00+09:00"
        dateModified="2026-01-02T10:00:00+09:00"
        author={{ name: '山田太郎' }}
        url="https://bon-log.com/posts/xxx"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.dateModified).toBe('2026-01-02T10:00:00+09:00')
  })

  it('画像URLを含める', () => {
    const { container } = render(
      <ArticleJsonLd
        headline="盆栽の育て方入門"
        datePublished="2026-01-01T12:00:00+09:00"
        author={{ name: '山田太郎' }}
        url="https://bon-log.com/posts/xxx"
        image="https://bon-log.com/images/xxx.jpg"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.image).toBe('https://bon-log.com/images/xxx.jpg')
  })

  it('説明を含める', () => {
    const { container } = render(
      <ArticleJsonLd
        headline="盆栽の育て方入門"
        datePublished="2026-01-01T12:00:00+09:00"
        author={{ name: '山田太郎' }}
        url="https://bon-log.com/posts/xxx"
        description="初心者向けの盆栽ガイド"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.description).toBe('初心者向けの盆栽ガイド')
  })

  it('発行者情報を含める', () => {
    const { container } = render(
      <ArticleJsonLd
        headline="盆栽の育て方入門"
        datePublished="2026-01-01T12:00:00+09:00"
        author={{ name: '山田太郎' }}
        url="https://bon-log.com/posts/xxx"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.publisher['@type']).toBe('Organization')
    expect(jsonLd.publisher.name).toBe('BON-LOG')
  })
})

describe('BreadcrumbJsonLd', () => {
  it('パンくずリストを含むJSON-LDを出力する', () => {
    const { container } = render(
      <BreadcrumbJsonLd
        items={[
          { name: 'ホーム', url: 'https://bon-log.com' },
          { name: '盆栽園', url: 'https://bon-log.com/shops' },
        ]}
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeInTheDocument()

    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd['@context']).toBe('https://schema.org')
    expect(jsonLd['@type']).toBe('BreadcrumbList')
  })

  it('パンくずアイテムをListItem形式で出力する', () => {
    const { container } = render(
      <BreadcrumbJsonLd
        items={[
          { name: 'ホーム', url: 'https://bon-log.com' },
          { name: '盆栽園', url: 'https://bon-log.com/shops' },
          { name: '○○盆栽園', url: 'https://bon-log.com/shops/xxx' },
        ]}
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')

    expect(jsonLd.itemListElement).toHaveLength(3)

    expect(jsonLd.itemListElement[0]['@type']).toBe('ListItem')
    expect(jsonLd.itemListElement[0].position).toBe(1)
    expect(jsonLd.itemListElement[0].name).toBe('ホーム')
    expect(jsonLd.itemListElement[0].item).toBe('https://bon-log.com')

    expect(jsonLd.itemListElement[1].position).toBe(2)
    expect(jsonLd.itemListElement[1].name).toBe('盆栽園')

    expect(jsonLd.itemListElement[2].position).toBe(3)
    expect(jsonLd.itemListElement[2].name).toBe('○○盆栽園')
  })
})

describe('WebSiteJsonLd', () => {
  it('ウェブサイト情報を含むJSON-LDを出力する', () => {
    const { container } = render(
      <WebSiteJsonLd
        name="BON-LOG"
        url="https://bon-log.com"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeInTheDocument()

    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd['@context']).toBe('https://schema.org')
    expect(jsonLd['@type']).toBe('WebSite')
    expect(jsonLd.name).toBe('BON-LOG')
    expect(jsonLd.url).toBe('https://bon-log.com')
  })

  it('説明を含める', () => {
    const { container } = render(
      <WebSiteJsonLd
        name="BON-LOG"
        url="https://bon-log.com"
        description="盆栽愛好家のためのSNS"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.description).toBe('盆栽愛好家のためのSNS')
  })

  it('サイト内検索を含める', () => {
    const { container } = render(
      <WebSiteJsonLd
        name="BON-LOG"
        url="https://bon-log.com"
        searchUrl="https://bon-log.com/search"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.potentialAction['@type']).toBe('SearchAction')
    expect(jsonLd.potentialAction.target['@type']).toBe('EntryPoint')
    expect(jsonLd.potentialAction.target.urlTemplate).toBe('https://bon-log.com/search?q={search_term_string}')
    expect(jsonLd.potentialAction['query-input']).toBe('required name=search_term_string')
  })

  it('オプションフィールドがない場合は含めない', () => {
    const { container } = render(
      <WebSiteJsonLd
        name="BON-LOG"
        url="https://bon-log.com"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.description).toBeUndefined()
    expect(jsonLd.potentialAction).toBeUndefined()
  })
})

describe('DefinedTermJsonLd', () => {
  it('用語定義のJSON-LDを出力する', () => {
    const { container } = render(
      <DefinedTermJsonLd
        name="取り木"
        description="枝の途中から根を出させて独立した樹にする技法"
        category="技術・作業"
        url="https://bon-log.com/dictionary/toriki"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeInTheDocument()

    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd['@context']).toBe('https://schema.org')
    expect(jsonLd['@type']).toBe('DefinedTerm')
    expect(jsonLd.name).toBe('取り木')
    expect(jsonLd.description).toContain('枝の途中から')
    expect(jsonLd.url).toBe('https://bon-log.com/dictionary/toriki')
  })

  it('inDefinedTermSetを含む', () => {
    const { container } = render(
      <DefinedTermJsonLd
        name="盆栽"
        description="鉢植えで樹木を育て観賞する芸術"
        category="展示・鑑賞"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.inDefinedTermSet).toBeDefined()
    expect(jsonLd.inDefinedTermSet['@type']).toBe('DefinedTermSet')
    expect(jsonLd.inDefinedTermSet.name).toBe('盆栽用語辞典')
    expect(jsonLd.inDefinedTermSet.description).toContain('展示・鑑賞')
  })

  it('カテゴリなしでも動作する', () => {
    const { container } = render(
      <DefinedTermJsonLd
        name="素材"
        description="盆栽の原材料となる苗木"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const jsonLd = JSON.parse(script?.textContent || '{}')
    expect(jsonLd.name).toBe('素材')
    expect(jsonLd.url).toBeUndefined()
    expect(jsonLd.inDefinedTermSet.description).toBeUndefined()
  })

  it('</script>をエスケープする（XSS対策）', () => {
    const { container } = render(
      <DefinedTermJsonLd
        name="テスト</script><script>alert(1)</script>"
        description="テスト説明"
      />
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script?.textContent).not.toContain('</script>')
  })
})
