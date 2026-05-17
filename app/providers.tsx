'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration'
import { STALE_TIME_MS } from '@/lib/constants/limits'

export function Providers({ children }: { children: React.ReactNode }) {
  // useState の初期化関数で QueryClient を 1 度だけ生成し、再レンダリング時の再生成を避ける。
  // SNS は頻繁なタブ切り替えがあるため refetchOnWindowFocus は無効化する (不要な再 fetch 抑制)。
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME_MS,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {children}
          <ServiceWorkerRegistration />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
