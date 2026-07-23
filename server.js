import 'dotenv/config'
import express from 'express'
import { neon } from '@neondatabase/serverless'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())

const sql = neon(process.env.NEON_CONNECTION_STRING)

// ── Formulations ─────────────────────────────────────────────────────────────

const FORMULATION_COLS = sql`
  id, entry_number, name, sanskrit_verse, ingredients, procedure,
  indications, organ_affected, dosha_involved, area_affected, notes, category, source_file`

app.get('/api/formulations', async (_req, res) => {
  try {
    const rows = await sql`
      SELECT ${FORMULATION_COLS} FROM formulations
      ORDER BY
        CAST(NULLIF(REGEXP_REPLACE(entry_number, '[^0-9]', '', 'g'), '') AS INTEGER) ASC NULLS LAST,
        entry_number ASC`
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/formulations', async (req, res) => {
  const p = req.body
  try {
    const [row] = await sql`
      INSERT INTO formulations
        (entry_number, name, sanskrit_verse, ingredients, procedure,
         indications, organ_affected, dosha_involved, area_affected,
         notes, category, source_file)
      VALUES
        (${p.entry_number}, ${p.name}, ${p.sanskrit_verse}, ${p.ingredients},
         ${p.procedure}, ${p.indications}, ${p.organ_affected}, ${p.dosha_involved},
         ${p.area_affected}, ${p.notes}, ${p.category}, ${p.source_file})
      RETURNING id, entry_number, name, sanskrit_verse, ingredients, procedure,
                indications, organ_affected, dosha_involved, area_affected, notes, category, source_file`
    res.json(row)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/formulations/:id', async (req, res) => {
  const p = req.body
  const id = Number(req.params.id)
  try {
    const [row] = await sql`
      UPDATE formulations SET
        entry_number   = ${p.entry_number},
        name           = ${p.name},
        sanskrit_verse = ${p.sanskrit_verse},
        ingredients    = ${p.ingredients},
        procedure      = ${p.procedure},
        indications    = ${p.indications},
        organ_affected = ${p.organ_affected},
        dosha_involved = ${p.dosha_involved},
        area_affected  = ${p.area_affected},
        notes          = ${p.notes},
        category       = ${p.category},
        source_file    = ${p.source_file}
      WHERE id = ${id}
      RETURNING id, entry_number, name, sanskrit_verse, ingredients, procedure,
                indications, organ_affected, dosha_involved, area_affected, notes, category, source_file`
    res.json(row)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/formulations/:id', async (req, res) => {
  const id = Number(req.params.id)
  try {
    await sql`DELETE FROM formulations WHERE id = ${id}`
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Semantic search ───────────────────────────────────────────────────────────

const NVIDIA_EMBED_URL = 'https://integrate.api.nvidia.com/v1/embeddings'
const EMBED_MODEL = 'nvidia/nv-embed-v1'

async function embedQuery(text) {
  const res = await fetch(NVIDIA_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: [text],
      input_type: 'query',
      encoding_format: 'float',
      truncate: 'END',
    }),
  })
  if (!res.ok) throw new Error(`NVIDIA API error ${res.status}`)
  const json = await res.json()
  return json.data[0].embedding
}

app.post('/api/semantic-search', async (req, res) => {
  const { query, limit = 20 } = req.body
  if (!query || !query.trim()) return res.status(400).json({ error: 'query required' })
  try {
    const embedding = await embedQuery(query.trim())
    const vec = '[' + embedding.join(',') + ']'
    // Rank by cosine distance — no hard cutoff since domain-specific text
    // naturally yields distances in 0.85–0.96 range; top-N ranking is what matters
    const rows = await sql`
      SELECT id, entry_number, name, sanskrit_verse, ingredients, procedure,
             indications, organ_affected, dosha_involved, area_affected, notes, category, source_file,
             ROUND((embedding <=> ${vec}::vector)::numeric, 4) AS distance
      FROM formulations
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vec}::vector
      LIMIT ${limit}`
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Serve built frontend ──────────────────────────────────────────────────────

app.use(express.static(join(__dirname, 'dist')))
app.get('/{*any}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
