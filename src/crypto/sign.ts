import { createHmac } from 'node:crypto';

export const sign = (timestamp: string, nonce: string, body: string, query = '{}'): string => {
  const secret = process.env.SIGNATURE_SECRET;
  if (!secret) {
    throw new Error('Missing SIGNATURE_SECRET environment variable (set it in .env)');
  }
  return createHmac('sha256', secret).update(`${timestamp}&${nonce}&${body}${query}`).digest('hex');
};
