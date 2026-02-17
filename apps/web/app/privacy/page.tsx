import { Card, CardContent, PageHeader } from '@/components/common'

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Privacy Policy" description="How we handle your data" />

      <Card>
        <CardContent className="py-8 prose prose-sm max-w-none">
          <div className="space-y-6" style={{ color: 'rgb(var(--foreground))' }}>
            <section>
              <h2 className="text-lg font-semibold">1. Information We Collect</h2>
              <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                StableNet is a decentralized application. We do not collect personal information
                beyond what is publicly available on the blockchain. Wallet addresses and
                transaction data are inherently public on-chain.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Local Storage</h2>
              <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                We use browser local storage to persist user preferences, account names, and pending
                transaction state. This data remains on your device and is not transmitted to any
                server.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Third-Party Services</h2>
              <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                StableNet may interact with third-party services such as RPC providers, bundlers,
                and block explorers. These services have their own privacy policies. We recommend
                reviewing them independently.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Smart Contract Interactions</h2>
              <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                All smart contract interactions are recorded on the blockchain and are publicly
                visible. StableNet does not have the ability to modify or delete on-chain data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Contact</h2>
              <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                For privacy-related inquiries, please open an issue on our{' '}
                <a
                  href="https://github.com/0xmhha/stable-platform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium"
                  style={{ color: 'rgb(var(--primary))' }}
                >
                  GitHub repository
                </a>
                .
              </p>
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
