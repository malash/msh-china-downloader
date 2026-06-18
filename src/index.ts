import { ensureLogin } from './auth/login.js';
import { getClaimDetail } from './api/claim.js';

const username = process.env.USERNAME;
const password = process.env.PASSWORD;
if (!username || !password) {
  throw new Error('Missing USERNAME / PASSWORD environment variables (set them in .env)');
}

try {
  await ensureLogin(username, password);

  const detail = await getClaimDetail('fZHC4jLa7HoccW5MDEYjmg==', 'aq79em/YqWnafq+HFAQInw==');
  console.log(JSON.stringify(detail, null, 2));
} catch (error) {
  console.error(error);
}
