import Link from 'next/link'
import Image from 'next/image'
import {
  TECHNIQUE_EFFECT_TYPE_LABELS,
  TECHNIQUE_EFFECT_TYPE_COLORS,
  TECHNIQUE_MAGNITUDE_LABELS,
} from '@/lib/constants/hormone-techniques'
import { buildHormonePath } from '@/lib/constants/path-builders'

type TechniqueEffect = {
  hormoneName: string
  hormoneSlug: string
  effectType: string
  magnitude: string
  mechanism: string | null
}

type Props = {
  techniqueName: string
  techniqueNameEn: string | null
  description: string
  effects: TechniqueEffect[]
}

export function HormoneTechniqueCard({ techniqueName, techniqueNameEn, description, effects }: Props) {
  const getTechniquePrefix = (name: string) => {
    if (name.includes('摘芯') || name.includes('芽摘み')) return 'technique-pinching';
    if (name.includes('剪定') || name.includes('切り戻し')) return 'technique-pruning';
    if (name.includes('針金')) return 'technique-wiring';
    if (name.includes('根') || name.includes('植え替え')) return 'technique-root-cutting';
    if (name.includes('葉刈り')) return 'technique-defoliation';
    return null;
  };
  const prefix = getTechniquePrefix(techniqueName);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {prefix && (
        <div className="relative w-full aspect-video border-b overflow-hidden">
          <Image
            src={`/images/generated/hormones/${prefix}.webp`}
            alt={techniqueName}
            fill
            className="object-cover object-center dark:hidden"
            sizes="(max-width: 768px) 100vw, 800px"
          />
          <Image
            src={`/images/generated/hormones/${prefix}-dark.webp`}
            alt={techniqueName}
            fill
            className="object-cover object-center hidden dark:block"
            sizes="(max-width: 768px) 100vw, 800px"
          />
        </div>
      )}
      <div className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-base">{techniqueName}</h3>
        {techniqueNameEn && (
          <p className="text-xs text-muted-foreground mt-0.5">{techniqueNameEn}</p>
        )}
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      {effects.length > 0 && (
        <div className="space-y-2">
          {effects.map((effect) => {
            const effectColors = TECHNIQUE_EFFECT_TYPE_COLORS[effect.effectType]
            const effectLabel = TECHNIQUE_EFFECT_TYPE_LABELS[effect.effectType] ?? effect.effectType
            const magnitudeLabel = TECHNIQUE_MAGNITUDE_LABELS[effect.magnitude] ?? effect.magnitude

            return (
              <div key={`${effect.hormoneSlug}-${effect.effectType}`} className="rounded-md bg-muted/50 p-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={buildHormonePath(effect.hormoneSlug)}
                    className="font-medium text-sm text-primary hover:underline"
                  >
                    {effect.hormoneName}
                  </Link>
                  {effectColors && (
                    <span className={`${effectColors.bg} ${effectColors.text} ${effectColors.darkBg} px-2 py-0.5 text-xs rounded-full font-medium`}>
                      {effectLabel}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    （影響度: {magnitudeLabel}）
                  </span>
                </div>
                {effect.mechanism && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{effect.mechanism}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {effects.length === 0 && (
        <p className="text-sm text-muted-foreground">この技法のホルモン効果データはまだありません。</p>
      )}
      </div>
    </div>
  )
}
