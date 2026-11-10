// Pure rate-limit rules (no server imports) so they can be unit tested.
export const LIMITS = {
  signIn:        { max: 10, windowSeconds: 600 },   // per IP + email
  signInIp:      { max: 30, windowSeconds: 600 },   // per IP
  signUp:        { max: 5,  windowSeconds: 3600 },  // per IP
  passwordReset: { max: 5,  windowSeconds: 3600 },  // per IP
  waitlist:      { max: 10, windowSeconds: 3600 },  // per IP
  message:       { max: 30, windowSeconds: 60 },    // per user
  pitch:         { max: 20, windowSeconds: 3600 },  // per user
  brief:         { max: 20, windowSeconds: 3600 },  // per user
  dispute:       { max: 10, windowSeconds: 3600 },  // per user
  feedback:      { max: 10, windowSeconds: 3600 },  // per user
  avatar:        { max: 10, windowSeconds: 3600 },  // per user
  chat:          { max: 20, windowSeconds: 600 },   // per IP, website chat assistant
  chatDaily:     { max: 150, windowSeconds: 86400 }, // per IP, so one visitor can't run up the AI bill
} as const;

export type LimitName = keyof typeof LIMITS;

export const TOO_MANY = 'Too many attempts. Wait a few minutes and try again.';

/** Builds a bounded key like "signIn:203.0.113.9". */
export function rateKey(name: LimitName, identity: string): string {
  return `${name}:${identity.trim().toLowerCase()}`.slice(0, 200);
}

/** First address in x-forwarded-for, else x-real-ip, else "unknown". */
export function firstIp(forwardedFor: string | null, realIp: string | null): string {
  const first = forwardedFor?.split(',')[0]?.trim();
  return first || realIp?.trim() || 'unknown';
}
