import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { SumiStrokeReveal } from '@/components/landing/SumiStrokeReveal'
import { AnimatedInkImage } from '@/components/landing/AnimatedInkImage'
import { LandingAuthCTA } from '@/components/landing/LandingAuthCTA'
import { LandingThemeToggle } from '@/components/landing/LandingThemeToggle'
import { HomeUrlCleaner } from '@/components/landing/HomeUrlCleaner'
import {
  LANDING_HERO_FRAMES,
  LANDING_FEATURE_POST_FRAMES,
  LANDING_FEATURE_COMMUNITY_FRAMES,
  LANDING_FEATURE_MAP_FRAMES,
  LANDING_FINAL_CTA_FRAMES,
  LANDING_ANIMATION_TIMING,
} from '@/lib/constants/landing-animation'
import {
  BASE_URL,
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

// Why no server auth(): server-side `auth()` を持たず、認証状態依存の CTA は
// [[LandingAuthCTA]] (client island) が `useSession()` で hydrate 後に flip する。
// 初回ペイント・SEO クローラ・未認証ユーザーは常に未認証 CTA を見る。
// 注: ページ自体は静的だが、root layout の `headers()` (CSP nonce) により HTML は
// SSG されず dynamic rendering となる (prerender されるのは robots.txt 等のみ)。
export default function Home() {
  return (
    <div className="min-h-screen washi-texture text-foreground overflow-x-hidden selection:bg-black selection:text-white bg-kinoko">
      <HomeUrlCleaner />
      <header className="fixed top-0 left-0 right-0 z-50 px-3 py-3 sm:px-6 sm:py-4 md:p-8 flex items-center justify-between gap-3 pointer-events-none max-w-[100vw]">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-widest text-black pointer-events-auto filter drop-shadow-md shrink-0 text-stroke-white">
          BON-LOG
        </h1>
        {/*
          ヘッダー右側のクラスタ: テーマトグル + 認証 CTA。
          LandingThemeToggle は LandingAuthCTA と同じサイズ (h-8/9) で
          ボタン群の左端に配置し、墨絵調のリズムを保つ。
        */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          <LandingThemeToggle />
          <LandingAuthCTA variant="header" />
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-kinoko dark:bg-yozora text-black py-32 md:py-20 flex-col bg-none">
          <div className="absolute inset-0 z-0 bg-kinoko dark:bg-yozora bg-none">
            <AnimatedInkImage
              frames={LANDING_HERO_FRAMES}
              alt=""
              fill
              sizes="100vw"
              priority
              lazyStart={false}
              frameDurationMs={LANDING_ANIMATION_TIMING.hero.frameDurationMs}
              crossfadeMs={LANDING_ANIMATION_TIMING.hero.crossfadeMs}
              loop={LANDING_ANIMATION_TIMING.hero.loop}
              className="absolute inset-0"
              imageClassName="object-cover object-center"
            />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.04\'/%3E%3C/svg%3E')] pointer-events-none" />
          </div>

          <div className="relative w-full max-w-7xl mx-auto px-6 flex flex-col items-start md:items-center justify-center mt-20 mb-10 md:mb-20">
            <div className="w-full text-stroke-white">
              {/* h1 (BON-LOG) と同内容の装飾ワードマーク。見出し階層を汚さないよう aria-hidden の装飾要素にする。 */}
              <div aria-hidden="true" className="text-[5rem] sm:text-[8rem] md:text-[11rem] leading-[0.8] mb-8 tracking-[0.02em] font-black transform -rotate-2 select-none text-black">
                <span className="block ml-[-0.5rem] md:ml-[-2rem] opacity-90 transition-transform duration-700 hover:scale-105 hover:-rotate-3 origin-left">BON</span>
                <span className="block ml-[2rem] md:ml-[10rem] opacity-100 transition-transform duration-700 hover:scale-105 hover:rotate-1 origin-left">LOG</span>
              </div>

              <div className="md:ml-[15rem] transform rotate-1 border-l-4 border-black pl-6 md:pl-10 space-y-4 max-w-2xl">
                <p className="text-xl sm:text-2xl md:text-3xl font-medium tracking-widest opacity-90 leading-relaxed text-black">
                  盆栽愛好家のための<br />コミュニティSNS
                </p>
              </div>
            </div>

            <LandingAuthCTA variant="hero" />
          </div>

        </section>

        <section className="relative py-40 min-h-screen">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute inset-0 opacity-[0.15] dark:hidden">
              <Image src="/images/generated/landing/features-tokonoma-mobile.webp" alt="" fill sizes="(max-width: 768px) 100vw, 0px" className="object-contain object-center md:hidden" />
              <Image src="/images/generated/landing/features-tokonoma.webp" alt="" fill sizes="(min-width: 768px) 100vw, 0px" className="object-contain object-center hidden md:block" />
            </div>
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
                <h2 className="text-5xl md:text-7xl font-bold tracking-widest text-center">
                  主な機能
                </h2>
              </div>
            </SumiStrokeReveal>

            <div className="flex flex-col space-y-32 md:space-y-48 max-w-5xl mx-auto">

              <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20">
                <div className="w-full md:w-1/2 relative">
                  <div className="card-washi bg-white p-2 transform -rotate-2 hover:rotate-0 transition-all duration-500 shadow-washi-lg z-10 relative">
                    <div className="relative aspect-[3/2] overflow-hidden grayscale contrast-125 hover:grayscale-0 transition-all duration-700">
                      <AnimatedInkImage
                        frames={LANDING_FEATURE_POST_FRAMES}
                        alt="Bonsai journal sketches"
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        frameDurationMs={LANDING_ANIMATION_TIMING.feature.frameDurationMs}
                        loop={LANDING_ANIMATION_TIMING.feature.loop}
                        loopPauseMs={LANDING_ANIMATION_TIMING.feature.loopPauseMs}
                        className="absolute inset-0"
                        imageClassName="object-cover"
                      />
                    </div>
                  </div>
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

              <div className="flex flex-col md:flex-row-reverse items-center gap-12 md:gap-20">
                <div className="w-full md:w-1/2 relative">
                  <div className="card-washi bg-black p-2 transform rotate-3 hover:rotate-0 transition-all duration-500 shadow-washi-lg z-10 relative text-white">
                    <div className="relative aspect-[3/2] overflow-hidden grayscale contrast-125 hover:grayscale-0 transition-all duration-700 mix-blend-luminosity hover:mix-blend-normal">
                      <AnimatedInkImage
                        frames={LANDING_FEATURE_COMMUNITY_FRAMES}
                        alt="Community bonsai gathering"
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        frameDurationMs={LANDING_ANIMATION_TIMING.feature.frameDurationMs}
                        loop={LANDING_ANIMATION_TIMING.feature.loop}
                        loopPauseMs={LANDING_ANIMATION_TIMING.feature.loopPauseMs}
                        className="absolute inset-0"
                        imageClassName="object-cover"
                      />
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

              <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20">
                <div className="w-full md:w-1/2 relative">
                  <div className="card-washi bg-white p-2 transform -rotate-1 hover:rotate-0 transition-all duration-500 shadow-washi-lg z-10 relative">
                    <div className="relative aspect-[3/2] overflow-hidden grayscale contrast-125 hover:grayscale-0 transition-all duration-700">
                      <AnimatedInkImage
                        frames={LANDING_FEATURE_MAP_FRAMES}
                        alt="Bonsai garden map"
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        frameDurationMs={LANDING_ANIMATION_TIMING.feature.frameDurationMs}
                        loop={LANDING_ANIMATION_TIMING.feature.loop}
                        loopPauseMs={LANDING_ANIMATION_TIMING.feature.loopPauseMs}
                        className="absolute inset-0"
                        imageClassName="object-cover"
                      />
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

        <section className="relative py-32 bg-black text-white px-6 overflow-hidden dark">
          <div className="container mx-auto relative z-10">
            <SumiStrokeReveal>
              <h2 className="text-4xl md:text-6xl font-bold mb-20 md:mb-32 text-center md:text-left md:pl-20 border-l-4 border-white/20 pl-6 transform -rotate-1">
                BON-LOG の<br />特徴
              </h2>
            </SumiStrokeReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-24 max-w-6xl mx-auto">
              <div className="relative group p-8 card-washi border-white/10 hover:border-white/40 transition-colors bg-black/50 backdrop-blur-sm transform rotate-1 hover:-translate-y-2">
                <div className="absolute -top-10 -right-6 text-8xl font-black text-white/5 group-hover:text-white/10 transition-colors pointer-events-none select-none">
                  探
                </div>
                <h3 className="text-2xl font-bold mb-6 tracking-widest relative z-10">盆栽園を検索</h3>
                <div className="w-12 h-1 bg-white/30 mb-6 group-hover:w-full transition-all duration-500" />
                <p className="text-white/70 leading-relaxed font-light">
                  位置情報や好みのジャンルから、あなたにぴったりの盆栽園を直感的に探せます。
                </p>
              </div>

              <div className="relative group p-8 card-washi border-white/10 hover:border-white/40 transition-colors bg-black/50 backdrop-blur-sm transform -rotate-2 md:mt-16 hover:-translate-y-2">
                <div className="absolute -bottom-6 -left-6 text-8xl font-black text-white/5 group-hover:text-white/10 transition-colors pointer-events-none select-none">
                  遇
                </div>
                <h3 className="text-2xl font-bold mb-6 tracking-widest relative z-10">イベント確認</h3>
                <div className="w-12 h-1 bg-white/30 mb-6 group-hover:w-full transition-all duration-500" />
                <p className="text-white/70 leading-relaxed font-light">
                  全国の展示会や即売会の情報を常に最新の状態でお届け。見逃しを防ぎます。
                </p>
              </div>

              <div className="relative group p-8 card-washi border-white/10 hover:border-white/40 transition-colors bg-black/50 backdrop-blur-sm transform rotate-1 md:mt-32 hover:-translate-y-2">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10rem] font-black text-white/5 group-hover:text-white/10 transition-colors pointer-events-none select-none">
                  結
                </div>
                <h3 className="text-2xl font-bold mb-6 tracking-widest relative z-10">仲間と繋がる</h3>
                <div className="w-12 h-1 bg-white/30 mb-6 group-hover:w-full transition-all duration-500" />
                <p className="text-white/70 leading-relaxed font-light">
                  日々の盆栽に対する熱狂や知識を分かち合う、純粋で濃密なコミュニケーション空間。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative py-32 md:py-40 px-6 overflow-hidden bg-kinoko dark:bg-neutral-900 text-black dark:text-white">
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
                <h2 className="text-4xl md:text-6xl font-bold tracking-widest text-center transform -rotate-1">
                  専門ガイド
                </h2>
                <div className="brush-divider opacity-40 w-24 mt-6" />
                <p className="mt-8 text-base md:text-lg text-muted-foreground tracking-wider text-center max-w-2xl leading-relaxed">
                  日々の管理から治療まで。盆栽を支える知識を体系的に。<br className="hidden md:inline" />
                  会員登録すれば、いつでも引ける専門データベースが手に入ります。
                </p>
              </div>
            </SumiStrokeReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-14 max-w-6xl mx-auto">

              <Link
                href={ROUTE_PESTICIDES}
                className="group relative p-8 md:p-10 card-washi border-black/15 dark:border-white/15 hover:border-black/50 dark:hover:border-white/40 bg-white/60 dark:bg-black/40 backdrop-blur-sm transform -rotate-1 hover:rotate-0 hover:-translate-y-2 transition-all duration-500 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
              >
                <div className="absolute -top-6 -right-4 text-8xl md:text-9xl font-black text-black/[0.06] dark:text-white/[0.05] group-hover:text-black/15 dark:group-hover:text-white/15 transition-colors pointer-events-none select-none">
                  薬
                </div>
                <h3 className="text-2xl font-bold mb-3 tracking-widest relative z-10">病害虫・薬剤</h3>
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

              <Link
                href={ROUTE_HORMONES}
                className="group relative p-8 md:p-10 card-washi border-black/15 dark:border-white/15 hover:border-black/50 dark:hover:border-white/40 bg-white/60 dark:bg-black/40 backdrop-blur-sm transform rotate-1 md:mt-12 hover:rotate-0 hover:-translate-y-2 transition-all duration-500 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
              >
                <div className="absolute -bottom-6 -left-4 text-8xl md:text-9xl font-black text-black/[0.06] dark:text-white/[0.05] group-hover:text-black/15 dark:group-hover:text-white/15 transition-colors pointer-events-none select-none">
                  命
                </div>
                <h3 className="text-2xl font-bold mb-3 tracking-widest relative z-10">植物ホルモン</h3>
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

              <Link
                href={ROUTE_FERTILIZERS}
                className="group relative p-8 md:p-10 card-washi border-black/15 dark:border-white/15 hover:border-black/50 dark:hover:border-white/40 bg-white/60 dark:bg-black/40 backdrop-blur-sm transform -rotate-1 md:mt-24 hover:rotate-0 hover:-translate-y-2 transition-all duration-500 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10rem] font-black text-black/[0.05] dark:text-white/[0.04] group-hover:text-black/10 dark:group-hover:text-white/10 transition-colors pointer-events-none select-none">
                  養
                </div>
                <h3 className="text-2xl font-bold mb-3 tracking-widest relative z-10">肥料ガイド</h3>
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

        <section className="relative overflow-hidden py-40 bg-white dark:bg-neutral-900 text-black dark:text-white">
          <div className="absolute right-0 bottom-0 opacity-10 dark:opacity-[0.04] pointer-events-none transform translate-x-1/4 translate-y-1/4">
            <Image
              src="/images/brush-frames/enso.svg"
              alt="Enso background"
              width={800}
              height={800}
            />
          </div>
          {/* 画像の washi 背景色が section bg と僅かに異なるため、radial-gradient mask で
              全辺を透明にフェードして靄越しに溶け込ませる。 */}
          <div
            className="absolute left-0 bottom-0 opacity-15 dark:opacity-[0.06] pointer-events-none transform -translate-x-1/4 translate-y-1/4"
            style={{
              maskImage:
                'radial-gradient(ellipse at center, black 35%, transparent 88%)',
              WebkitMaskImage:
                'radial-gradient(ellipse at center, black 35%, transparent 88%)',
            }}
          >
            <AnimatedInkImage
              frames={LANDING_FINAL_CTA_FRAMES}
              alt=""
              width={600}
              height={600}
              sizes="(max-width: 768px) 400px, 600px"
              frameDurationMs={LANDING_ANIMATION_TIMING.finalCta.frameDurationMs}
              loop={LANDING_ANIMATION_TIMING.finalCta.loop}
              imageClassName="object-contain"
            />
          </div>

          <div className="container mx-auto px-6 relative z-10 text-center flex flex-col items-center">
            <LandingAuthCTA variant="final" />
          </div>
        </section>
      </main>

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
