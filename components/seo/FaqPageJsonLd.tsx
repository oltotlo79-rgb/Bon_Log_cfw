import { safeJsonLdStringify } from './utils'

interface FaqPageJsonLdProps {
  /** FAQ 一覧。各要素は質問とその回答からなる。 */
  faqs: ReadonlyArray<{ question: string; answer: string }>
}

/**
 * FAQPage 構造化データを出力する。
 *
 * Why FAQPage: Google の検索結果リッチリザルトに FAQ ブロックとして展開され得る。
 * 1 ページ内の FAQ 全件を `mainEntity` に列挙する仕様 (schema.org/FAQPage)。
 */
export function FaqPageJsonLd({ faqs }: FaqPageJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  )
}
