/* eslint-disable no-console */
/**
 * MAFF農薬登録情報自動スクレイパー
 *
 * シードデータ内の登録番号を元にMAFF公式サイトからデータを取得し、
 * maff-reference.csv を自動生成・更新する。
 *
 * 使い方:
 *   npx tsx prisma/validation/scrape-maff.ts
 *
 * オプション:
 *   --dry-run    CSVを上書きせずレポートのみ出力
 *   --force      キャッシュを無視して再取得
 *   --diff-only  seedデータとの差分のみ出力
 *
 * レート制限: 1リクエスト/秒（MAFF負荷軽減）
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import { SEED_PATHS, VALIDATION_PATHS } from './parsers/config'

// ── 設定 ──────────────────────────────────────────────
const MAFF_BASE_URL = 'https://pesticide.maff.go.jp/agricultural-chemicals/details/'
const CACHE_DIR = path.resolve(__dirname, '.maff-cache')
const CACHE_MAX_AGE_DAYS = 30
const REQUEST_DELAY_MS = 1200 // 1.2秒間隔

// ── 型定義 ──────────────────────────────────────────────
interface MaffProduct {
  registrationNumber: string
  productName: string
  purpose: string           // 殺菌剤、殺虫剤、etc.
  formulationType: string   // 水和剤、乳剤、etc.
  manufacturer: string
  activeIngredients: { name: string; content: string }[]
}

interface SeedPesticide {
  slug: string
  name: string
  registrationNumber: string
  pesticideType: string
  ingredients: { name: string; content: string }[]
}

interface DiffItem {
  slug: string
  regNum: string
  field: string
  seed: string
  maff: string
  severity: 'ERROR' | 'WARN' | 'INFO'
}

// ── ユーティリティ ───────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'BonsaiSNS-DataValidator/1.0 (agricultural data validation)',
        'Accept': 'text/html',
        'Accept-Language': 'ja',
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location
        if (redirectUrl) {
          fetchPage(redirectUrl).then(resolve).catch(reject)
          return
        }
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      res.on('error', reject)
    }).on('error', reject)
  })
}

// ── キャッシュ ───────────────────────────────────────────
function getCachePath(regNum: string): string {
  return path.join(CACHE_DIR, `${regNum}.html`)
}

function isCacheValid(regNum: string): boolean {
  const cachePath = getCachePath(regNum)
  if (!fs.existsSync(cachePath)) return false
  const stat = fs.statSync(cachePath)
  const ageMs = Date.now() - stat.mtimeMs
  return ageMs < CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
}

function readCache(regNum: string): string | null {
  if (!isCacheValid(regNum)) return null
  return fs.readFileSync(getCachePath(regNum), 'utf-8')
}

function writeCache(regNum: string, html: string): void {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(getCachePath(regNum), html, 'utf-8')
}

// ── HTMLパーサー ─────────────────────────────────────────
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

function parseProductPage(html: string, regNum: string): MaffProduct | null {
  try {
    // 製品名: <h1> or <h2> タグ内、または title タグ
    let productName = ''
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (h1Match) {
      productName = stripTags(h1Match[1]).trim()
    } else {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch) {
        productName = titleMatch[1].replace(/\s*[|｜-].*/g, '').trim()
      }
    }

    // テーブル行からデータ抽出
    // MAFF ページは定義リスト(dt/dd)またはテーブル(th/td)でデータを表示
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
    const dtDd = html.match(/<dt[^>]*>[\s\S]*?<\/dt>\s*<dd[^>]*>[\s\S]*?<\/dd>/gi) || []

    let purpose = ''
    let formulationType = ''
    let manufacturer = ''
    const activeIngredients: { name: string; content: string }[] = []

    // テーブル行を解析
    for (const row of rows) {
      const cells = row.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) || []
      const cellTexts = cells.map(c => stripTags(c))

      if (cellTexts.length >= 2) {
        const label = cellTexts[0]
        const value = cellTexts[1]

        if (label.includes('種類名称') || label.includes('種類')) {
          purpose = value
        }
        if (label.includes('物理的化学的性状') || label.includes('性状')) {
          // 性状から剤型を推定
          if (!formulationType) {
            if (value.includes('水和')) formulationType = '水和剤'
            else if (value.includes('乳剤') || value.includes('乳白')) formulationType = '乳剤'
            else if (value.includes('粒')) formulationType = '粒剤'
            else if (value.includes('液')) formulationType = '液剤'
          }
        }
      }
    }

    // dt/dd 形式からも抽出
    for (const pair of dtDd) {
      const dtMatch = pair.match(/<dt[^>]*>([\s\S]*?)<\/dt>/i)
      const ddMatch = pair.match(/<dd[^>]*>([\s\S]*?)<\/dd>/i)
      if (!dtMatch || !ddMatch) continue
      const dt = stripTags(dtMatch[1])
      const dd = stripTags(ddMatch[1])

      if (dt.includes('登録名称') || dt.includes('農薬の名称')) {
        if (!productName) productName = dd
      }
      if (dt.includes('種類名称') || dt.includes('種類')) {
        purpose = dd
      }
    }

    // 有効成分を抽出
    // MAFFページ構造: <th>有効成分</th><td><p>成分名</p></td><td><p>含有量%</p></td>
    // 複数成分の場合、同構造の <tr> が繰り返される
    const ingPattern = /<th[^>]*>有効成分<\/th>\s*<td[^>]*>\s*<p>([\s\S]*?)<\/p>\s*<\/td>\s*<td[^>]*>\s*<p>([\s\S]*?)<\/p>/gi
    let ingMatch
    while ((ingMatch = ingPattern.exec(html)) !== null) {
      const name = stripTags(ingMatch[1]).trim()
      const content = stripTags(ingMatch[2]).trim()
      if (name && content) {
        activeIngredients.push({ name, content })
      }
    }

    // フォールバック: "その他成分"の前のテーブル行から抽出
    if (activeIngredients.length === 0) {
      const tableArea = html.match(/有効成分[\s\S]*?(?=その他成分)/i)?.[0] || ''
      const tdPattern = /<td[^>]*>\s*<p>([^<]+)<\/p>\s*<\/td>\s*<td[^>]*>\s*<p>(\d+\.?\d*%)<\/p>/gi
      let tdMatch
      while ((tdMatch = tdPattern.exec(tableArea)) !== null) {
        const name = stripTags(tdMatch[1]).trim()
        const content = tdMatch[2].trim()
        if (name && content && !name.includes('成分名')) {
          activeIngredients.push({ name, content })
        }
      }
    }

    // 製造者を抽出
    const mfgMatch = html.match(/製造[者場][\s\S]*?(?:株式会社|有限会社|合同会社)[^<]*/i)
    if (mfgMatch) {
      manufacturer = stripTags(mfgMatch[0]).replace(/製造[者場]\s*[:：]?\s*/, '').trim()
    }

    if (!productName) {
      console.warn(`  ⚠ 登録番号 ${regNum}: 製品名を抽出できませんでした`)
      return null
    }

    return {
      registrationNumber: regNum,
      productName,
      purpose,
      formulationType,
      manufacturer,
      activeIngredients,
    }
  } catch (e) {
    console.error(`  ✗ 登録番号 ${regNum}: パースエラー: ${e}`)
    return null
  }
}

