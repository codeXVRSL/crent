import { avatarUrl, initials } from '@/lib/avatar';
import { cx } from './ui';

/** Round profile photo, or initials when there is no photo. */
export function Avatar({ path, name, size = 32, className }: { path?: string | null; name: string; size?: number; className?: string }) {
  const url = avatarUrl(path);
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} style={style} className={cx('shrink-0 rounded-full border border-line object-cover', className)} />;
  }
  return (
    <span aria-hidden="true" style={style}
      className={cx('grid shrink-0 place-items-center rounded-full border border-line bg-accent-soft font-semibold text-accent', className)}>
      {initials(name)}
    </span>
  );
}
