 
import path from 'node:path'
import { config } from 'dotenv'
config({ path: path.resolve('.env.local') })
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const tables = [
  'pesticides', 'disease_pests', 'active_ingredients', 'pesticide_effects',
  'pesticide_active_ingredients', 'pesticide_incompatibilities', 'pesticide_columns',
  'formulation_types', 'spreader_types',
  'fertilizer_nutrients', 'fertilizer_categories', 'tree_species',
  'fertilization_plans', 'fertilizer_columns',
  'hormone_types', 'hormone_effects', 'hormone_interactions',
  'hormone_columns', 'hormone_seasonal_levels',
  'bonsai_terms',
]

;(async () => {
  for (const t of tables) {
    try {
      const r = await pool.query(`SELECT count(*) FROM ${t}`)
      console.log(`${t}: ${r.rows[0].count}`)
    } catch (e: unknown) {
      console.log(`${t}: ERROR - ${(e as Error).message}`)
    }
  }
  await pool.end()
})()
