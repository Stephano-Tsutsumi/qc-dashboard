#!/usr/bin/env node
/**
 * List weekly_snapshots, then delete exactly one row by report_date (YYYY-MM-DD).
 * Requires service role key (bypasses RLS) — from Supabase Dashboard → Project Settings → API.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *     node --env-file=.env.local scripts/delete-weekly-snapshot.mjs 2026-04-22
 *
 * Or paste the key for one run only (do not commit).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(root, '.env.local'), 'utf8')
    const out = {}
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1)
      out[m[1]] = v
    }
    return out
  } catch {
    return {}
  }
}

const envLocal = loadEnvLocal()
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || envLocal.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || envLocal.SUPABASE_SERVICE_ROLE_KEY || ''
const reportDate = (process.argv[2] || '').trim()

if (!url) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL (.env.local or env).')
  process.exit(1)
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
  console.error('Usage: node scripts/delete-weekly-snapshot.mjs YYYY-MM-DD')
  console.error('Example: node scripts/delete-weekly-snapshot.mjs 2026-04-22')
  process.exit(1)
}
if (!serviceKey) {
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY. Add it to the environment (not committed) or Dashboard → SQL Editor can run the DELETE manually.'
  )
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: rows, error: selErr } = await supabase
  .from('weekly_snapshots')
  .select('id, label, report_date, created_at')
  .eq('report_date', reportDate)

if (selErr) {
  console.error('Select failed:', selErr.message)
  process.exit(1)
}

console.log(`Rows with report_date=${reportDate}:`)
console.table(rows ?? [])

if (!rows?.length) {
  console.error('No row to delete for that report_date.')
  process.exit(1)
}
if (rows.length > 1) {
  console.error('Multiple rows match; delete manually by id in Supabase SQL Editor to avoid data loss.')
  process.exit(1)
}

const id = rows[0].id
const { error: delErr } = await supabase.from('weekly_snapshots').delete().eq('id', id)

if (delErr) {
  console.error('Delete failed:', delErr.message)
  process.exit(1)
}

console.log(`Deleted snapshot id=${id} label=${rows[0].label}`)
