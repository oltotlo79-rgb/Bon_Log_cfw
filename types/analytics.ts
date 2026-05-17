/**
 * アナリティクス機能のドメイン型定義
 *
 * Server Action の返却型およびコンポーネントの Props 型を共有するために使用。
 *
 * @module types/analytics
 */

/** 投稿分析データ */
export type PostAnalytics = {
  totalPosts: number
  totalLikes: number
  totalComments: number
  avgEngagement: number
  topPosts: {
    id: string
    content: string | null
    createdAt: Date
    likeCount: number
    commentCount: number
  }[]
  posts: {
    id: string
    content: string | null
    createdAt: Date
    likeCount: number
    commentCount: number
  }[]
}

/** いいね分析データ */
export type LikeAnalytics = {
  totalLikes: number
  hourlyData: number[]
  weekdayData: number[]
  dailyData: { date: string; count: number }[]
  peakHour: number
  peakWeekday: number
}

/** 引用・リポスト分析データ */
export type QuoteAnalytics = {
  totalQuotes: number
  totalReposts: number
  quotes: {
    id: string
    content: string | null
    user: { id: string; nickname: string; avatarUrl: string | null }
    originalPostId: string | null
    originalContent: string | null
    likeCount: number
    commentCount: number
    createdAt: Date
  }[]
}

/** キーワード分析データ */
export type KeywordAnalytics = {
  keywords: { word: string; count: number }[]
  totalWords: number
  uniqueWords: number
}

/** エンゲージメント推移データ */
export type EngagementTrend = {
  trend: {
    date: string
    posts: number
    likes: number
    comments: number
    engagement: number
  }[]
}

/** ジャンル別パフォーマンスデータ */
export type GenrePerformance = {
  genres: {
    name: string
    postCount: number
    avgLikes: number
    avgComments: number
    avgEngagement: number
  }[]
}

/** フォロワー推移データ */
export type FollowerGrowth = {
  currentFollowers: number
  totalNewInPeriod: number
  growth: {
    date: string
    newFollowers: number
    totalFollowers: number
  }[]
}

/** 前期比較データ */
export type PeriodComparison = {
  posts: { current: number; previous: number; change: number | null }
  likes: { current: number; previous: number; change: number | null }
  comments: { current: number; previous: number; change: number | null }
  followers: { current: number; previous: number; change: number | null }
}

/** 詳細アナリティクスデータ */
export type DetailedAnalytics = {
  totals: {
    profileViews: number
    postViews: number
    likesReceived: number
    newFollowers: number
  }
  dailyData: {
    date: string
    profileViews: number
    postViews: number
    likesReceived: number
    newFollowers: number
  }[]
  period: {
    start: string
    end: string
    days: number
  }
}

/** 基本統計データ（無料ユーザー向け） */
export type BasicStats = {
  postsCount: number
  followersCount: number
  followingCount: number
  totalLikesReceived: number
}
