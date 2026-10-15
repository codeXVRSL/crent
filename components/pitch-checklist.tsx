import { CheckCircle2 } from 'lucide-react';

/**
 * How a pitch is judged, in the researcher's words. The same list appears on the pitch form, the
 * public "For researchers" page and the help page, so nobody learns the rules from a rejection.
 */
export const PITCH_CHECKS: { title: string; body: string }[] = [
  { title: 'It is an outlier, not just a big video', body: 'Views well above what the channel usually gets: the brief says the minimum score. A small account that got 500k is a better find than a huge one that got its usual numbers.' },
  { title: 'It is recent', body: 'Inside the brief’s age limit, and the last 3 months are best. Older is fine only if people are still saving and sharing it.' },
  { title: 'The idea carried it, not the person', body: 'If the views came from the creator’s looks, fame or credentials, the idea won’t transfer. Pitch it only if you can say how it works without them, and write that in the adjustment note.' },
  { title: 'This creator can actually make it', body: 'Read their setup lines: face or faceless, gear, editing level, tone. Adapt the format in your instructions instead of pitching something they can’t film.' },
  { title: 'Nothing on the no list', body: 'No date predictions, speculation, unverified claims, skits or dancing unless the brief asks for them, and nothing that needs a crew or advanced editing.' },
  { title: 'Written so they can follow it tonight', body: 'Short sentences, to them as “you”. Exact hook text, what is on screen in the first 3 seconds, timings in seconds, the audio, and a CTA with the word “Follow”.' },
];

export function PitchChecklist({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={`grid gap-${compact ? '2' : '3'}`}>
      {PITCH_CHECKS.map((c) => (
        <li key={c.title} className="flex gap-2.5">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <span className={compact ? 'text-sm' : ''}><span className="font-medium">{c.title}.</span> <span className="text-muted">{c.body}</span></span>
        </li>
      ))}
    </ul>
  );
}
