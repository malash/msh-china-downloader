import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import Bluebird from 'bluebird';
import { login } from './auth/login.js';
import { checkSignatureSecret } from './auth/secret-check.js';
import { getPersons, RELATIONSHIP } from './api/persons.js';
import { getPolicies } from './api/policies.js';
import { getClaimList, type ClaimSummary } from './api/claim-list.js';
import { downloadClaim } from './download/claim.js';
import { renderIndex, sortClaims, type PersonGroup } from './download/index-page.js';
import { done, info, item, step } from './log.js';
import { sanitize } from './util.js';

const OUTPUT_DIR = fileURLToPath(new URL('../output/', import.meta.url));
const CLAIMS_DIR = join(OUTPUT_DIR, 'claims');

const account = process.env.MSH_ACCOUNT;
const password = process.env.MSH_PASSWORD;
if (!account || !password) {
  throw new Error('Missing MSH_ACCOUNT / MSH_PASSWORD environment variables (set them in .env)');
}

// Optional cap for testing, to avoid downloading everything. Empty = no limit.
const maxPerPerson = Number(process.env.MAX_CLAIMS_PER_PERSON) || Infinity;
// How many claims to download in parallel.
const concurrency = Number(process.env.CONCURRENCY) || 5;

const writeJson = (path: string, data: unknown) => writeFile(path, JSON.stringify(data, null, 2));

step('Checking SIGNATURE_SECRET against latest app.js');
await checkSignatureSecret(process.env.SIGNATURE_SECRET ?? '');

step('Logging in');
await login(account, password);
await mkdir(CLAIMS_DIR, { recursive: true });

const persons = await getPersons(account);
await writeJson(join(OUTPUT_DIR, 'persons.json'), persons);
done(`Logged in — ${persons.length} insured person(s) found`);

const groups: PersonGroup[] = [];

for (const [pi, person] of persons.entries()) {
  const name = person.insuredFullCName;
  const relationship = RELATIONSHIP[person.relationship] ?? person.relationship;
  step(`[${pi + 1}/${persons.length}] ${name} (${relationship})`);

  const personDir = join(CLAIMS_DIR, sanitize(person.insuredCName));
  await mkdir(personDir, { recursive: true });

  // Collect claims across every policy year, de-duplicated by claimNo.
  const policies = await getPolicies(person.customID, account);
  await writeJson(join(personDir, 'policies.json'), policies);
  info(`Policy years: ${policies.map(p => p.contYear).join(', ')}`);

  const byClaimNo = new Map<string, ClaimSummary>();
  await Bluebird.map(
    policies,
    async policy => {
      const claims = await getClaimList(person.customID, policy.grpPlanCode, policy.contYear);
      for (const c of claims) byClaimNo.set(c.claimNo, c);
      item(`${policy.contYear}: ${claims.length} claim(s)`);
    },
    { concurrency },
  );
  await writeJson(join(personDir, 'claims.json'), [...byClaimNo.values()]);

  const ordered = sortClaims([...byClaimNo.values()].map(summary => ({ summary, folder: '' })));
  const selected = ordered.slice(0, maxPerPerson);
  info(
    `${byClaimNo.size} unique claim(s), downloading ${selected.length} (concurrency ${concurrency})`,
  );

  let count = 0;
  const rows = await Bluebird.map(
    selected,
    async ({ summary }) => {
      const folder = await downloadClaim(summary, person.insuredCName, CLAIMS_DIR);
      item(`[${++count}/${selected.length}] ${summary.claimNo} (${summary.statusName})`);
      return { summary, folder };
    },
    { concurrency },
  );
  groups.push({ name, relationship, claims: rows });
}

step('Writing index.html');
const indexPath = join(OUTPUT_DIR, 'index.html');
await writeFile(indexPath, renderIndex(groups));

if (process.platform === 'darwin') {
  done(`Opening ${indexPath}`);
  spawn('open', [indexPath], { detached: true, stdio: 'ignore' }).unref();
} else {
  done(`Saved to ${indexPath}`);
}
