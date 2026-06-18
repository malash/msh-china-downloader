import { randomUUID } from 'node:crypto';
import { fetchWithSign, negotiateSession, setToken } from '../http/client.js';
import { encryptJson, generateUuid } from '../crypto/cipher.js';
import { readToken, writeToken } from './token-store.js';

interface LoginResult {
  token: string;
  userName: string;
  virtualId: string;
  [key: string]: unknown;
}

export const login = async (account: string, password: string): Promise<LoginResult> => {
  const session = await negotiateSession(generateUuid());

  const securityData = encryptJson(session, {
    account,
    password,
    verifyCode: '',
    sign: '',
    openId: '',
    language: 'zh_cn',
    from: 'app',
    registrationID: '',
    appVersion: '',
    // random deviceName keeps this session from kicking out the browser's
    deviceName: randomUUID(),
  });

  const { success, result, msg } = await fetchWithSign<{
    success: string;
    result: LoginResult;
    msg: string;
  }>('/appwechat/separated/isolationLogin', {
    biologicalRecognitionType: '00',
    language: 'zh_cn',
    loginIdentifier: '01',
    loginType: '',
    securityData,
    source: 'MSH',
    state: '',
  });

  if (success !== 't') {
    throw new Error(`Login failed: ${msg || success}`);
  }

  setToken(result.token);
  await writeToken(result.token);
  return result;
};

export const checkLogin = async (account: string): Promise<boolean> => {
  const { success } = await fetchWithSign<{ success: string }>(
    '/appwechat/com/separated/getPersonalInfo',
    { employeeID: account, usernameType: '01' },
  );
  return success === 't';
};

export const ensureLogin = async (account: string, password: string): Promise<void> => {
  const cached = await readToken();
  if (cached) {
    setToken(cached);
    if (await checkLogin(account)) {
      return;
    }
  }
  await login(account, password);
};
