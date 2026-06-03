import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getRecommendedUsers } from '@/lib/actions/feed'
import { RecommendedUserList } from '@/components/user/RecommendedUserList'
import { WeatherLocationSetting } from '@/components/weather/WeatherLocationSetting'
import { OnboardingComplete } from '@/components/onboarding/OnboardingComplete'
import { ROUTE_LOGIN, ROUTE_FEED } from '@/lib/constants/routes'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { pageTitle } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: pageTitle('はじめに'),
  robots: { index: false, follow: false },
}

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect(ROUTE_LOGIN)
  if (session.user.email === GUEST_EMAIL) redirect(ROUTE_FEED)

  // 既にオンボーディング済みなら再表示しない
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardedAt: true },
  })
  if (user?.onboardedAt) redirect(ROUTE_FEED)

  const { users } = await getRecommendedUsers()

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">BON-LOG へようこそ</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          いくつかの設定で、盆栽ライフをはじめましょう。
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">気になる人をフォロー</h2>
        <p className="text-sm text-muted-foreground">
          フォローすると、その人の投稿がタイムラインに表示されます。
        </p>
        {users.length > 0 ? (
          <RecommendedUserList users={users} />
        ) : (
          <p className="text-sm text-muted-foreground">
            おすすめのユーザーはまだいません。あとから探せます。
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">天気の地点を設定</h2>
        <p className="text-sm text-muted-foreground">
          登録すると、お住まいの地域に合わせた盆栽の管理アドバイスが表示されます。
        </p>
        <WeatherLocationSetting />
      </section>

      <OnboardingComplete />
    </div>
  )
}
