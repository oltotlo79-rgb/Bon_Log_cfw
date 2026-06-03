/** 日別のいいね数とコメント数の推移を積み上げ棒グラフで表示するチャートコンポーネント。 */

import { DEFAULT_ANALYTICS_DAYS } from '@/lib/constants/limits/analytics'

type LikeChartProps = {
  /** 日別のいいね・コメントデータの配列 */
  data: {
    /** 日付文字列（YYYY-MM-DD形式） */
    date: string
    /** その日のいいね数 */
    likes: number
    /** その日のコメント数 */
    comments: number
  }[]
}

/**
 * いいね・コメント推移チャートコンポーネント
 *
 * 時系列でのエンゲージメント推移を積み上げ棒グラフで表示。
 * いいね（濃い色）とコメント（薄い色）を視覚的に区別できる。
 *
 * @param props - LikeChartProps
 * @param props.data - 日別のいいね・コメントデータ配列
 * @returns いいね推移チャートのJSX要素
 */
export function LikeChart({ data }: LikeChartProps) {
  // データが空の場合は空状態を表示
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        データがありません
      </div>
    )
  }

  // グラフの高さ計算に使用する最大値を取得
  // いいね数とコメント数の合計が最大の日を基準にする
  // 0除算を防ぐため最小値1を設定
  const maxValue = Math.max(...data.map(d => d.likes + d.comments), 1)

  return (
    // チャート全体のコンテナ（高さ固定）
    <div className="h-48">
      {/*
        棒グラフコンテナ
        高さを固定し、各棒を均等配置
      */}
      <div className="flex items-end justify-between h-40 gap-1">
        {data.slice(-DEFAULT_ANALYTICS_DAYS).map((item) => {
          // いいね部分の高さを最大値に対する比率で計算（0-100%）
          const likeHeight = (item.likes / maxValue) * 100
          // コメント部分の高さを最大値に対する比率で計算（0-100%）
          const commentHeight = (item.comments / maxValue) * 100

          return (
            <div key={item.date} className="flex-1 flex flex-col items-center">
              <div className="w-full flex flex-col gap-0.5" style={{ height: '100%' }}>
                {/*
                  棒グラフ部分
                  flex-1で余白を埋め、justify-endで下寄せに
                */}
                <div className="flex-1 flex flex-col justify-end">
                  {/*
                    いいね部分（上側・濃い色）
                    - 高さは比率に基づいて動的に設定
                    - 1件以上ある場合は最低2pxの高さを確保
                  */}
                  <div
                    className="w-full bg-primary/60 rounded-t"
                    style={{ height: `${likeHeight}%`, minHeight: item.likes > 0 ? '2px' : '0' }}
                    // ホバー時にいいね数をツールチップ表示
                    title={`いいね: ${item.likes}`}
                  />
                  {/*
                    コメント部分（下側・薄い色）
                    - 高さは比率に基づいて動的に設定
                    - 1件以上ある場合は最低2pxの高さを確保
                  */}
                  <div
                    className="w-full bg-primary/30 rounded-b"
                    style={{ height: `${commentHeight}%`, minHeight: item.comments > 0 ? '2px' : '0' }}
                    // ホバー時にコメント数をツールチップ表示
                    title={`コメント: ${item.comments}`}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {/*
        X軸ラベルと凡例
        開始日・凡例・終了日を横並びで配置
      */}
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        {/*
          開始日ラベル
          日本語フォーマット（例: "1月1日"）で表示
        */}
        <span>
          {data[0] && new Date(data[0].date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
        </span>
        {/*
          凡例
          いいね（濃い色）とコメント（薄い色）の意味を表示
        */}
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-primary/60" />
            いいね
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-primary/30" />
            コメント
          </span>
        </div>
        {/*
          終了日ラベル
          日本語フォーマット（例: "1月31日"）で表示
        */}
        <span>
          {(() => {
            const last = data[data.length - 1]
            return last && new Date(last.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
          })()}
        </span>
      </div>
    </div>
  )
}
