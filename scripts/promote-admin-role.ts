/**
 * 管理者ロール昇格/変更スクリプト（監査ログ付き）
 *
 * 利用シーン:
 *   - 新規 super_admin の設置（UI からは自己昇格できない設計のため）
 *   - moderator → admin などロール引き上げ
 *
 * 安全装置:
 *   - デフォルトは dry-run。--commit を付けたときのみ実際に書き込む
 *   - DATABASE_URL に Supabase 等の本番ホストを検出した場合は追加確認を要求
 *   - 変更を AdminLog テーブルに記録（誰が・いつ・何をを追跡）
 *
 * 実行例:
 *   # ローカル DB でドライラン
 *   node --env-file=.env.local --import tsx scripts/promote-admin-role.ts oltotlo81@gmail.com super_admin
 *
 *   # ローカル DB で反映
 *   node --env-file=.env.local --import tsx scripts/promote-admin-role.ts oltotlo81@gmail.com super_admin --commit
 *
 *   # 本番 DB （Supabase）で反映 — --allow-prod 必須
 *   DATABASE_URL="<prod url>" DIRECT_URL="<prod direct url>" \
 *     node --import tsx scripts/promote-admin-role.ts oltotlo81@gmail.com super_admin --commit --allow-prod
 */

try {
  require('dotenv').config({ path: '.env.local' })
  require('dotenv').config({ path: '.env' })
} catch {
  // dotenv がなくても process.env に DATABASE_URL があれば可
}

import { PrismaClient, type AdminRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const VALID_ROLES: AdminRole[] = ['super_admin', 'admin', 'moderator', 'support', 'readonly']

function isProductionUrl(url: string | undefined): boolean {
  if (!url) return false
  return /supabase\.(co|com)|pooler\.supabase|prod|production/i.test(url)
}

/**
 * プロジェクトの `lib/db.ts` と同じ driver adapter パターン (PrismaPg + Pool) で
 * PrismaClient を生成する。スクリプト単体でも動作するように内製化。
 *
 * SSL 戦略:
 *   - localhost/127.0.0.1: SSL なし
 *   - リモート (Supabase 等): TLS 有効。SUPABASE_CA_CERT があれば完全検証、
 *     なければ rejectUnauthorized:false（CA 検証スキップ）でも接続は成立させる
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('❌ DATABASE_URL が設定されていません')
    process.exit(1)
  }

  let isLocal = false
  try {
    const { hostname } = new URL(connectionString)
    isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    // URL parse 失敗時はリモート扱い（安全側）
  }

  const caCert = process.env.SUPABASE_CA_CERT
    ? Buffer.from(process.env.SUPABASE_CA_CERT, 'base64').toString('utf-8')
    : undefined

  const pool = new Pool({
    connectionString,
    ssl: isLocal
      ? false
      : caCert
        ? { rejectUnauthorized: true, ca: caCert }
        : { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  })

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

async function main() {
  const args = process.argv.slice(2)
  const flagSet = new Set(args.filter((a) => a.startsWith('--')))
  const positional = args.filter((a) => !a.startsWith('--'))

  const email = positional[0]
  const role = positional[1] as AdminRole | undefined

  if (!email || !role) {
    console.error('使い方: promote-admin-role.ts <email> <role> [--commit] [--allow-prod]')
    console.error('  role: ' + VALID_ROLES.join(' | '))
    process.exit(1)
  }
  if (!VALID_ROLES.includes(role)) {
    console.error(`無効なロール: ${role}. 有効なロール: ${VALID_ROLES.join(', ')}`)
    process.exit(1)
  }

  const commit = flagSet.has('--commit')
  const allowProd = flagSet.has('--allow-prod')

  const dbUrl = process.env.DATABASE_URL
  const prodDetected = isProductionUrl(dbUrl)

  console.log('---- 管理者ロール昇格 ----')
  console.log(`対象 email : ${email}`)
  console.log(`目標 role  : ${role}`)
  console.log(`DB (host)  : ${dbUrl?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') ?? '(未設定)'}`)
  console.log(`実行モード : ${commit ? 'COMMIT (書き込み)' : 'DRY-RUN (書き込みなし)'}`)
  console.log(`本番判定   : ${prodDetected ? '⚠️  PRODUCTION' : 'local'}`)
  console.log('--------------------------')

  if (prodDetected && commit && !allowProd) {
    console.error('❌ 本番 DB への書き込みには --allow-prod フラグが必須です。')
    process.exit(2)
  }

  const prisma = createPrismaClient()
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, nickname: true, email: true },
    })
    if (!user) {
      console.error(`❌ User not found: ${email}`)
      process.exit(3)
    }

    const existing = await prisma.adminUser.findUnique({
      where: { userId: user.id },
      select: { role: true, createdAt: true },
    })

    console.log('現在の状態:')
    console.log(`  userId   : ${user.id}`)
    console.log(`  nickname : ${user.nickname ?? '(なし)'}`)
    console.log(`  現在role : ${existing?.role ?? '(管理者ではない)'}`)
    console.log(`  目標role : ${role}`)

    if (existing?.role === role) {
      console.log('✅ 既に目標のロールです。変更不要。')
      return
    }

    if (!commit) {
      console.log('')
      console.log('💡 これはドライラン結果です。実際に反映するには --commit を付けて再実行してください。')
      return
    }

    // 監査ログの adminId は「操作実行者」。本スクリプトは自己操作か、
    // 本人がシェルから自分の userId を渡す想定なので、対象 userId を
    // そのまま adminId として記録する。
    const [upserted] = await prisma.$transaction([
      prisma.adminUser.upsert({
        where: { userId: user.id },
        update: { role },
        create: { userId: user.id, role },
        select: { userId: true, role: true, createdAt: true },
      }),
      prisma.adminLog.create({
        data: {
          adminId: user.id,
          action: 'admin_role_change',
          targetType: 'admin_user',
          targetId: user.id,
          details: JSON.stringify({
            email,
            from: existing?.role ?? null,
            to: role,
            reason: 'CLI script: promote-admin-role.ts',
            prodDetected,
          }),
        },
      }),
    ])

    console.log('')
    console.log('✅ 反映完了:')
    console.log(`  userId: ${upserted.userId}`)
    console.log(`  role  : ${upserted.role}`)
    console.log(`  AdminLog に監査レコードを追加しました。`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('❌ スクリプト失敗:', err instanceof Error ? err.message : err)
  process.exit(1)
})
