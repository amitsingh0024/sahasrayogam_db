import 'dotenv/config'
import express from 'express'
import pg from 'pg'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import morgan from 'morgan'
import { z } from 'zod'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()

const pool = new pg.Pool({
  connectionString: process.env.NEON_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
})

// ── Security & Logging Middlewares ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disabled temporarily to avoid breaking React dev server
}))
app.use(morgan('dev'))
app.use(express.json())

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: { error: 'Too many requests from this IP' }
})
app.use('/api', apiLimiter)

// ── Authentication Middleware ───────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization
  const secret = process.env.ADMIN_SECRET
  if (!secret) return res.status(500).json({ error: 'Missing ADMIN_SECRET' })
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// ── Validation Schema (Zod) ─────────────────────────────────────────────────
const formulationSchema = z.object({
  entry_number:   z.string().optional().default(''),
  name:           z.string().min(1, 'Name is required'),
  sanskrit_verse: z.string().optional().default(''),
  ingredients:    z.string().optional().default(''),
  procedure:      z.string().optional().default(''),
  indications:    z.string().optional().default(''),
  organ_affected: z.string().optional().default(''),
  dosha_involved: z.string().optional().default(''),
  area_affected:  z.string().optional().default(''),
  notes:          z.string().optional().default(''),
  category:       z.string().min(1, 'Category is required'),
  source_file:    z.string().optional().default('')
})

const FORMULATION_COLS = `
  id, entry_number, name, sanskrit_verse, ingredients, procedure,
  indications, organ_affected, dosha_involved, area_affected, notes, category, source_file`

import NodeCache from 'node-cache'

// ── Cache Setup ─────────────────────────────────────────────────────────────
// Cache formulations and search results for 10 minutes (600 seconds)
const cache = new NodeCache({ stdTTL: 600 })

// ── Formulations ─────────────────────────────────────────────────────────────

app.get('/api/formulations', async (_req, res) => {
  try {
    const cacheKey = 'all_formulations'
    const cached = cache.get(cacheKey)
    if (cached) return res.json(cached)

    const { rows } = await pool.query(`
      SELECT ${FORMULATION_COLS} FROM formulations
      ORDER BY
        CAST(NULLIF(REGEXP_REPLACE(entry_number, '[^0-9]', '', 'g'), '') AS INTEGER) ASC NULLS LAST,
        entry_number ASC`)
    
    cache.set(cacheKey, rows)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Postgres Lexical/Fuzzy Search ────────────────────────────────────────────
// Uses pg_trgm for fuzzy name matching + tsvector full-text across all fields.
// Subquery computes tsvector once per row; outer query ranks and sorts.
app.post('/api/search', async (req, res) => {
  const { query, category, limit = 100 } = req.body
  if (!query || !query.trim()) return res.json([])

  const q = query.trim()
  const cacheKey = `search:${q}:${category || 'all'}:${limit}`
  const cached = cache.get(cacheKey)
  if (cached) return res.json(cached)

  try {
    const params = [q]
    let categoryFilter = ''
    if (category && category !== 'all') {
      if (category === 'AsavaArishta') {
        categoryFilter = `AND category IN ('Asava', 'Arishta')`
      } else {
        params.push(category)
        categoryFilter = `AND category = $${params.length}`
      }
    }
    params.push(limit)
    const limitParam = `$${params.length}`

    // Subquery computes tsvector once; outer SELECT ranks using pre-computed values
    const sql = `
      SELECT ${FORMULATION_COLS},
             ROUND(name_sim::numeric, 4)  AS name_sim,
             ROUND(text_rank::numeric, 4) AS text_rank
      FROM (
        SELECT *,
          similarity(name, $1) AS name_sim,
          ts_rank(
            to_tsvector('simple',
              coalesce(name,'')           || ' ' ||
              coalesce(ingredients,'')    || ' ' ||
              coalesce(indications,'')    || ' ' ||
              coalesce(dosha_involved,'') || ' ' ||
              coalesce(organ_affected,'') || ' ' ||
              coalesce(area_affected,'')  || ' ' ||
              coalesce(procedure,'')      || ' ' ||
              coalesce(notes,'')
            ),
            plainto_tsquery('simple', $1)
          ) AS text_rank,
          to_tsvector('simple',
            coalesce(name,'')           || ' ' ||
            coalesce(ingredients,'')    || ' ' ||
            coalesce(indications,'')    || ' ' ||
            coalesce(dosha_involved,'') || ' ' ||
            coalesce(organ_affected,'') || ' ' ||
            coalesce(area_affected,'')  || ' ' ||
            coalesce(procedure,'')      || ' ' ||
            coalesce(notes,'')
          ) AS tvec
        FROM formulations
      ) sub
      WHERE (name % $1 OR tvec @@ plainto_tsquery('simple', $1))
      ${categoryFilter}
      ORDER BY (name_sim * 2.0 + text_rank) DESC
      LIMIT ${limitParam}`

    const { rows } = await pool.query(sql, params)
    cache.set(cacheKey, rows)
    res.json(rows)
  } catch (err) {
    console.error('Search error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/formulations', requireAuth, async (req, res) => {
  try {
    const p = formulationSchema.parse(req.body)
    const { rows } = await pool.query(`
      INSERT INTO formulations
        (entry_number, name, sanskrit_verse, ingredients, procedure,
         indications, organ_affected, dosha_involved, area_affected,
         notes, category, source_file)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING ${FORMULATION_COLS}`,
      [p.entry_number, p.name, p.sanskrit_verse, p.ingredients,
       p.procedure, p.indications, p.organ_affected, p.dosha_involved,
       p.area_affected, p.notes, p.category, p.source_file]
    )
    cache.flushAll() // Invalidate cache on write
    res.json(rows[0])
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors })
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/formulations/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  try {
    const p = formulationSchema.parse(req.body)
    const { rows } = await pool.query(`
      UPDATE formulations SET
        entry_number   = $1,
        name           = $2,
        sanskrit_verse = $3,
        ingredients    = $4,
        procedure      = $5,
        indications    = $6,
        organ_affected = $7,
        dosha_involved = $8,
        area_affected  = $9,
        notes          = $10,
        category       = $11,
        source_file    = $12
      WHERE id = $13
      RETURNING ${FORMULATION_COLS}`,
      [p.entry_number, p.name, p.sanskrit_verse, p.ingredients,
       p.procedure, p.indications, p.organ_affected, p.dosha_involved,
       p.area_affected, p.notes, p.category, p.source_file, id]
    )
    cache.flushAll()
    res.json(rows[0])
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors })
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/formulations/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  try {
    await pool.query(`DELETE FROM formulations WHERE id = $1`, [id])
    cache.flushAll()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Semantic search ───────────────────────────────────────────────────────────

const NVIDIA_EMBED_URL = 'https://integrate.api.nvidia.com/v1/embeddings'
const EMBED_MODEL = 'nvidia/nemotron-3-embed-1b'

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

// NOTE: We don't protect semantic search with requireAuth so users can search freely!
app.post('/api/semantic-search', async (req, res) => {
  const { query, limit = 20 } = req.body
  if (!query || !query.trim()) return res.status(400).json({ error: 'query required' })
  try {
    const embedding = await embedQuery(query.trim())
    const vec = '[' + embedding.join(',') + ']'
    const { rows } = await pool.query(`
      SELECT ${FORMULATION_COLS},
             ROUND((embedding <=> $1::vector)::numeric, 4) AS distance
      FROM formulations
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $2`,
      [vec, limit]
    )
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
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`))
