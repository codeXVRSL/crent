import { describe, expect, it } from 'vitest';
import { initials, isValidAvatarPath } from '../lib/avatar';

const me = '00000000-0000-0000-0000-0000000000c1';
describe('avatar paths', () => {
  it('accepts photos in my own folder only', () => {
    expect(isValidAvatarPath(`${me}/avatar-abc.webp`, me)).toBe(true);
    expect(isValidAvatarPath(`00000000-0000-0000-0000-0000000000c2/avatar.png`, me)).toBe(false);
  });
  it('rejects unsafe names and types', () => {
    expect(isValidAvatarPath(`${me}/../x.png`, me)).toBe(false);
    expect(isValidAvatarPath(`${me}/a.gif`, me)).toBe(false);
    expect(isValidAvatarPath(`${me}/a.png/x`, me)).toBe(false);
    expect(isValidAvatarPath('', me)).toBe(false);
  });
  it('makes initials', () => {
    expect(initials('Maria Santos')).toBe('MS');
    expect(initials('jam')).toBe('J');
    expect(initials('  ')).toBe('?');
  });
});
