import { safeJsonLdStringify } from './utils'

/**
 * PersonJsonLdコンポーネントのプロパティ定義
 */
interface PersonJsonLdProps {
  /** 人物名 */
  name: string
  /** プロフィールページのURL */
  url: string
  /** プロフィール画像URL（オプション） */
  image?: string
  /** 自己紹介・説明（オプション） */
  description?: string
  /** 所属組織名（オプション） */
  worksFor?: string
  /** 居住地・所在地（オプション） */
  location?: string
}

/**
 * Person構造化データコンポーネント
 *
 * 人物（ユーザー）情報を構造化データとして出力。
 * Googleナレッジパネルやリッチリザルトでの表示に使用される可能性がある。
 *
 * @param props - 人物情報のプロパティ
 * @returns JSON-LDスクリプト要素
 *
 * @example
 * ```tsx
 * <PersonJsonLd
 *   name="山田太郎"
 *   url="https://bon-log.com/users/xxx"
 *   image="https://..."
 *   description="盆栽歴10年の愛好家です"
 *   location="東京都"
 * />
 * ```
 */
export function PersonJsonLd({
  name,
  url,
  image,
  description,
  worksFor,
  location,
}: PersonJsonLdProps) {
  // JSON-LDオブジェクトを構築
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',               // エンティティタイプ: 人物
    '@id': url,                       // 一意識別子としてURLを使用
    name,
    url,
    ...(image && { image }),         // プロフィール画像（指定時のみ）
    ...(description && { description }), // 説明（指定時のみ）
    // 所属組織（指定時のみ）
    ...(worksFor && {
      worksFor: {
        '@type': 'Organization',
        name: worksFor,
      },
    }),
    // 居住地（指定時のみ）
    ...(location && {
      homeLocation: {
        '@type': 'Place',
        name: location,
      },
    }),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  )
}
