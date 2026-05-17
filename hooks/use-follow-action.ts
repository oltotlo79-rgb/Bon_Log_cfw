'use client'

/**
 * @module hooks/use-follow-action
 *
 * フォロー / リクエスト操作の楽観的更新・ロールバック・エラー処理・キャッシュ無効化を
 * 1 箇所にまとめたフック。React hooks / router / toast / queryClient を使うため Client 境界専用。
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { ROUTE_LOGIN } from '@/lib/constants/routes'

/**
 * 各アクションの設定
 *
 * @property onOptimistic - 楽観的に状態を更新する関数
 * @property onRollback - エラー時に状態を元に戻す関数
 * @property action - 実行するServer Action（Promiseを返す）
 * @property getError - 結果からエラーメッセージを抽出する関数（エラーなしならnull）
 * @property successToast - 成功時に表示するトースト（省略可）
 */
type FollowActionConfig<T> = {
  onOptimistic: () => void
  onRollback: () => void
  action: () => Promise<T>
  getError: (result: T) => string | null
  successToast?: { title: string; description?: string }
}

/**
 * useFollowAction の戻り値
 *
 * @property execute - アクションを実行する関数（ジェネリクスで結果型を推論）
 * @property isPending - トランジション中かどうか
 */
type UseFollowActionReturn = {
  execute: <T>(config: FollowActionConfig<T>) => void
  isPending: boolean
}

/**
 * フォロー操作の共通パターンをまとめたカスタムフック
 *
 * 以下のフローを1箇所に集約する:
 * 1. 楽観的に状態を更新
 * 2. startTransition 内で Server Action を実行
 * 3. エラー時: ロールバック + 認証エラーならログインへリダイレクト、それ以外はトースト
 * 4. 成功時: オプションのトースト表示 + timeline キャッシュ無効化
 */
export function useFollowAction(): UseFollowActionReturn {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  function execute<T>(config: FollowActionConfig<T>) {
    const { onOptimistic, onRollback, action, getError, successToast } = config

    // 楽観的更新
    onOptimistic()

    startTransition(async () => {
      const result = await action()
      const errorMessage = getError(result)

      if (errorMessage) {
        // ロールバック
        onRollback()

        if (errorMessage === '認証が必要です') {
          router.push(ROUTE_LOGIN)
        } else {
          toast({
            title: 'エラー',
            description: errorMessage,
            variant: 'destructive',
          })
        }
      } else {
        // 成功時
        if (successToast) {
          toast(successToast)
        }
        queryClient.invalidateQueries({ queryKey: ['timeline'] })
      }
    })
  }

  return { execute, isPending }
}
