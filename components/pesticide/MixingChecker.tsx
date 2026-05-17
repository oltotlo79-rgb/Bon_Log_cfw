'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

type PesticideOption = {
  id: string
  name: string
  slug: string
  pesticideType: string
}

type IncompatibilityRecord = {
  pesticideId: string
  incompatibleWithId: string
}

type Props = {
  pesticides: PesticideOption[]
  incompatibilities: IncompatibilityRecord[]
}

/** 選択なしを表す値 */
const UNSELECTED = '__none__'

function isIncompatible(
  id1: string,
  id2: string,
  incompatibilities: IncompatibilityRecord[]
): boolean {
  return incompatibilities.some(
    (r) =>
      (r.pesticideId === id1 && r.incompatibleWithId === id2) ||
      (r.pesticideId === id2 && r.incompatibleWithId === id1)
  )
}

export function MixingChecker({ pesticides, incompatibilities }: Props) {
  const [selected1, setSelected1] = useState(UNSELECTED)
  const [selected2, setSelected2] = useState(UNSELECTED)
  const [selected3, setSelected3] = useState(UNSELECTED)

  const hasSelection1 = selected1 !== UNSELECTED
  const hasSelection2 = selected2 !== UNSELECTED
  const hasSelection3 = selected3 !== UNSELECTED

  const getName = useCallback(
    (id: string) => pesticides.find((p) => p.id === id)?.name ?? id,
    [pesticides]
  )

  const results = useMemo(() => {
    const pairs: Array<{
      id1: string
      id2: string
      name1: string
      name2: string
      incompatible: boolean
    }> = []

    if (hasSelection1 && hasSelection2) {
      pairs.push({
        id1: selected1,
        id2: selected2,
        name1: getName(selected1),
        name2: getName(selected2),
        incompatible: isIncompatible(selected1, selected2, incompatibilities),
      })
    }

    if (hasSelection3) {
      if (hasSelection1) {
        pairs.push({
          id1: selected1,
          id2: selected3,
          name1: getName(selected1),
          name2: getName(selected3),
          incompatible: isIncompatible(selected1, selected3, incompatibilities),
        })
      }
      if (hasSelection2) {
        pairs.push({
          id1: selected2,
          id2: selected3,
          name1: getName(selected2),
          name2: getName(selected3),
          incompatible: isIncompatible(selected2, selected3, incompatibilities),
        })
      }
    }

    return pairs
  }, [selected1, selected2, selected3, hasSelection1, hasSelection2, hasSelection3, incompatibilities, getName])

  const showResults = hasSelection1 && hasSelection2

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">農薬を選択</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 農薬1 */}
          <div className="space-y-2">
            <Label htmlFor="pesticide-1">農薬 1</Label>
            <Select value={selected1} onValueChange={setSelected1}>
              <SelectTrigger id="pesticide-1">
                <SelectValue placeholder="農薬を選択してください" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSELECTED}>-- 選択してください --</SelectItem>
                {pesticides.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 農薬2 */}
          <div className="space-y-2">
            <Label htmlFor="pesticide-2">農薬 2</Label>
            <Select value={selected2} onValueChange={setSelected2}>
              <SelectTrigger id="pesticide-2">
                <SelectValue placeholder="農薬を選択してください" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSELECTED}>-- 選択してください --</SelectItem>
                {pesticides
                  .filter((p) => p.id !== selected1)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* 農薬3（オプション） */}
          <div className="space-y-2">
            <Label htmlFor="pesticide-3">農薬 3（任意）</Label>
            <Select value={selected3} onValueChange={setSelected3}>
              <SelectTrigger id="pesticide-3">
                <SelectValue placeholder="3剤目を追加（任意）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSELECTED}>-- 選択しない --</SelectItem>
                {pesticides
                  .filter((p) => p.id !== selected1 && p.id !== selected2)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 結果 */}
      {showResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">チェック結果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.map((r, i) => (
              <div
                key={`${r.id1}-${r.id2}-${i}`}
                className={`rounded-lg p-3 border ${
                  r.incompatible
                    ? 'border-destructive/50 bg-destructive/5'
                    : 'border-green-500/50 bg-green-50 dark:bg-green-950/20'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={r.incompatible ? 'destructive' : 'default'}>
                    {r.incompatible ? '混用不可' : '混用可能'}
                  </Badge>
                  <span className="text-sm">
                    {r.name1} &times; {r.name2}
                  </span>
                </div>
                {r.incompatible && (
                  <p className="text-xs text-destructive mt-1">
                    この組み合わせはデータベース上で混用不可として登録されています。
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 免責 */}
      <Alert className="border-border bg-muted/50">
        <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
          この結果はデータベースに登録された混用不可情報に基づきます。未登録の組み合わせについては製品ラベルを必ず確認してください。
        </AlertDescription>
      </Alert>
    </div>
  )
}
