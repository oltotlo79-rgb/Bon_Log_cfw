/**
 * @file app/(legal)/accessibility/page.tsx
 * @description BON-LOG アクセシビリティ声明ページ
 *
 * WCAG 2.1 準拠状況と、アクセシビリティ向上のための取り組みを記載。
 * Google AdSense審査においてもサイトの信頼性向上に寄与する。
 */

import { Metadata } from 'next'
import Link from 'next/link'
import { ROUTE_ACCESSIBILITY, ROUTE_CONTACT } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: 'アクセシビリティについて - BON-LOG',
  description: 'BON-LOGのアクセシビリティへの取り組みとWCAG準拠状況について',
  alternates: { canonical: pageCanonical(ROUTE_ACCESSIBILITY) },
}

export default function AccessibilityPage() {
  return (
    <article className="prose prose-sm sm:prose max-w-none">
      <h1>アクセシビリティについて</h1>
      <p className="text-sm text-muted-foreground">最終更新日: 2026年4月14日</p>

      <h2>基本方針</h2>
      <p>
        BON-LOG（以下「当サービス」）は、年齢、障がいの有無、使用デバイスに関わらず、
        すべての方が快適に盆栽コミュニティを楽しめることを目指しています。
        Web Content Accessibility Guidelines (WCAG) 2.1 の適合レベルAAを目標に、
        継続的なアクセシビリティの改善に取り組んでいます。
      </p>

      <h2>現在の取り組み</h2>

      <h3>キーボード操作</h3>
      <ul>
        <li>すべてのインタラクティブ要素（ボタン、リンク、フォーム）はキーボードで操作可能です</li>
        <li>スキップリンクを実装し、キーボードユーザーが繰り返しのナビゲーションを飛ばしてメインコンテンツに直接アクセスできます</li>
        <li>フォーカス状態が視覚的に明確に表示されます</li>
      </ul>

      <h3>スクリーンリーダー対応</h3>
      <ul>
        <li>セマンティックなHTML要素（header, nav, main, article, footer）を使用しています</li>
        <li>画像には代替テキスト（alt属性）を設定しています</li>
        <li>フォームの入力欄にはラベルを紐付けています</li>
        <li>アイコンのみのボタンにはアクセシブルな名前を付与しています</li>
      </ul>

      <h3>視覚的配慮</h3>
      <ul>
        <li>テキストと背景のコントラスト比を確保しています</li>
        <li>ダークモードに対応し、ユーザーの好みの表示設定で利用できます</li>
        <li>フォントサイズはブラウザの設定に応じて拡大縮小可能です</li>
        <li>色のみに依存しない情報伝達を心がけています</li>
      </ul>

      <h3>レスポンシブデザイン</h3>
      <ul>
        <li>スマートフォン、タブレット、デスクトップのすべてに対応しています</li>
        <li>画面の向き（縦横）の切り替えに対応しています</li>
        <li>タッチ操作とマウス操作の両方に対応しています</li>
      </ul>

      <h3>コンテンツの配慮</h3>
      <ul>
        <li>ページの言語（日本語）を明示しています</li>
        <li>見出しの階層構造を適切に使用しています</li>
        <li>リンクテキストは遷移先がわかる表現を使用しています</li>
        <li>エラーメッセージは具体的な内容と対処法を示しています</li>
      </ul>

      <h2>既知の課題</h2>
      <p>以下の項目については、改善に取り組んでいます。</p>
      <ul>
        <li>一部のユーザー投稿画像に適切な代替テキストが設定されていない場合があります</li>
        <li>地図機能（盆栽園マップ）のキーボード操作対応を改善中です</li>
      </ul>

      <h2>フィードバック</h2>
      <p>
        アクセシビリティに関するご意見・ご要望がございましたら、
        <Link href={ROUTE_CONTACT} className="underline hover:text-foreground">お問い合わせページ</Link>
        よりお気軽にご連絡ください。いただいたフィードバックは、
        サービスの改善に活用させていただきます。
      </p>

      <h2>準拠基準</h2>
      <p>当サービスは以下の基準を参考にアクセシビリティの向上に努めています。</p>
      <ul>
        <li>Web Content Accessibility Guidelines (WCAG) 2.1 適合レベル AA</li>
        <li>JIS X 8341-3:2016（日本工業規格 高齢者・障害者等配慮設計指針）</li>
      </ul>
    </article>
  )
}
