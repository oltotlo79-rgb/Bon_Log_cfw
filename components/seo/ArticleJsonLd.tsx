import { getAppUrl } from '@/lib/env'
import { safeJsonLdStringify } from './utils'

/**
 * ArticleJsonLdコンポーネントのプロパティ定義
 */
interface ArticleJsonLdProps {
  /** 記事タイトル */
  headline: string
  /** 公開日時（ISO 8601形式） */
  datePublished: string
  /** 更新日時（ISO 8601形式、オプション） */
  dateModified?: string
  /** 著者情報 */
  author: {
    /** 著者名 */
    name: string
    /** 著者プロフィールURL（オプション） */
    url?: string
  }
  /** 記事ページのURL */
  url: string
  /** アイキャッチ画像URL（オプション） */
  image?: string
  /** 記事の説明（オプション） */
  description?: string
}

/**
 * Article構造化データコンポーネント
 *
 * 記事（投稿）情報を構造化データとして出力。
 * Googleニュースや検索結果での表示に影響する。
 *
 * @param props - 記事情報のプロパティ
 * @returns JSON-LDスクリプト要素
 *
 * @example
 * ```tsx
 * <ArticleJsonLd
 *   headline="盆栽の育て方入門"
 *   datePublished="2026-01-01T12:00:00+09:00"
 *   author={{ name: "山田太郎", url: "https://bon-log.com/users/xxx" }}
 *   url="https://bon-log.com/posts/xxx"
 *   image="https://..."
 * />
 * ```
 */
export function ArticleJsonLd({
  headline,
  datePublished,
  dateModified,
  author,
  url,
  image,
  description,
}: ArticleJsonLdProps) {
  // JSON-LDオブジェクトを構築
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',              // エンティティタイプ: 記事
    headline,
    datePublished,
    ...(dateModified && { dateModified }), // 更新日時（指定時のみ）
    // 著者情報
    author: {
      '@type': 'Person',
      name: author.name,
      ...(author.url && { url: author.url }),
    },
    url,
    ...(image && { image }),         // 画像（指定時のみ）
    ...(description && { description }),
    // 発行者（サイト）情報
    publisher: {
      '@type': 'Organization',
      name: 'BON-LOG',
      url: getAppUrl(),
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  )
}
