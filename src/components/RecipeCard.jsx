import React from 'react';

const CATEGORY_COLORS = {
  Kashaya:  { primary: '#1A3C34', light: '#ECF3F0', badge: '#D0E7DF', border: '#1A3C3430' },
  Ghrita:   { primary: '#7A5200', light: '#FBF3E3', badge: '#F5E4BB', border: '#7A520030' },
  Taila:    { primary: '#3D5A1F', light: '#EDF2E5', badge: '#D8E8C8', border: '#3D5A1F30' },
  Choornam: { primary: '#7A3F2E', light: '#F5EDE8', badge: '#EDD5C5', border: '#7A3F2E30' },
  // AsavaArishta sub-categories
  Arishta:  { primary: '#5C1835', light: '#F5E8EC', badge: '#EDD0DB', border: '#5C183530' },
  Asava:    { primary: '#2B3F6B', light: '#E8EDF6', badge: '#C8D5ED', border: '#2B3F6B30' },
};

// Badge labels & accent colors for sub-categories within the AsavaArishta tab
const SUBCATEGORY_BADGE = {
  Arishta: { label: 'Arishta', bg: '#EDD0DB', text: '#5C1835' },
  Asava:   { label: 'Asava',   bg: '#C8D5ED', text: '#2B3F6B' },
};

// Colors for ingredient sub-section labels (Kalka/Sneha/Drava)
const INGREDIENT_LABEL_STYLES = {
  'Kalka Dravya':  { bg: '#DCF0E4', text: '#1E6640', dot: '#3A9E5E' },
  'Sneha Dravya':  { bg: '#FFF0D0', text: '#8B5200', dot: '#C5A059' },
  'Drava Dravya':  { bg: '#DDEEF8', text: '#1B5E8A', dot: '#3B9ADE' },
  '1st formula':   { bg: '#EDE8FF', text: '#5B35A8', dot: '#8B6CC5' },
  '2nd formula':   { bg: '#FFE8F4', text: '#A8357A', dot: '#D4629C' },
  '3rd formula':   { bg: '#E8F4FF', text: '#1B5F99', dot: '#4A90CC' },
};

const IngredientLine = ({ line, index }) => {
  if (!line.trim()) return null;
  const colonIdx = line.indexOf(':');
  if (colonIdx > 0) {
    const label = line.substring(0, colonIdx).trim();
    const content = line.substring(colonIdx + 1).trim();
    const labelStyle = INGREDIENT_LABEL_STYLES[label];
    if (labelStyle) {
      return (
        <div className="mb-3">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-bold font-sans px-2 py-0.5 rounded-full mr-2 mb-1"
            style={{ backgroundColor: labelStyle.bg, color: labelStyle.text }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: labelStyle.dot }} />
            {label}
          </span>
          <span className="text-sm" style={{ fontFamily: "'EB Garamond', serif", lineHeight: '1.7' }}>
            {content}
          </span>
        </div>
      );
    }
    // Generic bold label (e.g. "Formula 1:")
    return (
      <div key={index} className="mb-2 text-sm" style={{ fontFamily: "'EB Garamond', serif", lineHeight: '1.7' }}>
        <span className="font-bold font-sans text-xs uppercase tracking-wide text-gray-500 mr-1.5">{label}:</span>
        {content}
      </div>
    );
  }
  return (
    <div className="mb-1 text-sm" style={{ fontFamily: "'EB Garamond', serif", lineHeight: '1.7' }}>
      {line}
    </div>
  );
};

