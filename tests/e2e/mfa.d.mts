import type { Page } from '@playwright/test';
export function totp(secret: string, at?: number): string;
export function enrollAdmin(page: Page, base?: string): Promise<string>;
export function passMfa(page: Page, secret: string): Promise<void>;
