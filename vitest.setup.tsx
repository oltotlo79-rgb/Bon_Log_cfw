/* eslint-disable no-console */
// TextEncoder/TextDecoder polyfill (pg/Prisma)
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as typeof global.TextDecoder

// production 想定の env validation を実行するテストが production を明示的に設定するため、
// 先行テストの NODE_ENV='production' 残留時にも `getAppUrl()` (lib/env.ts) が throw しないよう
// 既定値を供給する。個別テストが上書きする場合は beforeEach で明示的に再設定すること。
if (!process.env.NEXT_PUBLIC_APP_URL) {
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
}

// @testing-library/jest-dom extended matchers (compatible with Vitest)
import '@testing-library/jest-dom'

// server-only mock (テスト環境ではClient扱いになるため)
vi.mock('server-only', () => ({}))

// client-logger mock (テスト環境ではconsoleに委譲)
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    error: (...args: unknown[]) => console.error(...args),
    log: (...args: unknown[]) => console.log(...args),
    warn: (...args: unknown[]) => console.warn(...args),
  },
}))

// Global mocks
// Database mock (Prisma)
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    follow: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    followRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// next/cache global mock — unstable_cache, revalidatePath, revalidateTag, cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

// Follow request actions mock (avoid next/cache Request error)
vi.mock('@/lib/actions/follow-request', () => ({
  sendFollowRequest: vi.fn().mockResolvedValue({ success: true, status: 'pending' }),
  cancelFollowRequest: vi.fn().mockResolvedValue({ success: true }),
  approveFollowRequest: vi.fn().mockResolvedValue({ success: true, status: 'approved' }),
  rejectFollowRequest: vi.fn().mockResolvedValue({ success: true, status: 'rejected' }),
  getFollowRequestStatus: vi.fn().mockResolvedValue({ hasRequest: false, status: null }),
  getReceivedFollowRequests: vi.fn().mockResolvedValue({ requests: [], nextCursor: undefined }),
  getSentFollowRequests: vi.fn().mockResolvedValue({ requests: [], nextCursor: undefined }),
  getPendingFollowRequestCount: vi.fn().mockResolvedValue({ count: 0 }),
}))

// Auth mock (NextAuth.js)
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: {
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
    },
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
}))

// Logger mock
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

// Next.js Image
// Why: next/image 固有のbool/非DOM props を anchor 出力に流すと React が
// `Received true for non-boolean attribute fill` 等の warning を出す。テスト出力
// で本質的な regression を埋めないよう、Next.js 専用 props は全て除去してから spread する。
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const {
      fill,
      // 以下はテストで読み取らないため eslint-disable で参照なし警告を抑止する。
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      priority,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      preload,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      quality,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      placeholder,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      blurDataURL,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      loader,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      unoptimized,
      ...imgProps
    } = props
    if (fill) {
      (imgProps as Record<string, unknown>).style = {
        ...(imgProps.style as Record<string, unknown> || {}),
        objectFit: 'cover',
        position: 'absolute',
        width: '100%',
        height: '100%',
      }
    }
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...imgProps as React.ImgHTMLAttributes<HTMLImageElement>} />
  },
}))

// Next.js Link
// next/link 固有のプロパティ（scroll/prefetch/replace 等）を anchor に
// 渡すと React が DOM 警告を出すため、HTMLAnchorElement に存在しない
// props は事前に除去してから spread する。
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    // Next.js 固有 props（DOM に流さない）
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    scroll,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    prefetch,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    replace,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    shallow,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    locale,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    legacyBehavior,
    ...props
  }: {
    children: React.ReactNode
    href: string
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
      },
    },
    status: 'authenticated',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// React Query
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }),
    useMutation: vi.fn().mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isLoading: false,
      error: null,
    }),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
    }),
  }
})

