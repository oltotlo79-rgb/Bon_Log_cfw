/** いいねの獲得パターンを時間帯別・曜日別に視覚化するヒートマップコンポーネント。 */

type TimeHeatmapProps = {
  /** 時間帯別（0-23時）のいいね数配列（24要素） */
  hourlyData: number[]
  /** 曜日別（日-土）のいいね数配列（7要素） */
  weekdayData: number[]
}

/**
 * X軸に表示する時間ラベル（3時間おきに表示）
 * 0時、3時、6時、9時、12時、15時、18時、21時
 */
const HOURS = ['0', '3', '6', '9', '12', '15', '18', '21']

/**
 * 曜日ラベル配列
 * JavaScriptのDate.getDay()と対応（0=日曜日）
 */
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/**
 * 時間帯別ヒートマップコンポーネント
 *
 * 時間帯別の棒グラフと曜日別のヒートマップセルを表示し、
 * いいねの獲得パターンを視覚的に分析できるようにする。
 *
 * @param props - TimeHeatmapProps
 * @param props.hourlyData - 24時間分のいいね数データ
 * @param props.weekdayData - 7日分（曜日別）のいいね数データ
 * @returns 時間帯別ヒートマップのJSX要素
 */
export function TimeHeatmap({ hourlyData, weekdayData }: TimeHeatmapProps) {
  // 時間帯別データの最大値を取得（0除算を防ぐため最小値1を設定）
  const maxHourly = Math.max(...hourlyData, 1)

  /**
   * 時間帯別の値に基づいて背景色クラスを決定
   *
   * 最大値に対する比率に応じて5段階の色を返す。
   * プライマリカラーの透明度を変えることでグラデーションを表現。
   *
   * @param value - いいね数
   * @returns Tailwind CSSの背景色クラス
   */
  function getHourlyColor(value: number): string {
    // 最大値に対する比率を計算
    const ratio = value / maxHourly

    // 比率に応じて5段階の背景色クラスを返す
    if (ratio === 0) return 'bg-muted'        // 0件: グレー（無彩色）
    if (ratio < 0.25) return 'bg-primary/20'  // 低: 20%透明度
    if (ratio < 0.5) return 'bg-primary/40'   // 中低: 40%透明度
    if (ratio < 0.75) return 'bg-primary/60'  // 中高: 60%透明度
    return 'bg-primary/80'                     // 高: 80%透明度
  }

  // 時間帯別・曜日別のグラフをレンダリング
  return (
    <div className="space-y-4">
      {/*
        時間帯別セクション
        24本の棒グラフで各時間帯のいいね数を表示
      */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">時間帯別</p>
        {/*
          棒グラフコンテナ
          高さ固定でフレックスボックスを使用し、各棒を均等配置
        */}
        <div className="flex items-end justify-between h-24 gap-1">
          {hourlyData.map((value, hour) => (
            <div key={hour} className="flex-1 flex flex-col items-center">
              {/*
                個別の棒
                - 高さは最大値に対する比率で計算
                - 色は値に応じて動的に決定
                - 0より大きい場合は最低4pxの高さを確保（見えなくなるのを防止）
              */}
              <div
                className={`w-full rounded-t transition-all ${getHourlyColor(value)}`}
                style={{ height: `${(value / maxHourly) * 100}%`, minHeight: value > 0 ? '4px' : '0' }}
                // ホバー時に時間と件数をツールチップ表示
                title={`${hour}時: ${value}件`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          {HOURS.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
      </div>

      {/*
        曜日別セクション
        7つのセルで各曜日のいいね数をヒートマップ形式で表示
      */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">曜日別</p>
        <div className="flex gap-2">
          {weekdayData.map((value, day) => {
            // 曜日データ内での最大値を取得（各セルの色計算に使用）
            const maxWeekday = Math.max(...weekdayData, 1)
            // 最大値に対する比率を計算
            const ratio = value / maxWeekday

            // 比率に応じて背景色を決定（5段階）
            let colorClass = 'bg-muted'           // デフォルト: グレー
            if (ratio > 0) colorClass = 'bg-primary/20'    // 1件以上: 薄い
            if (ratio > 0.25) colorClass = 'bg-primary/40' // 25%超: やや薄い
            if (ratio > 0.5) colorClass = 'bg-primary/60'  // 50%超: やや濃い
            if (ratio > 0.75) colorClass = 'bg-primary/80' // 75%超: 濃い

            return (
              <div key={day} className="flex-1 text-center">
                {/*
                  曜日セル
                  - 固定高さで色を背景として表示
                  - 1件以上ある場合は中央に数値を表示
                */}
                <div
                  className={`h-8 rounded ${colorClass} flex items-center justify-center text-xs`}
                  // ホバー時に曜日と件数をツールチップ表示
                  title={`${WEEKDAYS[day]}: ${value}件`}
                >
                  {value > 0 && <span className="text-primary-foreground font-medium">{value}</span>}
                </div>
                <span className="text-xs text-muted-foreground mt-1 block">
                  {WEEKDAYS[day]}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/*
        凡例セクション
        色の意味（少〜多）を示すカラーバーを表示
      */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>少</span>
        <div className="flex gap-1">
          <span className="w-4 h-4 rounded bg-muted" />
          <span className="w-4 h-4 rounded bg-primary/20" />
          <span className="w-4 h-4 rounded bg-primary/40" />
          <span className="w-4 h-4 rounded bg-primary/60" />
          <span className="w-4 h-4 rounded bg-primary/80" />
        </div>
        <span>多</span>
      </div>
    </div>
  )
}
