'use client'

type BonsaiItem = {
  id: string
  name: string
  species?: string | null
}

type BonsaiSelectorSectionProps = {
  selectedBonsaiId: string | null
  bonsaiList: BonsaiItem[]
  onChange: (id: string | null) => void
}

/**
 * マイ盆栽選択UIコンポーネント
 *
 * stateなし（純粋な表示コンポーネント）
 */
export function BonsaiSelectorSection({
  selectedBonsaiId,
  bonsaiList,
  onChange,
}: BonsaiSelectorSectionProps) {
  if (bonsaiList.length === 0) return null

  return (
    <div className="mt-4">
      <label className="block text-sm font-medium text-muted-foreground mb-2">
        関連する盆栽（任意）
      </label>
      <select
        value={selectedBonsaiId ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">選択しない</option>
        {bonsaiList.map((bonsai) => (
          <option key={bonsai.id} value={bonsai.id}>
            {bonsai.name}{bonsai.species ? ` (${bonsai.species})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
