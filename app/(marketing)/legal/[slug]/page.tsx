import { notFound } from 'next/navigation';
import { Notice } from '@/components/ui';

// DRAFTS ONLY. Have a Philippine lawyer review every page before launch.
const DOCS: Record<string, { title: string; sections: [string, string][] }> = {
  terms: {
    title: 'Terms of Service',
    sections: [
      ['What Outlier Desk is', 'Outlier Desk is an online marketplace that connects content creators ("Creators") with Content Research Experts ("Researchers"). We provide the platform, payments through a licensed payment provider, and dispute handling. We are not a party to the research service between a Creator and a Researcher.'],
      ['Accounts', 'You must be at least 18 years old and give accurate information. Each account has one role: Creator or Researcher. You are responsible for activity on your account.'],
      ['Briefs and funding', 'A Creator funds a brief in advance. Funds are held by our payment provider until they are used for unlocks or refunded. Briefs are shown to Researchers only after payment is confirmed.'],
      ['Unlocks', 'Unlocking a pitch uses one idea from the brief budget and releases payment to the Researcher, subject to a 72-hour hold. Unlocks are final except through the dispute process.'],
      ['Fees', 'Creators pay a marketplace fee (currently 5%) when funding a brief. Researchers pay a service fee (currently 10%) on each unlock. Fee changes apply only to briefs created after the change.'],
      ['Staying on the platform', 'For 12 months after you first connect with another user through Outlier Desk, you agree to pay for research work with that user through Outlier Desk. Sharing contact details to move work off the platform may lead to suspension.'],
      ['Prohibited conduct', 'No false view counts or proof, no copying other Researchers’ locked content, no harassment, no illegal or adult niches, and no attempts to get around payments.'],
      ['Complaints', 'Under the Internet Transactions Act (RA 11967), you must first use our internal complaint process (Help page or support email). If your complaint is not resolved within 7 calendar days, you may go to the Department of Trade and Industry or the courts.'],
      ['Liability', 'The platform is provided as is. To the extent allowed by law, our total liability is limited to the fees we received from you in the 3 months before the claim.'],
      ['Governing law', 'These terms are governed by the laws of the Republic of the Philippines.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['Who we are', 'Outlier Desk is the personal information controller for data collected on this platform, under the Data Privacy Act of 2012 (RA 10173). Contact our Data Protection Officer at the support email listed in the footer.'],
      ['What we collect', 'Account data (name, email), profile data, briefs, pitches and messages, payment records, and for Researchers: legal name, birth date, address, mobile number, government ID images and a selfie.'],
      ['Why we collect it', 'To run the marketplace, process payments and payouts, prevent fraud, comply with the Internet Transactions Act seller-verification rules, and resolve disputes.'],
      ['Who can see verification data', 'Only the account owner and authorized Outlier Desk staff. ID images are stored in private storage and shown to staff through short-lived links.'],
      ['Service providers', 'Supabase (database and storage), Vercel (hosting), our payment provider, and our email provider. Some process data outside the Philippines under contracts that require protection of your data.'],
      ['How long we keep it', 'Verification data is kept for as long as required by law after your account closes, then deleted. Transaction records are kept for tax and accounting periods required by law.'],
      ['Your rights', 'You may request access, correction, deletion, or a copy of your data, and object to processing, by contacting us. You may also file a complaint with the National Privacy Commission.'],
    ],
  },
  refunds: {
    title: 'Refund Policy',
    sections: [
      ['Unused budget', 'When a brief closes, at its deadline or when you close it early, the unused budget and its share of the marketplace fee are refunded to your original payment method.'],
      ['Unlocked ideas', 'Unlocked ideas are not refundable except through a dispute.'],
      ['Disputes', 'You can open a dispute within 72 hours of an unlock if the source is gone, the stats were false, the idea does not match its card, instructions are missing, or it was copied. The Researcher has 48 hours to reply before our team decides.'],
      ['Timing', 'Card refunds usually appear within 5–10 business days, depending on your bank.'],
    ],
  },
  'cre-agreement': {
    title: 'Researcher Agreement',
    sections: [
      ['Independent contractor', 'You work as an independent contractor, not as an employee of Outlier Desk. You are responsible for your own taxes, including registration with the BIR where required.'],
      ['Truthful pitches', 'Views, channel medians and dates must be accurate at the time you pitch. Keep a screenshot as proof.'],
      ['License on unlock', 'When a Creator unlocks your pitch, you grant that Creator a non-exclusive, perpetual license to use your written instructions for their own content.'],
      ['Original write-ups', 'Your hooks, analysis and instructions must be your own work. Do not copy other Researchers’ write-ups.'],
      ['Verification', 'You consent to identity verification and to Outlier Desk keeping your verification data as described in the Privacy Policy.'],
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: DOCS[slug]?.title ?? 'Legal' };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) notFound();
  return (
    <article className="mx-auto grid max-w-3xl gap-6 px-4 py-14">
      <h1 className="text-[40px] font-semibold tracking-tight">{doc.title}</h1>
      <Notice>Draft for legal review. Not yet in effect.</Notice>
      {doc.sections.map(([h, body]) => (
        <section key={h} className="grid gap-2">
          <h2 className="text-lg font-semibold">{h}</h2>
          <p className="leading-relaxed text-ink-2">{body}</p>
        </section>
      ))}
    </article>
  );
}