// Browser environment (jsdom) mocks
if (typeof window !== 'undefined') {
  // IntersectionObserver mock
  class MockIntersectionObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  })

  // matchMedia mock
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // ResizeObserver mock
  class MockResizeObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  }

  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: MockResizeObserver,
  })

  // scrollTo mock
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: vi.fn(),
  })

  // localStorage mock
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  })

  // Prevent jsdom "Not implemented: navigation to another Document" warnings.
  // jsdom does not implement real browser navigation. When tests click <a href>
  // links (rendered via next/link mock), jsdom attempts to navigate and emits
  // this warning via its virtualConsole. Because next/link is mocked to a plain
  // <a>, and navigation itself is already mocked via useRouter, we cancel the
  // DOM-level navigation before jsdom can attempt it. This does NOT suppress any
  // console output — it prevents the navigation from starting.
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    const anchor = target?.closest('a')
    if (anchor && !e.defaultPrevented) {
      const href = anchor.getAttribute('href') ?? ''
      // Only cancel navigation for internal paths that jsdom cannot handle.
      // External http(s) URLs and javascript: hrefs are left unchanged.
      if (href && !href.startsWith('http') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
        e.preventDefault()
      }
    }
  }, true)
}

/**
 * Test-renderer limitation の既知 React warning を明示的に suppress する。
 * 本物の regression を埋もれさせないため、allowlist は **理由が明確かつ production 側で
 * 正しく書かれている** ものに限定する。新しい warning を見つけたら原則 production 側か
 * test mock 側を修正し、ここに追加しないこと。
 *
 * - `ReactDOM.render` / `act(...)` 系: 旧 API の互換 warning。
 * - `An update to ... inside a test was not wrapped in act(...)`: 非同期 state 更新の見逃し。
 * - `is an async Client Component`: production の async Server Component を test renderer が
 *   Client 扱いするときの偽陽性。production コードは server で実行されるため安全。
 * - `Missing \`Description\` or \`aria-describedby\`` (Radix): production では accessible
 *   description を必ず付ける ARIA リント方針があるが、生 UI primitive の小さな test では
 *   省略しているため発生。Radix 側からの開発時 guidance であり、production に runtime 影響なし。
 * - `<html>/<body> cannot be a child of <div>`: global-error.tsx は最終防衛線として
 *   自前の `<html><body>` を描画する仕様 (Next.js 規約)。testing-library は div container に
 *   mount するため必ずこの DOM nesting warning が出る。`<html>`/`<body>` を描画するのは
 *   global-error のみのため、この 2 fragment に限定すれば他の nesting バグは隠さない。
 */
const SUPPRESSED_WARNING_FRAGMENTS = [
  'Warning: ReactDOM.render',
  'Warning: An update to',
  'act(...)',
  'is an async Client Component',
  // Radix の warning は `aria-describedby={undefined}` まで含む形のため、末尾 backtick を
  // 含めると substring match に失敗する。`aria-describedby` のリテラルだけで照合する。
  'Missing `Description` or `aria-describedby',
  // jsdom 環境の未実装機能ログ。production/React のバグではなく jsdom の制約
  // （matchMedia/ResizeObserver 等を mock しているのと同じ理由）。アプリ例外は隠さない。
  'Not implemented: navigation',
  "Not implemented: HTMLCanvasElement",
] as const

const originalError = console.error
const originalWarn = console.warn

function shouldSuppress(args: unknown[]): boolean {
  const first = args[0]
  // jsdom の未実装ログは Error オブジェクトとして渡るため message/stack も照合対象にする。
  const message =
    typeof first === 'string'
      ? first
      : first instanceof Error
        ? `${first.message}\n${first.stack ?? ''}`
        : ''
  if (!message) return false
  if (SUPPRESSED_WARNING_FRAGMENTS.some((fragment) => message.includes(fragment))) return true
  // global-error.tsx は最終防衛線として自前の <html><body> を描画する仕様 (Next.js 規約)。
  // testing-library は div container に mount するため必ず DOM nesting warning が出る。
  // React 19 は format-string 警告 ("In HTML, %s cannot be a child of %s" + 引数に '<html>')
  // を使うため、テンプレートと interpolation 引数の両方を見て <html>/<body> 限定で抑制する
  // (他の nesting バグは隠さない)。
  if (message.includes('cannot be a child of')) {
    const interpolated = args.slice(1).map((a) => String(a))
    if (interpolated.includes('<html>') || interpolated.includes('<body>')) return true
  }
  return false
}

beforeAll(() => {
  // React.warn / dev warnings は console.error 経由、Radix の一部 dev hint は
  // console.warn 経由で出るため両方を intercept する。
  console.error = (...args: unknown[]) => {
    if (shouldSuppress(args)) return
    originalError.call(console, ...args)
  }
  console.warn = (...args: unknown[]) => {
    if (shouldSuppress(args)) return
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})
