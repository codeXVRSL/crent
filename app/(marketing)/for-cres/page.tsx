import { LinkButton } from '@/components/ui';
export const metadata = { title: 'For researchers' };

export default function ForCres() {
  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-4 py-14">
      <div className="grid gap-3">
        <span className="label">For Content Research Experts</span>
        <h1 className="text-4xl font-bold">Get paid for the outliers you find.</h1>
        <p className="font-serif text-lg text-muted">Creators post briefs with the budget already paid in. You pitch proven videos with the proof visible and the idea locked. When they unlock it, you earn.</p>
      </div>
      <section className="grid gap-3">
        <h2 className="text-xl font-bold">How you get verified</h2>
        <ol className="grid list-decimal gap-2 pl-5 text-muted">
          <li>Create your public profile: headline, niches, platforms.</li>
          <li>Add at least 3 portfolio finds with the views and channel median, so creators can see your eye for outliers.</li>
          <li>Submit your ID, a selfie holding it, your address and mobile number. The Philippine Internet Transactions Act requires marketplaces to verify sellers. Only our team can see these details.</li>
          <li>We review within 2 business days. Once approved, you can pitch on any open brief.</li>
        </ol>
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-bold">How you get paid</h2>
        <ul className="grid gap-2 text-muted">
          <li>You keep 90% of each unlock. Example: an $8 unlock pays you $7.20.</li>
          <li>Earnings are on hold for 72 hours after an unlock, in case the creator reports a problem.</li>
          <li>Withdraw once you have $10 or more, to GCash, Maya or a Philippine bank account, in pesos.</li>
        </ul>
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Rules that protect you</h2>
        <ul className="grid gap-2 text-muted">
          <li>Creators can&apos;t see your source, hook or instructions until they pay.</li>
          <li>If another researcher already pitched the same video on a brief, the first pitch wins.</li>
          <li>Contact details are hidden in chat so deals stay protected by escrow and reviews.</li>
        </ul>
      </section>
      <LinkButton href="/signup?as=cre" className="justify-self-start">Apply as a researcher</LinkButton>
    </div>
  );
}
