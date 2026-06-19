import { fetchWithSign } from '../client.js';

export interface ClaimSummary {
  claimNo: string;
  employeeId: string;
  insuredName: string;
  hChineseName: string;
  startDate: string;
  endDate: string;
  status: string;
  statusName: string;
  payAmount: string;
  currency: string;
  invoiceAmount: string;
  invoiceCurrency: string;
  customID: string;
  [key: string]: unknown;
}

const PAGE_SIZE = 50;

export const getClaimList = async (
  customID: string,
  grpPlanCode: string,
  contYear: string,
): Promise<ClaimSummary[]> => {
  const claims: ClaimSummary[] = [];
  for (let pages = 1; ; pages++) {
    const { success, result, msg } = await fetchWithSign<{
      success: string;
      result: ClaimSummary[];
      msg?: string;
    }>('/appwechat/claim/separated/getClaimList', {
      claimNo: '',
      contYear,
      customID,
      grpPlanCode,
      loginBusinessType: '',
      pageSize: PAGE_SIZE,
      pages,
      status: '1,2,3,4,5',
    });

    if (success !== 't') {
      throw new Error(`getClaimList failed: ${msg || success}`);
    }
    claims.push(...result);
    if (result.length < PAGE_SIZE) break;
  }
  return claims;
};
