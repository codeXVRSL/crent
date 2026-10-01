// Creates demo accounts and sample data for testing: a creator, a verified researcher and an admin,
// one live brief with locked pitches waiting to be unlocked, and a researcher swipe file.
//
//   npm run seed:demo
//
// Reads NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from
// .env.local (or the environment). Safe to run twice: existing demo accounts get their password reset
// and sample data is only added once. Use on a local or test project only, never on production.
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error('Missing Supabase settings. Fill in .env.local first (see README, step 5).');
  process.exit(1);
}

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'OutlierDemo2026!';
const ACCOUNTS = {
  creator: { email: 'demo.creator@example.com', name: 'Carla Demo' },
  researcher: { email: 'demo.researcher@example.com', name: 'Jamaica Demo' },
  researcher2: { email: 'demo.researcher2@example.com', name: 'Rico Demo' },
  admin: { email: 'demo.admin@example.com', name: 'Admin Demo' },
};

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const must = (label) => ({ data, error }) => {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
};

async function ensureUser({ email, name }) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = data?.users.find((u) => u.email === email);
  if (found) {
    await admin.auth.admin.updateUserById(found.id, { password: DEMO_PASSWORD, email_confirm: true }).then(must(`reset ${email}`));
    return found.id;
  }
  const created = await admin.auth.admin.createUser({
    email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { display_name: name },
  }).then(must(`create ${email}`));
  return created.user.id;
}

/** A client signed in as the demo user, so every write goes through the app's real rules. */
async function as(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD }).then(must(`sign in ${email}`));
  return c;
}

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

