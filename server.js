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

app.get('/api/formulations', async (_req, res) => {
  try {
    const rows = await sql`SELECT * FROM formulations ORDER BY id ASC`
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
      RETURNING *`
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
      RETURNING *`
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

// ── Serve built frontend ──────────────────────────────────────────────────────

app.use(express.static(join(__dirname, 'dist')))
app.get('/{*any}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
