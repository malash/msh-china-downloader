import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ensureLogin } from './auth/login.js';
import { getPersons, RELATIONSHIP } from './api/persons.js';
import { getPolicies } from './api/policies.js';
import { getClaimList, type ClaimSummary } from './api/claim-list.js';
import { downloadClaim } from './download/claim.js';
import { renderIndex, sortClaims, type PersonGroup } from './download/index-page.js';

const OUTPUT_DIR = fileURLToPath(new URL('../output/', import.meta.url));
const CLAIMS_DIR = join(OUTPUT_DIR, 'claims');

const username = process.env.USERNAME;
const password = process.env.PASSWORD;
if (!username || !password) {
  throw new Error('Missing USERNAME / PASSWORD environment variables (set them in .env)');
}

// Optional cap for testing, to avoid downloading everything. Empty = no limit.
const maxPerPerson = Number(process.env.MAX_CLAIMS_PER_PERSON) || Infinity;

const sanitize = (s: string): string => s.replace(/[/\\:*?"<>|\s]/g, '_');

const writeJson = (path: string, data: unknown) =>
  writeFile(path, JSON.stringify(data, null, 2));

console.log('Logging in...');
await ensureLogin(username, password);
await mkdir(CLAIMS_DIR, { recursive: true });

console.log('Fetching insured persons...');
const persons = await getPersons(username);
await writeJson(join(OUTPUT_DIR, 'persons.json'), persons);
console.log(`Found ${persons.length} person(s).`);

const groups: PersonGroup[] = [];

for (const [pi, person] of persons.entries()) {
  const name = person.insuredFullCName;
  const relationship = RELATIONSHIP[person.relationship] ?? person.relationship;
  console.log(`\n[${pi + 1}/${persons.length}] ${name} (${relationship})`);

  const personDir = join(CLAIMS_DIR, sanitize(person.insuredCName));
  await mkdir(personDir, { recursive: true });

  // Collect claims across every policy year, de-duplicated by claimNo.
  console.log('  Fetching policy years...');
  const policies = await getPolicies(person.customID, username);
  await writeJson(join(personDir, 'policies.json'), policies);
  console.log(`  ${policies.length} policy year(s): ${policies.map((p) => p.contYear).join(', ')}`);

  const byClaimNo = new Map<string, ClaimSummary>();
  for (const policy of policies) {
    const claims = await getClaimList(person.customID, policy.grpPlanCode, policy.contYear);
    for (const c of claims) byClaimNo.set(c.claimNo, c);
    console.log(`    year ${policy.contYear}: ${claims.length} claim(s)`);
  }
  await writeJson(join(personDir, 'claims.json'), [...byClaimNo.values()]);

  const ordered = sortClaims([...byClaimNo.values()].map((summary) => ({ summary, folder: '' })));
  const selected = ordered.slice(0, maxPerPerson);
  console.log(`  ${byClaimNo.size} unique claim(s), downloading ${selected.length}...`);

  const rows = [];
  for (const [ci, { summary }] of selected.entries()) {
    process.stdout.write(`    [${ci + 1}/${selected.length}] ${summary.claimNo} (${summary.statusName})... `);
    const folder = await downloadClaim(summary, person.insuredCName, CLAIMS_DIR);
    console.log('done');
    rows.push({ summary, folder });
  }
  groups.push({ name, relationship, claims: rows });
}

console.log('\nWriting index.html...');
await writeFile(join(OUTPUT_DIR, 'index.html'), renderIndex(groups));
console.log(`Done. Open ${join(OUTPUT_DIR, 'index.html')}`);
