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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 pr-4 font-medium text-gray-900">Feature</th>
                <th className="text-center py-3 px-4 font-medium text-gray-900">EOA</th>
                <th className="text-center py-3 pl-4 font-medium text-gray-900">Smart Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {features.map((feature) => (
                <tr key={feature.name}>
                  <td className="py-3 pr-4 text-gray-700">{feature.name}</td>
                  <td className="py-3 px-4 text-center">
                    {feature.eoa === null ? (
                      <span className="text-gray-400">N/A</span>
                    ) : feature.eoa ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-red-500">-</span>
                    )}
                  </td>
                  <td className="py-3 pl-4 text-center">
                    {feature.smart ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-red-500">-</span>
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
