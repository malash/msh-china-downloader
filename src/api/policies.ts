import { fetchWithSign } from '../client.js';

export interface Policy {
  contYear: string;
  grpPlanCode: string;
  customID: string;
  insuredName: string;
  startDate: string;
  endDate: string;
  planTypeName: string;
  [key: string]: unknown;
}

export const getPolicies = async (customID: string, employeeId: string): Promise<Policy[]> => {
  const { success, result, msg } = await fetchWithSign<{
    success: string;
    result: Policy[];
    msg?: string;
  }>('/appwechat/more/separated/getPolicyList', {
    businessType: '',
    customID,
    employeeID: employeeId,
    sort: 'desc',
    statusList: [0, 1],
    usernameType: '01',
  });

  if (success !== 't') {
    throw new Error(`getPolicies failed: ${msg || success}`);
  }
  return result;
};
