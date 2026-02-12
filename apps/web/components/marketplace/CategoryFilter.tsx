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
        <h3 className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
          Category
        </h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.key}
              onClick={() => onCategoryChange(cat.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150"
              style={{
                backgroundColor:
                  selectedCategory === cat.key ? 'rgb(var(--primary))' : 'rgb(var(--secondary))',
                color: selectedCategory === cat.key ? 'white' : 'rgb(var(--foreground))',
                boxShadow:
                  selectedCategory === cat.key ? '0 0 16px -4px rgba(124, 92, 252, 0.3)' : 'none',
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Module Types */}
      <div>
        <h3 className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
          Module Type
        </h3>
        <div className="flex flex-wrap gap-2">
          {moduleTypes.map((type) => (
            <button
              type="button"
              key={type.key}
              onClick={() => onTypeChange(type.key)}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150"
              style={{
                backgroundColor:
                  selectedType === type.key ? 'rgb(var(--foreground))' : 'rgb(var(--secondary))',
                color:
                  selectedType === type.key ? 'rgb(var(--background))' : 'rgb(var(--foreground))',
              }}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
