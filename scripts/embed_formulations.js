/**
 * One-time script: embed all formulations via NVIDIA nv-embed-v1
 * and store the vectors in the DB.
 *
 * Run from kashaya-web/:
 *   node scripts/embed_formulations.js
 */
import 'dotenv/config'
import pg from 'pg'

const { Client } = pg
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY
const NVIDIA_EMBED_URL = 'https://integrate.api.nvidia.com/v1/embeddings'
const MODEL = 'nvidia/nv-embed-v1'
const BATCH_SIZE = 10   // rows per API call (keep low to avoid payload limits)
const DELAY_MS  = 500   // ms between batches (rate-limit headroom)

// ── Build the text blob we embed for each formulation ────────────────────────
function formulationToText(row) {
  const parts = [row.name]
  if (row.indications)    parts.push(`Indications: ${row.indications}`)
  if (row.organ_affected) parts.push(`Organ: ${row.organ_affected}`)
  if (row.dosha_involved) parts.push(`Dosha: ${row.dosha_involved}`)
  if (row.area_affected)  parts.push(`Area: ${row.area_affected}`)
  if (row.ingredients)    parts.push(`Ingredients: ${row.ingredients}`)
  return parts.join('. ')
}

// ── Call NVIDIA embedding API ─────────────────────────────────────────────────
async function embedTexts(texts, inputType = 'passage') {
  const res = await fetch(NVIDIA_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: texts,
      input_type: inputType,
      encoding_format: 'float',
      truncate: 'END',
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`NVIDIA API ${res.status}: ${txt}`)
  }
  const json = await res.json()
  // API returns data sorted by index
  return json.data.sort((a, b) => a.index - b.index).map(d => d.embedding)
}

// ── Main ─────────────────────────────────────────────────────────────────────
const client = new Client({ connectionString: process.env.NEON_CONNECTION_STRING })
await client.connect()

// Fetch only rows that don't have an embedding yet
const { rows } = await client.query(
  `SELECT id, name, indications, organ_affected, dosha_involved, area_affected, ingredients
   FROM formulations
   WHERE embedding IS NULL
   ORDER BY id`)

console.log(`Rows to embed: ${rows.length}`)
if (rows.length === 0) {
  console.log('All formulations already embedded.')
  await client.end()
  process.exit(0)
}

let done = 0
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE)
  const texts = batch.map(formulationToText)

  const embeddings = await embedTexts(texts, 'passage')

  for (let j = 0; j < batch.length; j++) {
    const vec = '[' + embeddings[j].join(',') + ']'
    await client.query(
      `UPDATE formulations SET embedding = $1::vector WHERE id = $2`,
      [vec, batch[j].id]
    )
  }

  done += batch.length
  process.stdout.write(`\r  ${done}/${rows.length} embedded`)

  if (i + BATCH_SIZE < rows.length) {
    await new Promise(r => setTimeout(r, DELAY_MS))
  }
}

console.log('\n✓ Done')
await client.end()
