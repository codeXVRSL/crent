import { describe, expect, it } from 'vitest';
import { parseChatRequest, readReply, sameOrigin, CHAT_MAX_CHARS } from '../lib/chat';

describe('parseChatRequest', () => {
  it('accepts a normal message', () => {
    expect(parseChatRequest({ sessionId: 'abc12345-xyz', message: '  How much does it cost? ' }))
      .toEqual({ sessionId: 'abc12345-xyz', message: 'How much does it cost?' });
  });
  it('rejects bad sessions, empty and oversized messages', () => {
    expect(parseChatRequest({ sessionId: '../etc', message: 'hi' })).toBeNull();
    expect(parseChatRequest({ sessionId: 'abc12345', message: '   ' })).toBeNull();
    expect(parseChatRequest({ sessionId: 'abc12345', message: 'x'.repeat(CHAT_MAX_CHARS + 1) })).toBeNull();
    expect(parseChatRequest('nope')).toBeNull();
  });
  it('strips control characters', () => {
    expect(parseChatRequest({ sessionId: 'abc12345', message: 'hi\u0000\u0007 there' })?.message).toBe('hi there');
  });
});

describe('readReply and sameOrigin', () => {
  it('reads only a non-empty string reply, capped', () => {
    expect(readReply({ reply: ' Hello ' })).toBe('Hello');
    expect(readReply({ reply: 42 })).toBeNull();
    expect(readReply({ reply: 'x'.repeat(5000) })?.length).toBe(2000);
  });
  it('checks the request came from our own site', () => {
    expect(sameOrigin('https://outlierdesk.com', 'outlierdesk.com')).toBe(true);
    expect(sameOrigin('https://evil.example', 'outlierdesk.com')).toBe(false);
    expect(sameOrigin(null, 'outlierdesk.com')).toBe(false);
  });
});
