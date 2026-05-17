import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'

// .env.local を読み込み（Next.js と同じファイルを使用）
config({ path: path.resolve('.env.local') })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // `npx prisma db seed` で手動実行、または CI の E2E セットアップで使用。
    // `prisma db push` / `migrate dev` では自動実行されない。
    // `migrate reset` のみ自動実行されるが、DBをリセットする場合は意図的な操作のため問題なし。
    seed: 'npx tsx prisma/seed.ts',
  },
})
