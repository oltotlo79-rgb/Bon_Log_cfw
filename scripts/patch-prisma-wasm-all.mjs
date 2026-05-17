#!/usr/bin/env node
/**
 * @file scripts/patch-prisma-wasm-all.mjs
 *
 * `next build` 完了後、Prisma が生成した wasm ファイル群を持つ可能性のある
 * すべての location に対して patch-prisma-wasm-loader.mjs を実行する。
 *
 * Cloudflare Workers ビルドでは `next build` が `output: standalone` モード
 * (OpenNext が NEXT_PRIVATE_STANDALONE=true を強制) で動き、
 * .next/standalone/node_modules/.prisma/client/ に node_modules をコピーする。
 * OpenNext はこのコピーから bundle するため、こちらも patch しないと
 * 効果がない。
 *
 * 探索対象:
 *   1. node_modules/.prisma/client/                              ← 通常の場所
 *   2. .next/standalone/node_modules/.prisma/client/             ← standalone copy
 *   3. .next/standalone/<packagePath>/node_modules/.prisma/client/  ← monorepo の場合
 */

import { existsSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PATCH_SCRIPT = path.join(__dirname, 'patch-prisma-wasm-loader.mjs')

const CANDIDATES = [
  path.join('node_modules', '.prisma', 'client'),
  path.join('.next', 'standalone', 'node_modules', '.prisma', 'client'),
]

function log(msg) {
  console.log(`[patch-prisma-wasm-all] ${msg}`)
}

let patchedCount = 0
for (const dir of CANDIDATES) {
  if (!existsSync(dir)) {
    log(`skip (not exist): ${dir}`)
    continue
  }
  log(`patching: ${dir}`)
  const result = spawnSync(process.execPath, [PATCH_SCRIPT, dir], {
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    log(`ERROR: patch failed for ${dir} (exit code ${result.status})`)
    process.exit(result.status ?? 1)
  }
  patchedCount++
}

log(`done. patched ${patchedCount} location(s).`)
