import { Card, CardContent, PageHeader } from '@/components/common'

export default function TermsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Terms of Service" description="Terms and conditions for using StableNet" />

      <Card>
        <CardContent className="py-8 prose prose-sm max-w-none">
          <div className="space-y-6" style={{ color: 'rgb(var(--foreground))' }}>
            <section>
              <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
              <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                By accessing or using StableNet, you agree to be bound by these Terms of Service.
                StableNet is provided as-is for interacting with blockchain smart contracts.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Use of Service</h2>
              <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                StableNet provides a web interface for managing ERC-4337 smart accounts. You are
                solely responsible for the security of your private keys and wallet credentials. We
                do not have access to your funds or the ability to recover lost keys.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Smart Contract Risks</h2>
              <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Blockchain transactions are irreversible. Smart contracts may contain bugs or
                vulnerabilities. You acknowledge the inherent risks of interacting with
                decentralized protocols and agree that StableNet is not liable for any losses
                resulting from smart contract interactions.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. No Financial Advice</h2>
              <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                StableNet does not provide financial, investment, or legal advice. DeFi features
                such as token swaps and liquidity provision carry financial risk. Always conduct
                your own research before using any DeFi protocol.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Modifications</h2>
              <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                We reserve the right to modify these terms at any time. Continued use of StableNet
                after changes constitutes acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Open Source</h2>
              <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                StableNet is open source software. The source code is available on{' '}
                <a
                  href="https://github.com/0xmhha/stable-platform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium"
                  style={{ color: 'rgb(var(--primary))' }}
                >
                  GitHub
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
