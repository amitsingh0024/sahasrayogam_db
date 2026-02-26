import { useState, useMemo, useEffect } from 'react'
import Fuse from 'fuse.js'
import { Search, Leaf } from 'lucide-react'
import RecipeCard from './components/RecipeCard'
import { supabase } from './lib/supabaseClient'
import kashayaData_local from './data/Kashaya.json'
import ghritaData_local from './data/Ghrita.json'

function App() {
  const [query, setQuery] = useState('')
  const [searchField, setSearchField] = useState('all')
  const [category, setCategory] = useState('Kashaya')
  const [allData, setAllData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('formulations')
        .select('*')

      if (error) {
        console.error('Error fetching data:', error)
        // Fallback to local data if Supabase fails
        setAllData([...kashayaData_local, ...ghritaData_local])
      } else {
        setAllData(data)
      }
      setIsLoading(false)
    }

    fetchData()
  }, [])

  const categories = [
    { id: 'Kashaya', label: 'Kashaya', icon: 'Decoction' },
    { id: 'Ghrita', label: 'Ghrita', icon: 'Ghee' },
  ];

  const currentData = useMemo(() => {
    return allData.filter(item => item.category === category);
  }, [allData, category]);

  const searchFields = [
    { id: 'all', label: 'All Fields', keys: ['name', 'ingredients', 'indications', 'sanskrit_verse', 'procedure'] },
    { id: 'name', label: 'Name', keys: ['name'] },
    { id: 'ingredients', label: 'Ingredients', keys: ['ingredients'] },
    { id: 'indications', label: 'Indications', keys: ['indications'] },
    { id: 'sanskrit_verse', label: 'Sanskrit', keys: ['sanskrit_verse'] },
    { id: 'procedure', label: 'Procedure', keys: ['procedure'] },
  ];

  const currentConfig = searchFields.find(f => f.id === searchField) || searchFields[0];

  // Search Logic (Recursive AND)
  const filteredRecipes = useMemo(() => {
    if (!query) return currentData;

    const terms = query.split(/[,\s]+/).filter(t => t.trim().length > 0);
    if (terms.length === 0) return currentData;

    let currentResults = currentData;

    // For each term, filter the *current* results further
    for (const term of terms) {
      const fuse = new Fuse(currentResults, {
        keys: currentConfig.keys,
        threshold: 0.3,
        distance: 100,
        ignoreLocation: true, // Search anywhere in the string
      });

      currentResults = fuse.search(term).map(result => result.item);

      if (currentResults.length === 0) break;
    }

    return currentResults;
  }, [query, currentConfig.keys]);

  return (
    <div className="min-h-screen bg-cream selection:bg-accent/30">

      {/* Header / Hero */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="p-2 bg-primary rounded-lg text-white">
              <Leaf size={20} />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold text-primary tracking-tight">
                Sahasrayogam
              </h1>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                {category} Prakarana
              </p>
            </div>
          </div>

          {/* Category Switcher (Desktop) */}
          <div className="hidden lg:flex items-center bg-gray-100 p-1 rounded-full">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-6 py-1.5 rounded-full text-sm font-bold transition-all ${category === cat.id
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Enhanced Search Input (Desktop) */}
          <div className="hidden md:flex items-center gap-2 grow max-w-2xl">
            <div className="relative grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder={`Search in ${currentConfig.label}...`}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent transition-all"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              value={searchField}
              onChange={(e) => setSearchField(e.target.value)}
              className="bg-white border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer shadow-sm"
            >
              {searchFields.map(field => (
                <option key={field.id} value={field.id}>{field.label}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Mobile Search Bar (Sticky below header) */}
      <div className="md:hidden sticky top-[73px] z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search recipes..."
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${category === cat.id
                ? 'bg-accent text-white shadow-sm'
                : 'bg-white text-gray-500 border border-gray-100'
                }`}
            >
              {cat.label}
            </button>
          ))}
          <div className="w-[1px] bg-gray-200 mx-1 shrink-0" />
          {searchFields.map(field => (
            <button
              key={field.id}
              onClick={() => setSearchField(field.id)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${searchField === field.id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white text-gray-500 border border-gray-100 hover:border-accent'
                }`}
            >
              {field.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Results Info */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-gray-500 font-medium">
            {isLoading ? (
              <span>Loading formulations...</span>
            ) : (
              <>Showing <span className="text-primary font-bold">{filteredRecipes.length}</span> formulations</>
            )}
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6 pb-20">
          {filteredRecipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}

          {filteredRecipes.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-400">
              <p className="text-lg">No recipes found matching "{query}"</p>
              <p className="text-sm mt-2">Try searching for ingredients like "Guduchi" or indications like "Fever"</p>
            </div>
          )}
        </div>
      </main>

    </div>
  )
}

export default App