const RecipeCard = ({ recipe }) => {
  if (!recipe) return null;

  const cat = CATEGORY_COLORS[recipe.category] || CATEGORY_COLORS.Kashaya;
  const subBadge = SUBCATEGORY_BADGE[recipe.category] || null;

  const indications = recipe.indications
    ? recipe.indications.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  return (
    <div
      className="relative bg-[#FFFDF8] rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
      style={{
        border: `1px solid ${cat.border}`,
        borderLeft: `4px solid ${cat.primary}`,
        boxShadow: '0 1px 8px rgba(26,60,52,0.05)',
      }}
    >
      <div className="p-6">

        {/* ── Header ── */}
        <div className="flex justify-between items-start mb-4 gap-3">
          <div className="flex-1 min-w-0">
            {/* Subcategory badge (Arishta / Asava) */}
            {subBadge && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold font-sans uppercase tracking-[0.12em] px-2 py-0.5 rounded-full mb-2"
                style={{ backgroundColor: subBadge.bg, color: subBadge.text }}
              >
                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: subBadge.text }} />
                {subBadge.label}
              </span>
            )}
            <h3
              className="text-xl font-serif font-bold leading-tight"
              style={{ color: cat.primary }}
            >
              {recipe.name}
            </h3>
          </div>
          <span
            className="shrink-0 text-xs font-bold font-mono px-2.5 py-1 rounded-full"
            style={{ backgroundColor: cat.badge, color: cat.primary }}
          >
            #{recipe.entry_number}
          </span>
        </div>

        {/* ── Sanskrit Verse ── */}
        {recipe.sanskrit_verse && (
          <div
            className="mb-6 rounded-xl p-4 relative overflow-hidden"
            style={{
              backgroundColor: cat.light,
              border: `1px solid ${cat.border}`,
            }}
          >
            {/* Decorative mark */}
            <span
              className="absolute top-2 right-3 text-2xl opacity-20 select-none"
              style={{ color: cat.primary, fontFamily: "'Noto Sans Devanagari', sans-serif" }}
              aria-hidden="true"
            >
              ॐ
            </span>
            <p
              className="text-sm leading-loose whitespace-pre-line relative z-10"
              style={{
                fontFamily: "'Noto Sans Devanagari', 'Playfair Display', serif",
                color: '#3D3020',
                lineHeight: '1.9',
              }}
            >
              {recipe.sanskrit_verse}
            </p>
          </div>
        )}

        {/* ── Content Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4"
          style={{ borderTop: `1px dashed ${cat.border}` }}
        >

          {/* Left: Ingredients */}
          <div>
            <h4 className="flex items-center gap-2 text-[10px] font-bold font-sans uppercase tracking-[0.15em] text-gray-400 mb-3">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.primary }} />
              Ingredients
            </h4>
            <div>
              {recipe.ingredients
                ? recipe.ingredients.split('\n').map((line, i) => (
                    <IngredientLine key={i} line={line} index={i} />
                  ))
                : <span className="text-sm text-gray-400 italic font-garamond">—</span>
              }
            </div>
          </div>

          {/* Right: Procedure + Indications */}
          <div className="space-y-6">

            {/* Procedure */}
            <div>
              <h4 className="flex items-center gap-2 text-[10px] font-bold font-sans uppercase tracking-[0.15em] text-gray-400 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Procedure
              </h4>
              <div>
                {recipe.procedure
                  ? recipe.procedure.split('\n').map((line, i) => (
                      <div
                        key={i}
                        className="mb-1 text-sm"
                        style={{ fontFamily: "'EB Garamond', serif", lineHeight: '1.75', color: '#2C3428cc' }}
                      >
                        {line}
                      </div>
                    ))
                  : <span className="text-sm text-gray-400 italic">—</span>
                }
              </div>
            </div>

            {/* Indications */}
            {indications.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-[10px] font-bold font-sans uppercase tracking-[0.15em] text-gray-400 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                  Indications
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {indications.map((ind, i) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-full font-sans"
                      style={{
                        backgroundColor: cat.light,
                        color: cat.primary,
                        border: `1px solid ${cat.border}`,
                        lineHeight: '1.4',
                      }}
                    >
                      {ind}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Notes Footer ── */}
        {recipe.notes && (
          <div
            className="-mx-6 -mb-6 mt-6 px-6 py-4"
            style={{
              backgroundColor: `${cat.light}90`,
              borderTop: `1px solid ${cat.border}`,
            }}
          >
            <p
              className="text-xs leading-relaxed italic"
              style={{ fontFamily: "'EB Garamond', serif", color: '#2C342899' }}
            >
              <span
                className="not-italic font-bold font-sans text-[10px] uppercase tracking-[0.12em] mr-2"
                style={{ color: cat.primary }}
              >
                ✦ Note
              </span>
              {recipe.notes.split('\n').join(' · ')}
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default RecipeCard;
