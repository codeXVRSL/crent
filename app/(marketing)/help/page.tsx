import { BRAND } from '@/lib/brand';
import { getSettings, holdHoursText, usd, type PublicSettings } from '@/lib/settings';
export const metadata = { title: 'Help and FAQ', description: 'How outlier scores, unlocks, refunds, disputes, verification and payouts work.' };

const faqFor = (s: PublicSettings): [string, string][] => [
  ['What is an outlier score?', "The source video's views divided by the median views of that channel's recent videos. A 10× score means it did ten times better than that channel usually does, which suggests the idea, not the audience size, drove the result."],
  ['What do I get when I unlock an idea?', 'The link to the source video, the exact hook, why it worked, step-by-step filming instructions and notes on adapting it to your channel.'],
  ["What if the idea isn't what the card showed?", `Open a dispute from the unlocked idea within ${holdHoursText(s.holdHours)}. The researcher gets 48 hours to reply, then our team decides. If you're right, you get the money back.`],
  ['When do I get refunded?', 'When your brief closes, either at the deadline or when you close it early, any budget you did not use is refunded along with its share of the marketplace fee. Card refunds usually take 5–10 business days.'],
  ['How are researchers verified?', 'Every researcher submits a government ID, a selfie, their address and mobile number, and at least three portfolio finds. Our team reviews each one before they can pitch.'],
  ["Why can't I share my email or phone number in chat?", `Contact details are hidden so both sides keep escrow protection, reviews and dispute support. Work found on ${BRAND} must be paid through ${BRAND}.`],
  ['How and when do researchers get paid?', `Earnings become available ${holdHoursText(s.holdHours)} after an unlock. Researchers can withdraw ${usd(s.minPayoutCents)} or more to GCash, Maya or a Philippine bank account.`],
  ['What is the idea board?', 'Every idea you unlock lands on your idea board. Move it from To do through Scripting and Filming to Posted, group ideas into batches, set film dates and keep private notes. After posting, log the views it got: the researcher sees only that result, never your link or notes, and it builds their public track record.'],
  ['Can I work with the same researcher again?', "Yes. Save any researcher from their profile or a pitch card, then invite them to a live brief from Saved researchers. They're notified even if the brief is outside their usual niches."],
  ['What is the swipe file?', "A private place for researchers to save outliers before there's a brief for them. When an open brief fits a saved find, it shows on the swipe file and the pitch form opens with the link, views and date already filled in."],
  ['What do the researcher levels mean?', 'New, Rising, Pro and Top rated are computed from public stats: unlocks, ratings, repeat buyers and the results creators logged. A researcher whose logged results average below the creator\'s usual views cannot pass Rising.'],
  ['Who can see my ID photos?', 'Only you and the verification team. ID photos are stored in private storage, shown through links that expire after five minutes, and are never shown to creators or other researchers.'],
  ['Do I pay tax on my earnings?', "Researchers are independent contractors and are responsible for their own taxes in the Philippines. We don't withhold tax from payouts at this time; download your earnings and payouts from Wallet (Download earnings and payouts) for your records."],
  ['How do I delete my account?', 'Settings → Close account. It works once any held earnings are paid out, any live brief is closed and refunded, and any open dispute is resolved. Your ID photos, payout details, saved items and profile are deleted straight away; payment records stay with the platform under an anonymised profile, as the Privacy Policy describes.'],
  ['Who owns the idea after I unlock it?', "Ideas themselves can't be owned under copyright. When you unlock, you get the right to use the researcher's written instructions for your own content. The researcher won't pitch the same source video to you again."],
];

export default async function Help() {
  const faq = faqFor(await getSettings());
  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-14">
      <h1 className="text-[40px] font-semibold tracking-tight">Help</h1>
      <div className="grid gap-3">
        {faq.map(([q, a]) => (
          <details key={q} className="rounded-2xl border border-line bg-surface shadow-sm p-4">
            <summary className="cursor-pointer font-semibold">{q}</summary>
            <p className="mt-2 text-muted">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