async function main() {
  const ids = {};
  for (const [k, a] of Object.entries(ACCOUNTS)) ids[k] = await ensureUser(a);

  const { data: niches } = await admin.from('niches').select('id, slug');
  const niche = (slug) => niches.find((n) => n.slug === slug)?.id;
  if (!niche('personal-finance')) throw new Error('Niches are missing. Run supabase/seed.sql first.');

  // ---------- Roles and profiles (service role: the same thing an admin does by hand) ----------
  await admin.from('profiles').update({ role: 'admin' }).eq('id', ids.admin).then(must('admin role'));
  const { data: cp } = await admin.from('profiles').select('role').eq('id', ids.creator).single();
  if (!cp.role) await (await as(ACCOUNTS.creator.email)).rpc('set_initial_role', { p_role: 'creator' }).then(must('creator role'));
  await admin.from('profiles').update({ handle: 'carla_demo' }).eq('id', ids.creator).then(must('creator handle'));
  await admin.from('creator_profiles').update({
    brand_name: 'Carla Money', main_platform: 'tiktok', follower_band: '50k-200k', channel_url: 'https://www.tiktok.com/@carlamoney',
  }).eq('user_id', ids.creator).then(must('creator profile'));

  const researchers = [
    { key: 'researcher', handle: 'jamaica_demo', headline: 'Personal finance and side-hustle outlier finder', niches: ['personal-finance', 'side-hustles'] },
    { key: 'researcher2', handle: 'rico_demo', headline: 'Fitness and wellness short-form researcher', niches: ['fitness', 'health-wellness'] },
  ];
  for (const r of researchers) {
    const { data: p } = await admin.from('profiles').select('role').eq('id', ids[r.key]).single();
    const client = await as(ACCOUNTS[r.key].email);
    if (!p.role) await client.rpc('set_initial_role', { p_role: 'cre' }).then(must(`${r.key} role`));
    await admin.from('profiles').update({ handle: r.handle }).eq('id', ids[r.key]).then(must('handle'));
    await admin.from('cre_profiles').update({
      headline: r.headline, platforms: ['tiktok', 'instagram_reels', 'youtube_shorts'], years_experience: 3, accepting_work: true,
      bio: 'I spend every day finding short-form videos that beat their channel average by 5× or more, and turn them into filmable instructions.',
      kyc_status: 'approved', kyc_reviewed_at: new Date().toISOString(), kyc_reviewed_by: ids.admin,
    }).eq('user_id', ids[r.key]).then(must('cre profile'));
    for (const slug of r.niches) {
      await admin.from('cre_niches').upsert({ user_id: ids[r.key], niche_id: niche(slug) }, { ignoreDuplicates: true });
    }
    const { count } = await admin.from('portfolio_items').select('id', { count: 'exact', head: true }).eq('cre_id', ids[r.key]);
    if (!count) {
      await admin.from('portfolio_items').insert([1, 2, 3].map((i) => ({
        cre_id: ids[r.key], platform: 'tiktok', niche_id: niche(r.niches[0]), title: `Sample find ${i}: ${['Paycheck split', 'Myth bust', 'Street quiz'][i - 1]}`,
        source_url: `https://www.tiktok.com/@sample/video/74000000000000${r.key === 'researcher' ? 1 : 2}${i}`,
        source_views: [1300000, 820000, 2100000][i - 1], channel_median_views: [92000, 61000, 140000][i - 1],
        result_note: 'Example portfolio entry for testing.',
      }))).then(must('portfolio'));
    }
  }

  // ---------- Sample brief with locked pitches (only once) ----------
  const { count: briefCount } = await admin.from('briefs').select('id', { count: 'exact', head: true }).eq('creator_id', ids.creator);
  if (!briefCount) {
    const creator = await as(ACCOUNTS.creator.email);
    const briefId = await creator.rpc('create_brief', {
      p_title: '10 TikTok money ideas for young professionals',
      p_description: 'I make 30–45 second talking-head videos about money for people in their first jobs. I want proven ideas with a clear promise in the first line and something I can show on screen (an app, receipts, a spreadsheet).',
      p_platform: 'tiktok', p_niche_id: niche('personal-finance'),
      p_must_include: 'Face on camera. Filmable alone at home.', p_avoid: 'Crypto and stock picks.',
      p_example_urls: [], p_min_multiplier: 3, p_max_video_age_days: 180,
      p_price_per_idea_cents: 800, p_max_unlocks: 5,
      p_deadline_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    }).then(must('create brief'));
    const payment = await creator.rpc('prepare_brief_payment', { p_brief_id: briefId, p_provider: 'mock' }).then(must('payment'));
    await admin.rpc('mark_payment_paid', { p_external_id: payment.external_id, p_provider_ref: `demo_${briefId}`, p_amount_cents: payment.amount_cents, p_method: 'test_card' }).then(must('mark paid'));

    const cre = await as(ACCOUNTS.researcher.email);
    const pitches = [
      { format: 'Talking head + spreadsheet', hook_cat: 'number_list', teaser: 'A first-paycheck plan that splits money into three simple buckets', views: 1300000, median: 92000, hook: 'Here is exactly what I did with my first paycheck', id: 1 },
      { format: 'Green screen over bank app', hook_cat: 'myth_bust', teaser: 'Why the savings rule everyone repeats fails for entry-level pay', views: 820000, median: 61000, hook: 'Stop using the fifty thirty twenty rule', id: 2 },
      { format: 'Street quiz', hook_cat: 'question', teaser: 'Asking strangers one money question with surprising answers', views: 2100000, median: 140000, hook: 'How much is in your savings account right now', id: 3 },
    ];
    for (const p of pitches) {
      await cre.rpc('submit_pitch', {
        p_brief_id: briefId, p_platform: 'tiktok', p_format_label: p.format, p_duration_seconds: 40, p_hook_category: p.hook_cat,
        p_teaser: p.teaser, p_source_views: p.views, p_channel_median_views: p.median, p_source_posted_on: daysAgo(20 + p.id * 5),
        p_source_channel_size_band: '50k-200k', p_source_url: `https://www.tiktok.com/@sample/video/7500000000000000${p.id}`,
        p_source_channel_url: null, p_hook_text: p.hook,
        p_why_it_worked: 'A specific promise in the first line plus visible proof on screen in the first three seconds keeps people watching to the end.',
        p_instructions: `HOOK (0–3s): "${p.hook}"\n\nSHOT LIST:\n1. Face to camera, say the hook\n2. Cut to the screen recording\n3. Show the result\n\nCTA: Follow for part two.`,
        p_adaptation_notes: 'Use your own numbers. Keep it under 45 seconds.',
      }).then(must('pitch'));
    }

    await cre.from('swipe_items').insert({
      cre_id: ids.researcher, platform: 'tiktok', niche_id: niche('personal-finance'), title: 'Rent vs buy, whiteboard',
      source_url: 'https://www.tiktok.com/@sample/video/7600000000000000001', source_views: 950000, channel_median_views: 70000,
      source_posted_on: daysAgo(12), hook_category: 'bold_claim', notes: 'Whiteboard math, very saveable. Would suit creators talking to renters.',
    }).then(must('swipe item'));
  }

  console.log('\nDemo accounts ready. Password for all of them:', DEMO_PASSWORD);
  for (const [k, a] of Object.entries(ACCOUNTS)) console.log(`  ${k.padEnd(12)} ${a.email}`);
  console.log('\nThe creator has a live brief with 3 locked pitches from the researcher, ready to unlock.\n');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
