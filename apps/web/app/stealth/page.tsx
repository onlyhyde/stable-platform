'use client'

import Link from 'next/link'
import { useWallet } from '@/hooks'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/common'

export default function StealthPage() {
  const { isConnected } = useWallet()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stealth Transactions</h1>
        <p className="text-gray-500">Send and receive with enhanced privacy</p>
      </div>

      {/* Info Banner */}
      <Card className="bg-primary-50 border-primary-200">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-primary-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-primary-900">What are Stealth Addresses?</p>
              <p className="text-sm text-primary-700 mt-1">
                Stealth addresses provide privacy by generating unique one-time addresses for each transaction.
                Only the recipient can detect and access funds sent to their stealth meta-address.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/stealth/send">
          <Card className="hover:shadow-md hover:border-primary-200 transition-all cursor-pointer h-full">
            <CardContent className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <CardTitle>Private Send</CardTitle>
              <CardDescription className="mt-2">Send tokens to a stealth meta-address</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/stealth/receive">
          <Card className="hover:shadow-md hover:border-primary-200 transition-all cursor-pointer h-full">
            <CardContent className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <CardTitle>Private Receive</CardTitle>
              <CardDescription className="mt-2">Generate your stealth address and scan for incoming</CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* How It Works */}
      <Card>
        <CardContent className="py-6">
          <h3 className="font-semibold text-gray-900 mb-4">How Stealth Transactions Work</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <span className="font-semibold text-gray-900">1</span>
              </div>
              <h4 className="font-medium text-gray-900">Generate Meta-Address</h4>
              <p className="text-sm text-gray-500 mt-1">
                Create a stealth meta-address that can be safely shared publicly
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <span className="font-semibold text-gray-900">2</span>
              </div>
              <h4 className="font-medium text-gray-900">Sender Creates Address</h4>
              <p className="text-sm text-gray-500 mt-1">
                Sender generates a unique one-time address only you can access
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <span className="font-semibold text-gray-900">3</span>
              </div>
              <h4 className="font-medium text-gray-900">Scan & Withdraw</h4>
              <p className="text-sm text-gray-500 mt-1">
                Scan announcements to find your funds and withdraw privately
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Stats */}
      {isConnected && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-gray-500">Stealth Addresses Used</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-gray-500">Pending Announcements</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-gray-500">Total Received</p>
              <p className="text-2xl font-bold text-gray-900">0 ETH</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
