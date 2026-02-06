'use client'

import { Card, CardContent } from '@/components/common'

const steps = [
  {
    number: 1,
    title: 'Generate Meta-Address',
    description: 'Create a stealth meta-address that can be safely shared publicly',
  },
  {
    number: 2,
    title: 'Sender Creates Address',
    description: 'Sender generates a unique one-time address only you can access',
  },
  {
    number: 3,
    title: 'Scan & Withdraw',
    description: 'Scan announcements to find your funds and withdraw privately',
  },
]

export function HowItWorksCard() {
  return (
    <Card>
      <CardContent className="py-6">
        <h3 className="font-semibold mb-4" style={{ color: 'rgb(var(--foreground))' }}>
          How Stealth Transactions Work
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div key={step.number} className="text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: 'rgb(var(--secondary))' }}
              >
                <span className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                  {step.number}
                </span>
              </div>
              <h4 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                {step.title}
              </h4>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
