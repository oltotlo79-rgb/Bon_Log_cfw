/** このファイルはユーザーが所有する盆栽の一覧を表示し、 */

'use client'

// React のフック: コンポーネントの状態管理に使用
import { useState } from 'react'
// Next.js のリンクコンポーネント: クライアントサイドナビゲーション用
import Link from 'next/link'
// Next.js の画像最適化コンポーネント: 自動的に画像を最適化
import Image from 'next/image'
// 盆栽検索コンポーネント: 名前・樹種・説明で検索
import { BonsaiSearch } from './BonsaiSearch'
import { ROUTE_BONSAI_NEW } from '@/lib/constants/routes'

/**
 * プラスアイコン（追加ボタン用）
 * @param className - カスタムCSSクラス
 */
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

/**
 * 木アイコン（盆栽のプレースホルダー用）
 * @param className - カスタムCSSクラス
 */
function TreeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v18" />
      <path d="M8 7a4 4 0 0 1 8 0c0 2-2 3-4 3S8 9 8 7Z" />
      <path d="M6 12a4 4 0 0 1 12 0c0 2-3 3-6 3s-6-1-6-3Z" />
    </svg>
  )
}

/**
 * 盆栽データと関連する成長記録を含む型定義
 */
type BonsaiWithRecords = {
  /** 盆栽ID */
  id: string
  /** 盆栽の名前 */
  name: string
  /** 樹種（オプション） */
  species: string | null
  /** 入手日（オプション） */
  acquiredAt: Date | null
  /** 説明・メモ（オプション） */
  description: string | null
  /** 成長記録（サムネイル表示用に最新のもののみ取得） */
  records?: {
    /** 記録に含まれる画像URL */
    images?: { url: string }[]
  }[]
  /** 関連データの件数（成長記録数） */
  _count?: { records: number }
}

/**
 * BonsaiListClientコンポーネントのProps型定義
 */
interface BonsaiListClientProps {
  /** 初期表示する盆栽リスト（サーバーから取得済み） */
  initialBonsais: BonsaiWithRecords[]
}

/**
 * 盆栽一覧表示クライアントコンポーネント
 *
 * サーバーから取得した盆栽データを一覧表示し、
 * 検索機能で動的にフィルタリングできます。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.initialBonsais - 初期表示する盆栽リスト
 */
export function BonsaiListClient({ initialBonsais }: BonsaiListClientProps) {
  /**
   * 表示する盆栽リストの状態
   * 検索結果に応じて更新される
   */
  const [bonsais, setBonsais] = useState<BonsaiWithRecords[]>(initialBonsais)

  /**
   * 検索中かどうかのフラグ
   * true: 検索結果を表示中、false: 全件表示中
   */
  const [isSearching, setIsSearching] = useState(false)

  /**
   * 検索結果を受け取るコールバック
   * BonsaiSearchコンポーネントから呼び出される
   *
   * @param searchResults - 検索結果の盆栽リスト
   */
  const handleSearch = (searchResults: BonsaiWithRecords[]) => {
    setBonsais(searchResults)
    setIsSearching(true)
  }

  /**
   * 検索をクリアして全件表示に戻すコールバック
   * BonsaiSearchコンポーネントから呼び出される
   */
  const handleClear = () => {
    setBonsais(initialBonsais)
    setIsSearching(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ヘッダーセクション */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">マイ盆栽</h1>
          {/* 盆栽追加ボタン */}
          <Link
            href={ROUTE_BONSAI_NEW}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>盆栽を追加</span>
          </Link>
        </div>

        {/* 検索フォーム */}
        <BonsaiSearch
          onSearch={handleSearch}
          onClear={handleClear}
          initialCount={initialBonsais.length}
        />
      </div>

      {/* 盆栽リストまたは空状態の表示 */}
      {bonsais.length === 0 ? (
        // 盆栽が存在しない場合の表示
        <div className="bg-card rounded-lg border p-8 text-center">
          <TreeIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          {isSearching ? (
            // 検索結果が0件の場合
            <>
              <h2 className="text-lg font-semibold mb-2">検索結果がありません</h2>
              <p className="text-muted-foreground mb-4">
                別のキーワードで検索してみてください
              </p>
            </>
          ) : (
            // 盆栽が未登録の場合（初期状態）
            <>
              <h2 className="text-lg font-semibold mb-2">まだ盆栽が登録されていません</h2>
              <p className="text-muted-foreground mb-4">
                あなたの盆栽を登録して、成長記録を残しましょう
              </p>
              <Link
                href={ROUTE_BONSAI_NEW}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                <span>最初の盆栽を登録</span>
              </Link>
            </>
          )}
        </div>
      ) : (
        // 盆栽リストの表示
        <div className="grid gap-4">
          {bonsais.map((bonsai) => {
            // 最新の成長記録から画像URLを取得（サムネイル表示用）
            const latestRecord = bonsai.records?.[0]
            const latestImage = latestRecord?.images?.[0]?.url

            return (
              <Link
                key={bonsai.id}
                href={`/bonsai/${bonsai.id}`}
                className="bg-card rounded-lg border overflow-hidden hover:border-primary/50 transition-colors"
              >
                <div className="flex">
                  {/* サムネイル画像エリア */}
                  <div className="w-32 h-32 bg-muted flex-shrink-0">
                    {latestImage ? (
                      // 成長記録画像がある場合
                      <Image
                        src={latestImage}
                        alt={bonsai.name}
                        width={128}
                        height={128}
                        sizes="128px"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      // 画像がない場合はプレースホルダーアイコンを表示
                      <div className="w-full h-full flex items-center justify-center">
                        <TreeIcon className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* 盆栽情報エリア */}
                  <div className="flex-1 p-4">
                    <h3 className="font-bold text-lg">{bonsai.name}</h3>
                    {/* 樹種の表示（存在する場合） */}
                    {bonsai.species && (
                      <p className="text-sm text-muted-foreground">{bonsai.species}</p>
                    )}
                    {/* 統計情報: 記録数と入手日 */}
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{bonsai._count?.records || 0}件の記録</span>
                      {bonsai.acquiredAt && (
                        <span>
                          入手: {new Date(bonsai.acquiredAt).toLocaleDateString('ja-JP')}
                        </span>
                      )}
                    </div>
                    {/* 説明文の表示（2行まで） */}
                    {bonsai.description && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {bonsai.description}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
