import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { signInAsGuestFormAction } from '@/lib/actions/auth'
import { SumiStrokeReveal } from '@/components/landing/SumiStrokeReveal'
import {
  BASE_URL,
  ROUTE_FEED,
  ROUTE_SETTINGS,
  ROUTE_SETTINGS_PROFILE,
  ROUTE_LOGIN,
  ROUTE_REGISTER,
  ROUTE_ABOUT,
  ROUTE_PRIVACY,
  ROUTE_TERMS,
  ROUTE_HELP,
  ROUTE_CONTACT,
  ROUTE_PESTICIDES,
  ROUTE_HORMONES,
  ROUTE_FERTILIZERS,
} from '@/lib/constants/routes'

// ランディングページの canonical はサイトルートに固定。
// `title.absolute` でルートレイアウトの `template` 適用を回避し、
// ブランド名を含む完全タイトルを検索結果に表示する。
export const metadata: Metadata = {
  title: {
    absolute: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
  },
  description:
    '盆栽愛好家のためのSNS。投稿・コミュニティ・盆栽園マップ・イベント情報・盆栽用語辞典に加え、病害虫と薬剤データベース・植物ホルモンガイド・肥料ガイドなど、盆栽文化を支える総合プラットフォームです。',
  alternates: { canonical: BASE_URL },
  openGraph: {
    url: BASE_URL,
    title: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
    description:
      '盆栽愛好家のためのSNS。投稿・コミュニティ・盆栽園マップ・イベント情報・辞典・病害虫薬剤・ホルモン・肥料の総合ガイド。',
  },
}

