import React from 'react'

const SECTIONS = [
  { key: 'names',       label: 'Formulations', icon: '❋' },
  { key: 'ingredients', label: 'Ingredients',  icon: '·' },
  { key: 'indications', label: 'Indications',  icon: '·' },
]

export default function SearchDropdown({
  suggestions,
  isOpen,
  activeIndex,
  flatSuggestions,
  onSuggestionClick,
  dropdownRef,
  accentColor,
}) {
  if (!isOpen) return null

  const total = flatSuggestions.length
  if (total === 0) return null

  // Compute globalIndex offset per section
  let offset = 0
  const sections = SECTIONS.map(sec => {
    const items = suggestions[sec.key] || []
    const start = offset
    offset += items.length
    return { ...sec, items, start }
  }).filter(s => s.items.length > 0)

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 right-0 mt-1.5 z-[60] overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-xl"
      style={{ boxShadow: '0 8px 32px rgba(26,60,52,0.13)' }}
    >
      {sections.map(sec => (
        <div key={sec.key}>
          {/* Section header */}
          <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
            <span className="text-[9px] font-bold font-sans uppercase tracking-[0.16em] text-gray-400">
              {sec.label}
            </span>
          </div>

          {/* Suggestion items */}
          {sec.items.map((item, i) => {
            const globalIdx = sec.start + i
            const isActive  = globalIdx === activeIndex
            return (
              <button
                key={item}
                onMouseDown={e => e.preventDefault()}   // keep input focused
                onClick={() => onSuggestionClick(item)}
                title={item}
                className={`
                  w-full text-left px-3 py-2 text-sm font-garamond truncate
                  flex items-center gap-2 transition-colors duration-100
                  ${isActive ? 'text-primary' : 'text-charcoal hover:bg-amber-50/60'}
                `}
                style={isActive ? {
                  backgroundColor: `${accentColor}12`,
                  borderLeft: `2px solid ${accentColor}`,
                  paddingLeft: '10px',
                } : {
                  borderLeft: '2px solid transparent',
                  paddingLeft: '10px',
                }}
              >
                <span
                  className="shrink-0 text-[10px] font-sans"
                  style={{ color: accentColor, opacity: 0.7 }}
                >
                  {sec.icon}
                </span>
                <span className="truncate">{item}</span>
              </button>
            )
          })}
        </div>
      ))}

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-amber-100/80">
        <span className="text-[9px] text-gray-400 font-sans tracking-wide">
          ↑↓ navigate · Enter select · Esc close
        </span>
      </div>
    </div>
  )
}
