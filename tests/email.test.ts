import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

const sent: { html: string; text: string }[] = [];
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example');
  vi.stubEnv('RESEND_API_KEY', 'test');
  vi.stubGlobal('fetch', async (_u: string, init: { body: string }) => { sent.push(JSON.parse(init.body)); return new Response('{}'); });
  sent.length = 0;
  vi.resetModules();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const buttonHref = (html: string) => html.match(/<a href="([^"]+)"[^>]*>Open /)?.[1];

describe('email button', () => {
  it('uses the site link, never a URL quoted from user text', async () => {
    const { sendEmail } = await import('../lib/email');
    await sendEmail('a@b.c', 'Problem', 'Their words:\n\n"verify at https://evil.example/login"\n\nReply here: https://app.example/disputes/1');
    expect(buttonHref(sent[0].html)).toBe('https://app.example/disputes/1');
  });
  it.each(['https://app.example.evil.com/login', 'https://app.example@evil.com/login'])('rejects the look-alike %s', async (bad) => {
    const { sendEmail } = await import('../lib/email');
    await sendEmail('a@b.c', 'Hi', `See ${bad}`);
    expect(buttonHref(sent[0].html)).toBeUndefined();
  });
  it('drops trailing punctuation from the button link', async () => {
    const { sendEmail } = await import('../lib/email');
    await sendEmail('a@b.c', 'Hi', 'Open your wallet (https://app.example/wallet).');
    expect(buttonHref(sent[0].html)).toBe('https://app.example/wallet');
  });
});

describe('quoteUserText', () => {
  it('removes every link form and keeps punctuation', async () => {
    const { quoteUserText } = await import('../lib/email');
    expect(quoteUserText('see https://x.co/a), www.evil.ph and evil-example.com/verify.')).toBe('see [link removed]), [link removed] and [link removed].');
  });
  it('leaves ordinary words and numbers alone', async () => {
    const { quoteUserText } = await import('../lib/email');
    expect(quoteUserText('Views were 1.2M not 900k, e.g. the hook.')).toBe('Views were 1.2M not 900k, e.g. the hook.');
  });
});
