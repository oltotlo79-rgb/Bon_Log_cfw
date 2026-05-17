/** 自分の投稿が他のユーザーに引用された一覧を表示するコンポーネント。 */

// Next.js Linkコンポーネント: クライアントサイドナビゲーション用
import Link from 'next/link'

// shadcn/ui Avatarコンポーネント: ユーザーアバター表示用
// Avatar: アバターのコンテナ
// AvatarFallback: 画像がない場合のフォールバック表示
// AvatarImage: アバター画像
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// lucide-reactアイコン: いいねとコメントのアイコン
import { Heart, MessageSquare } from 'lucide-react'
import { QUOTE_DISPLAY_LIMIT } from '@/lib/constants/limits'

/**
 * 引用投稿データの型定義
 */
type Quote = {
  /** 引用投稿のID */
  id: string
  /** 引用投稿のコンテンツ */
  content: string | null
  /** 引用したユーザーの情報 */
  user: {
    /** ユーザーID */
    id: string
    /** ニックネーム */
    nickname: string
    /** アバター画像URL（未設定の場合はnull） */
    avatarUrl: string | null
  }
  /** 元の投稿（自分の投稿）のID */
  originalPostId: string | null
  /** 元の投稿（自分の投稿）のコンテンツ */
  originalContent: string | null
  /** 引用投稿が獲得したいいね数 */
  likeCount: number
  /** 引用投稿が獲得したコメント数 */
  commentCount: number
  /** 引用投稿の作成日時 */
  createdAt: Date
}

/**
 * QuoteListコンポーネントのProps型定義
 */
type QuoteListProps = {
  /** 引用投稿の配列 */
  quotes: Quote[]
}

/**
 * 日付を相対時間の文字列に変換するユーティリティ関数
 *
 * 現在時刻との差分を計算し、人間が読みやすい相対時間形式で返す。
 *
 * @param date - 変換対象の日付
 * @returns 相対時間の文字列（例: "今日", "昨日", "3日前", "2週間前", "1ヶ月前"）
 */
function formatRelativeTime(date: Date) {
  const now = new Date()
  // 現在時刻との差分をミリ秒で計算
  const diff = now.getTime() - new Date(date).getTime()
  // ミリ秒を日数に変換（切り捨て）
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  // 日数に応じて適切な表現を返す
  if (days === 0) return '今日'           // 0日 = 今日
  if (days === 1) return '昨日'           // 1日前 = 昨日
  if (days < 7) return `${days}日前`      // 1週間以内 = X日前
  if (days < 30) return `${Math.floor(days / 7)}週間前`   // 1ヶ月以内 = X週間前
  return `${Math.floor(days / 30)}ヶ月前`  // 1ヶ月以上 = Xヶ月前
}

/**
 * 引用投稿一覧コンポーネント
 *
 * 自分の投稿がどのように引用されているかを一覧で確認できる。
 * 各引用投稿はクリックすると詳細ページへ遷移する。
 *
 * @param props - QuoteListProps
 * @param props.quotes - 表示する引用投稿の配列
 * @returns 引用投稿一覧のJSX要素
 */
export function QuoteList({ quotes }: QuoteListProps) {
  // 引用がない場合は空状態を表示
  if (quotes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        引用された投稿はありません
      </div>
    )
  }

  return (
    // リストコンテナ: 最大高さを設定してスクロール可能に
    <div className="space-y-3 max-h-80 overflow-y-auto">
      {/* 最大10件まで表示（パフォーマンスとUI考慮） */}
      {quotes.slice(0, QUOTE_DISPLAY_LIMIT).map((quote) => (
        // 各引用投稿はリンクとして機能し、クリックで詳細ページへ遷移
        <Link
          key={quote.id}
          href={`/posts/${quote.id}`}
          className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          {/* アバターとコンテンツを横並びに配置 */}
          <div className="flex items-start gap-3">
            {/*
              引用者のアバター
              - 小さめサイズ（w-8 h-8）で表示
              - 画像がない場合はニックネームの頭文字をフォールバック表示
            */}
            <Avatar className="w-8 h-8">
              <AvatarImage src={quote.user.avatarUrl || undefined} alt={quote.user.nickname} />
              <AvatarFallback>{quote.user.nickname[0]}</AvatarFallback>
            </Avatar>
            {/* コンテンツ部分 */}
            <div className="flex-1 min-w-0">
              {/* ユーザー名と投稿日時 */}
              <div className="flex items-center gap-2 text-sm">
                {/*
                  ニックネーム
                  長い場合は省略（truncate）
                */}
                <span className="font-medium truncate">{quote.user.nickname}</span>
                {/* 相対時間表示 */}
                <span className="text-muted-foreground text-xs">
                  {formatRelativeTime(quote.createdAt)}
                </span>
              </div>
              {/*
                引用投稿の本文
                コンテンツが存在する場合のみ表示
                長文は2行で切り捨て（line-clamp-2）
              */}
              {quote.content && (
                <p className="text-sm line-clamp-2 mt-1">{quote.content}</p>
              )}
              {/*
                引用元（自分の投稿）の表示
                元のコンテンツが存在する場合のみ表示
                グレー背景のボックスで区別
              */}
              {quote.originalContent && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                  <span className="font-medium">引用元:</span> {quote.originalContent}
                </div>
              )}
              {/*
                エンゲージメント情報
                いいね数とコメント数をアイコン付きで表示
              */}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                {/* いいね数 */}
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  {quote.likeCount}
                </span>
                {/* コメント数 */}
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {quote.commentCount}
                </span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