export default async function Home() {
  const session = await auth()
  const isLoggedIn = !!session?.user

  return (
    <div className="min-h-screen washi-texture text-foreground overflow-x-hidden selection:bg-black selection:text-white bg-[#f0ece4]">
      {/* 
        Header - Minimalist and transparent to not interfere with the hero art 
      */}
      <header className="fixed top-0 left-0 right-0 z-50 px-3 py-3 sm:px-6 sm:py-4 md:p-8 flex items-center justify-between gap-3 pointer-events-none max-w-[100vw]">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-widest text-black pointer-events-auto filter drop-shadow-md shrink-0 text-stroke-white">
          BON-LOG
        </h1>
        <div className="flex items-center flex-wrap justify-end gap-1.5 sm:gap-4 min-w-0 pointer-events-auto">
          {isLoggedIn ? (
            <>
              <Button asChild variant="outline" size="sm" className="bg-transparent border-black text-black hover:bg-black hover:text-white transition-colors btn-washi text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 shrink-0">
                <Link href={ROUTE_FEED}>タイムラインへ</Link>
              </Button>
              <Button asChild size="sm" className="btn-washi text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 shrink-0">
                <Link href={ROUTE_SETTINGS}>設定</Link>
              </Button>
            </>
          ) : (
            <>
              <form action={signInAsGuestFormAction} className="shrink-0">
                <Button type="submit" variant="ghost" size="sm" className="bg-transparent border border-black/30 text-black hover:bg-black/10 btn-washi text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 whitespace-nowrap">
                  のぞいてみる
                </Button>
              </form>
              <Button asChild variant="outline" size="sm" className="bg-transparent border-black text-black hover:bg-black hover:text-white transition-colors btn-washi text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 shrink-0">
                <Link href={ROUTE_LOGIN}>ログイン</Link>
              </Button>
              <Button asChild size="sm" className="btn-washi text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 shrink-0">
                <Link href={ROUTE_REGISTER}>新規登録</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {/* 
          Hero Section - Art Directed Sumi-e Masterpiece
        */}
        <section className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#f0ece4] dark:bg-[#1a1a2e] text-black py-32 md:py-20 flex-col bg-none">
          {/* viewport / theme で 1 枚しか描画されないため、preload (head に link rel="preload" を
              出す Next.js 16 の挙動) は使わない。代わりに loading="eager" + fetchPriority="high" で
              「読まれた瞬間に取りに行く」ことだけ伝え、4 枚全てを並行に取り合わないようにする。 */}
          <div className="absolute inset-0 z-0 bg-[#f0ece4] dark:bg-[#1a1a2e] bg-none">
            <Image src="/images/generated/landing/hero-bonsai-ink-mobile.webp" alt="" fill sizes="(max-width: 768px) 100vw, 0px" className="object-cover object-center md:hidden dark:hidden" loading="eager" fetchPriority="high" />
            <Image src="/images/generated/landing/hero-bonsai-ink.webp" alt="" fill sizes="(min-width: 768px) 100vw, 0px" className="object-cover object-center hidden md:block dark:hidden" loading="eager" fetchPriority="high" />
            <Image src="/images/generated/landing/hero-bonsai-ink-dark-mobile.webp" alt="" fill sizes="(max-width: 768px) 100vw, 0px" className="object-cover object-center hidden dark:block dark:md:hidden" />
            <Image src="/images/generated/landing/hero-bonsai-ink-dark.webp" alt="" fill sizes="(min-width: 768px) 100vw, 0px" className="object-cover object-center hidden dark:hidden dark:md:block" />
            {/* Subtle grain overlay */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.04\'/%3E%3C/svg%3E')] pointer-events-none" />
          </div>

          <div className="relative w-full max-w-7xl mx-auto px-6 flex flex-col items-start md:items-center justify-center mt-20 mb-10 md:mb-20">
            {/* Title with black text and thin white outline for readability */}
            <div className="w-full text-stroke-white">
              <h2 className="text-[5rem] sm:text-[8rem] md:text-[11rem] leading-[0.8] mb-8 tracking-[0.02em] font-black transform -rotate-2 select-none text-black">
                <span className="block ml-[-0.5rem] md:ml-[-2rem] opacity-90 transition-transform duration-700 hover:scale-105 hover:-rotate-3 origin-left">BON</span>
                <span className="block ml-[2rem] md:ml-[10rem] opacity-100 transition-transform duration-700 hover:scale-105 hover:rotate-1 origin-left">LOG</span>
              </h2>

              <div className="md:ml-[15rem] transform rotate-1 border-l-4 border-black pl-6 md:pl-10 space-y-4 max-w-2xl">
                <p className="text-xl sm:text-2xl md:text-3xl font-medium tracking-widest opacity-90 leading-relaxed text-black">
                  盆栽愛好家のための<br />コミュニティSNS
                </p>
              </div>
            </div>

            {/* Asymmetrical CTA placement */}
            <div className="mt-20 md:mt-32 w-full flex flex-col sm:flex-row gap-6 md:gap-10 md:justify-end pr-0 md:pr-20 transform -rotate-1">
              {isLoggedIn ? (
                <>
                  <Button asChild size="lg" className="h-auto text-xl px-12 py-8 btn-washi group relative overflow-hidden">
                    <Link href={ROUTE_FEED}>
                      <span className="relative z-10">タイムラインへ</span>
                      <span className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out skew-x-12" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-auto border-2 border-black bg-transparent text-black text-xl px-12 py-8 btn-washi hover:bg-black hover:text-white transition-all duration-300">
                    <Link href={ROUTE_SETTINGS_PROFILE}>プロフィール編集</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg" className="h-auto text-xl px-12 py-8 btn-washi group relative overflow-hidden">
                    <Link href={ROUTE_REGISTER}>
                      <span className="relative z-10">無料で始める</span>
                      <span className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out skew-x-12" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-auto border-2 border-black bg-transparent text-black text-xl px-12 py-8 btn-washi hover:bg-black hover:text-white transition-all duration-300">
                    <Link href={ROUTE_LOGIN}>ログイン</Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-60 text-black text-stroke-white">
            <span className="text-xs tracking-[0.3em] uppercase rotate-90 mb-6">Scroll</span>
            <div className="w-[1px] h-16 bg-black animate-pulse" />
          </div>
        </section>

        {/*
          Features Vertical Staggered Section
        */}
        <section className="relative py-40 min-h-screen">
          {/* Section Background Overlay */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {/* ライトモード背景（opacity 15%） */}
            <div className="absolute inset-0 opacity-[0.15] dark:hidden">
              <Image src="/images/generated/landing/features-tokonoma-mobile.webp" alt="" fill sizes="(max-width: 768px) 100vw, 0px" className="object-contain object-center md:hidden" />
              <Image src="/images/generated/landing/features-tokonoma.webp" alt="" fill sizes="(min-width: 768px) 100vw, 0px" className="object-contain object-center hidden md:block" />
            </div>
            {/* ダークモード背景（opacity 15%）+ 薄い黒オーバーレイ */}
            <div className="absolute inset-0 opacity-[0.15] hidden dark:block">
              <Image src="/images/generated/landing/features-tokonoma-dark-mobile.webp" alt="" fill sizes="(max-width: 768px) 100vw, 0px" className="object-contain object-center md:hidden" />
              <Image src="/images/generated/landing/features-tokonoma-dark.webp" alt="" fill sizes="(min-width: 768px) 100vw, 0px" className="object-contain object-center hidden md:block" />
            </div>
            <div className="absolute inset-0 bg-black/60 hidden dark:block" />
          </div>

          <div className="container mx-auto px-6 relative z-10">
            <SumiStrokeReveal>
              <div className="flex flex-col items-center mb-32">
                <Image
                  src="/images/brush-frames/enso.svg"
                  alt="Enso"
                  width={120}
                  height={120}
                  className="opacity-40 mb-6 transform -rotate-12"
                />
                <h3 className="text-5xl md:text-7xl font-bold tracking-widest text-center">
                  主な機能
                </h3>
              </div>
            </SumiStrokeReveal>

            {/* Asymmetrical Vertical Flow */}
            <div className="flex flex-col space-y-32 md:space-y-48 max-w-5xl mx-auto">

              {/* Feature 1 */}
              <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20">
                <div className="w-full md:w-1/2 relative">
                  <div className="card-washi bg-white p-2 transform -rotate-2 hover:rotate-0 transition-all duration-500 shadow-washi-lg z-10 relative">
                    <div className="relative aspect-[3/2] overflow-hidden grayscale contrast-125 hover:grayscale-0 transition-all duration-700">
                      <Image src="/images/generated/landing/landing-scroll-1.webp" alt="Bonsai sharing" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover dark:hidden" />
                      <Image src="/images/generated/landing/landing-scroll-1-dark.webp" alt="Bonsai sharing" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover hidden dark:block" />
                    </div>
                  </div>
                  {/* Decorative ink element behind */}
                  <div className="absolute -inset-10 bg-black/5 blur-2xl rounded-full -z-10 transform translate-x-10 translate-y-10" />
                </div>

                <div className="w-full md:w-1/2 space-y-6 transform translate-y-4 md:translate-y-12">
                  <div className="flex items-center gap-6">
                    <span className="text-6xl md:text-8xl font-black text-black/35 select-none -ml-4">壱</span>
                    <h3 className="text-3xl md:text-4xl font-bold tracking-wider">投稿・共有</h3>
                  </div>
                  <div className="brush-divider opacity-40 w-2/3" />
                  <p className="text-lg md:text-xl text-muted-foreground leading-loose tracking-wide">
                    愛培する盆栽の写真や手入れの記録を投稿。<br />
                    ジャンルごとに整理して、あなただけの盆栽の歩みを世界と共有できます。
                  </p>
                </div>
              </div>

              {/* Feature 2 (Reversed) */}
              <div className="flex flex-col md:flex-row-reverse items-center gap-12 md:gap-20">
                <div className="w-full md:w-1/2 relative">
                  <div className="card-washi bg-black p-2 transform rotate-3 hover:rotate-0 transition-all duration-500 shadow-washi-lg z-10 relative text-white">
                    <div className="relative aspect-[3/2] overflow-hidden grayscale contrast-125 hover:grayscale-0 transition-all duration-700 mix-blend-luminosity hover:mix-blend-normal">
                      <Image src="/images/generated/landing/landing-scroll-2.webp" alt="Community" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover dark:hidden" />
                      <Image src="/images/generated/landing/landing-scroll-2-dark.webp" alt="Community" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover hidden dark:block" />
                    </div>
                  </div>
                  <div className="absolute top-1/2 right-full translate-x-1/2 -translate-y-1/2 opacity-20 hidden md:block w-96 h-96">
                    <Image src="/images/brush-frames/button-blob.svg" fill className="object-contain" alt="" />
                  </div>
                </div>

                <div className="w-full md:w-1/2 space-y-6 transform -translate-y-4 md:-translate-y-12 md:text-right">
                  <div className="flex items-center md:flex-row-reverse gap-6">
                    <span className="text-6xl md:text-8xl font-black text-black/35 select-none md:-mr-4">弐</span>
                    <h3 className="text-3xl md:text-4xl font-bold tracking-wider">コミュニティ</h3>
                  </div>
                  <div className="brush-divider opacity-40 w-2/3 md:ml-auto" />
                  <p className="text-lg md:text-xl text-muted-foreground leading-loose tracking-wide">
                    同じ趣味を持つ仲間とつながる。<br />
                    フォローして最新情報をチェックし、知識や経験を深め合う場所。
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20">
                <div className="w-full md:w-1/2 relative">
                  <div className="card-washi bg-white p-2 transform -rotate-1 hover:rotate-0 transition-all duration-500 shadow-washi-lg z-10 relative">
                    <div className="relative aspect-[3/2] overflow-hidden grayscale contrast-125 hover:grayscale-0 transition-all duration-700">
                      <Image src="/images/generated/landing/landing-scroll-3.webp" alt="Japanese garden" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover dark:hidden" />
                      <Image src="/images/generated/landing/landing-scroll-3-dark.webp" alt="Japanese garden" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover hidden dark:block" />
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-1/2 space-y-6 transform translate-y-8">
                  <div className="flex items-center gap-6">
                    <span className="text-6xl md:text-8xl font-black text-black/35 select-none -ml-4">参</span>
                    <h3 className="text-3xl md:text-4xl font-bold tracking-wider">盆栽園マップ</h3>
                  </div>
                  <div className="brush-divider opacity-40 w-2/3" />
                  <p className="text-lg md:text-xl text-muted-foreground leading-loose tracking-wide">
                    全国の隠れた名園を地図から探す。<br />
                    訪れた盆栽園のレビューを投稿し、新たな名所を共有。
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 
          Characteristics Section (Bonsai Features Grid but chaotic)
        */}
        <section className="relative py-32 bg-black text-white px-6 overflow-hidden dark">
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none filter invert mix-blend-screen">
            <Image src="/images/generated/landing/features-tokonoma-mobile.webp" alt="" fill sizes="(max-width: 768px) 100vw, 0px" className="object-cover md:hidden dark:hidden" />
            <Image src="/images/generated/landing/features-tokonoma.webp" alt="" fill sizes="(min-width: 768px) 100vw, 0px" className="object-cover hidden md:block dark:hidden" />
            <Image src="/images/generated/landing/features-tokonoma-dark-mobile.webp" alt="" fill sizes="(max-width: 768px) 100vw, 0px" className="object-cover hidden dark:block dark:md:hidden" />
            <Image src="/images/generated/landing/features-tokonoma-dark.webp" alt="" fill sizes="(min-width: 768px) 100vw, 0px" className="object-cover hidden dark:hidden dark:md:block" />
          </div>

          <div className="container mx-auto relative z-10">
            <SumiStrokeReveal>
              <h3 className="text-4xl md:text-6xl font-bold mb-20 md:mb-32 text-center md:text-left md:pl-20 border-l-4 border-white/20 pl-6 transform -rotate-1">
                BON-LOG の<br />特徴
              </h3>
            </SumiStrokeReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-24 max-w-6xl mx-auto">
              {/* Point 1 */}
              <div className="relative group p-8 card-washi border-white/10 hover:border-white/40 transition-colors bg-black/50 backdrop-blur-sm transform rotate-1 hover:-translate-y-2">
                <div className="absolute -top-10 -right-6 text-8xl font-black text-white/5 group-hover:text-white/10 transition-colors pointer-events-none select-none">
                  探
                </div>
                <h4 className="text-2xl font-bold mb-6 tracking-widest relative z-10">盆栽園を検索</h4>
                <div className="w-12 h-1 bg-white/30 mb-6 group-hover:w-full transition-all duration-500" />
                <p className="text-white/70 leading-relaxed font-light">
                  位置情報や好みのジャンルから、あなたにぴったりの盆栽園を直感的に探せます。
                </p>
              </div>

              {/* Point 2 */}
              <div className="relative group p-8 card-washi border-white/10 hover:border-white/40 transition-colors bg-black/50 backdrop-blur-sm transform -rotate-2 md:mt-16 hover:-translate-y-2">
                <div className="absolute -bottom-6 -left-6 text-8xl font-black text-white/5 group-hover:text-white/10 transition-colors pointer-events-none select-none">
                  遇
                </div>
                <h4 className="text-2xl font-bold mb-6 tracking-widest relative z-10">イベント確認</h4>
                <div className="w-12 h-1 bg-white/30 mb-6 group-hover:w-full transition-all duration-500" />
                <p className="text-white/70 leading-relaxed font-light">
                  全国の展示会や即売会の情報を常に最新の状態でお届け。見逃しを防ぎます。
                </p>
              </div>

              {/* Point 3 */}
              <div className="relative group p-8 card-washi border-white/10 hover:border-white/40 transition-colors bg-black/50 backdrop-blur-sm transform rotate-1 md:mt-32 hover:-translate-y-2">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10rem] font-black text-white/5 group-hover:text-white/10 transition-colors pointer-events-none select-none">
                  結
                </div>
                <h4 className="text-2xl font-bold mb-6 tracking-widest relative z-10">仲間と繋がる</h4>
                <div className="w-12 h-1 bg-white/30 mb-6 group-hover:w-full transition-all duration-500" />
                <p className="text-white/70 leading-relaxed font-light">
                  日々の盆栽に対する熱狂や知識を分かち合う、純粋で濃密なコミュニケーション空間。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/*
          Knowledge Base Section — 病害虫・薬剤 / 植物ホルモン / 肥料の専門ガイド
          ライト: 鳥の子色 (#f0ece4) ベース、ダーク: neutral-900 ベース
          各カードからログイン後の専門ページに遷移できる導線を提供。
        */}
        <section className="relative py-32 md:py-40 px-6 overflow-hidden bg-[#f0ece4] dark:bg-neutral-900 text-black dark:text-white">
          {/* 装飾: 円相 — ライトは控えめ、ダークは更に薄く */}
          <div className="absolute -top-24 -right-24 opacity-[0.06] dark:opacity-[0.04] pointer-events-none select-none">
            <Image
              src="/images/brush-frames/enso.svg"
              alt=""
              width={500}
              height={500}
              className="dark:invert"
            />
          </div>

          <div className="container mx-auto relative z-10">
            <SumiStrokeReveal>
              <div className="flex flex-col items-center mb-20 md:mb-28">
                <h3 className="text-4xl md:text-6xl font-bold tracking-widest text-center transform -rotate-1">
                  専門ガイド
                </h3>
                <div className="brush-divider opacity-40 w-24 mt-6" />
                <p className="mt-8 text-base md:text-lg text-muted-foreground tracking-wider text-center max-w-2xl leading-relaxed">
                  日々の管理から治療まで。盆栽を支える知識を体系的に。<br className="hidden md:inline" />
                  会員登録すれば、いつでも引ける専門データベースが手に入ります。
                </p>
              </div>
            </SumiStrokeReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-14 max-w-6xl mx-auto">

              {/* Guide 1: 病害虫・薬剤データベース */}
              <Link
                href={ROUTE_PESTICIDES}
                className="group relative p-8 md:p-10 card-washi border-black/15 dark:border-white/15 hover:border-black/50 dark:hover:border-white/40 bg-white/60 dark:bg-black/40 backdrop-blur-sm transform -rotate-1 hover:rotate-0 hover:-translate-y-2 transition-all duration-500 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
              >
                <div className="absolute -top-6 -right-4 text-8xl md:text-9xl font-black text-black/[0.06] dark:text-white/[0.05] group-hover:text-black/15 dark:group-hover:text-white/15 transition-colors pointer-events-none select-none">
                  薬
                </div>
                <h4 className="text-2xl font-bold mb-3 tracking-widest relative z-10">病害虫・薬剤</h4>
                <div className="w-10 h-1 bg-black/40 dark:bg-white/40 mb-6 group-hover:w-full transition-all duration-500" />
                <p className="text-base text-black/75 dark:text-white/75 leading-relaxed font-light relative z-10">
                  病害虫の図鑑と農薬・展着剤のデータベース。<br />
                  原体・剤型・効果・混用の可否まで横断検索。
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold tracking-widest text-black/80 dark:text-white/80 group-hover:gap-4 transition-all relative z-10">
                  図鑑を見る
                  <span aria-hidden="true">→</span>
                </span>
              </Link>

              {/* Guide 2: 植物ホルモンガイド */}
              <Link
                href={ROUTE_HORMONES}
                className="group relative p-8 md:p-10 card-washi border-black/15 dark:border-white/15 hover:border-black/50 dark:hover:border-white/40 bg-white/60 dark:bg-black/40 backdrop-blur-sm transform rotate-1 md:mt-12 hover:rotate-0 hover:-translate-y-2 transition-all duration-500 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
              >
                <div className="absolute -bottom-6 -left-4 text-8xl md:text-9xl font-black text-black/[0.06] dark:text-white/[0.05] group-hover:text-black/15 dark:group-hover:text-white/15 transition-colors pointer-events-none select-none">
                  命
                </div>
                <h4 className="text-2xl font-bold mb-3 tracking-widest relative z-10">植物ホルモン</h4>
                <div className="w-10 h-1 bg-black/40 dark:bg-white/40 mb-6 group-hover:w-full transition-all duration-500" />
                <p className="text-base text-black/75 dark:text-white/75 leading-relaxed font-light relative z-10">
                  五大ホルモンの働きと相互作用、技法ごとの効果。<br />
                  年間カレンダーやシミュレーターで盆栽の生理を可視化。
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold tracking-widest text-black/80 dark:text-white/80 group-hover:gap-4 transition-all relative z-10">
                  ガイドを見る
                  <span aria-hidden="true">→</span>
                </span>
              </Link>

              {/* Guide 3: 肥料ガイド */}
              <Link
                href={ROUTE_FERTILIZERS}
                className="group relative p-8 md:p-10 card-washi border-black/15 dark:border-white/15 hover:border-black/50 dark:hover:border-white/40 bg-white/60 dark:bg-black/40 backdrop-blur-sm transform -rotate-1 md:mt-24 hover:rotate-0 hover:-translate-y-2 transition-all duration-500 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10rem] font-black text-black/[0.05] dark:text-white/[0.04] group-hover:text-black/10 dark:group-hover:text-white/10 transition-colors pointer-events-none select-none">
                  養
                </div>
                <h4 className="text-2xl font-bold mb-3 tracking-widest relative z-10">肥料ガイド</h4>
                <div className="w-10 h-1 bg-black/40 dark:bg-white/40 mb-6 group-hover:w-full transition-all duration-500" />
                <p className="text-base text-black/75 dark:text-white/75 leading-relaxed font-light relative z-10">
                  栄養素辞典と樹種別の月次施肥スケジュール。<br />
                  カテゴリ比較・症状からの逆引きで施肥判断を支援。
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold tracking-widest text-black/80 dark:text-white/80 group-hover:gap-4 transition-all relative z-10">
                  カレンダーを見る
                  <span aria-hidden="true">→</span>
                </span>
              </Link>

            </div>
          </div>
        </section>

        {/*
          CTA Section
        */}
        <section className="relative overflow-hidden py-40 bg-white dark:bg-neutral-900 text-black dark:text-white">
          <div className="absolute right-0 bottom-0 opacity-10 dark:opacity-[0.04] pointer-events-none transform translate-x-1/4 translate-y-1/4">
            <Image
              src="/images/brush-frames/enso.svg"
              alt="Enso background"
              width={800}
              height={800}
            />
          </div>
          <div className="absolute left-0 bottom-0 opacity-15 dark:opacity-[0.06] pointer-events-none transform -translate-x-1/4 translate-y-1/4">
            <Image src="/images/generated/landing/cta-enso-bonsai-mobile.webp" alt="" width={400} height={500} className="object-contain md:hidden dark:hidden" />
            <Image src="/images/generated/landing/cta-enso-bonsai.webp" alt="" width={600} height={600} className="object-contain hidden md:block dark:hidden" />
            <Image src="/images/generated/landing/cta-enso-bonsai-dark-mobile.webp" alt="" width={400} height={500} className="object-contain hidden dark:block dark:md:hidden" />
            <Image src="/images/generated/landing/cta-enso-bonsai-dark.webp" alt="" width={600} height={600} className="object-contain hidden dark:hidden dark:md:block" />
          </div>

          <div className="container mx-auto px-6 relative z-10 text-center flex flex-col items-center">
            {isLoggedIn ? (
              <>
                <h3 className="text-4xl md:text-6xl font-black mb-12 tracking-widest transform -rotate-1">
                  墨の道へ<br />戻る
                </h3>
                <p className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 mb-16 tracking-widest">
                  最新の投稿があなたを待っています。
                </p>
                <Button asChild size="lg" className="h-auto text-2xl px-16 py-10 btn-washi transform hover:-rotate-2">
                  <Link href={ROUTE_FEED}>タイムラインへ</Link>
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-4xl md:text-6xl font-black mb-12 tracking-widest transform -rotate-1">
                  今すぐ<br />始める
                </h3>
                <p className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 mb-16 tracking-widest">
                  純粋な盆栽愛を、ここに刻もう。
                </p>
                <div className="flex flex-col sm:flex-row gap-8 justify-center items-center">
                  <Button asChild size="lg" className="h-auto text-2xl px-16 py-10 btn-washi transform hover:scale-105 hover:-rotate-2">
                    <Link href={ROUTE_REGISTER}>無料で新規登録</Link>
                  </Button>
                  <span className="text-gray-500 dark:text-gray-400 italic font-serif">または</span>
                  <form action={signInAsGuestFormAction} className="contents">
                    <Button type="submit" variant="outline" size="lg" className="h-auto border-2 border-black dark:border-white bg-transparent text-black dark:text-white text-xl px-12 py-8 btn-washi hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all duration-300 transform hover:scale-105 hover:rotate-1">
                      のぞいてみる
                    </Button>
                  </form>
                  <Button asChild variant="outline" size="lg" className="h-auto border-2 border-black bg-transparent text-black text-xl px-12 py-8 btn-washi hover:bg-black hover:text-white transition-all duration-300 transform hover:scale-105 hover:rotate-1">
                    <Link href={ROUTE_LOGIN}>ログイン</Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      {/* 
        Footer - Raw and minimalist
      */}
      <footer className="border-t-[3px] border-black bg-white text-black py-16">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end gap-12">
            <div>
              <h3 className="text-4xl font-black text-black mb-4 tracking-widest">BON-LOG</h3>
              <p className="text-sm font-bold tracking-widest opacity-80">盆栽愛好家のためのSNS</p>
            </div>

            <div className="flex flex-wrap gap-6 md:gap-12 items-start md:items-center font-medium tracking-wider">
              <Link href={ROUTE_ABOUT} className="relative group overflow-hidden">
                <span className="relative z-10 transition-colors group-hover:text-white">BON-LOGについて</span>
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-black transform origin-left transition-transform scale-x-0 group-hover:scale-x-100" />
                <span className="absolute inset-0 bg-black transform origin-bottom transition-transform scale-y-0 group-hover:scale-y-100 -z-10" />
              </Link>
              <Link href={ROUTE_PRIVACY} className="relative group overflow-hidden">
                <span className="relative z-10 transition-colors group-hover:text-white">プライバシーポリシー</span>
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-black transform origin-left transition-transform scale-x-0 group-hover:scale-x-100" />
                <span className="absolute inset-0 bg-black transform origin-bottom transition-transform scale-y-0 group-hover:scale-y-100 -z-10" />
              </Link>
              <Link href={ROUTE_TERMS} className="relative group overflow-hidden">
                <span className="relative z-10 transition-colors group-hover:text-white">利用規約</span>
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-black transform origin-left transition-transform scale-x-0 group-hover:scale-x-100" />
                <span className="absolute inset-0 bg-black transform origin-bottom transition-transform scale-y-0 group-hover:scale-y-100 -z-10" />
              </Link>
              <Link href={ROUTE_HELP} className="relative group overflow-hidden">
                <span className="relative z-10 transition-colors group-hover:text-white">ヘルプ</span>
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-black transform origin-left transition-transform scale-x-0 group-hover:scale-x-100" />
                <span className="absolute inset-0 bg-black transform origin-bottom transition-transform scale-y-0 group-hover:scale-y-100 -z-10" />
              </Link>
              <Link href={ROUTE_CONTACT} className="relative group overflow-hidden">
                <span className="relative z-10 transition-colors group-hover:text-white">お問い合わせ</span>
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-black transform origin-left transition-transform scale-x-0 group-hover:scale-x-100" />
                <span className="absolute inset-0 bg-black transform origin-bottom transition-transform scale-y-0 group-hover:scale-y-100 -z-10" />
              </Link>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-black/20 flex justify-between items-center text-xs tracking-widest font-bold">
            <p>&copy; {new Date().getFullYear()} BON-LOG</p>
            <p>ALL RIGHTS RESERVED.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
