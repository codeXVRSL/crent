// Money helpers. Must match the SQL function fee_cents() exactly (integer bps, round half up).

export function feeCents(amountCents: number, bps: number): number {
  return Math.floor((amountCents * bps + 5000) / 10000);
}

export function briefCharge(pricePerIdeaCents: number, maxUnlocks: number, creatorFeeBps: number) {
  const budget = pricePerIdeaCents * maxUnlocks;
  const fee = feeCents(budget, creatorFeeBps);
  return { budget, fee, total: budget + fee };
}

export function unlockSplit(grossCents: number, creFeeBps: number) {
  const fee = feeCents(grossCents, creFeeBps);
  return { gross: grossCents, fee, net: grossCents - fee };
}

export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(currency === 'PHP' ? 'en-PH' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export { parseDollarsToCents } from './parse';
