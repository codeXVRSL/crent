export const metadata = { title: 'Help' };

const faq: [string, string][] = [
  ['What is an outlier score?', "The source video's views divided by the median views of that channel's recent videos. A 10× score means it did ten times better than that channel usually does, which suggests the idea, not the audience size, drove the result."],
  ['What do I get when I unlock an idea?', 'The link to the source video, the exact hook, why it worked, step-by-step filming instructions and notes on adapting it to your channel.'],
  ["What if the idea isn't what the card showed?", "Open a dispute from the unlocked idea within 72 hours. The researcher gets 48 hours to reply, then our team decides. If you're right, you get the money back."],
  ['When do I get refunded?', 'When your brief closes, either at the deadline or when you close it early, any budget you did not use is refunded along with its share of the marketplace fee. Card refunds usually take 5–10 business days.'],
  ['How are researchers verified?', 'Every researcher submits a government ID, a selfie, their address and mobile number, and at least three portfolio finds. Our team reviews each one before they can pitch.'],
  ["Why can't I share my email or phone number in chat?", 'Contact details are hidden so both sides keep escrow protection, reviews and dispute support. Work found on Outlier Desk must be paid through Outlier Desk.'],
  ['How and when do researchers get paid?', 'Earnings become available 72 hours after an unlock. Researchers can withdraw $10 or more to GCash, Maya or a Philippine bank account.'],
  ['Who owns the idea after I unlock it?', "Ideas themselves can't be owned under copyright. When you unlock, you get the right to use the researcher's written instructions for your own content. The researcher won't pitch the same source video to you again."],
];

export default function Help() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-14">
      <h1 className="text-4xl font-bold">Help</h1>
      <div className="grid gap-3">
        {faq.map(([q, a]) => (
          <details key={q} className="rounded-lg border border-line bg-surface p-4">
            <summary className="cursor-pointer font-semibold">{q}</summary>
            <p className="mt-2 text-muted">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
