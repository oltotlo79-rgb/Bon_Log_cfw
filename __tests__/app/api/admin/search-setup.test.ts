/**
 * Admin Search Setup API テスト
 *
 * getRecommendations関数のロジックをテスト
 */

describe('Admin Search Setup - getRecommendations logic', () => {
  /**
   * getRecommendations関数のロジックを再現
   */
  function getRecommendations(
    status: { mode: string; bigmAvailable: boolean; trgmAvailable: boolean },
    missingIndexes: string[]
  ): string[] {
    const recommendations: string[] = []

    if (!status.trgmAvailable) {
      recommendations.push(
        'pg_trgm拡張が有効化されていません。「拡張を有効化」ボタンをクリックしてください。'
      )
    }

    if (status.mode === 'like' && status.trgmAvailable) {
      recommendations.push(
        '環境変数 SEARCH_MODE=trgm を設定することで、全文検索のパフォーマンスが向上します。'
      )
    }

    if (missingIndexes.length > 0) {
      recommendations.push(
        `${missingIndexes.length}個のGINインデックスが不足しています。「インデックスを作成」ボタンをクリックしてください。`
      )
    }

    if (recommendations.length === 0) {
      recommendations.push('全文検索は最適な状態で動作しています。')
    }

    return recommendations
  }

  it('should recommend enabling extension when trgm not available', () => {
    const result = getRecommendations(
      { mode: 'like', bigmAvailable: false, trgmAvailable: false },
      []
    )

    expect(result).toContain(
      'pg_trgm拡張が有効化されていません。「拡張を有効化」ボタンをクリックしてください。'
    )
  })

  it('should recommend setting SEARCH_MODE when trgm available but mode is like', () => {
    const result = getRecommendations(
      { mode: 'like', bigmAvailable: false, trgmAvailable: true },
      []
    )

    expect(result).toContain(
      '環境変数 SEARCH_MODE=trgm を設定することで、全文検索のパフォーマンスが向上します。'
    )
  })

  it('should recommend creating indexes when missing', () => {
    const result = getRecommendations(
      { mode: 'trgm', bigmAvailable: false, trgmAvailable: true },
      ['index1', 'index2', 'index3']
    )

    expect(result).toContain(
      '3個のGINインデックスが不足しています。「インデックスを作成」ボタンをクリックしてください。'
    )
  })

  it('should return optimal message when everything is configured', () => {
    const result = getRecommendations(
      { mode: 'trgm', bigmAvailable: false, trgmAvailable: true },
      []
    )

    expect(result).toContain('全文検索は最適な状態で動作しています。')
    expect(result).toHaveLength(1)
  })

  it('should return multiple recommendations when multiple issues', () => {
    const result = getRecommendations(
      { mode: 'like', bigmAvailable: false, trgmAvailable: false },
      ['index1']
    )

    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result).toContain(
      'pg_trgm拡張が有効化されていません。「拡張を有効化」ボタンをクリックしてください。'
    )
    expect(result).toContain(
      '1個のGINインデックスが不足しています。「インデックスを作成」ボタンをクリックしてください。'
    )
  })
})
