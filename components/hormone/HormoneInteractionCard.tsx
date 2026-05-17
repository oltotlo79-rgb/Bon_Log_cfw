const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  synergistic: {
    label: '相乗',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  antagonistic: {
    label: '拮抗',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  modulatory: {
    label: '調節',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
}

type Props = {
  hormoneAName: string
  hormoneBName: string
  type: string
  description: string | null
  bonsaiRelevance: string | null
}

export function HormoneInteractionCard({
  hormoneAName,
  hormoneBName,
  type,
  description,
  bonsaiRelevance,
}: Props) {
  const config = TYPE_CONFIG[type] ?? { label: type, className: 'bg-muted text-muted-foreground' }

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{hormoneAName}</span>
        <span className="text-muted-foreground">&harr;</span>
        <span className="font-medium">{hormoneBName}</span>
        <span className={config.className + ' px-2 py-0.5 text-xs rounded-full font-medium'}>
          {config.label}
        </span>
      </div>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {bonsaiRelevance && (
        <p className="text-xs text-muted-foreground border-t pt-2">{bonsaiRelevance}</p>
      )}
    </div>
  )
}
