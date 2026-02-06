'use client'

import { Card, CardContent } from '@/components/common'

const features = [
  { name: 'Gas Sponsorship', eoa: false, smart: true },
  { name: 'Batched Transactions', eoa: false, smart: true },
  { name: 'Session Keys', eoa: false, smart: true },
  { name: 'Social Recovery', eoa: false, smart: true },
  { name: 'Multi-Signature', eoa: false, smart: true },
  { name: 'Spending Limits', eoa: false, smart: true },
  { name: 'Reversible', eoa: null as boolean | null, smart: true },
]

export function FeatureComparisonCard() {
  return (
    <Card>
      <CardContent className="py-6">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'rgb(var(--foreground))' }}>
          Feature Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgb(var(--border))' }}>
                <th
                  className="text-left py-3 pr-4 font-medium"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  Feature
                </th>
                <th
                  className="text-center py-3 px-4 font-medium"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  EOA
                </th>
                <th
                  className="text-center py-3 pl-4 font-medium"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  Smart Account
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr
                  key={feature.name}
                  style={{
                    borderBottom:
                      index < features.length - 1 ? '1px solid rgb(var(--border) / 0.5)' : 'none',
                  }}
                >
                  <td className="py-3 pr-4" style={{ color: 'rgb(var(--foreground) / 0.8)' }}>
                    {feature.name}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {feature.eoa === null ? (
                      <span style={{ color: 'rgb(var(--muted-foreground))' }}>N/A</span>
                    ) : feature.eoa ? (
                      <span style={{ color: 'rgb(var(--success))' }}>✓</span>
                    ) : (
                      <span style={{ color: 'rgb(var(--destructive))' }}>-</span>
                    )}
                  </td>
                  <td className="py-3 pl-4 text-center">
                    {feature.smart ? (
                      <span style={{ color: 'rgb(var(--success))' }}>✓</span>
                    ) : (
                      <span style={{ color: 'rgb(var(--destructive))' }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
