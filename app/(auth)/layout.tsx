import Image from 'next/image'
import { ArrowLeft as ArrowLeftIcon } from 'lucide-react'
import { ROUTE_HOME_FROM_AUTH } from '@/lib/constants/routes'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden washi-texture text-foreground selection:bg-black selection:text-white bg-background">
      {/*
        トップへ戻るボタン: ログアウト直後（未ログイン）に踏まれる。
        proxy.ts は `/` をログイン状態に応じて `/feed` へ 307 する。この認証依存リダイレクトを
        ブラウザ / CDN / bfcache が保持していると、ログアウト後でも Cookie を再評価せず
        `/feed` → `/onboarding` と誤遷移する。`<a>` 化で Router Cache を、proxy 側の no-store で
        HTTP cache を塞いだが、CDN / bfcache 経路で再発し得た。
        そこで「ログイン中には決して訪問され得ない」クエリ付き URL (`/?from=auth`) へ遷移させ、
        キャッシュ済みリダイレクトが構造的に存在し得ない状態を作る。着地後は landing 側の
        HomeUrlCleaner が `?from=auth` を履歴から除去し URL を `/` に戻す。
        next/link ではなく素の `<a>` なのは、full-page navigation で proxy に最新 Cookie を
        評価させるため。
      */}
      <a
        href={ROUTE_HOME_FROM_AUTH}
        className="fixed top-6 left-6 z-50 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors bg-background/80 backdrop-blur-md px-4 py-2 rounded-full border shadow-sm group"
      >
        <ArrowLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        トップへ戻る
      </a>

      {/* 墨飛沫背景。viewport / theme で 1 枚しか表示されないため preload は使わず
          loading="eager" + fetchPriority="high" で帯域競合を避ける。 */}
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none overflow-hidden">
        <Image
          src="/images/generated/auth/auth-bonsai-gate-mobile.webp"
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 0px"
          className="object-contain object-center md:hidden dark:hidden"
          loading="eager"
          fetchPriority="high"
        />
        <div className="absolute -top-[10%] -bottom-[10%] inset-x-0 hidden md:block dark:md:hidden">
          <Image
            src="/images/generated/auth/auth-bonsai-gate.webp"
            alt=""
            fill
            sizes="(min-width: 768px) 100vw, 0px"
            className="object-contain object-center"
            loading="eager"
            fetchPriority="high"
          />
        </div>
        <Image
          src="/images/generated/auth/auth-bonsai-gate-dark-mobile.webp"
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 0px"
          className="object-contain object-center hidden dark:max-md:block"
        />
        <div className="absolute -top-[10%] -bottom-[10%] inset-x-0 hidden dark:md:block">
          <Image
            src="/images/generated/auth/auth-bonsai-gate-dark.webp"
            alt=""
            fill
            sizes="(min-width: 768px) 100vw, 0px"
            className="object-contain object-center"
          />
        </div>
      </div>

      {/*
        メインコンテナ
        アシンメトリーを強調するため、コンテナ全体をわずかに傾ける (-rotate-1)
      */}
      <div className="w-full max-w-md relative z-10 animate-fade-in transform -rotate-1">
        <div className="flex items-center justify-center mb-10 opacity-60">
          <div className="w-24 brush-divider" />
          <div className="mx-4 font-black text-2xl tracking-widest text-foreground/50 select-none">・</div>
          <div className="w-24 brush-divider" />
        </div>

        <div className="text-center mb-12">
          <h1 className="text-6xl md:text-7xl font-black tracking-widest text-foreground drop-shadow-sm select-none">
            BON<span className="opacity-80 ml-2">-</span>LOG
          </h1>
          <p className="text-muted-foreground mt-6 text-sm md:text-base tracking-[0.3em] font-medium mix-blend-multiply dark:mix-blend-normal">
            盆栽愛好家のためのSNS
          </p>
        </div>

        {/*
          メインカード（ライト時は白、ダーク時は透明でテーマに追従）
          四角いボーダーではなく、墨枠 (card-washi) で囲む。
          背面のコンテナの傾き (-rotate-1) とは逆方向に少し戻す (rotate-1) ことでバランスを取る。

          Why dark で overlay / blur を入れない:
            背面の墨絵 (auth-bonsai-gate-dark.webp) を景観として見せる要件のため、
            コンテナ側で背景を覆う overlay も blur も持たない。
            フォーム入力欄は `auth-glass [data-slot="input"]` 側で 0.3 opacity の
            半透明背景を別途持ち、入力部分だけ局所的に読みやすくする。
        */}
        <div className="relative card-washi bg-white/30 dark:bg-transparent backdrop-blur-md dark:backdrop-blur-none p-2 shadow-washi-lg transform rotate-1 auth-glass">
          <main id="main-content" tabIndex={-1} className="relative z-10 text-card-foreground p-6 md:p-8">
            {children}
          </main>
        </div>

        <div className="flex items-center justify-center mt-12 opacity-40">
          <div className="w-32 brush-divider" />
        </div>
      </div>
    </div>
  )
}
