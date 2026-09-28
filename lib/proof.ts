import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Short-lived links for proof screenshots the viewer is allowed to see (storage policy decides). */
export async function signProofs(supabase: SupabaseClient, secrets: { pitch_id: string; proof_path?: string | null }[]) {
  const withProof = secrets.filter((s) => s.proof_path);
  const map = new Map<string, string>();
  if (!withProof.length) return map;
  const { data } = await supabase.storage.from('pitch-proof').createSignedUrls(withProof.map((s) => s.proof_path!), 600);
  (data ?? []).forEach((d, i) => { if (d.signedUrl) map.set(withProof[i].pitch_id, d.signedUrl); });
  return map;
}
