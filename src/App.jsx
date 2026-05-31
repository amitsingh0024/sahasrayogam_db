import { useState, useMemo, useEffect, useCallback } from 'react'
import Fuse from 'fuse.js'
import { Search, AlertCircle, PenLine, Sparkles, Loader2, X } from 'lucide-react'
import RecipeCard from './components/RecipeCard'
import AdminPanel from './components/AdminPanel'
import SearchDropdown from './components/SearchDropdown'
import { fetchFormulations, semanticSearch } from './lib/api'
import { buildSuggestionCorpus } from './lib/suggestionCorpus'
import { useSearchSuggestions } from './hooks/useSearchSuggestions'

const CATEGORY_CONFIG = {
  Kashaya:            { emoji: '🌿', desc: 'Decoctions',              color: '#1A3C34', light: '#ECF3F0' },
  KashayaParisishta:  { label: 'Kashaya Parisishta', emoji: '🍃', desc: 'Supplementary Decoctions', color: '#2C5F4A', light: '#E8F5EF' },
  Ghrita:             { emoji: '🧈', desc: 'Medicated Ghee',          color: '#7A5200', light: '#FBF3E3' },
  Taila:              { emoji: '💧', desc: 'Medicated Oils',           color: '#3D5A1F', light: '#EDF2E5' },
  TailaParisishta:    { label: 'Taila Parisishta', emoji: '🫒', desc: 'Supplementary Oils', color: '#5C7A35', light: '#EFF5E8' },
  Choornam:           { emoji: '🌾', desc: 'Herbal Powders',           color: '#7A3F2E', light: '#F5EDE8' },
  AsavaArishta:       { emoji: '🫙', desc: 'Fermented Preparations',  color: '#5C1835', light: '#F5E8EC' },
  Lehya:              { emoji: '🍯', desc: 'Electuaries & Confections', color: '#7B3F00', light: '#FDF3E0' },
  Gutika:             { label: 'Vati',   emoji: '💊', desc: 'Tablets & Pills',       color: '#4A2080', light: '#F0EAF8' },
  Vati:               { label: 'Gutika', emoji: '🔮', desc: 'Gutika Preparations',   color: '#3B6B56', light: '#EAF8F1' },
}

// Categories in the AsavaArishta combined tab
const ASAVA_ARISHTA_CATS = new Set(['Arishta', 'Asava'])

