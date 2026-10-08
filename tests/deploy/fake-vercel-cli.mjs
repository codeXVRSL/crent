#!/usr/bin/env node
// Stand-in for the Vercel CLI in the deploy dry run: records the call and behaves like `link` / `deploy`.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(process.env.FAKE_CLI_LOG, JSON.stringify(args) + '\n');
if (!args.includes('--token') || !args[args.indexOf('--token') + 1]) { console.error('no token'); process.exit(1); }
if (args[0] === 'link') { mkdirSync('.vercel', { recursive: true }); writeFileSync('.vercel/project.json', JSON.stringify({ projectId: 'prj_test', orgId: 'team_test' })); }
if (args[0] === 'deploy') console.log('https://crent-abc123.vercel.app');
