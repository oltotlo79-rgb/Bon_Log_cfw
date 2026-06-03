import { redirect } from 'next/navigation'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { getCmsPages } from '@/lib/actions/admin/cms'
import { CmsPageList } from './CmsPageList'
import { FileEdit } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'コンテンツ管理 - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    category?: string
  }>
}

export default async function ContentManagementPage({ searchParams }: PageProps) {
  const params = await searchParams
  const category = params.category || ''

  const result = await getCmsPages({
    category: category || undefined,
    limit: 100,
  })

  if ('error' in result) {
    redirect(ROUTE_LOGIN)
  }

  const { pages, total } = result

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileEdit className="w-6 h-6" />
        <h1 className="text-2xl font-bold">コンテンツ管理</h1>
      </div>

      <CmsPageList
        pages={JSON.parse(JSON.stringify(pages))}
        total={total}
        currentCategory={category}
      />
    </div>
  )
}
