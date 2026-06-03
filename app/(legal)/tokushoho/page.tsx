/**
 * このページは日本の特定商取引法（特商法）に基づいて、
 * 有料サービスを提供する事業者として必要な情報を表示します。
 *
 * 主な表示項目:
 * - 販売業者名
 * - 運営統括責任者
 * - 所在地・連絡先
 * - 販売価格
 * - 支払方法・支払時期
 * - サービス提供時期
 * - 契約期間
 * - 解約・返金ポリシー
 *
 * 特商法第11条に基づく表示義務を満たすためのページです。
 */

// Next.jsのメタデータ型定義（SEO対策用）
import { Metadata } from 'next'
// Next.jsのクライアントサイドナビゲーション用Linkコンポーネント
import Link from 'next/link'
import { PREMIUM_PRICE_MONTHLY_JPY, PREMIUM_PRICE_YEARLY_JPY } from '@/lib/constants/limits'
import { ROUTE_SETTINGS_SUBSCRIPTION, ROUTE_TOKUSHOHO } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

/**
 * SEO最適化のためのtitleとdescriptionを設定
 */
export const metadata: Metadata = {
  title: '特定商取引法に基づく表記',
  description: 'BON-LOG（ボンログ）の特定商取引法に基づく表記です。',
  alternates: { canonical: pageCanonical(ROUTE_TOKUSHOHO) },
}

/**
 * 特定商取引法に基づく表記ページコンポーネント
 *
 * テーブル形式で特商法に必要な事項を表示します。
 * 法律で定められた必須項目を漏れなく記載しています。
 *
 * @returns 特定商取引法に基づく表記のテーブルを含むページ要素
 */
export default function TokushohoPage() {
  return (
    // proseクラス: 長文テキストに適したタイポグラフィを適用
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>特定商取引法に基づく表記</h1>

      <table className="w-full">
        <tbody>
          <tr>
            <th className="text-left py-3 pr-4 border-b w-1/3">販売業者</th>
            <td className="py-3 border-b">BON-LOG運営</td>
          </tr>

          <tr>
            <th className="text-left py-3 pr-4 border-b">運営統括責任者</th>
            <td className="py-3 border-b">野村侑矢</td>
          </tr>

          <tr>
            <th className="text-left py-3 pr-4 border-b">所在地</th>
            <td className="py-3 border-b">請求があった場合に遅滞なく開示いたします</td>
          </tr>

          <tr>
            <th className="text-left py-3 pr-4 border-b">電話番号</th>
            <td className="py-3 border-b">請求があった場合に遅滞なく開示いたします</td>
          </tr>

          <tr>
            <th className="text-left py-3 pr-4 border-b">メールアドレス</th>
            <td className="py-3 border-b">
              <a href="mailto:bon.log2026@gmail.com" className="text-primary hover:underline">
                bon.log2026@gmail.com
              </a>
            </td>
          </tr>

          <tr>
            <th className="text-left py-3 pr-4 border-b">販売価格</th>
            <td className="py-3 border-b">
              <ul className="list-disc list-inside m-0">
                <li>月額プラン: {PREMIUM_PRICE_MONTHLY_JPY}円（税込）</li>
                <li>年額プラン: {PREMIUM_PRICE_YEARLY_JPY.toLocaleString()}円（税込）</li>
              </ul>
            </td>
          </tr>

          <tr>
            <th className="text-left py-3 pr-4 border-b">販売価格以外の必要料金</th>
            <td className="py-3 border-b">なし</td>
          </tr>

          <tr>
            <th className="text-left py-3 pr-4 border-b">支払方法</th>
            <td className="py-3 border-b">クレジットカード（Stripe決済）</td>
          </tr>

          <tr>
            <th className="text-left py-3 pr-4 border-b">支払時期</th>
            <td className="py-3 border-b">
              お申し込み時に即時決済<br />
              自動更新の場合は、更新日に自動決済
            </td>
          </tr>

          <tr>
            <th className="text-left py-3 pr-4 border-b">サービス提供時期</th>
            <td className="py-3 border-b">決済完了後、即時ご利用いただけます</td>
          </tr>

          <tr>
            <th className="text-left py-3 pr-4 border-b">契約期間</th>
            <td className="py-3 border-b">
              <ul className="list-disc list-inside m-0">
                <li>月額プラン: 1ヶ月（自動更新）</li>
                <li>年額プラン: 1年（自動更新）</li>
              </ul>
            </td>
          </tr>

          <tr>
            <th className="text-left py-3 pr-4 border-b">解約・キャンセル</th>
            <td className="py-3 border-b">
              <Link href={ROUTE_SETTINGS_SUBSCRIPTION} className="text-primary hover:underline">設定ページ</Link>からいつでも解約可能です。<br />
              解約後も契約期間終了までサービスをご利用いただけます。<br />
              契約期間途中での解約による日割り返金はいたしません。
            </td>
          </tr>

          <tr>
            <th className="text-left py-3 pr-4 border-b">返金ポリシー</th>
            <td className="py-3 border-b">
              デジタルサービスの性質上、原則として返金はいたしません。<br />
              ただし、当方の責に帰すべき事由によりサービスが提供できなかった場合は、この限りではありません。
            </td>
          </tr>

          <tr>
            <th className="text-left py-3 pr-4">動作環境</th>
            <td className="py-3">
              インターネット接続環境<br />
              最新版のChrome、Firefox、Safari、Edgeを推奨
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground m-0">
          ご不明な点がございましたら、上記メールアドレスまでお問い合わせください。
        </p>
      </div>
    </div>
  )
}
