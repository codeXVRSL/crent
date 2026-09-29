import { Heart } from 'lucide-react';
import { toggleFavorite } from '@/app/actions/favorites';

/** Save or unsave a researcher. Server-rendered form, works without JavaScript. */
export function FavoriteButton({ creId, saved, back, compact }: { creId: string; saved: boolean; back: string; compact?: boolean }) {
  return (
    <form action={toggleFavorite}>
      <input type="hidden" name="cre_id" value={creId} />
      <input type="hidden" name="on" value={saved ? '0' : '1'} />
      <input type="hidden" name="back" value={back} />
      <button type="submit" aria-pressed={saved}
        className={`inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-2.5 text-[13px] font-medium transition-colors ${
          saved ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2'}`}>
        <Heart className={`size-3.5 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
        {compact ? <span className="sr-only">{saved ? 'Saved' : 'Save researcher'}</span> : saved ? 'Saved' : 'Save researcher'}
      </button>
    </form>
  );
}
