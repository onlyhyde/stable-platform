'use client'

const categories = [
  { key: 'all', label: 'All', icon: '📦' },
  { key: 'security', label: 'Security', icon: '🛡' },
  { key: 'defi', label: 'DeFi', icon: '💱' },
  { key: 'governance', label: 'Governance', icon: '🏛' },
  { key: 'automation', label: 'Automation', icon: '⚙' },
  { key: 'privacy', label: 'Privacy', icon: '🔒' },
  { key: 'social-recovery', label: 'Recovery', icon: '🔑' },
  { key: 'utility', label: 'Utility', icon: '🔧' },
] as const

const moduleTypes = [
  { key: 'all', label: 'All Types' },
  { key: 'validator', label: 'Validator' },
  { key: 'executor', label: 'Executor' },
  { key: 'hook', label: 'Hook' },
  { key: 'fallback', label: 'Fallback' },
] as const

interface CategoryFilterProps {
  selectedCategory: string
  selectedType: string
  onCategoryChange: (category: string) => void
  onTypeChange: (type: string) => void
}

export function CategoryFilter({
  selectedCategory,
  selectedType,
  onCategoryChange,
  onTypeChange,
}: CategoryFilterProps) {
  return (
    <div className="space-y-4">
      {/* Categories */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-2">Category</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => onCategoryChange(cat.key)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                transition-all duration-200
                ${
                  selectedCategory === cat.key
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Module Types */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-2">Module Type</h3>
        <div className="flex flex-wrap gap-2">
          {moduleTypes.map(type => (
            <button
              key={type.key}
              onClick={() => onTypeChange(type.key)}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200
                ${
                  selectedType === type.key
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
