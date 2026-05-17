import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // Why root を明示する:
  //   一部の Windows sandbox 環境 (Claude harness 等) で `vite-tsconfig-paths` が
  //   workspace 外を上方探索すると `Cannot read directory "../../..": Access is denied.`
  //   で起動前に落ちる。root を repo ルートに固定して探索範囲を限定する。
  root: __dirname,
  plugins: [react(), tsconfigPaths({ projects: [path.resolve(__dirname, 'tsconfig.json')] })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  // 同じ理由で FS 探索を repo ルート以下に閉じる。
  server: {
    fs: {
      strict: true,
      allow: [__dirname],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.tsx'],
    dir: __dirname,
    include: [
      '**/__tests__/**/*.(test|spec).(ts|tsx|js)',
      '**/*.(test|spec).(ts|tsx|js)',
    ],
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/e2e/**',
      '**/.claude/**',
      '.claude/**',
      '**/.clone/**',
      '.clone/**',
    ],
    testTimeout: 15000,
    teardownTimeout: 5000,
    pool: 'forks',
    /**
     * fork ワーカー数を CPU の 50% に制限する。
     *
     * pre-push hook やビルドと並行して `vitest run` を起動すると、CPU/メモリが
     * 逼迫した状態で多数の fork worker が立ち上がり、特定テストのモック競合や
     * グローバル状態の汚染で flaky な失敗が起きることがある（毎回違うテストが
     * 落ちる、独立実行すると 100% pass という症状）。
     *
     * 既定（CPU コア数）のままでも並列度は抑えられるが、push 時のように他の
     * プロセスが既に走っているケースでは半分まで絞る方が安定する。Vitest 4 では
     * `poolOptions.forks.maxForks` は廃止され、トップレベル `maxWorkers` が
     * 推奨 API。
     */
    maxWorkers: '50%',
    coverage: {
      // Istanbul provider は `vi.mock()` でモックされたソースモジュールの
      // 元実装を instrumentation 対象として保持する。v8 provider ではモックされた
      // モジュールが大量にあると実装のカバレッジを誤って 0% と集計するため、
      // Istanbul に切替えて実測値を正確化する。
      provider: 'istanbul',
      reporter: ['text-summary', 'json-summary'],
      include: [
        'lib/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'app/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.d.ts',
        '**/node_modules/**',
        '**/__tests__/**',
        '**/index.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
    deps: {
      optimizer: {
        web: {
          include: [
            'isomorphic-dompurify',
            'dompurify',
            '@panva',
            'jose',
            'nanoid',
            'uuid',
            'next-auth',
            '@auth',
            'otplib',
            '@otplib',
            '@scure',
          ],
        },
      },
    },
  },
})
