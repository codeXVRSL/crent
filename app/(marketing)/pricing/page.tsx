import { LinkButton } from '@/components/ui';
export const metadata = { title: 'Pricing', description: 'Pay per idea, from $3. A 5% marketplace fee on what you use, refunded on unused budget. Researchers keep 90% of every unlock.' };

const rows = [
  ['You post', '5 ideas × $8.00 = $40.00 budget'],
  ['You pay today', '$40.00 + $2.00 marketplace fee (5%) = $42.00'],
  ['You unlock 3 ideas', 'Each researcher receives $7.20 ($8.00 − 10% fee)'],
  ['The brief closes', 'You get back $16.00 unused budget + $0.80 of the fee = $16.80'],
  ['Total spent', '$25.20 for 3 researched ideas'],
];

export default function Pricing() {
  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-4 py-14">
      <div className="grid gap-2">
        <span className="label">Pricing</span>
        <h1 className="text-[40px] font-semibold tracking-tight">No subscriptions. You pay per idea.</h1>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[480px] text-sm">
          <thead><tr className="border-b border-line text-left"><th className="label p-3">Fee</th><th className="label p-3">Rate</th><th className="label p-3">Paid by</th></tr></thead>
          <tbody>
            <tr className="border-b border-line"><td className="p-3">Marketplace fee</td><td className="num p-3">5%</td><td className="p-3">Creator, added when funding a brief</td></tr>
            <tr><td className="p-3">Service fee</td><td className="num p-3">10%</td><td className="p-3">Researcher, taken from each unlock</td></tr>
          </tbody>
        </table>
      </div>
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Worked example</h2>
        <dl className="grid gap-2 rounded-2xl border border-line bg-surface shadow-sm p-5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 sm:grid-cols-[160px_1fr]"><dt className="font-semibold">{k}</dt><dd className="num">{v}</dd></div>
          ))}
        </dl>
        <p className="text-sm text-muted">Price per idea can be anywhere from $3 to $500. Most briefs pay $5–$15 per idea.</p>
      </div>
      <LinkButton href="/signup?as=creator" className="justify-self-start">Post a brief</LinkButton>
    </div>
  );
}
