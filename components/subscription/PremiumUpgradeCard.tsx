/**
 * @file PremiumUpgradeCard.tsx
 * @description プレミアム会員へのアップグレードを促すカードコンポーネント
 *
 * このコンポーネントは、無料会員ユーザーに対してプレミアム会員の特典を
 * 視覚的に訴求し、登録ページへの導線を提供します。
 *
 * @features
 * - プレミアム会員の特典リスト表示
 * - カスタマイズ可能なタイトルと説明文
 * - 登録ページへのリンクボタン
 * - グラデーション背景による視覚的な強調
 *
 * @usage
 * ```tsx
 * // 基本的な使用例
 * <PremiumUpgradeCard />
 *
 * // カスタムタイトルと説明文を使用
 * <PremiumUpgradeCard
 *   title="この機能はプレミアム限定です"
 *   description="今すぐアップグレードして全機能を解放しましょう"
 * />
 *
 * // 機能リストを非表示にする
 * <PremiumUpgradeCard showFeatures={false} />
 * ```
 */

'use client'

// Next.jsのLinkコンポーネント: クライアントサイドナビゲーションを実現
import Link from 'next/link'
import { ROUTE_SETTINGS_SUBSCRIPTION } from '@/lib/constants/routes'

// shadcn/uiのButtonコンポーネント: スタイル付きボタン
import { Button } from '@/components/ui/button'

// shadcn/uiのCardコンポーネント群: カードレイアウト用
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// lucide-reactのアイコン
// Crown: 王冠アイコン（プレミアム会員を象徴）
// Check: チェックマークアイコン（機能リストの項目に使用）
import { Crown, Check } from 'lucide-react'

/**
 * PremiumUpgradeCardコンポーネントのプロパティ型定義
 */
type PremiumUpgradeCardProps = {
  /** カードのタイトル（デフォルト: 'プレミアム会員限定機能'） */
  title?: string
  /** カードの説明文（デフォルト: 'この機能を利用するにはプレミアム会員への登録が必要です。'） */
  description?: string
  /** プレミアム機能リストを表示するかどうか（デフォルト: true） */
  showFeatures?: boolean
}

/**
 * プレミアム会員の特典リスト
 * 無料会員との差別化ポイントを明確に示す
 */
const features = [
  '投稿文字数 2000文字',    // 無料会員は500文字まで
  '画像添付 6枚まで',        // 無料会員は4枚まで
  '動画添付 3本まで',        // 無料会員は1本まで
  '予約投稿機能',            // 無料会員は利用不可
  '投稿分析ダッシュボード',  // 無料会員は利用不可
]

/**
 * プレミアム会員アップグレード促進カードコンポーネント
 *
 * 無料会員ユーザーにプレミアム会員の特典を視覚的に訴求し、
 * 登録ページへの導線を提供するカードコンポーネント
 *
 * @param props - コンポーネントのプロパティ
 * @returns プレミアムアップグレードカードのJSX要素
 */
export function PremiumUpgradeCard({
  title = 'プレミアム会員限定機能',
  description = 'この機能を利用するにはプレミアム会員への登録が必要です。',
  showFeatures = true,
}: PremiumUpgradeCardProps) {
  return (
    // カードコンテナ: プライマリカラーを使用したグラデーション背景で視覚的に強調
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      {/* カードヘッダー: アイコン、タイトル、説明文を中央揃えで配置 */}
      <CardHeader className="text-center">
        {/* 王冠アイコンを円形背景で囲む: プレミアム感を演出 */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <Crown className="w-8 h-8 text-primary" />
        </div>
        {/* カードタイトル */}
        <CardTitle className="text-xl">{title}</CardTitle>
        {/* カード説明文: グレーテキストで表示 */}
        <p className="text-muted-foreground mt-2">{description}</p>
      </CardHeader>

      {/* カードコンテンツ: 機能リストと価格、CTAボタン */}
      <CardContent>
        {/* showFeaturesがtrueの場合のみ機能リストを表示 */}
        {showFeatures && (
          <ul className="space-y-2 mb-6">
            {/* プレミアム機能を1つずつ表示 */}
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                {/* チェックマークアイコン: 利用可能な機能を示す */}
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        {/* 価格表示とCTAボタンセクション */}
        <div className="text-center">
          {/* 月額料金表示 */}
          <p className="text-2xl font-bold mb-4">
            ¥500<span className="text-sm font-normal text-muted-foreground">/月</span>
          </p>
          {/* 登録ページへのリンクボタン: bonsai-greenカラーで統一 */}
          <Button asChild variant="bonsai" className="w-full">
            <Link href={ROUTE_SETTINGS_SUBSCRIPTION}>プレミアムに登録する</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