// ── シードデータ読み込み ───────────────────────────────────
function extractSeedPesticides(): SeedPesticide[] {
  const results: SeedPesticide[] = []
  const files = [SEED_PATHS.data, SEED_PATHS.additions, SEED_PATHS.additions2]

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue
    const content = fs.readFileSync(filePath, 'utf-8')

    // パターン1: prisma.pesticide.create({ data: { ... } }) ブロック
    const blockPattern = /(?:create|upsert)\(\s*\{[\s\S]*?data:\s*\{([\s\S]*?)\}\s*(?:,\s*\}|\}\s*\))/g
    let blockMatch
    while ((blockMatch = blockPattern.exec(content)) !== null) {
      const block = blockMatch[1]

      const slugMatch = block.match(/slug:\s*["']([^"']+)["']/)
      const nameMatch = block.match(/name:\s*["']([^"']+)["']/)
      const regMatch = block.match(/registrationNumber:\s*["'](\d+)["']/)

      if (!slugMatch || !nameMatch || !regMatch) continue

      results.push({
        slug: slugMatch[1],
        name: nameMatch[1],
        registrationNumber: regMatch[1],
        pesticideType: '',
        ingredients: [],
      })
    }

    // パターン2: ensurePesticide({ slug: "...", name: "...", registrationNumber: "..." }) 形式
    // additions2.ts 等で使用
    const ensurePattern = /\{\s*slug:\s*["']([^"']+)["'],\s*name:\s*["']([^"']+)["'],\s*registrationNumber:\s*["'](\d+)["']/g
    let ensureMatch
    while ((ensureMatch = ensurePattern.exec(content)) !== null) {
      const slug = ensureMatch[1]
      // 重複チェック（パターン1で既に取得済みの場合はスキップ）
      if (results.some(r => r.slug === slug)) continue
      results.push({
        slug,
        name: ensureMatch[2],
        registrationNumber: ensureMatch[3],
        pesticideType: '',
        ingredients: [],
      })
    }

    // パターン3: { slug: "...", name: "...", reg: "..." } 形式 (展着剤製品の短縮表記)
    // seed-pesticide-data.ts の展着剤製品配列で使用
    const shortRegPattern = /\{\s*slug:\s*["']([^"']+)["'],\s*name:\s*["']([^"']+)["'],\s*reg:\s*["'](\d+)["']/g
    let shortRegMatch
    while ((shortRegMatch = shortRegPattern.exec(content)) !== null) {
      const slug = shortRegMatch[1]
      if (results.some(r => r.slug === slug)) continue
      results.push({
        slug,
        name: shortRegMatch[2],
        registrationNumber: shortRegMatch[3],
        pesticideType: '',
        ingredients: [],
      })
    }

    // パターン4: prisma.pesticide.upsert({ where: { slug: "..." }, update: {}, create: { ... } })
    // seed-pesticide-data.ts の upsert ブロック (パターン1 の `data:` 形式とは別構造)。
    const upsertPattern = /upsert\(\s*\{[\s\S]*?create:\s*\{([\s\S]*?)\}\s*,?\s*\}\s*\)/g
    let upsertMatch
    while ((upsertMatch = upsertPattern.exec(content)) !== null) {
      const block = upsertMatch[1]
      const slugMatch = block.match(/slug:\s*["']([^"']+)["']/)
      const nameMatch = block.match(/name:\s*["']([^"']+)["']/)
      const regMatch = block.match(/registrationNumber:\s*["'](\d+)["']/)
      if (!slugMatch || !nameMatch || !regMatch) continue
      const slug = slugMatch[1]
      if (results.some(r => r.slug === slug)) continue
      results.push({
        slug,
        name: nameMatch[1],
        registrationNumber: regMatch[1],
        pesticideType: '',
        ingredients: [],
      })
    }
  }

  // pest-links.csv から成分情報を補完
  const pestLinksPath = path.resolve(__dirname, 'pest-links.csv')
  if (fs.existsSync(pestLinksPath)) {
    const linksContent = fs.readFileSync(pestLinksPath, 'utf-8')
    const lines = linksContent.split('\n').slice(1) // ヘッダースキップ
    for (const line of lines) {
      const [pesticideSlug, ingredientSlug, contentLabel] = line.split(',')
      if (!pesticideSlug || !ingredientSlug) continue
      const pest = results.find(p => p.slug === pesticideSlug)
      if (pest) {
        pest.ingredients.push({
          name: ingredientSlug,
          content: contentLabel || '',
        })
      }
    }
  }

  // pesticides.csv から pesticideType を補完
  const pestCsvPath = path.resolve(__dirname, 'pesticides.csv')
  if (fs.existsSync(pestCsvPath)) {
    const csvContent = fs.readFileSync(pestCsvPath, 'utf-8')
    const lines = csvContent.split('\n').slice(1)
    for (const line of lines) {
      const cols = line.split(',')
      const slug = cols[0]
      const pType = cols[3] // pesticideType column
      const pest = results.find(p => p.slug === slug)
      if (pest && pType) {
        pest.pesticideType = pType
      }
    }
  }

  return results
}

// ── 成分名の正規化（比較用） ──────────────────────────────
function _normalizeIngredientName(name: string): string {
  return name
    .replace(/[（(][^）)]*[）)]/g, '')  // 括弧内除去
    .replace(/[ｱ-ﾝ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0 + 0x30A0)) // 半角→全角カナ
    .replace(/[　\s]+/g, '')
    .replace(/[・]/g, '')
    .toLowerCase()
    .trim()
}

function normalizeContent(content: string): string {
  // "15.0%" → "15.0"
  return content.replace(/%/g, '').replace(/\s/g, '').trim()
}

// ── 差分検出 ──────────────────────────────────────────────
function compareSeedWithMaff(seedPests: SeedPesticide[], maffProducts: Map<string, MaffProduct>): DiffItem[] {
  const diffs: DiffItem[] = []

  for (const seed of seedPests) {
    const maff = maffProducts.get(seed.registrationNumber)
    if (!maff) continue

    // 成分数の比較
    if (maff.activeIngredients.length > 0 && seed.ingredients.length > 0) {
      // MAFF成分とseed成分のマッチング
      for (const maffIng of maff.activeIngredients) {
        const maffContent = normalizeContent(maffIng.content)

        // seed側で同じ含有量の成分を探す
        const seedMatch = seed.ingredients.find(si => {
          const seedContent = normalizeContent(si.content)
          return seedContent === maffContent
        })

        if (!seedMatch) {
          // 含有量が一致する成分がない → 不一致の可能性
          const seedContents = seed.ingredients.map(si => si.content).join(', ')
          diffs.push({
            slug: seed.slug,
            regNum: seed.registrationNumber,
            field: '有効成分含有量',
            seed: seedContents,
            maff: `${maffIng.name}: ${maffIng.content}`,
            severity: 'ERROR',
          })
        }
      }
    }

    // 成分数の不一致
    if (maff.activeIngredients.length > 0 && seed.ingredients.length > 0 &&
        maff.activeIngredients.length !== seed.ingredients.length) {
      diffs.push({
        slug: seed.slug,
        regNum: seed.registrationNumber,
        field: '有効成分数',
        seed: `${seed.ingredients.length}成分`,
        maff: `${maff.activeIngredients.length}成分`,
        severity: 'WARN',
      })
    }
  }

  return diffs
}

// ── CSV出力 ──────────────────────────────────────────────
function generateMaffReferenceCsv(products: Map<string, MaffProduct>, seedPests: SeedPesticide[]): string {
  // 5 成分まで構造化 (maff-reference-pending.csv と同じ列構造)。
  // MAFF 公式には 4 成分・5 成分の混合製剤 (例: ベニカＸネクストスプレー 24117) があるため、
  // 3 成分固定では構造上失われる情報がある。
  const header = 'pesticide_slug,maff_registration_number,maff_product_name,active_ingredient_1_name,active_ingredient_1_content,active_ingredient_2_name,active_ingredient_2_content,active_ingredient_3_name,active_ingredient_3_content,active_ingredient_4_name,active_ingredient_4_content,active_ingredient_5_name,active_ingredient_5_content,verified_date,source_url,notes'
  const today = new Date().toISOString().split('T')[0]
  const lines = [header]

  // seedデータの登録番号順にソート
  const sorted = [...seedPests]
    .filter(sp => products.has(sp.registrationNumber))
    .sort((a, b) => a.slug.localeCompare(b.slug))

  function csvEscape(value: string): string {
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
    return value
  }

  for (const seed of sorted) {
    const maff = products.get(seed.registrationNumber)!
    const ings = maff.activeIngredients
    const cols = [
      seed.slug,
      maff.registrationNumber,
      maff.productName,
      ings[0]?.name || '',
      ings[0]?.content || '',
      ings[1]?.name || '',
      ings[1]?.content || '',
      ings[2]?.name || '',
      ings[2]?.content || '',
      ings[3]?.name || '',
      ings[3]?.content || '',
      ings[4]?.name || '',
      ings[4]?.content || '',
      today,
      `${MAFF_BASE_URL}${maff.registrationNumber}`,
      `自動取得(${maff.purpose || 'N/A'})`,
    ]
    lines.push(cols.map(csvEscape).join(','))
  }

  return lines.join('\n') + '\n'
}

// ── メイン ───────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const forceRefresh = args.includes('--force')
  const diffOnly = args.includes('--diff-only')

  console.log('═══════════════════════════════════════════')
  console.log('  MAFF農薬登録データ 自動スクレイパー')
  console.log('═══════════════════════════════════════════')
  console.log()

  // 1. シードデータから登録番号付き農薬を抽出
  console.log('📂 シードデータ読み込み中...')
  const seedPests = extractSeedPesticides()
  console.log(`  → ${seedPests.length}件の登録番号付き農薬を検出`)
  console.log()

  // 2. MAFFからデータ取得
  console.log('🌐 MAFFデータ取得中...')
  const maffProducts = new Map<string, MaffProduct>()
  let fetchCount = 0
  let cacheHitCount = 0
  let errorCount = 0

  for (const seed of seedPests) {
    const regNum = seed.registrationNumber
    process.stdout.write(`  [${fetchCount + cacheHitCount + errorCount + 1}/${seedPests.length}] ${seed.slug} (${regNum})... `)

    // キャッシュチェック
    if (!forceRefresh) {
      const cached = readCache(regNum)
      if (cached) {
        const product = parseProductPage(cached, regNum)
        if (product) {
          maffProducts.set(regNum, product)
          cacheHitCount++
          console.log(`✓ キャッシュ (${product.productName})`)
          continue
        }
      }
    }

    // MAFF取得
    try {
      const html = await fetchPage(`${MAFF_BASE_URL}${regNum}`)
      writeCache(regNum, html)
      const product = parseProductPage(html, regNum)
      if (product) {
        maffProducts.set(regNum, product)
        fetchCount++
        console.log(`✓ 取得 (${product.productName})`)
      } else {
        errorCount++
        console.log('✗ パース失敗')
      }
    } catch (e) {
      errorCount++
      console.log(`✗ ${e instanceof Error ? e.message : 'エラー'}`)
    }

    await sleep(REQUEST_DELAY_MS)
  }

  console.log()
  console.log(`📊 取得結果: 成功=${fetchCount + cacheHitCount} (新規=${fetchCount}, キャッシュ=${cacheHitCount}), 失敗=${errorCount}`)
  console.log()

  // 3. 差分検出
  console.log('🔍 シードデータとの差分検出中...')
  const diffs = compareSeedWithMaff(seedPests, maffProducts)

  if (diffs.length === 0) {
    console.log('  ✅ 差分なし — シードデータはMAFF公式データと一致しています')
  } else {
    console.log(`  ⚠ ${diffs.length}件の差分を検出:`)
    console.log()
    for (const d of diffs) {
      const icon = d.severity === 'ERROR' ? '❌' : d.severity === 'WARN' ? '⚠️' : 'ℹ️'
      console.log(`  ${icon} ${d.slug} (${d.regNum}) — ${d.field}`)
      console.log(`     シード: ${d.seed}`)
      console.log(`     MAFF:   ${d.maff}`)
      console.log()
    }
  }

  if (diffOnly) return

  // 4. maff-reference.csv 生成
  const csvContent = generateMaffReferenceCsv(maffProducts, seedPests)
  const csvPath = VALIDATION_PATHS.maffReference
  const baselinePath = path.resolve(__dirname, 'baseline', 'maff-reference.csv')

  if (isDryRun) {
    console.log('📝 [DRY RUN] maff-reference.csv の内容:')
    console.log(csvContent.split('\n').slice(0, 5).join('\n'))
    console.log(`  ... (計 ${csvContent.split('\n').length - 1} 行)`)
  } else {
    fs.writeFileSync(csvPath, csvContent, 'utf-8')
    fs.writeFileSync(baselinePath, csvContent, 'utf-8')
    console.log(`✅ ${csvPath} を更新しました (${maffProducts.size}件)`)
    console.log(`✅ ${baselinePath} を更新しました`)
  }

  // 5. レポート出力
  const reportLines = [
    `MAFF自動検証レポート — ${new Date().toISOString()}`,
    `${'='.repeat(60)}`,
    ``,
    `取得結果: 成功=${fetchCount + cacheHitCount}, 失敗=${errorCount}`,
    `差分: ${diffs.length}件`,
    ``,
  ]

  if (diffs.length > 0) {
    reportLines.push('差分詳細:')
    for (const d of diffs) {
      reportLines.push(`  [${d.severity}] ${d.slug} (${d.regNum}) — ${d.field}`)
      reportLines.push(`    シード: ${d.seed}`)
      reportLines.push(`    MAFF:   ${d.maff}`)
      reportLines.push('')
    }
  }

  // MAFF取得できなかった農薬一覧
  const unverified = seedPests.filter(sp => !maffProducts.has(sp.registrationNumber))
  if (unverified.length > 0) {
    reportLines.push(`MAFF未取得(${unverified.length}件):`)
    for (const u of unverified) {
      reportLines.push(`  - ${u.slug} (${u.registrationNumber}): ${u.name}`)
    }
  }

  const reportPath = path.resolve(__dirname, 'maff-scrape-report.txt')
  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf-8')
  console.log(`📄 レポート: ${reportPath}`)
}

main().catch(console.error)
