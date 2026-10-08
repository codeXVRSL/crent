export type Currency = 'USD' | 'PHP';

export type PaymentEvent = {
  eventId: string;
  type: 'payment.paid' | 'payment.failed' | 'payment.expired' | 'refund.succeeded' | 'refund.failed'
      | 'payout.succeeded' | 'payout.failed' | 'ignored';
  /** Our id: payments.external_id, refunds.id or payouts.id */
  reference?: string;
  providerRef?: string;
  amountCents?: number;
  method?: string;
  failure?: string;
  raw: unknown;
};

export interface PaymentProvider {
  name: 'mock' | 'xendit';

  createCheckout(input: {
    paymentId: string;
    externalId: string;
    amountCents: number;
    currency: Currency;
    description: string;
    payerEmail: string;
    successUrl: string;
    failureUrl: string;
  }): Promise<{ providerRef: string; checkoutUrl: string }>;

  /** Must throw if the request is not authentic. */
  parseWebhook(req: Request): Promise<PaymentEvent>;

  refund(input: {
    refundId: string;
    paymentProviderRef: string;
    amountCents: number;
    currency: Currency;
  }): Promise<{ status: 'succeeded' | 'pending' | 'unsupported' | 'failed'; providerRef?: string; failure?: string }>;

  payout(input: {
    /** Increases each time an admin approves the payout, so a retry is a new transfer at the provider. */
    attempt?: number;
    payoutId: string;
    amountCents: number; // in the destination currency
    currency: Currency;
    destination: { kind: 'gcash' | 'maya' | 'bank'; bankCode?: string | null; accountName: string; accountNumber: string };
  }): Promise<{ status: 'succeeded' | 'pending' | 'failed'; providerRef?: string; failure?: string }>;
}
