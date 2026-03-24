// Builds a deduplicated suggestion corpus from allData.
// Called once after data loads; returns stable arrays for Fuse to index.

const FORMULA_LABEL_RE = /^\d+(st|nd|rd|th)\s+formula$/i
const SPECIAL_LABEL_RE = /^(kalka\s+dravya|sneha\s+dravya|drava\s+dravya|formula)$/i

function isFormulaLabel(str) {
  return FORMULA_LABEL_RE.test(str) || SPECIAL_LABEL_RE.test(str)
}

function addUnique(map, raw) {
  const key = raw.toLowerCase().trim()
  if (key.length < 3) return
  if (!map.has(key)) map.set(key, raw.trim())
}

// Split "Chinnodbhava (Guduchi)" → ["Chinnodbhava", "Guduchi"]
function expandParens(token) {
  return token.split(/\s*[()]\s*/).map(s => s.trim()).filter(s => s.length >= 3)
}

export function buildSuggestionCorpus(allData) {
  const nameList = []
  const ingMap   = new Map()   // lowercase → original casing
  const indMap   = new Map()

  for (const entry of allData) {
    // ── Names ──────────────────────────────────────────────
    if (entry.name) nameList.push(entry.name)

    // ── Ingredients ────────────────────────────────────────
    if (entry.ingredients) {
      for (const rawLine of entry.ingredients.split('\n')) {
        const line = rawLine.trim()
        if (!line) continue

        // If the line has a colon, check whether the left side is a label
        const colonIdx = line.indexOf(':')
        const content = colonIdx > 0 && isFormulaLabel(line.substring(0, colonIdx).trim())
          ? line.substring(colonIdx + 1)
          : line

        // Split by comma, expand parentheticals, add to map
        for (const part of content.split(',')) {
          // Strip trailing quantity notations: "Sunthi — 1 pala" or "Sunthi - 2 parts"
          const clean = part.split(/\s+[—–-]\s+\d/)[0].trim()
          for (const token of expandParens(clean)) {
            addUnique(ingMap, token)
          }
        }
      }
    }

    // ── Indications ────────────────────────────────────────
    if (entry.indications) {
      for (const part of entry.indications.split(/[\n,]/)) {
        const clean = part.trim()
        addUnique(indMap, clean)
      }
    }
  }

  return {
    names:       nameList,
    ingredients: [...ingMap.values()].sort((a, b) => a.localeCompare(b)),
    indications: [...indMap.values()].sort((a, b) => a.localeCompare(b)),
  }
}
