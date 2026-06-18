import { randomUUID } from 'node:crypto';
import { fetchWithSign, negotiateSession, setToken } from '../http/client.js';
import { encryptJson, generateUuid } from '../crypto/cipher.js';

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
  return result;
};
