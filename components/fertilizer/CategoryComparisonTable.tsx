import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react'
import Image from 'next/image'

function getCategoryImagePrefix(name: string) {
  if (name.includes('有機')) return 'category-organic'
  if (name.includes('化成')) return 'category-chemical'
  if (name.includes('液') || name.includes('水肥')) return 'category-liquid'
  return null
}

type Category = {
  name: string
  description: string | null
  merit: string | null
  demerit: string | null
  bonsaiUsage: string | null
}

type Props = {
  categories: Category[]
}

export function CategoryComparisonTable({ categories }: Props) {
  return (
    <div className="space-y-4">
      {categories.map((cat) => {
        const imgPrefix = getCategoryImagePrefix(cat.name)
        return (
          <div key={cat.name} className="rounded-lg border overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5">
              {imgPrefix && (
                <div className="relative w-full sm:w-40 md:w-48 aspect-square shrink-0 rounded-lg overflow-hidden">
                  <Image
                    src={`/images/generated/fertilizers/${imgPrefix}.webp`}
                    alt={cat.name}
                    fill
                    className="object-cover object-center dark:hidden"
                    sizes="(max-width: 640px) 100vw, 200px"
                  />
                  <Image
                    src={`/images/generated/fertilizers/${imgPrefix}-dark.webp`}
                    alt={cat.name}
                    fill
                    className="object-cover object-center hidden dark:block"
                    sizes="(max-width: 640px) 100vw, 200px"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base mb-1.5">{cat.name}</h3>
                {cat.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{cat.description}</p>
                )}
              </div>
            </div>

            {(cat.merit || cat.demerit || cat.bonsaiUsage) && (
              <div className="grid grid-cols-1 md:grid-cols-3 border-t text-sm">
                {cat.merit && (
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 border-b md:border-b-0 md:border-r last:border-b-0 last:md:border-r-0">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">メリット</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{cat.merit}</p>
                  </div>
                )}
                {cat.demerit && (
                  <div className="bg-rose-50/50 dark:bg-rose-950/20 p-4 border-b md:border-b-0 md:border-r last:border-b-0 last:md:border-r-0">
                    <div className="flex items-center gap-1.5 mb-2">
                      <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span className="font-medium text-rose-700 dark:text-rose-400">デメリット</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{cat.demerit}</p>
                  </div>
                )}
                {cat.bonsaiUsage && (
                  <div className="bg-sky-50/50 dark:bg-sky-950/20 p-4 border-b md:border-b-0 last:border-b-0">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lightbulb className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <span className="font-medium text-sky-700 dark:text-sky-400">盆栽での使い方</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{cat.bonsaiUsage}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
