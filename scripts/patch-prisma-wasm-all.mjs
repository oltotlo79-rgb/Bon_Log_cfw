#!/usr/bin/env node
/**
 * @file scripts/patch-prisma-wasm-all.mjs
 *
 * `next build` 完了後、プロジェクト配下に存在する **すべての**
 * `.prisma/client/wasm.js` を含むディレクトリに対して
 * patch-prisma-wasm-loader.mjs を実行する。
 *
 * 既知の copy 先:
 *   - node_modules/.prisma/client/
 *   - .next/standalone/node_modules/.prisma/client/
 *   - .next/standalone/<packagePath>/node_modules/.prisma/client/
 *
 * recursive 探索で発見した path すべてを patch することで、OpenNext が
 * どの copy から bundle しても patch が反映される状態を作る。
 *
 * 探索ルートからの exclude:
 *   - .git
 *   - .open-next (OpenNext 自身がここに copy するが、それは esbuild 直前)
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PATCH_SCRIPT = path.join(__dirname, 'patch-prisma-wasm-loader.mjs')
const ROOT = process.cwd()

const EXCLUDE_DIRS = new Set(['.git', '.open-next', '.vercel', '.turbo'])

function log(msg) {
  console.log(`[patch-prisma-wasm-all] ${msg}`)
}

/**
 * `.prisma/client` というディレクトリ末尾を検出する recursive walker。
 * 深さ上限を 12 階層に制限して暴走を防ぐ。
 */
function findPrismaClientDirs(dir, depth, results) {
  if (depth > 12) return
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = path.join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue
    // `<...>/.prisma/client` がターゲット
    if (entry === 'client' && path.basename(dir) === '.prisma') {
      // wasm.js が実在することを最低条件にする
      if (existsSync(path.join(full, 'wasm.js'))) {
        results.push(full)
      }
      continue // .prisma/client の中はもう探索しない
    }
    findPrismaClientDirs(full, depth + 1, results)
  }
}

log(`scanning under: ${ROOT}`)
const found = []
findPrismaClientDirs(ROOT, 0, found)
log(`found ${found.length} .prisma/client directories`)

let patched = 0
for (const dir of found) {
  log(`patching: ${dir}`)
  const result = spawnSync(process.execPath, [PATCH_SCRIPT, dir], {
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    log(`ERROR: patch failed for ${dir} (exit code ${result.status})`)
    process.exit(result.status ?? 1)
  }
  patched++
}

log(`done. patched ${patched} location(s).`)
