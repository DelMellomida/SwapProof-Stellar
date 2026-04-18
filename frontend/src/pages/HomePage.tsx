import { Link } from 'react-router-dom'
import { ShieldCheck, Link2, Zap } from 'lucide-react'

const PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Trustless Escrow',
    body: 'Funds are locked in a smart contract — neither party can cheat. No arbiter, no platform custody.',
  },
  {
    icon: Link2,
    title: 'One Shareable Link',
    body: 'Send a deal link in any chat. Your buyer opens it, pays, and tracking is automatic.',
  },
  {
    icon: Zap,
    title: 'Settled in Seconds',
    body: 'Built on Stellar — transactions confirm in under 5 seconds with near-zero fees.',
  },
]

export function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      {/* Hero */}
      <section className="pt-20 pb-16 text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-display text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Built on Stellar · Soroban Smart Contracts
        </div>

        <h1 className="font-display text-4xl sm:text-6xl tracking-tight text-foreground leading-tight">
          P2P Escrow for{' '}
          <span className="text-gradient-teal">Informal Markets</span>
        </h1>

        <p className="mx-auto max-w-xl text-base text-muted-foreground font-sans leading-relaxed">
          Stop trusting strangers. SwapProof locks funds in a smart contract until you confirm delivery — or your timeout kicks in automatically.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/create"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-display text-sm text-primary-foreground hover:bg-primary/90 glow-teal transition-all"
          >
            <ShieldCheck className="h-4 w-4" />
            Create a Deal
          </Link>
          <a
            href="https://github.com/DelMellomida/SwapProof-Stellar"
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 font-display text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
          >
            View Source
          </a>
        </div>
      </section>

      {/* Pillars */}
      <section className="pb-20 grid gap-4 sm:grid-cols-3">
        {PILLARS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="card-glass p-6 space-y-3 animate-fade-in">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-display text-base text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground font-sans leading-relaxed">{body}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="pb-24 space-y-8">
        <h2 className="font-display text-2xl text-center text-foreground">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-4">
          {[
            { n: '01', role: 'Seller', text: 'Create a deal with item, price, and timeout.' },
            { n: '02', role: 'Seller', text: 'Share the deal link in any chat app.' },
            { n: '03', role: 'Buyer', text: 'Open the link and lock funds into escrow.' },
            { n: '04', role: 'Both', text: 'Confirm delivery or timeout auto-releases.' },
          ].map(({ n, role, text }) => (
            <li key={n} className="card-glass p-5 space-y-2">
              <span className="font-display text-3xl text-primary/30">{n}</span>
              <p className="text-xs font-display text-primary tracking-widest uppercase">{role}</p>
              <p className="text-sm text-muted-foreground font-sans">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
