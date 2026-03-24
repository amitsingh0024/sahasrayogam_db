import { useState, useMemo, useRef, useCallback } from 'react'
import Fuse from 'fuse.js'

const FUSE_OPTS = {
  threshold:        0.35,
  distance:         60,
  ignoreLocation:   true,
  minMatchCharLength: 2,
  includeScore:     true,
}

const NO_SUGGESTIONS = { names: [], ingredients: [], indications: [] }

// Fields where suggestions don't make sense (long prose / Devanagari)
const NO_SUGGEST_FIELDS = new Set(['sanskrit_verse', 'procedure'])

export function useSearchSuggestions({ query, corpus, searchField, enabled, onQueryChange }) {
  const [isOpen, setIsOpen]       = useState(false)
  const [activeIndex, setActiveIdx] = useState(-1)
  const inputRef   = useRef(null)
  const dropdownRef = useRef(null)

  // ── Build memoised Fuse instances (rebuilt only when corpus changes) ──
  const fuseInstances = useMemo(() => {
    if (!corpus) return null
    return {
      names:       new Fuse(corpus.names, FUSE_OPTS),
      ingredients: new Fuse(corpus.ingredients, FUSE_OPTS),
      indications: new Fuse(corpus.indications, FUSE_OPTS),
    }
  }, [corpus])

  // ── Derive the active (last) token ──────────────────────────────────
  const { activeTerm, hasTrailingSpace } = useMemo(() => {
    const trailing = query !== query.trimEnd()
    const tokens   = query.trim().split(/\s+/).filter(Boolean)
    return {
      activeTerm:      tokens.length > 0 ? tokens[tokens.length - 1] : '',
      hasTrailingSpace: trailing,
    }
  }, [query])

  // ── Run suggestion search ────────────────────────────────────────────
  const suggestions = useMemo(() => {
    if (
      !enabled ||
      !fuseInstances ||
      hasTrailingSpace ||
      activeTerm.length < 2 ||
      NO_SUGGEST_FIELDS.has(searchField)
    ) return NO_SUGGESTIONS

    const top3 = (fuse) => fuse.search(activeTerm).slice(0, 3).map(r => r.item)

    if (searchField === 'name') {
      return { names: top3(fuseInstances.names), ingredients: [], indications: [] }
    }
    if (searchField === 'ingredients') {
      return { names: [], ingredients: top3(fuseInstances.ingredients), indications: [] }
    }
    if (searchField === 'indications') {
      return { names: [], ingredients: [], indications: top3(fuseInstances.indications) }
    }
    // 'all'
    return {
      names:       top3(fuseInstances.names),
      ingredients: top3(fuseInstances.ingredients),
      indications: top3(fuseInstances.indications),
    }
  }, [activeTerm, hasTrailingSpace, fuseInstances, searchField, enabled])

  // Compute flat list for keyboard nav
  const flatSuggestions = useMemo(
    () => [...suggestions.names, ...suggestions.ingredients, ...suggestions.indications],
    [suggestions]
  )

  const totalItems = flatSuggestions.length

  const shouldShow = totalItems > 0 && !hasTrailingSpace && activeTerm.length >= 2
  const openState  = isOpen && shouldShow

  // ── Handlers ────────────────────────────────────────────────────────
  const close = useCallback(() => {
    setIsOpen(false)
    setActiveIdx(-1)
  }, [])

  const onInputFocus = useCallback(() => {
    if (shouldShow) setIsOpen(true)
  }, [shouldShow])

  const onSuggestionClick = useCallback((suggestion) => {
    const tokens = query.trim().split(/\s+/).filter(Boolean)
    const prefix = tokens.slice(0, -1)
    onQueryChange([...prefix, suggestion].join(' '))
    close()
    // Return focus to input
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [query, onQueryChange, close])

  const onKeyDown = useCallback((e) => {
    if (!openState) {
      if (e.key === 'Escape') close()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      onSuggestionClick(flatSuggestions[activeIndex])
    } else if (e.key === 'Escape') {
      close()
    }
  }, [openState, activeIndex, totalItems, flatSuggestions, onSuggestionClick, close])

  // Open dropdown as the user types (if conditions are met)
  useMemo(() => {
    if (shouldShow) setIsOpen(true)
    else setIsOpen(false)
    setActiveIdx(-1)
  }, [shouldShow, activeTerm])

  return {
    suggestions,
    isOpen: openState,
    activeIndex,
    flatSuggestions,
    inputRef,
    dropdownRef,
    onKeyDown,
    onInputFocus,
    onSuggestionClick,
    close,
  }
}
