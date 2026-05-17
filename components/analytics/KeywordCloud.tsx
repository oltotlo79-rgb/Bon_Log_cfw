/** ユーザーの投稿で頻繁に使用されるキーワードを視覚的に表示する */

/**
 * KeywordCloudコンポーネントのProps型定義
 */
type KeywordCloudProps = {
  /** キーワードと出現回数のペア配列 */
  keywords: {
    /** キーワード文字列 */
    word: string
    /** 出現回数 */
    count: number
  }[]
}

/**
 * キーワードクラウドコンポーネント
 *
 * キーワードの出現頻度を視覚的に表現し、ユーザーがどのような
 * トピックについて投稿しているかを一目で把握できるようにする。
 *
 * @param props - KeywordCloudProps
 * @param props.keywords - 表示するキーワードの配列
 * @returns キーワードクラウドのJSX要素
 */
export function KeywordCloud({ keywords }: KeywordCloudProps) {
  // キーワードが空の場合は空状態を表示
  if (keywords.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        キーワードがありません
      </div>
    )
  }

  // サイズと透明度の計算に使用する最大・最小出現回数を取得
  // Math.max/minでスプレッド構文を使用してcount値の配列から最大/最小値を取得
  const maxCount = Math.max(...keywords.map(k => k.count))
  const minCount = Math.min(...keywords.map(k => k.count))

  /**
   * 出現回数に基づいてキーワードのフォントサイズクラスを決定
   *
   * 最大・最小出現回数の範囲内での相対位置（ratio）に基づいて
   * 5段階のサイズクラスを返す。
   *
   * @param count - キーワードの出現回数
   * @returns Tailwind CSSのフォントサイズクラス
   */
  function getSize(count: number): string {
    // 全てのキーワードの出現回数が同じ場合は中間サイズを返す
    if (maxCount === minCount) return 'text-base'

    // 0〜1の範囲で相対位置を計算（0が最小、1が最大）
    const ratio = (count - minCount) / (maxCount - minCount)

    // 相対位置に応じて5段階のサイズクラスを返す
    if (ratio > 0.8) return 'text-xl font-bold'      // 最大: 一番大きく太字
    if (ratio > 0.6) return 'text-lg font-semibold'  // 大: 大きめで半太字
    if (ratio > 0.4) return 'text-base font-medium'  // 中: 標準サイズで中太
    if (ratio > 0.2) return 'text-sm'                // 小: 小さめ
    return 'text-xs'                                  // 最小: 一番小さい
  }

  /**
   * 出現回数に基づいてキーワードの透明度クラスを決定
   *
   * より出現頻度が高いキーワードほど不透明に（目立つように）表示される。
   *
   * @param count - キーワードの出現回数
   * @returns Tailwind CSSの透明度クラス
   */
  function getOpacity(count: number): string {
    // 全てのキーワードの出現回数が同じ場合は完全不透明
    if (maxCount === minCount) return 'opacity-100'

    // 0〜1の範囲で相対位置を計算
    const ratio = (count - minCount) / (maxCount - minCount)

    // 相対位置に応じて3段階の透明度クラスを返す
    if (ratio > 0.6) return 'opacity-100'  // 高頻度: 完全不透明
    if (ratio > 0.3) return 'opacity-80'   // 中頻度: 80%不透明
    return 'opacity-60'                     // 低頻度: 60%不透明
  }

  return (
    // キーワードをフレックスボックスで折り返し配置、中央寄せ
    <div className="flex flex-wrap gap-2 justify-center py-4">
      {keywords.map((keyword) => (
        <span
          key={keyword.word}
          // 動的にサイズと透明度のクラスを適用
          // ホバー時に背景色が濃くなるトランジション効果付き
          className={`inline-block px-2 py-1 bg-primary/10 text-primary rounded ${getSize(keyword.count)} ${getOpacity(keyword.count)} hover:bg-primary/20 transition-colors cursor-default`}
          // ホバー時にツールチップで出現回数を表示
          title={`${keyword.word}: ${keyword.count}回`}
        >
          {keyword.word}
        </span>
      ))}
    </div>
  )
}
