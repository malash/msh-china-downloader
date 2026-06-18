import { createHmac } from 'node:crypto';

const secret = process.env.SIGNATURE_SECRET;
if (!secret) {
  throw new Error('Missing SIGNATURE_SECRET environment variable (set it in .env)');
}

export const sign = (timestamp: string, nonce: string, body: string, query = '{}'): string =>
  createHmac('sha256', secret).update(`${timestamp}&${nonce}&${body}${query}`).digest('hex');
