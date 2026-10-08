import { LinkButton } from '@/components/ui';
import { briefCharge, feeCents, formatMoney, unlockSplit } from '@/lib/money';
import { getSettings, pct, usd } from '@/lib/settings';

export async function generateMetadata() {
  const s = await getSettings();
  return { title: 'Pricing', description: `Pay per idea, from ${usd(s.minPriceCents)}. A ${pct(s.creatorFeeBps)} marketplace fee on what you use, refunded on unused budget. Researchers keep ${pct(10000 - s.creFeeBps)} of every unlock.` };
}

export default async function Pricing() {
  const s = await getSettings();
  // Worked example, computed with the same fee maths the database uses: 5 ideas at $8, 3 unlocked.
  const price = 800, ideas = 5, used = 3;
  const charge = briefCharge(price, ideas, s.creatorFeeBps);
  const split = unlockSplit(price, s.creFeeBps);
  const feeKept = feeCents(used * price, s.creatorFeeBps);
  const refund = (ideas - used) * price + (charge.fee - feeKept);
  const rows = [
    ['You post', `${ideas} ideas × ${formatMoney(price)} = ${formatMoney(charge.budget)} budget`],
    ['You pay today', `${formatMoney(charge.budget)} + ${formatMoney(charge.fee)} marketplace fee (${pct(s.creatorFeeBps)}) = ${formatMoney(charge.total)}`],
    [`You unlock ${used} ideas`, `Each researcher receives ${formatMoney(split.net)} (${formatMoney(price)} − ${pct(s.creFeeBps)} fee)`],
    ['The brief closes', `You get back ${formatMoney((ideas - used) * price)} unused budget + ${formatMoney(charge.fee - feeKept)} of the fee = ${formatMoney(refund)}`],
    ['Total spent', `${formatMoney(charge.total - refund)} for ${used} researched ideas`],
  ];
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
            <tr className="border-b border-line"><td className="p-3">Marketplace fee</td><td className="num p-3">{pct(s.creatorFeeBps)}</td><td className="p-3">Creator, added when funding a brief</td></tr>
            <tr><td className="p-3">Service fee</td><td className="num p-3">{pct(s.creFeeBps)}</td><td className="p-3">Researcher, taken from each unlock</td></tr>
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
        <p className="text-sm text-muted">Price per idea can be anywhere from {usd(s.minPriceCents)} to {usd(s.maxPriceCents)}. Most briefs pay $5–$15 per idea.</p>
      </div>
      <LinkButton href="/signup?as=creator" className="justify-self-start">Post a brief</LinkButton>
    </div>
  );
}
