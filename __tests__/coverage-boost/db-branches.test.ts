// @vitest-environment node
/**
 * db.ts ブランチカバレッジ向上テスト
 *
 * 環境変数を切り替えて、実際のdb.tsモジュールの各ブランチを実行する
 */
import { vi } from 'vitest'

// PrismaClient / Pool / PrismaPg をクラスとしてモック
vi.mock('@prisma/client', () => {
  return {
    PrismaClient: class MockPrismaClient {
       
      options: any
       
      constructor(options?: any) {
        this.options = options
        MockPrismaClient.lastOptions = options
        MockPrismaClient.callCount++
      }
      $connect = vi.fn()
       
      static lastOptions: any = null
      static callCount = 0
      static reset() {
        this.lastOptions = null
        this.callCount = 0
      }
    },
  }
})

vi.mock('pg', () => {
  return {
    Pool: class MockPool {

      config: any

      constructor(config?: any) {
        this.config = config
        MockPool.lastConfig = config
        MockPool.callCount++
      }
      connect = vi.fn()
      on = vi.fn()

      static lastConfig: any = null
      static callCount = 0
      static reset() {
        this.lastConfig = null
        this.callCount = 0
      }
    },
  }
})

vi.mock('@prisma/adapter-pg', () => {
  return {
    PrismaPg: class MockPrismaPg {
      static callCount = 0
       
      constructor(_pool: any) {
        MockPrismaPg.callCount++
      }
      static reset() {
        this.callCount = 0
      }
    },
  }
})

// db.tsのグローバルモックを解除して実モジュールをテスト
vi.unmock('@/lib/db')

describe('db.ts ブランチカバレッジ', () => {
  const originalEnv = { ...process.env }

  afterEach(async () => {
    vi.resetModules()
    process.env = { ...originalEnv }
    // グローバル変数をクリア
    const g = global as unknown as { prisma?: unknown }
    delete g.prisma

    // モックカウンターをリセット
    const { PrismaClient } = await import('@prisma/client') as unknown as { PrismaClient: { reset: () => void } }
    const { Pool } = await import('pg') as unknown as { Pool: { reset: () => void } }
    const { PrismaPg } = await import('@prisma/adapter-pg') as unknown as { PrismaPg: { reset: () => void } }
    PrismaClient.reset()
    Pool.reset()
    PrismaPg.reset()
  })

  it('ダミーDATABASE_URLの場合もPoolとアダプターを作成する（engineType=client対応）', async () => {
    process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'
    ;(process.env as { NODE_ENV: string }).NODE_ENV = 'test'

    const { prisma } = await import('@/lib/db')
    const { Pool } = await import('pg') as unknown as { Pool: { callCount: number; lastConfig: { connectionString: string } } }
    const { PrismaPg } = await import('@prisma/adapter-pg') as unknown as { PrismaPg: { callCount: number } }

    expect(prisma).toBeDefined()
    expect(Pool.callCount).toBe(1) // ダミーでもPool作成（アダプター必須のため）
    expect(Pool.lastConfig.connectionString).toBe('postgresql://dummy:dummy@localhost:5432/dummy')
    expect(PrismaPg.callCount).toBe(1)
  })

  it('実際のDATABASE_URLの場合PoolとPrismaPgを作成する', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/realdb'
    ;(process.env as { NODE_ENV: string }).NODE_ENV = 'test'

    const { prisma } = await import('@/lib/db')
    const { Pool } = await import('pg') as unknown as { Pool: { callCount: number; lastConfig: { connectionString: string; ssl: boolean } } }
    const { PrismaPg } = await import('@prisma/adapter-pg') as unknown as { PrismaPg: { callCount: number } }

    expect(prisma).toBeDefined()
    expect(Pool.callCount).toBe(1)
    expect(Pool.lastConfig.connectionString).toBe('postgresql://user:pass@localhost:5432/realdb')
    expect(Pool.lastConfig.ssl).toBe(false) // test環境ではSSL無効
    expect(PrismaPg.callCount).toBe(1)
  })

  it('本番環境ではSSL証明書検証が有効になる', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/proddb'
    ;(process.env as { NODE_ENV: string }).NODE_ENV = 'production'
    delete process.env.SUPABASE_CA_CERT

    await import('@/lib/db')
    const { Pool } = await import('pg') as unknown as { Pool: { lastConfig: { ssl: { rejectUnauthorized: boolean; ca: string | undefined } } } }

    expect(Pool.lastConfig.ssl).toEqual({ rejectUnauthorized: true, ca: undefined })
  })

  it('本番環境でCA証明書が設定されている場合はデコードされる', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/proddb'
    ;(process.env as { NODE_ENV: string }).NODE_ENV = 'production'
    const certContent = '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----'
    process.env.SUPABASE_CA_CERT = Buffer.from(certContent).toString('base64')

    await import('@/lib/db')
    const { Pool } = await import('pg') as unknown as { Pool: { lastConfig: { ssl: { rejectUnauthorized: boolean; ca: string } } } }

    expect(Pool.lastConfig.ssl.rejectUnauthorized).toBe(true)
    expect(Pool.lastConfig.ssl.ca).toBe(certContent)
  })

  it('開発環境ではログレベルが詳細になる', async () => {
    process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'
    ;(process.env as { NODE_ENV: string }).NODE_ENV = 'development'

    await import('@/lib/db')
    const { PrismaClient } = await import('@prisma/client') as unknown as { PrismaClient: { lastOptions: { log: string[] } } }

    expect(PrismaClient.lastOptions.log).toEqual(['query', 'error', 'warn'])
  })

  it('本番環境ではログレベルがエラーのみになる', async () => {
    process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'
    ;(process.env as { NODE_ENV: string }).NODE_ENV = 'production'

    await import('@/lib/db')
    const { PrismaClient } = await import('@prisma/client') as unknown as { PrismaClient: { lastOptions: { log: string[] } } }

    expect(PrismaClient.lastOptions.log).toEqual(['error'])
  })

  it('開発環境でグローバル変数にprismaが保存される', async () => {
    process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'
    ;(process.env as { NODE_ENV: string }).NODE_ENV = 'development'

    await import('@/lib/db')
    const g = global as unknown as { prisma?: unknown }

    expect(g.prisma).toBeDefined()
  })

  it('本番環境ではグローバル変数にprismaが保存されない', async () => {
    const g = global as unknown as { prisma?: unknown }
    delete g.prisma
    process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'
    ;(process.env as { NODE_ENV: string }).NODE_ENV = 'production'

    await import('@/lib/db')

    expect(g.prisma).toBeUndefined()
  })

  it('グローバルにprismaが存在する場合は再利用する', async () => {
    const existingPrisma = { existing: true }
    const g = global as unknown as { prisma?: unknown }
    g.prisma = existingPrisma
    process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'
    ;(process.env as { NODE_ENV: string }).NODE_ENV = 'development'

    const { prisma } = await import('@/lib/db')

    expect(prisma).toBe(existingPrisma)
  })
})
