// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const DUMMY_DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'

describe('shouldSkipBuildTimeDbAccess', () => {
  const original = {
    SKIP_DB_CONNECTION: process.env.SKIP_DB_CONNECTION,
    DATABASE_URL: process.env.DATABASE_URL,
  }

  beforeEach(() => {
    delete process.env.SKIP_DB_CONNECTION
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/real_db'
  })

  afterEach(() => {
    if (original.SKIP_DB_CONNECTION !== undefined) {
      process.env.SKIP_DB_CONNECTION = original.SKIP_DB_CONNECTION
    } else {
      delete process.env.SKIP_DB_CONNECTION
    }
    if (original.DATABASE_URL !== undefined) {
      process.env.DATABASE_URL = original.DATABASE_URL
    } else {
      delete process.env.DATABASE_URL
    }
  })

  it('全条件 false で skip しない', async () => {
    const { shouldSkipBuildTimeDbAccess } = await import('@/lib/build/db-availability')
    expect(shouldSkipBuildTimeDbAccess()).toBe(false)
  })

  it('SKIP_DB_CONNECTION=true なら skip する', async () => {
    process.env.SKIP_DB_CONNECTION = 'true'
    const { shouldSkipBuildTimeDbAccess } = await import('@/lib/build/db-availability')
    expect(shouldSkipBuildTimeDbAccess()).toBe(true)
  })

  it('SKIP_DB_CONNECTION=false は skip しない (=true のみ true)', async () => {
    process.env.SKIP_DB_CONNECTION = 'false'
    const { shouldSkipBuildTimeDbAccess } = await import('@/lib/build/db-availability')
    expect(shouldSkipBuildTimeDbAccess()).toBe(false)
  })

  it('DATABASE_URL 未設定なら skip する', async () => {
    delete process.env.DATABASE_URL
    const { shouldSkipBuildTimeDbAccess } = await import('@/lib/build/db-availability')
    expect(shouldSkipBuildTimeDbAccess()).toBe(true)
  })

  it('DATABASE_URL=空文字も skip する (falsy ガード)', async () => {
    process.env.DATABASE_URL = ''
    const { shouldSkipBuildTimeDbAccess } = await import('@/lib/build/db-availability')
    expect(shouldSkipBuildTimeDbAccess()).toBe(true)
  })

  it('DATABASE_URL がダミー値なら skip する', async () => {
    process.env.DATABASE_URL = DUMMY_DATABASE_URL
    const { shouldSkipBuildTimeDbAccess } = await import('@/lib/build/db-availability')
    expect(shouldSkipBuildTimeDbAccess()).toBe(true)
  })

  it('ダミー値と似た別 URL は skip しない', async () => {
    process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy2'
    const { shouldSkipBuildTimeDbAccess } = await import('@/lib/build/db-availability')
    expect(shouldSkipBuildTimeDbAccess()).toBe(false)
  })
})
