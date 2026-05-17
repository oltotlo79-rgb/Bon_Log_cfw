 
/**
 * 農薬シードデータ全量オーケストレーション
 *
 * 5ファイルを正しい依存順序で順次実行する。
 * 各ファイルは子プロセスで実行され、既存コードを一切変更しない。
 *
 * ## 実行順序
 *
 * Phase 1: Foundation（基盤データ作成）
 *   1. seed-pesticide-data.ts         — 農薬・成分・効果・コラムの全基盤
 *   2. seed-pesticide-additions.ts    — 追加農薬製品（冪等）
 *
 * Phase 2: Additions（データ拡充、全て冪等）
 *   3. seed-pesticide-additions2.ts   — 追加農薬製品・スプレー製品（統合版）
 *
 * Phase 4: Validation（整合性チェック、任意）
 *   5. seed-pesticide-validate.ts     — 4レベル整合性チェック
 *
 * ※ 旧 Phase 3（修正ファイル7個）および effect-supplement / enhance-descriptions は
 *   基盤データに吸収済み。アーカイブは prisma/seed-pesticide-archive/ に保存。
 *
 * ## 使い方
 *   npx tsx prisma/seed-pesticide-all.ts [--skip-validate] [--from <phase>]
 *
 * @module prisma/seed-pesticide-all
 */

import { execSync } from 'child_process'
import path from 'path'

interface SeedStep {
  file: string
  phase: string
  description: string
}

const STEPS: SeedStep[] = [
  // Phase 1: Foundation
  { file: 'seed-pesticide-data.ts',              phase: '1', description: '基盤データ（農薬・成分・効果・コラム）' },
  { file: 'seed-pesticide-additions.ts',          phase: '1', description: '追加農薬製品' },

  // Phase 2: Additions
  { file: 'seed-pesticide-additions2.ts',         phase: '2', description: '追加農薬製品・スプレー製品（統合版）' },
  // 旧 seed-pesticide-spray.ts は additions2.ts に統合済み
  // effect-supplement.ts, enhance-descriptions.ts は基盤データに吸収済み

  // Phase 3: Fixes — 全て基盤データに吸収済み (prisma/seed-pesticide-archive/ に移動)

  // Phase 4: Validation
  { file: 'seed-pesticide-validate.ts',           phase: '4', description: '整合性チェック' },
]

const args = process.argv.slice(2)
const skipValidate = args.includes('--skip-validate')
const fromIndex = args.indexOf('--from')
const fromPhase = fromIndex !== -1 ? args[fromIndex + 1] : null

function main() {
  const prismaDir = path.resolve(__dirname)

  let steps = STEPS

  // --skip-validate: Phase 4 をスキップ
  if (skipValidate) {
    steps = steps.filter((s) => s.phase !== '4')
  }

  // --from <phase>: 指定フェーズ以降のみ実行
  if (fromPhase) {
    steps = steps.filter((s) => s.phase >= fromPhase)
  }

  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║   農薬シードデータ 全量オーケストレーション          ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(`  実行ステップ数: ${steps.length}`)
  if (skipValidate) console.log('  ※ バリデーションはスキップ')
  if (fromPhase) console.log(`  ※ Phase ${fromPhase} から開始`)
  console.log('')

  let currentPhase = ''

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]

    // フェーズ変更時にヘッダー表示
    if (step.phase !== currentPhase) {
      currentPhase = step.phase
      const phaseNames: Record<string, string> = {
        '1': 'Foundation（基盤データ）',
        '2': 'Additions（データ拡充）',
        '3': 'Fixes（修正適用）',
        '4': 'Validation（整合性チェック）',
      }
      console.log(`\n── Phase ${currentPhase}: ${phaseNames[currentPhase]} ──`)
    }

    const stepNum = String(i + 1).padStart(2, ' ')
    console.log(`\n  [${stepNum}/${steps.length}] ${step.description}`)
    console.log(`       → ${step.file}`)

    const filePath = path.join(prismaDir, step.file)
    const startTime = Date.now()

    try {
      execSync(`npx tsx "${filePath}"`, {
        stdio: 'inherit',
        cwd: path.resolve(prismaDir, '..', '..', '..'),
        env: { ...process.env },
      })
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`       ✓ 完了 (${elapsed}s)`)
    } catch (_error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.error(`       ✗ 失敗 (${elapsed}s)`)
      console.error(`\n❌ Step ${i + 1} でエラーが発生しました。以降のステップは実行されません。`)
      process.exit(1)
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║   ✅ 全ステップが正常に完了しました                   ║')
  console.log('╚══════════════════════════════════════════════════════╝')
}

main()
