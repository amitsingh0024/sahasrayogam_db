import { useState, useEffect } from 'react'
import { X, Zap, Save, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { supabaseAdmin } from '../lib/supabaseAdmin'

// ─── Constants ──────────────────────────────────────────────────────────────
const CATEGORIES = ['Kashaya', 'KashayaParisishta', 'Ghrita', 'Taila', 'Choornam', 'Arishta', 'Asava', 'Lehya', 'Vati', 'Gutika']

const CAT_META = {
  Kashaya:           { color: '#1A3C34', source: 'Kashaya.txt' },
  KashayaParisishta: { label: 'Kashaya Parisishta', color: '#2C5F4A', source: 'KashayaParisishta.txt' },
  Ghrita:            { color: '#7A5200', source: 'Ghrita.txt' },
  Taila:             { color: '#3D5A1F', source: 'Taila.txt' },
  Choornam:          { color: '#7A3F2E', source: 'Choornam.txt' },
  Arishta:           { color: '#5C1835', source: 'Asava,Arishta.txt' },
  Asava:             { color: '#2B3F6B', source: 'Asava,Arishta.txt' },
  Lehya:             { color: '#7B3F00', source: 'Lehya.txt' },
  Gutika:            { label: 'Vati',   color: '#4A2080', source: 'Gutika.txt' },
  Vati:              { label: 'Gutika', color: '#3B6B56', source: 'Vati.txt' },
}

// ─── Auto-parser ────────────────────────────────────────────────────────────
function parseRawEntry(raw) {
  const lines = raw.split('\n')
  const DEVANAGARI   = /[\u0900-\u097F]/
  const CONTENTS_RE  = /^-{0,2}Contents?\s*:/i
  const NUMBERED_RE  = /^-(\d+(?:st|nd|rd|th)\s+formula)\s*:(.*)/i
  const FORMULA_RE   = /^-{1,2}Formula\s*:(.*)/i
  const PROC_RE      = /^-Procedure\s*:(.*)/i
  const IND_RE       = /^-Indications?\s*:(.*)/i
  const ORGAN_RE     = /^-Organ\s+Affected\s*:(.*)/i
  const DOSHA_RE     = /^-Dosha\s+(?:Involved|Affected)?\s*:(.*)/i
  const AREA_RE      = /^-Area\s+Affected\s*:(.*)/i
  const NOTE_HINTS   = [/^The same/i, /^According/i, /^In this context/i,
                        /^N\.B\./i, /^Note:/i, /^This formulation/i,
                        /^Originally/i, /^Therapeutically/i, /^The word/i]

  let entryNumber = '', name = ''
  let shlokas = [], formulaLines = [], procLines = [], indLines = [], noteLines = []
  let organLines = [], doshaLines = [], areaLines = []
  let headerFound = false, inContents = false
  let section = null, pastInd = false

  const appendTo = (sec, text, isCont = false) => {
    if (sec === 'formula' && formulaLines.length)
      formulaLines[formulaLines.length - 1] += (isCont ? ' ' : '\n') + text
    else if (sec === 'procedure' && procLines.length)
      procLines[procLines.length - 1] += ' ' + text
    else if (sec === 'indications' && indLines.length)
      indLines[indLines.length - 1] += ' ' + text
    else if (sec === 'organ' && organLines.length)
      organLines[organLines.length - 1] += ' ' + text
    else if (sec === 'dosha' && doshaLines.length)
      doshaLines[doshaLines.length - 1] += ' ' + text
    else if (sec === 'area' && areaLines.length)
      areaLines[areaLines.length - 1] += ' ' + text
    else
      noteLines.push(text)
  }

  for (const rawLine of lines) {
    const l = rawLine.trim()
    if (!l) continue

    if (!headerFound) {
      const m = l.match(/^(\d+)\.\s*(.+)/)
      if (m) { entryNumber = m[1]; name = m[2].trim(); headerFound = true }
      continue
    }

    if (CONTENTS_RE.test(l)) {
      inContents = true; pastInd = false; section = null; continue
    }

    if (!inContents) {
      if (DEVANAGARI.test(l)) shlokas.push(l.startsWith('-') ? l.slice(1).trim() : l)
      continue
    }

    const numM   = l.match(NUMBERED_RE)
    const fmM    = l.match(FORMULA_RE)
    const procM  = l.match(PROC_RE)
    const indM   = l.match(IND_RE)
    const organM = l.match(ORGAN_RE)
    const doshaM = l.match(DOSHA_RE)
    const areaM  = l.match(AREA_RE)

    if (numM) {
      formulaLines.push(numM[1].trim() + ': ' + numM[2].trim())
      section = 'formula'; pastInd = false
    } else if (fmM) {
      formulaLines.push(fmM[1].trim())
      section = 'formula'; pastInd = false
    } else if (procM) {
      const t = procM[1].trim(); if (t) procLines.push(t); section = 'procedure'
    } else if (indM) {
      const t = indM[1].trim(); if (t) indLines.push(t); section = 'indications'; pastInd = true
    } else if (organM) {
      const t = organM[1].trim(); if (t) organLines.push(t); section = 'organ'; pastInd = false
    } else if (doshaM) {
      const t = doshaM[1].trim(); if (t) doshaLines.push(t); section = 'dosha'; pastInd = false
    } else if (areaM) {
      const t = areaM[1].trim(); if (t) areaLines.push(t); section = 'area'; pastInd = false
    } else if (l.startsWith('-')) {
      const clean = l.slice(1).trim()
      if (!clean) continue
      if (DEVANAGARI.test(clean)) {
        shlokas.push(clean); pastInd = false; section = 'shloka'
      } else if (pastInd || NOTE_HINTS.some(p => p.test(clean))) {
        noteLines.push(clean); section = 'notes'; pastInd = true
      } else if (section && section !== 'shloka') {
        appendTo(section, clean)
      } else {
        noteLines.push(clean)
      }
    } else {
      if (DEVANAGARI.test(l)) {
        shlokas.push(l); section = 'shloka'
      } else if (pastInd) {
        if (noteLines.length) noteLines[noteLines.length - 1] += ' ' + l
        else noteLines.push(l)
      } else if (section && section !== 'shloka') {
        appendTo(section, l, true)
      }
    }
  }

  return {
    entry_number:   entryNumber,
    name,
    sanskrit_verse: shlokas.join('\n'),
    ingredients:    formulaLines.join('\n'),
    procedure:      procLines.join('\n'),
    indications:    indLines.join('\n'),
    organ_affected: organLines.join('\n'),
    dosha_involved: doshaLines.join('\n'),
    area_affected:  areaLines.join('\n'),
    notes:          noteLines.join('\n'),
  }
}

// ─── Field wrapper ───────────────────────────────────────────────────────────
function Field({ label, flashing, children, optional }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-1.5">
        {label}
        {optional && <span className="ml-1 normal-case tracking-normal font-normal text-gray-300">(optional)</span>}
      </label>
      <div className={flashing ? 'field-flash-wrap' : ''}>{children}</div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function AdminPanel({ recipe, onClose, onSaved, onUpdated, onDeleted }) {
  const isEdit = Boolean(recipe?.id)
  const initCat = recipe?.category || 'Kashaya'

  const [category,    setCategory]    = useState(initCat)
  const [entryNumber, setEntryNumber] = useState(recipe?.entry_number   || '')
  const [name,        setName]        = useState(recipe?.name           || '')
  const [verse,       setVerse]       = useState(recipe?.sanskrit_verse || '')
  const [ingredients, setIngredients] = useState(recipe?.ingredients    || '')
  const [procedure,   setProcedure]   = useState(recipe?.procedure      || '')
  const [indications,    setIndications]    = useState(recipe?.indications    || '')
  const [organAffected,  setOrganAffected]  = useState(recipe?.organ_affected || '')
  const [doshaInvolved,  setDoshaInvolved]  = useState(recipe?.dosha_involved || '')
  const [areaAffected,   setAreaAffected]   = useState(recipe?.area_affected  || '')
  const [notes,          setNotes]          = useState(recipe?.notes          || '')

  const [rawText,    setRawText]    = useState('')
  const [showPaste,  setShowPaste]  = useState(!isEdit)
  const [flashSet,   setFlashSet]   = useState(new Set())
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [toastMsg,   setToastMsg]   = useState(null)  // { text, ok }

  const accent = CAT_META[category]?.color || '#1A3C34'
  const lightBg = `${accent}0D`
  const borderC = `${accent}25`

  // Flash a field briefly to signal it was auto-filled
  const flash = (...fields) => {
    setFlashSet(new Set(fields))
    setTimeout(() => setFlashSet(new Set()), 1100)
  }

  const toast = (text, ok = true) => {
    setToastMsg({ text, ok })
    setTimeout(() => setToastMsg(null), 2800)
  }

  // Keyboard shortcut: Cmd/Ctrl+S saves
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault(); handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  // ── Parse ────────────────────────────────────────────────────────────────
  const handleParse = () => {
    if (!rawText.trim()) { toast('Paste some text first', false); return }
    const p = parseRawEntry(rawText)
    const toFlash = []
    if (p.entry_number)   { setEntryNumber(p.entry_number);   toFlash.push('num') }
    if (p.name)           { setName(p.name);                  toFlash.push('name') }
    if (p.sanskrit_verse) { setVerse(p.sanskrit_verse);       toFlash.push('verse') }
    if (p.ingredients)    { setIngredients(p.ingredients);    toFlash.push('ing') }
    if (p.procedure)      { setProcedure(p.procedure);        toFlash.push('proc') }
    if (p.indications)    { setIndications(p.indications);       toFlash.push('ind') }
    if (p.organ_affected) { setOrganAffected(p.organ_affected); toFlash.push('organ') }
    if (p.dosha_involved) { setDoshaInvolved(p.dosha_involved); toFlash.push('dosha') }
    if (p.area_affected)  { setAreaAffected(p.area_affected);   toFlash.push('area') }
    if (p.notes)          { setNotes(p.notes);                  toFlash.push('notes') }
    flash(...toFlash)
    toast(toFlash.length ? `${toFlash.length} fields parsed` : 'No structured data found — fill manually', toFlash.length > 0)
  }

  // ── Save / Update ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) { toast('Name is required', false); return }
    setSaving(true)
    const payload = {
      entry_number:   entryNumber,
      name:           name.trim(),
      sanskrit_verse: verse.trim(),
      ingredients:    ingredients.trim(),
      procedure:      procedure.trim(),
      indications:    indications.trim(),
      organ_affected: organAffected.trim(),
      dosha_involved: doshaInvolved.trim(),
      area_affected:  areaAffected.trim(),
      notes:          notes.trim(),
      category,
      source_file:    CAT_META[category]?.source || '',
    }

    if (isEdit) {
      const { data, error } = await supabaseAdmin
        .from('formulations').update(payload).eq('id', recipe.id).select()
      setSaving(false)
      if (error) { toast('Update failed: ' + error.message, false); return }
      const updated = data?.[0] ?? { ...payload, id: recipe.id }
      toast(`Updated — ${updated.name}`)
      onUpdated?.(updated)
    } else {
      const { data, error } = await supabaseAdmin
        .from('formulations').insert([payload]).select()
      setSaving(false)
      if (error) { toast('Save failed: ' + error.message, false); return }
      const saved = data?.[0] ?? payload
      toast(`Saved — ${saved.name}`)
      onSaved?.(saved)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!isEdit) return
    if (!window.confirm(`Permanently delete "${recipe.name}"?\nThis cannot be undone.`)) return
    setDeleting(true)
    const { error } = await supabaseAdmin.from('formulations').delete().eq('id', recipe.id)
    setDeleting(false)
    if (error) { toast('Delete failed: ' + error.message, false); return }
    onDeleted?.(recipe.id)
    onClose()
  }

  // ── Input style ──────────────────────────────────────────────────────────
  const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 transition-colors resize-none'
  const inputStyle = { borderColor: borderC, '--tw-ring-color': borderC }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/25 z-50 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        className="fixed right-0 top-0 bottom-0 w-[530px] max-w-[96vw] bg-white z-50 flex flex-col shadow-2xl"
        style={{ animation: 'slideInRight 0.22s ease-out' }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Panel header ──────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ backgroundColor: lightBg, borderBottom: `1px solid ${borderC}` }}
        >
          <div>
            <h2 className="font-serif font-bold text-base leading-snug" style={{ color: accent }}>
              {isEdit ? `✎  ${recipe.name}` : '+ New Formula'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 font-sans">
              {isEdit ? 'Edit and save directly to database' : 'Parse or fill, then save to database'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 rounded-full text-gray-400 hover:bg-black/8 hover:text-gray-600 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Category selector */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-2">Category</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => {
                const active = category === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className="px-3 py-1 rounded-full text-xs font-bold font-sans transition-all"
                    style={active
                      ? { backgroundColor: CAT_META[cat].color, color: '#FFF' }
                      : { backgroundColor: '#F3F4F6', color: '#6B7280' }
                    }
                  >
                    {CAT_META[cat]?.label || cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Auto-parse accordion ────────────────────────────────────── */}
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: borderC }}>
            <button
              onClick={() => setShowPaste(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold font-sans transition-colors"
              style={{ backgroundColor: lightBg, color: accent }}
            >
              <span className="flex items-center gap-2"><Zap size={13} /> Auto-parse from raw text</span>
              {showPaste ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showPaste && (
              <div className="p-4 space-y-3 border-t" style={{ borderColor: borderC }}>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder="Paste one entry block from the .txt source file here…"
                  rows={7}
                  className={inputCls + ' font-devanagari'}
                  style={{ ...inputStyle, fontSize: '13px', lineHeight: '1.75' }}
                />
                <button
                  onClick={handleParse}
                  className="w-full py-2 rounded-lg text-white text-sm font-bold font-sans flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: accent }}
                >
                  <Zap size={14} /> Parse into fields
                </button>
              </div>
            )}
          </div>

          {/* ── Entry # + Name ──────────────────────────────────────────── */}
          <div className="grid grid-cols-[90px_1fr] gap-3">
            <Field label="Entry #" flashing={flashSet.has('num')}>
              <input
                value={entryNumber}
                onChange={e => setEntryNumber(e.target.value)}
                placeholder="e.g. 14"
                className={inputCls}
                style={inputStyle}
              />
            </Field>
            <Field label="Name" flashing={flashSet.has('name')}>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Formula name"
                className={inputCls}
                style={inputStyle}
              />
            </Field>
          </div>

          {/* ── Sanskrit Verse ──────────────────────────────────────────── */}
          <Field label="Sanskrit Verse" flashing={flashSet.has('verse')} optional>
            <textarea
              value={verse}
              onChange={e => setVerse(e.target.value)}
              placeholder="ślokas (Devanagari)…"
              rows={4}
              className={inputCls + ' font-devanagari'}
              style={{ ...inputStyle, lineHeight: '1.9', fontSize: '15px' }}
            />
          </Field>

          {/* ── Ingredients ─────────────────────────────────────────────── */}
          <Field label="Formula / Ingredients" flashing={flashSet.has('ing')}>
            <textarea
              value={ingredients}
              onChange={e => setIngredients(e.target.value)}
              placeholder={"Single: Drug1, Drug2, Drug3…\nMulti:\n1st formula: Drug1…\n2nd formula: Drug4…"}
              rows={5}
              className={inputCls}
              style={inputStyle}
            />
          </Field>

          {/* ── Procedure ───────────────────────────────────────────────── */}
          <Field label="Procedure" flashing={flashSet.has('proc')}>
            <textarea
              value={procedure}
              onChange={e => setProcedure(e.target.value)}
              placeholder="Prepare decoction with the above specified drugs…"
              rows={3}
              className={inputCls}
              style={inputStyle}
            />
          </Field>

          {/* ── Indications ─────────────────────────────────────────────── */}
          <Field label="Indications" flashing={flashSet.has('ind')}>
            <textarea
              value={indications}
              onChange={e => setIndications(e.target.value)}
              placeholder="Jwara, Trishna, Raktapitta…"
              rows={3}
              className={inputCls}
              style={inputStyle}
            />
          </Field>

          {/* ── 3 new clinical fields ────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 p-4 rounded-xl" style={{ backgroundColor: `${accent}08`, border: `1px solid ${borderC}` }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 -mb-1">Clinical Classification</p>
            <Field label="Dosha Involved" flashing={flashSet.has('dosha')} optional>
              <input
                value={doshaInvolved}
                onChange={e => setDoshaInvolved(e.target.value)}
                placeholder="Vata, Pitta, Kapha…"
                className={inputCls}
                style={inputStyle}
              />
            </Field>
            <Field label="Organ Affected" flashing={flashSet.has('organ')} optional>
              <input
                value={organAffected}
                onChange={e => setOrganAffected(e.target.value)}
                placeholder="Liver, Heart, Lungs…"
                className={inputCls}
                style={inputStyle}
              />
            </Field>
            <Field label="Area Affected" flashing={flashSet.has('area')} optional>
              <input
                value={areaAffected}
                onChange={e => setAreaAffected(e.target.value)}
                placeholder="Abdomen, Head, Joints…"
                className={inputCls}
                style={inputStyle}
              />
            </Field>
          </div>

          {/* ── Notes ───────────────────────────────────────────────────── */}
          <Field label="Notes" flashing={flashSet.has('notes')} optional>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Cross-references, commentary, NB remarks…"
              rows={3}
              className={inputCls}
              style={inputStyle}
            />
          </Field>

        </div>{/* end scrollable body */}

        {/* ── Footer actions ────────────────────────────────────────────── */}
        <div
          className="shrink-0 px-5 py-4 flex items-center gap-3"
          style={{ borderTop: `1px solid ${borderC}` }}
        >
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold font-sans text-red-500 border-red-200 hover:bg-red-50 transition-colors disabled:opacity-40 shrink-0"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold font-sans transition-all disabled:opacity-40 hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : <><Save size={15} /> {isEdit ? 'Update Formula' : 'Save to Database'}</>
            }
          </button>
        </div>

        {/* ── Inline toast ──────────────────────────────────────────────── */}
        {toastMsg && (
          <div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full text-white text-xs font-semibold font-sans shadow-lg whitespace-nowrap z-10"
            style={{
              backgroundColor: toastMsg.ok ? accent : '#B91C1C',
              animation: 'fadeSlideUp 0.2s ease-out',
            }}
          >
            {toastMsg.text}
          </div>
        )}
      </div>
    </>
  )
}