const SkeletonCard = ({ index }) => (
  <div
    className="bg-[#FFFDF8] rounded-2xl border border-amber-100/80 overflow-hidden"
    style={{ animation: `skeletonPulse 1.8s ease-in-out ${index * 0.15}s infinite` }}
  >
    <div className="border-l-4 border-amber-200/60 m-6 rounded-xl bg-amber-50/50 h-14" />
    <div className="px-6 pb-6 space-y-3">
      <div className="flex justify-between gap-4">
        <div className="h-5 rounded bg-amber-100/60 w-2/3" />
        <div className="h-5 rounded-full bg-amber-100/60 w-10" />
      </div>
      <div className="h-3 rounded bg-amber-100/40 w-1/4" />
      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-amber-100/60">
        <div className="space-y-2">
          {[80, 100, 65, 90].map((w, j) => (
            <div key={j} className="h-2.5 rounded bg-amber-100/50" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="space-y-2">
          {[100, 75, 85].map((w, j) => (
            <div key={j} className="h-2.5 rounded bg-amber-100/50" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    </div>
  </div>
)

function App() {
  const [query, setQuery] = useState('')
  const [searchField, setSearchField] = useState('all')
  const [category, setCategory] = useState('Kashaya')
  const [allData, setAllData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── AI semantic search ───────────────────────────────────────────────────
  const [aiMode, setAiMode]       = useState(false)
  const [aiResults, setAiResults] = useState(null)   // null = no search yet
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]     = useState(null)

  const handleAiSearch = useCallback(async (q) => {
    const trimmed = (q || query).trim()
    if (!trimmed) return
    setAiLoading(true)
    setAiError(null)
    setAiResults(null)
    try {
      const results = await semanticSearch(trimmed, 30)
      setAiResults(results)
    } catch (err) {
      setAiError('AI search failed. Please try again.')
    }
    setAiLoading(false)
  }, [query])

  const toggleAiMode = useCallback(() => {
    setAiMode(prev => {
      if (prev) {
        setAiResults(null)
        setAiError(null)
        setQuery('')
      }
      return !prev
    })
  }, [])

  // ── Admin mode ──────────────────────────────────────────────────────────
  const [adminMode,    setAdminMode]    = useState(false)
  const [adminOpen,    setAdminOpen]    = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)  // null = new entry
  const openNewEntry = useCallback(() => {
    setEditingEntry(null)
    setAdminOpen(true)
  }, [])

  const openEditEntry = useCallback((recipe) => {
    setEditingEntry(recipe)
    setAdminOpen(true)
  }, [])

  const closeAdmin = useCallback(() => {
    setAdminOpen(false)
    setEditingEntry(null)
  }, [])

  const handleAdminToggle = useCallback(() => {
    if (adminMode) {
      setAdminMode(false)
      if (adminOpen) closeAdmin()
    } else {
      setAdminMode(true)
    }
  }, [adminMode, adminOpen, closeAdmin])

  const handleSaved = useCallback((newRow) => {
    setAllData(prev => [...prev, newRow])
    // Switch to that category tab so the user sees the result
    if (newRow.category) {
      if (newRow.category === 'Arishta' || newRow.category === 'Asava') setCategory('AsavaArishta')
      else setCategory(newRow.category)
    }
    closeAdmin()
  }, [closeAdmin])

  const handleUpdated = useCallback((updated) => {
    setAllData(prev => prev.map(r => r.id === updated.id ? updated : r))
    closeAdmin()
  }, [closeAdmin])

  const handleDeleted = useCallback((id) => {
    setAllData(prev => prev.filter(r => r.id !== id))
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchFormulations()
        setAllData(data || [])
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Database Error: Failed to connect. Please try again later.')
      }
      setIsLoading(false)
    }
    fetchData()
  }, [])

  const categories = Object.entries(CATEGORY_CONFIG).map(([id, cfg]) => ({ id, label: cfg.label || id, ...cfg }))

  const categoryCounts = useMemo(() => {
    const counts = {}
    categories.forEach(c => {
      if (c.id === 'AsavaArishta') {
        counts[c.id] = allData.filter(item => ASAVA_ARISHTA_CATS.has(item.category)).length
      } else {
        counts[c.id] = allData.filter(item => item.category === c.id).length
      }
    })
    return counts
  }, [allData])

  const currentData = useMemo(() => {
    if (category === 'AsavaArishta') {
      return allData.filter(item => ASAVA_ARISHTA_CATS.has(item.category))
    }
    return allData.filter(item => item.category === category)
  }, [allData, category])

  const searchFields = [
    { id: 'all',          label: 'All Fields',  keys: ['name', 'ingredients', 'indications', 'sanskrit_verse', 'procedure'] },
    { id: 'name',         label: 'Name',        keys: ['name'] },
    { id: 'ingredients',  label: 'Ingredients', keys: ['ingredients'] },
    { id: 'indications',  label: 'Indications', keys: ['indications'] },
    { id: 'sanskrit_verse', label: 'Sanskrit',  keys: ['sanskrit_verse'] },
    { id: 'procedure',    label: 'Procedure',   keys: ['procedure'] },
  ]

  const currentConfig = searchFields.find(f => f.id === searchField) || searchFields[0]

  // When a query is active, search across ALL data regardless of the active tab.
  // Tabs are for browsing only — search always goes global.
  const filteredRecipes = useMemo(() => {
    if (!query) return currentData
    const terms = query.trim().split(/\s+/).filter(t => t.length > 0)
    if (terms.length === 0) return currentData
    let currentResults = allData
    for (const term of terms) {
      const fuse = new Fuse(currentResults, {
        keys: currentConfig.keys,
        threshold: 0.3,
        distance: 100,
        ignoreLocation: true,
      })
      currentResults = fuse.search(term).map(result => result.item)
      if (currentResults.length === 0) break
    }
    return currentResults
  }, [query, allData, currentData, currentConfig.keys])

  const isGlobalSearch = query.trim().length > 0

  const activeCat = CATEGORY_CONFIG[category]

  // ── Suggestion corpus (built once after data loads) ──────────────────
  const corpus = useMemo(
    () => allData.length > 0 ? buildSuggestionCorpus(allData) : null,
    [allData]
  )

  // Two independent hook instances — one for the desktop input, one for mobile
  const desktopSug = useSearchSuggestions({
    query, corpus, searchField, enabled: !isLoading, onQueryChange: setQuery,
  })
  const mobileSug = useSearchSuggestions({
    query, corpus, searchField, enabled: !isLoading, onQueryChange: setQuery,
  })

  const handleCategoryChange = (catId) => {
    setCategory(catId)
    setQuery('')
  }

  return (
    <div className="min-h-screen bg-cream selection:bg-accent/30">

      {/* ── HEADER ── */}
      <header
        className="bg-white sticky top-0 z-50"
        style={{ borderBottom: '1px solid rgba(197,160,89,0.2)', boxShadow: '0 2px 16px rgba(26,60,52,0.06)' }}
      >
        {/* Top accent line */}
        <div className="h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent opacity-60" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* ── Row 1: Brand · Search · Admin ── */}
          <div className="flex items-center gap-4 py-3">

            {/* Brand */}
            <div className="flex items-center gap-3 shrink-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-base font-serif transition-colors duration-300"
                style={{ backgroundColor: activeCat?.color }}
              >
                ❋
              </div>
              <div>
                <h1 className="text-lg font-serif font-bold text-primary leading-none tracking-tight">
                  Sahasrayogam
                </h1>
                <p className="text-[9px] tracking-[0.18em] mt-0.5 font-sans"
                   style={{ color: activeCat?.color, opacity: 0.7 }}>
                  सहस्रयोगम् · CLASSICAL FORMULARY
                </p>
              </div>
            </div>

            {/* Search — takes all remaining space on md+ */}
            <div className="hidden md:flex items-center gap-2 flex-1 min-w-0">

              {/* AI mode toggle */}
              <button
                onClick={toggleAiMode}
                title={aiMode ? 'Switch to keyword search' : 'AI semantic search — describe symptoms in plain language'}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold font-sans transition-all border ${
                  aiMode
                    ? 'text-white border-transparent shadow-md'
                    : 'text-gray-500 bg-white border-amber-200/60 hover:border-amber-300'
                }`}
                style={aiMode ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' } : {}}
              >
                <Sparkles size={13} />
                <span>AI</span>
              </button>

              <div className="relative flex-1 min-w-0">
                {aiMode
                  ? <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2" size={15} style={{ color: '#8b5cf6' }} />
                  : <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                }
                <input
                  ref={desktopSug.inputRef}
                  type="text"
                  placeholder={aiMode ? 'Describe symptoms or condition… (press Enter)' : 'Search all formulations…'}
                  className={`w-full pl-9 pr-10 py-2 border rounded-full text-sm focus:outline-none focus:bg-white focus:ring-2 transition-all font-garamond ${
                    aiMode
                      ? 'bg-violet-50/60 border-violet-200/80'
                      : 'bg-amber-50/60 border-amber-200/60'
                  }`}
                  style={{ '--tw-ring-color': aiMode ? '#8b5cf640' : `${activeCat?.color}40` }}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); if (aiMode) { setAiResults(null); setAiError(null) } }}
                  onKeyDown={(e) => {
                    if (aiMode) {
                      if (e.key === 'Enter') handleAiSearch()
                      if (e.key === 'Escape') { setQuery(''); setAiResults(null) }
                    } else {
                      desktopSug.onKeyDown(e)
                    }
                  }}
                  onFocus={aiMode ? undefined : desktopSug.onInputFocus}
                  onBlur={aiMode ? undefined : () => setTimeout(desktopSug.close, 150)}
                  autoComplete="off"
                />
                {/* Clear button when AI mode has a query */}
                {aiMode && query && (
                  <button
                    onClick={() => { setQuery(''); setAiResults(null); setAiError(null) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
                {!aiMode && (
                  <SearchDropdown
                    suggestions={desktopSug.suggestions}
                    isOpen={desktopSug.isOpen}
                    activeIndex={desktopSug.activeIndex}
                    flatSuggestions={desktopSug.flatSuggestions}
                    onSuggestionClick={desktopSug.onSuggestionClick}
                    dropdownRef={desktopSug.dropdownRef}
                    accentColor={activeCat?.color}
                  />
                )}
              </div>

              {/* Field selector — hidden in AI mode */}
              {!aiMode && (
                <select
                  value={searchField}
                  onChange={(e) => setSearchField(e.target.value)}
                  className="shrink-0 bg-white border border-amber-200/60 rounded-full px-3 py-2 text-xs text-gray-600 focus:outline-none cursor-pointer font-sans"
                >
                  {searchFields.map(field => (
                    <option key={field.id} value={field.id}>{field.label}</option>
                  ))}
                </select>
              )}

              {/* Search button in AI mode */}
              {aiMode && (
                <button
                  onClick={() => handleAiSearch()}
                  disabled={aiLoading || !query.trim()}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold font-sans text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {aiLoading
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Sparkles size={13} />
                  }
                  Search
                </button>
              )}
            </div>

            {/* Spacer on mobile so admin button stays right */}
            <div className="flex-1 md:hidden" />

            {/* Admin mode toggle */}
            <button
              onClick={handleAdminToggle}
              title={adminMode ? 'Exit admin mode' : 'Admin mode'}
              className="shrink-0 p-2 rounded-lg transition-all"
              style={adminMode
                ? { backgroundColor: activeCat?.color, color: '#FFF' }
                : { color: '#9CA3AF' }
              }
            >
              <PenLine size={16} />
            </button>
          </div>

          {/* ── Row 2: Category tabs (desktop lg+) ── */}
          <div className="hidden lg:block pb-2">
            <nav className="flex items-center gap-1 bg-amber-50/60 p-1 rounded-2xl border border-amber-100/80 overflow-x-auto no-scrollbar">
              {categories.map((cat) => {
                const isActive = category === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                      isActive ? 'text-white shadow-md' : 'text-gray-500 hover:text-charcoal hover:bg-white/70'
                    }`}
                    style={isActive ? { backgroundColor: cat.color } : {}}
                  >
                    <span className="text-sm">{cat.emoji}</span>
                    <span className="font-sans">{cat.label}</span>
                    {!isLoading && categoryCounts[cat.id] > 0 && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full font-mono leading-none ${
                          isActive ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {categoryCounts[cat.id]}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

        </div>
      </header>

      {/* ── MOBILE: search + categories ── */}
      <div
        className="md:hidden sticky z-40 bg-white/95 backdrop-blur-md px-4 py-3 space-y-2.5"
        style={{ top: '57px', borderBottom: '1px solid rgba(197,160,89,0.2)' }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            ref={mobileSug.inputRef}
            type="text"
            placeholder="Search all formulations…"
            className="w-full pl-9 pr-4 py-2.5 bg-amber-50/70 border border-amber-200/60 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/40 focus:bg-white transition-all font-garamond"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={mobileSug.onKeyDown}
            onFocus={mobileSug.onInputFocus}
            onBlur={() => setTimeout(mobileSug.close, 150)}
            autoComplete="off"
          />
          <SearchDropdown
            suggestions={mobileSug.suggestions}
            isOpen={mobileSug.isOpen}
            activeIndex={mobileSug.activeIndex}
            flatSuggestions={mobileSug.flatSuggestions}
            onSuggestionClick={mobileSug.onSuggestionClick}
            dropdownRef={mobileSug.dropdownRef}
            accentColor={activeCat?.color}
          />
        </div>
        <div className="relative">
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => {
            const isActive = category === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold font-sans transition-all ${
                  isActive ? 'text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100'
                }`}
                style={isActive ? { backgroundColor: cat.color } : {}}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            )
          })}
          <div className="w-px bg-amber-100/80 mx-1 shrink-0 self-stretch" />
          {searchFields.map(field => (
            <button
              key={field.id}
              onClick={() => setSearchField(field.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold font-sans transition-all ${
                searchField === field.id
                  ? 'text-white shadow-sm'
                  : 'bg-white text-gray-500 border border-gray-100'
              }`}
              style={searchField === field.id ? { backgroundColor: activeCat?.color } : {}}
            >
              {field.label}
            </button>
          ))}
          </div>
          {/* Right fade — indicates more tabs to scroll */}
          <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white/90 to-transparent" />
        </div>
      </div>

      {/* ── MAIN ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Error */}
        {error && (
          <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-2xl text-red-600 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle size={22} className="shrink-0" />
              <h3 className="font-bold text-lg font-serif">Connection Error</h3>
            </div>
            <div className="space-y-3 text-sm font-garamond">
              <p className="font-medium">{error}</p>
              <div className="bg-white/50 p-4 rounded-xl border border-red-100 mt-4">
                <p className="font-bold mb-2 font-sans">How to fix this:</p>
                <ul className="list-disc list-inside space-y-1 text-red-700">
                  <li>Check if you are on a Restricted WiFi (Work/Public/School).</li>
                  <li>Try switching to Mobile Data/Hotspot on this device.</li>
                  <li>Check if a VPN or Ad-blocker is blocking neon.tech.</li>
                  <li>Restart the browser or try a different one (Chrome/Safari).</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── AI search results ── */}
        {aiMode ? (
          <>
            {/* AI header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                     style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  <Sparkles size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-serif font-bold leading-tight text-violet-700">
                    AI Semantic Search
                  </h2>
                  <p className="text-xs text-gray-400 font-sans mt-0.5">
                    {aiResults
                      ? `${aiResults.length} formulations matched by meaning`
                      : 'Describe symptoms or conditions in plain language'}
                  </p>
                </div>
              </div>
              {aiResults && (
                <p className="text-sm font-sans text-gray-400">
                  Ranked by relevance · <span className="text-violet-400">"{query}"</span>
                </p>
              )}
            </div>

            {/* AI loading */}
            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                     style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  <Loader2 size={26} className="text-white animate-spin" />
                </div>
                <p className="text-sm font-garamond text-gray-400">Searching by meaning…</p>
              </div>
            )}

            {/* AI error */}
            {aiError && !aiLoading && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm flex items-center gap-3">
                <AlertCircle size={18} className="shrink-0" />
                {aiError}
              </div>
            )}

            {/* AI idle prompt */}
            {!aiLoading && !aiResults && !aiError && (
              <div className="flex flex-col items-center justify-center py-28 gap-3 text-center">
                <div className="text-5xl mb-2">✨</div>
                <p className="text-lg font-serif text-charcoal/50">Describe what you're looking for</p>
                <p className="text-sm text-gray-400 font-garamond max-w-sm">
                  Try <em>"joint pain and swelling"</em>, <em>"digestive issues after eating"</em>,
                  or <em>"fever with body ache"</em> — in your own words.
                </p>
                <p className="text-xs text-violet-400 mt-2 font-sans">Press Enter or click Search</p>
              </div>
            )}

            {/* AI results grid */}
            {!aiLoading && aiResults && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-24">
                {aiResults.length > 0 ? (
                  aiResults.map((recipe, i) => (
                    <div key={recipe.id} className="card-appear" style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}>
                      <RecipeCard
                        recipe={recipe}
                        adminMode={adminMode}
                        onEdit={openEditEntry}
                        showCategory={true}
                        searchTerms={[]}
                      />
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-24 text-center">
                    <div className="text-5xl mb-5">🔍</div>
                    <p className="text-xl font-serif text-charcoal/50">No matches found</p>
                    <p className="text-sm text-gray-400 mt-2 font-garamond">Try rephrasing your query</p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── Regular section header ── */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {!isLoading && (
                  isGlobalSearch ? (
                    <>
                      <span className="text-3xl">🔍</span>
                      <div>
                        <h2 className="text-lg font-serif font-bold leading-tight text-charcoal">
                          All Formulations
                        </h2>
                        <p className="text-xs text-gray-400 font-sans mt-0.5">Searching across all categories</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl">{activeCat?.emoji}</span>
                      <div>
                        <h2 className="text-lg font-serif font-bold leading-tight" style={{ color: activeCat?.color }}>
                          {category === 'AsavaArishta' ? 'Asava-Arishta Prakarana' : `${activeCat?.label || category} Prakarana`}
                        </h2>
                        <p className="text-xs text-gray-400 font-sans mt-0.5">{activeCat?.desc}</p>
                      </div>
                    </>
                  )
                )}
              </div>
              <p className="text-sm font-sans font-medium text-gray-400">
                {isLoading ? (
                  <span className="text-amber-600">Loading formulary…</span>
                ) : (
                  <>
                    <span className="font-bold" style={{ color: isGlobalSearch ? '#6B7280' : activeCat?.color }}>
                      {filteredRecipes.length}
                    </span>{' '}
                    formulation{filteredRecipes.length !== 1 ? 's' : ''}
                    {query && <span className="text-gray-300"> · "{query}"</span>}
                  </>
                )}
              </p>
            </div>

            {/* Regular grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-24">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} index={i} />)
              ) : filteredRecipes.length > 0 ? (
                filteredRecipes.map((recipe, i) => (
                  <div key={recipe.id} className="card-appear" style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}>
                    <RecipeCard
                      recipe={recipe}
                      adminMode={adminMode}
                      onEdit={openEditEntry}
                      showCategory={isGlobalSearch}
                      searchTerms={isGlobalSearch ? query.trim().split(/\s+/).filter(t => t.length > 0) : []}
                    />
                  </div>
                ))
              ) : (
                <div className="col-span-full py-24 text-center">
                  <div className="text-5xl mb-5">🔍</div>
                  <p className="text-xl font-serif text-charcoal/50">No formulations found</p>
                  <p className="text-sm text-gray-400 mt-2 font-garamond">
                    Try{' '}
                    <button
                      className="text-primary/70 hover:text-primary underline underline-offset-2 transition-colors"
                      onClick={() => setQuery('Guduchi')}
                    >
                      Guduchi
                    </button>
                    {', '}
                    <button
                      className="text-primary/70 hover:text-primary underline underline-offset-2 transition-colors"
                      onClick={() => setQuery('Jwara')}
                    >
                      Jwara
                    </button>
                    {', or an ingredient name'}
                  </p>
                  <button
                    className="mt-5 text-xs font-sans font-bold px-4 py-2 rounded-full border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
                    onClick={() => setQuery('')}
                  >
                    Clear search
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── Floating "Add" button (admin mode only) ── */}
      {adminMode && (
        <button
          onClick={openNewEntry}
          title="Add new formula"
          className="fixed bottom-8 right-8 z-40 w-14 h-14 rounded-full text-white text-2xl shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
          style={{ backgroundColor: activeCat?.color }}
        >
          +
        </button>
      )}

      {/* ── Admin panel ── */}
      {adminOpen && (
        <AdminPanel
          key={editingEntry?.id ?? 'new'}
          recipe={editingEntry}
          onClose={closeAdmin}
          onSaved={handleSaved}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}


    </div>
  )
}

export default App
