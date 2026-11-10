'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '@/lib/avatar';
import { setAvatar } from '@/app/actions/profile';
import { Button, Notice } from './ui';

export function AvatarUpload({ userId, hasPhoto }: { userId: string; hasPhoto: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'bad' | 'good'; text: string } | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    const ext = AVATAR_TYPES[file.type];
    if (!ext) return setMsg({ tone: 'bad', text: 'Use a JPG, PNG or WebP image.' });
    if (file.size > AVATAR_MAX_BYTES) return setMsg({ tone: 'bad', text: 'Use an image under 2 MB.' });
    setBusy(true);
    const path = `${userId}/avatar-${Date.now().toString(36)}.${ext}`;
    const { error } = await createBrowserSupabase().storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setBusy(false); return setMsg({ tone: 'bad', text: 'Upload failed. Try again.' }); }
    const res = await setAvatar(path);
    setBusy(false);
    setMsg({ tone: res.ok ? 'good' : 'bad', text: res.ok ? res.message ?? 'Photo updated.' : res.message });
    if (input.current) input.current.value = '';
    router.refresh();
  }

  async function onRemove() {
    setBusy(true);
    const res = await setAvatar(null);
    setBusy(false);
    setMsg({ tone: res.ok ? 'good' : 'bad', text: res.ok ? res.message ?? 'Photo removed.' : res.message });
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar-file"
        onChange={(e) => onFile(e.target.files?.[0])} disabled={busy} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} {hasPhoto ? 'Change photo' : 'Upload photo'}
        </Button>
        {hasPhoto && <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onRemove}>Remove</Button>}
      </div>
      <p className="text-xs text-muted">JPG, PNG or WebP, up to 2 MB. Shown on your public profile and in messages.</p>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}
