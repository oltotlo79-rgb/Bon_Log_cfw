import { ArrowUp, ArrowDown } from 'lucide-react'

type Effect = {
  effectName: string
  description: string | null
  isPromoting: boolean
}

type Props = {
  effects: Effect[]
}

export function HormoneEffectList({ effects }: Props) {
  if (effects.length === 0) {
    return <p className="text-sm text-muted-foreground">効果情報はまだありません。</p>
  }

  return (
    <ul className="space-y-2">
      {effects.map((effect) => (
        <li key={effect.effectName} className="flex items-start gap-2 text-sm">
          {effect.isPromoting ? (
            <ArrowUp className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          ) : (
            <ArrowDown className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          )}
          <div>
            <span className="font-medium">{effect.effectName}</span>
            {effect.description && (
              <p className="text-muted-foreground">{effect.description}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
